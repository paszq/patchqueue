/**
 * Adaptery źródeł — jedyne miejsce w aplikacji, które wie, jak wyglądają cudze dane.
 *
 * Każdy adapter tłumaczy jeden obcy format na `ImportedFinding`. Poza tym plikiem nikt
 * nie wie, że raport skanera ma kolumny, że biuletyn ma myślniki, ani że lista bywa
 * gołymi identyfikatorami. Dodanie kolejnego źródła to dopisanie adaptera i wpisanie go
 * do rejestru — bez dotykania warstwy danych, punktów końcowych i widoku.
 */
import {
  normalizeIdentifier,
  parseCvss,
  type ImportedFinding,
  type ParseResult,
  type RejectedLine,
  type SourceAdapter,
} from "./finding";

/** Pusta komórka w obcym źródle znaczy „nie wiem", a nie „pusty tekst". */
function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function usefulLines(raw: string): { line: number; text: string }[] {
  return raw
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter((entry) => entry.text !== "" && !entry.text.startsWith("#"));
}

// ---------------------------------------------------------------------------
// Raport skanera w formacie CSV
// ---------------------------------------------------------------------------

// Partial, bo nagłówek może zawierać kolumny, których nie znamy — wtedy klucz nie istnieje.
const CSV_ALIASES: Partial<Record<string, keyof ImportedFinding>> = {
  cve: "identifier",
  "cve id": "identifier",
  id: "identifier",
  identyfikator: "identifier",
  cvss: "cvss",
  "cvss score": "cvss",
  score: "cvss",
  ocena: "cvss",
  component: "component",
  package: "component",
  produkt: "component",
  komponent: "component",
  version: "version",
  wersja: "version",
  description: "description",
  summary: "description",
  title: "description",
  opis: "description",
};

/**
 * Separator ustalany raz, na podstawie nagłówka, i używany do wszystkich wierszy.
 * Wykrywanie go osobno w każdym wierszu zawodziło, gdy dane rozdzielone średnikami
 * zawierały przecinek w ocenie ("9,8") — wiersz był wtedy dzielony inaczej niż nagłówek.
 */
function detectSeparator(headerLine: string): string {
  return headerLine.includes(";") && !headerLine.includes(",") ? ";" : ",";
}

function splitCsvLine(line: string, separator: string): string[] {
  return line.split(separator).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
}

const scannerCsv: SourceAdapter = {
  format: "scanner-csv",

  recognizes(raw) {
    const lines = usefulLines(raw);
    if (lines.length === 0) return false;
    const first = lines[0];
    const header = splitCsvLine(first.text, detectSeparator(first.text)).map((cell) => cell.toLowerCase());
    return header.length >= 2 && header.some((cell) => CSV_ALIASES[cell] === "identifier");
  },

  parse(raw) {
    const lines = usefulLines(raw);
    const findings: ImportedFinding[] = [];
    const rejected: RejectedLine[] = [];

    if (lines.length === 0) {
      return { format: "scanner-csv", findings, rejected };
    }
    const [headerLine, ...rows] = lines;

    const separator = detectSeparator(headerLine.text);
    const columns = splitCsvLine(headerLine.text, separator).map((cell) => CSV_ALIASES[cell.toLowerCase()] ?? null);

    for (const row of rows) {
      const cells = splitCsvLine(row.text, separator);
      // Partial, bo wiersz może nie mieć wszystkich kolumn — inaczej typy udawałyby pewność, której nie ma.
      const picked: Partial<Record<string, string>> = {};
      columns.forEach((field, index) => {
        if (field !== null && index < cells.length) picked[field] = cells[index];
      });

      const identifier = normalizeIdentifier(picked.identifier ?? "");
      if (identifier === null) {
        rejected.push({ line: row.line, raw: row.text, reason: "brak poprawnego identyfikatora CVE" });
        continue;
      }

      findings.push({
        identifier,
        cvss: parseCvss(picked.cvss),
        component: blankToNull(picked.component),
        version: blankToNull(picked.version),
        description: picked.description?.trim() ?? "",
      });
    }

    return { format: "scanner-csv", findings, rejected };
  },
};

// ---------------------------------------------------------------------------
// Biuletyn bezpieczeństwa — tekst ciągły, jedna pozycja w linii
// ---------------------------------------------------------------------------

/**
 * Nazwane grupy są w typach zadeklarowane jako obecne, a w czasie wykonania grupa
 * opcjonalna jest `undefined`. Ten typ przywraca zgodność między jednym a drugim.
 */
interface BulletinGroups {
  id?: string;
  cvss?: string;
  rest?: string;
}

/** np. "CVE-2026-1234 (CVSS 9.8) — nginx 1.18.0 — przepełnienie bufora" */
const BULLETIN_LINE =
  /^(?<id>CVE-\d{4}-\d{4,7})\s*(?:\((?:CVSS[:\s]*)?(?<cvss>[\d.,]+)\))?\s*(?:[—–-]\s*(?<rest>.*))?$/i;

const bulletin: SourceAdapter = {
  format: "bulletin",

  recognizes(raw) {
    const lines = usefulLines(raw);
    if (lines.length === 0) return false;
    // Sam identyfikator zawiera myślniki, więc separatora szukamy dopiero po nim —
    // inaczej goła lista identyfikatorów byłaby brana za biuletyn.
    const matching = lines.filter((entry) => {
      const groups = BULLETIN_LINE.exec(entry.text)?.groups as BulletinGroups | undefined;
      if (groups === undefined) return false;
      return (groups.cvss ?? "") !== "" || (groups.rest ?? "").trim() !== "";
    });
    return matching.length > 0;
  },

  parse(raw) {
    const findings: ImportedFinding[] = [];
    const rejected: RejectedLine[] = [];

    for (const entry of usefulLines(raw)) {
      const match = BULLETIN_LINE.exec(entry.text);
      const groups = match?.groups as BulletinGroups | undefined;
      if (groups === undefined) {
        rejected.push({ line: entry.line, raw: entry.text, reason: "wiersz nie pasuje do formatu biuletynu" });
        continue;
      }

      const rest = (groups.rest ?? "").trim();
      // Część po ocenie bywa "komponent wersja — opis"; rozdzielamy po pierwszym myślniku.
      const [componentPart, ...descriptionParts] = rest.split(/\s+[—–-]\s+/);
      const componentTokens = componentPart.trim().split(/\s+/);
      const looksVersioned = componentTokens.length >= 2 && /^\d/.test(componentTokens[componentTokens.length - 1]);

      findings.push({
        identifier: (groups.id ?? "").toUpperCase(),
        cvss: parseCvss(groups.cvss),
        component: componentTokens[0] || null,
        version: looksVersioned ? componentTokens[componentTokens.length - 1] : null,
        description: descriptionParts.join(" — ").trim(),
      });
    }

    return { format: "bulletin", findings, rejected };
  },
};

// ---------------------------------------------------------------------------
// Goła lista identyfikatorów
// ---------------------------------------------------------------------------

const cveList: SourceAdapter = {
  format: "cve-list",

  recognizes(raw) {
    const lines = usefulLines(raw);
    if (lines.length === 0) return false;
    return lines.every((entry) => /^CVE-\d{4}-\d{4,7}$/i.test(entry.text));
  },

  parse(raw) {
    const findings: ImportedFinding[] = [];
    const rejected: RejectedLine[] = [];

    for (const entry of usefulLines(raw)) {
      const identifier = normalizeIdentifier(entry.text);
      if (identifier === null) {
        rejected.push({ line: entry.line, raw: entry.text, reason: "brak poprawnego identyfikatora CVE" });
        continue;
      }
      findings.push({ identifier, cvss: null, component: null, version: null, description: "" });
    }

    return { format: "cve-list", findings, rejected };
  },
};

/** Kolejność ma znaczenie: od najbardziej rozpoznawalnego formatu do najogólniejszego. */
export const ADAPTERS: readonly SourceAdapter[] = [scannerCsv, bulletin, cveList];

export function adapterFor(format: ParseResult["format"]): SourceAdapter {
  const found = ADAPTERS.find((adapter) => adapter.format === format);
  if (found === undefined) throw new Error(`Nieznany format źródła: ${format}`);
  return found;
}

/** Rozpoznanie formatu bez pytania użytkownika; `null`, gdy żaden adapter nie przyznaje się do tekstu. */
export function detectAdapter(raw: string): SourceAdapter | null {
  return ADAPTERS.find((adapter) => adapter.recognizes(raw)) ?? null;
}
