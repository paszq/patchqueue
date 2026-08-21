/**
 * Agregat: zasób wraz ze swoimi pozycjami.
 *
 * Dokumenty konsekwentnie mówią o zasobie jako o całości — zmiana zasobu wpływa na
 * wszystkie jego otwarte pozycje, a usunięcie zasobu zależy od ich stanu. Kod trzymał
 * jednak trzy niezależne tabele i trzy niezależne moduły, a niezmienniki tej całości
 * były egzekwowane wyłącznie w bazie (patrz `context/domain/01-domain-distillation.md`).
 *
 * To działało, ale oznaczało, że wiedza domenowa mieszkała poza kodem domenowym — tam,
 * gdzie nie sięga ani analiza statyczna, ani testy jednostkowe. Ten moduł sprowadza ją
 * z powrotem, nie zabierając bazie roli ostatecznego strażnika: wyzwalacze zostają,
 * bo chronią także przed zapisem z pominięciem aplikacji.
 *
 * Moduł jest czysty: bez bazy, bez HTTP, bez zegara poza jawnie przekazanym.
 */
import {
  assessPriority,
  deadlineFor,
  overdueState,
  type Criticality,
  type Exposure,
  type PriorityBreakdown,
} from "./priority";

export type ItemStatus = "open" | "patched" | "rejected";

export interface AssetFacts {
  id: string;
  name: string;
  component: string;
  version: string;
  exposure: Exposure;
  criticality: Criticality;
}

export interface ItemFacts {
  id: string;
  identifier: string;
  cvss: number;
  status: ItemStatus;
  openedAt: Date;
}

export interface AssessedItem extends ItemFacts {
  assessment: PriorityBreakdown;
  deadline: Date | null;
  isOverdue: boolean;
  daysOverdue: number;
}

export class InvariantViolation extends Error {}

function assess(item: ItemFacts, asset: AssetFacts, now: Date): AssessedItem {
  const assessment = assessPriority({ cvss: item.cvss, exposure: asset.exposure, criticality: asset.criticality });
  const overdue = overdueState(item.openedAt, assessment.priority, now);
  return {
    ...item,
    assessment,
    deadline: deadlineFor(item.openedAt, assessment.priority),
    isOverdue: overdue.isOverdue,
    daysOverdue: overdue.daysOverdue,
  };
}

/**
 * Zasób ze swoimi pozycjami. Niezmienny — każda operacja zwraca nową całość, więc nie
 * da się zmienić zasobu w jednym miejscu i zapomnieć o jego pozycjach w drugim.
 */
export class MonitoredAsset {
  private constructor(
    readonly facts: AssetFacts,
    readonly items: readonly AssessedItem[],
    private readonly now: Date,
  ) {}

  static from(facts: AssetFacts, items: readonly ItemFacts[], now = new Date()): MonitoredAsset {
    return new MonitoredAsset(
      facts,
      items.map((item) => assess(item, facts, now)),
      now,
    );
  }

  get openItems(): readonly AssessedItem[] {
    return this.items.filter((item) => item.status === "open");
  }

  get resolvedItems(): readonly AssessedItem[] {
    return this.items.filter((item) => item.status !== "open");
  }

  /**
   * Niezmiennik: zmiana ekspozycji przelicza WSZYSTKIE otwarte pozycje i NIE ŻADNĄ
   * rozstrzygniętą. Rozstrzygnięcie zapadło w określonych okolicznościach i zmiana
   * zasobu nie może go zmieniać wstecz.
   */
  withExposure(exposure: Exposure): MonitoredAsset {
    if (exposure === this.facts.exposure) return this;
    const changed: AssetFacts = { ...this.facts, exposure };
    return new MonitoredAsset(
      changed,
      this.items.map((item) => (item.status === "open" ? assess(item, changed, this.now) : item)),
      this.now,
    );
  }

  withCriticality(criticality: Criticality): MonitoredAsset {
    if (criticality === this.facts.criticality) return this;
    const changed: AssetFacts = { ...this.facts, criticality };
    return new MonitoredAsset(
      changed,
      this.items.map((item) => (item.status === "open" ? assess(item, changed, this.now) : item)),
      this.now,
    );
  }

  /**
   * Niezmiennik: zasobu z nierozstrzygniętymi pozycjami nie wolno usunąć, a odmowa
   * musi nazwać pozycje, które to blokują. Baza pilnuje tego wyzwalaczem — tutaj
   * reguła jest po to, żeby aplikacja mogła odmówić wcześniej i sensowniej.
   */
  removalObjection(): string | null {
    const blocking = this.openItems.map((item) => item.identifier).sort();
    if (blocking.length === 0) return null;
    return `Nie można usunąć zasobu z nierozstrzygniętymi pozycjami (${blocking.length.toString()}): ${blocking.join(", ")}`;
  }

  assertRemovable(): void {
    const objection = this.removalObjection();
    if (objection !== null) throw new InvariantViolation(objection);
  }
}
