import { describe, expect, it } from "vitest";
import { InvariantViolation, MonitoredAsset, type AssetFacts, type ItemFacts } from "./monitored-asset";

const NOW = new Date("2026-08-21T00:00:00Z");
const asset: AssetFacts = {
  id: "a1",
  name: "srv-web-01",
  component: "nginx",
  version: "1.18.0",
  exposure: "isolated",
  criticality: "low",
};

const item = (id: string, cvss: number, status: ItemFacts["status"] = "open"): ItemFacts => ({
  id,
  identifier: `CVE-2026-${id}`,
  cvss,
  status,
  openedAt: new Date("2026-08-01T00:00:00Z"),
});

describe("niezmiennik: zmiana ekspozycji przelicza wszystkie otwarte pozycje", () => {
  it("podnosi priorytet każdej otwartej pozycji, nie tylko przeglądanej", () => {
    const before = MonitoredAsset.from(asset, [item("1000", 9.8), item("2000", 5.0), item("3000", 2.0)], NOW);
    const after = before.withExposure("public");

    expect(after.openItems).toHaveLength(3);
    for (const [index, item] of after.openItems.entries()) {
      expect(item.assessment.score).toBeGreaterThan(before.openItems[index].assessment.score);
    }
  });

  it("nie rusza pozycji już rozstrzygniętych", () => {
    const before = MonitoredAsset.from(asset, [item("1000", 9.8, "patched"), item("2000", 9.8, "rejected")], NOW);
    const after = before.withExposure("public");

    expect(after.resolvedItems.map((i) => i.assessment.score)).toEqual(
      before.resolvedItems.map((i) => i.assessment.score),
    );
  });

  it("przelicza także termin, nie tylko wynik", () => {
    const before = MonitoredAsset.from(asset, [item("1000", 9.8)], NOW);
    expect(before.openItems[0].deadline).toBeNull(); // klasa niska — bez terminu

    const after = before.withExposure("public");
    expect(after.openItems[0].deadline).not.toBeNull();
  });

  it("zmiana krytyczności działa tak samo", () => {
    const before = MonitoredAsset.from(
      { ...asset, exposure: "public" },
      [item("1000", 6.0), item("2000", 6.0, "patched")],
      NOW,
    );
    const after = before.withCriticality("high");

    expect(after.openItems[0].assessment.score).toBeGreaterThan(before.openItems[0].assessment.score);
    expect(after.resolvedItems[0].assessment.score).toBe(before.resolvedItems[0].assessment.score);
  });

  it("ustawienie tej samej ekspozycji niczego nie zmienia", () => {
    const before = MonitoredAsset.from(asset, [item("1000", 9.8)], NOW);
    expect(before.withExposure("isolated")).toBe(before);
  });

  it("nie zmienia całości w miejscu — poprzedni obraz zostaje nietknięty", () => {
    const before = MonitoredAsset.from(asset, [item("1000", 9.8)], NOW);
    const scoreBefore = before.openItems[0].assessment.score;
    before.withExposure("public");
    expect(before.openItems[0].assessment.score).toBe(scoreBefore);
    expect(before.facts.exposure).toBe("isolated");
  });
});

describe("niezmiennik: zasobu z otwartymi pozycjami nie wolno usunąć", () => {
  it("odmawia i wymienia pozycje blokujące, posortowane", () => {
    const monitored = MonitoredAsset.from(
      asset,
      [item("2000", 5.0), item("1000", 9.8), item("3000", 1.0, "patched")],
      NOW,
    );
    const objection = monitored.removalObjection();

    expect(objection).toContain("CVE-2026-1000");
    expect(objection).toContain("CVE-2026-2000");
    expect(objection).not.toContain("CVE-2026-3000");
    expect(objection).toContain("(2)");
  });

  it("pozwala usunąć zasób, którego wszystkie pozycje są rozstrzygnięte", () => {
    const monitored = MonitoredAsset.from(asset, [item("1000", 9.8, "patched"), item("2000", 5.0, "rejected")], NOW);
    expect(monitored.removalObjection()).toBeNull();
    expect(() => {
      monitored.assertRemovable();
    }).not.toThrow();
  });

  it("pozwala usunąć zasób bez żadnych pozycji", () => {
    expect(MonitoredAsset.from(asset, [], NOW).removalObjection()).toBeNull();
  });

  it("rzuca wyjątkiem, gdy ktoś zignoruje odmowę", () => {
    const monitored = MonitoredAsset.from(asset, [item("1000", 9.8)], NOW);
    expect(() => {
      monitored.assertRemovable();
    }).toThrow(InvariantViolation);
  });
});

describe("niezmiennik nadrzędny z PRD zachowany na poziomie całości", () => {
  it("ta sama podatność nigdy nie stoi niżej po zwiększeniu ekspozycji", () => {
    for (const cvss of [0, 2.5, 5, 7.9, 10]) {
      const isolated = MonitoredAsset.from(asset, [item("1000", cvss)], NOW);
      const internal = isolated.withExposure("internal");
      const publicFacing = isolated.withExposure("public");

      expect(internal.openItems[0].assessment.score).toBeGreaterThanOrEqual(isolated.openItems[0].assessment.score);
      expect(publicFacing.openItems[0].assessment.score).toBeGreaterThanOrEqual(internal.openItems[0].assessment.score);
    }
  });
});
