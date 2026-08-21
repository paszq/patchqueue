/**
 * Kontrakt wejścia z zewnętrznych źródeł.
 *
 * `ImportedFinding` jest jedynym kształtem, w jakim dane z obcych źródeł wchodzą do
 * aplikacji. Raporty skanerów, biuletyny i wklejone listy mają różne formaty, różne
 * nazwy kolumn i różne konwencje zapisu oceny — ale za tą granicą nikt się o tym nie
 * dowiaduje. To jest cały sens tej warstwy: obce kształty nie przeciekają do modelu.
 *
 * Moduł jest czysty — bez bazy, bez HTTP, bez zegara. Cała warstwa parsowania daje się
 * przez to testować tabelą przypadków, a nie przez klikanie w interfejsie.
 */

export const SOURCE_FORMATS = ["scanner-csv", "bulletin", "cve-list"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export const SOURCE_LABEL: Record<SourceFormat, string> = {
  "scanner-csv": "raport skanera (CSV)",
  bulletin: "biuletyn bezpieczeństwa",
  "cve-list": "lista identyfikatorów",
};

/** Pojedyncze znalezisko przetłumaczone na kształt zrozumiały dla aplikacji. */
export interface ImportedFinding {
  identifier: string;
  /** `null`, gdy źródło oceny nie podaje — użytkownik uzupełnia ją sam. */
  cvss: number | null;
  /** Nazwa komponentu, jeśli źródło ją zna. Służy do dopasowania do zasobu. */
  component: string | null;
  version: string | null;
  description: string;
}

/** Wiersz, którego nie udało się przetłumaczyć — z powodem, nie po cichu. */
export interface RejectedLine {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  format: SourceFormat;
  findings: ImportedFinding[];
  rejected: RejectedLine[];
}

/**
 * Port. Każde źródło dostaje własny adapter implementujący ten interfejs; reszta
 * aplikacji zna wyłącznie ten kontrakt i nie wie, ile formatów istnieje.
 */
export interface SourceAdapter {
  readonly format: SourceFormat;
  /** Czy ten adapter rozpoznaje podany tekst jako swój. */
  recognizes(raw: string): boolean;
  parse(raw: string): ParseResult;
}

export const CVE_PATTERN = /\b(CVE-\d{4}-\d{4,7})\b/i;

/** Ocena CVSS bywa zapisywana przecinkiem albo z sufiksem — normalizujemy tutaj. */
export function parseCvss(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  // Minus musi zostać wykryty przed czyszczeniem — inaczej "-1" stałoby się "1".
  if (trimmed.startsWith("-")) return null;
  const cleaned = trimmed.replace(",", ".").replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) return null;
  return Math.round(parsed * 10) / 10;
}

export function normalizeIdentifier(raw: string): string | null {
  const match = CVE_PATTERN.exec(raw);
  return match === null ? null : match[1].toUpperCase();
}
