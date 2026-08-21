import { describe, expect, it } from "vitest";
import { ADAPTERS, adapterFor, detectAdapter } from "./adapters";
import { parseCvss, normalizeIdentifier } from "./finding";

describe("rozpoznawanie formatu źródła", () => {
  it("rozpoznaje raport skanera po nagłówku kolumn", () => {
    const raw = "CVE,Component,Version,CVSS\nCVE-2026-1111,nginx,1.18.0,9.8";
    expect(detectAdapter(raw)?.format).toBe("scanner-csv");
  });

  it("rozpoznaje raport skanera niezależnie od języka i kolejności kolumn", () => {
    const raw = "Wersja;Komponent;Ocena;Identyfikator\n1.18.0;nginx;9,8;CVE-2026-1111";
    expect(detectAdapter(raw)?.format).toBe("scanner-csv");
  });

  it("rozpoznaje biuletyn po strukturze wiersza", () => {
    expect(detectAdapter("CVE-2026-1111 (CVSS 9.8) — nginx 1.18.0 — przepełnienie bufora")?.format).toBe("bulletin");
  });

  it("rozpoznaje gołą listę identyfikatorów", () => {
    expect(detectAdapter("CVE-2026-1111\nCVE-2026-2222")?.format).toBe("cve-list");
  });

  it("nie zgaduje przy tekście, którego żaden adapter nie zna", () => {
    expect(detectAdapter("zupełnie przypadkowy tekst bez struktury")).toBeNull();
  });

  it("każdy adapter deklaruje własny format i da się go pobrać po nazwie", () => {
    for (const adapter of ADAPTERS) {
      expect(adapterFor(adapter.format)).toBe(adapter);
    }
  });
});

describe("raport skanera (CSV)", () => {
  it("tłumaczy wiersze niezależnie od kolejności i nazw kolumn", () => {
    const raw = ["Wersja;Komponent;Ocena;Identyfikator", "1.18.0;nginx;9,8;CVE-2026-1111"].join("\n");
    const { findings, rejected } = adapterFor("scanner-csv").parse(raw);

    expect(rejected).toHaveLength(0);
    expect(findings[0]).toEqual({
      identifier: "CVE-2026-1111",
      cvss: 9.8,
      component: "nginx",
      version: "1.18.0",
      description: "",
    });
  });

  it("odrzuca wiersz bez identyfikatora, podając powód i numer linii", () => {
    const raw = ["CVE,Component,CVSS", "CVE-2026-1111,nginx,9.8", "coś-nie-tak,openssl,7.5"].join("\n");
    const { findings, rejected } = adapterFor("scanner-csv").parse(raw);

    expect(findings).toHaveLength(1);
    expect(rejected).toEqual([
      { line: 3, raw: "coś-nie-tak,openssl,7.5", reason: "brak poprawnego identyfikatora CVE" },
    ]);
  });

  it("pomija komentarze i puste wiersze", () => {
    const raw = ["# raport z 2026-08-21", "", "CVE,CVSS", "CVE-2026-1111,9.8", ""].join("\n");
    const { findings, rejected } = adapterFor("scanner-csv").parse(raw);
    expect(findings).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("zdejmuje cudzysłowy i nadmiarowe spacje", () => {
    const raw = ["CVE, Description", 'CVE-2026-1111, "  opis w cudzysłowie  "'].join("\n");
    expect(adapterFor("scanner-csv").parse(raw).findings[0].description).toBe("opis w cudzysłowie");
  });
});

describe("biuletyn bezpieczeństwa", () => {
  it("rozdziela identyfikator, ocenę, komponent z wersją i opis", () => {
    const raw = "CVE-2026-1234 (CVSS 9.8) — nginx 1.18.0 — przepełnienie bufora w obsłudze nagłówka";
    const { findings } = adapterFor("bulletin").parse(raw);

    expect(findings[0]).toEqual({
      identifier: "CVE-2026-1234",
      cvss: 9.8,
      component: "nginx",
      version: "1.18.0",
      description: "przepełnienie bufora w obsłudze nagłówka",
    });
  });

  it("radzi sobie z pozycją bez oceny i bez opisu", () => {
    const { findings } = adapterFor("bulletin").parse("CVE-2026-5555 — openssl");
    expect(findings[0].cvss).toBeNull();
    expect(findings[0].component).toBe("openssl");
    expect(findings[0].version).toBeNull();
  });

  it("odrzuca wiersz, którego nie rozumie, zamiast zgadywać", () => {
    const { findings, rejected } = adapterFor("bulletin").parse("CVE-2026-1234 (9.8) — nginx\nzwykłe zdanie o niczym");
    expect(findings).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].line).toBe(2);
  });
});

describe("lista identyfikatorów", () => {
  it("przyjmuje same identyfikatory i zostawia ocenę do uzupełnienia", () => {
    const { findings } = adapterFor("cve-list").parse("CVE-2026-1111\ncve-2026-2222");
    expect(findings.map((f) => f.identifier)).toEqual(["CVE-2026-1111", "CVE-2026-2222"]);
    expect(findings.every((f) => f.cvss === null)).toBe(true);
  });
});

describe("normalizacja wartości z obcych źródeł", () => {
  it.each([
    ["9.8", 9.8],
    ["9,8", 9.8],
    ["CVSS 7.5", 7.5],
    ["  6.1  ", 6.1],
    ["10", 10],
    ["0", 0],
  ])("przyjmuje ocenę zapisaną jako %s", (input, expected) => {
    expect(parseCvss(input)).toBe(expected);
  });

  it.each(["", "   ", "brak", "11.0", "-1", null, undefined])("odrzuca ocenę %s", (input) => {
    expect(parseCvss(input)).toBeNull();
  });

  it("podnosi identyfikator do wielkich liter i wycina go z otoczenia", () => {
    expect(normalizeIdentifier("dotyczy cve-2026-1111 w wersji 1.2")).toBe("CVE-2026-1111");
    expect(normalizeIdentifier("bez identyfikatora")).toBeNull();
  });
});
