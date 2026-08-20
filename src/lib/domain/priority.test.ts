import { describe, expect, it } from "vitest";
import {
  assessPriority,
  CRITICALITIES,
  deadlineFor,
  EXPOSURES,
  InvalidPriorityInput,
  orderQueue,
  overdueState,
  type Criticality,
  type Exposure,
  type QueueItem,
} from "./priority";

const at = (iso: string) => new Date(iso);

describe("assessPriority — the same flaw, judged by where it sits", () => {
  it("puts a severe flaw on a publicly reachable, business-critical asset at the top class", () => {
    const result = assessPriority({ cvss: 9.8, exposure: "public", criticality: "high" });
    expect(result.priority).toBe("critical");
    expect(result.deadlineDays).toBe(3);
  });

  it("drops the very same flaw to the bottom class when the asset is isolated and unimportant", () => {
    const result = assessPriority({ cvss: 9.8, exposure: "isolated", criticality: "low" });
    expect(result.priority).toBe("low");
    expect(result.deadlineDays).toBeNull();
  });

  it("ranks a mild flaw on an exposed asset above a severe one that is locked away", () => {
    const exposedButMild = assessPriority({ cvss: 5.0, exposure: "public", criticality: "high" });
    const severeButIsolated = assessPriority({ cvss: 9.8, exposure: "isolated", criticality: "low" });
    expect(exposedButMild.score).toBeGreaterThan(severeButIsolated.score);
  });

  it("reports every factor behind the score, so the result can be explained rather than trusted", () => {
    const { factors } = assessPriority({ cvss: 7.5, exposure: "internal", criticality: "medium" });
    expect(factors).toEqual({
      cvss: 7.5,
      exposure: "internal",
      exposureWeight: 0.6,
      criticality: "medium",
      criticalityWeight: 0.75,
    });
  });

  it("assigns a deadline to every class except the lowest", () => {
    expect(assessPriority({ cvss: 10, exposure: "public", criticality: "high" }).deadlineDays).toBe(3);
    expect(assessPriority({ cvss: 5.0, exposure: "public", criticality: "high" }).deadlineDays).toBe(14);
    expect(assessPriority({ cvss: 4.0, exposure: "internal", criticality: "high" }).deadlineDays).toBe(60);
    expect(assessPriority({ cvss: 1.0, exposure: "isolated", criticality: "low" }).deadlineDays).toBeNull();
  });
});

describe("assessPriority — the PRD guardrail, checked exhaustively", () => {
  const moreExposed: Record<Exposure, number> = { public: 3, internal: 2, isolated: 1 };
  const moreCritical: Record<Criticality, number> = { high: 3, medium: 2, low: 1 };
  const samples = [0, 0.1, 2.5, 4.4, 5, 7.9, 9.8, 10];

  it("never ranks a vulnerability lower when its asset is more exposed, all else equal", () => {
    for (const cvss of samples) {
      for (const criticality of CRITICALITIES) {
        for (const a of EXPOSURES) {
          for (const b of EXPOSURES) {
            if (moreExposed[a] <= moreExposed[b]) continue;
            const exposed = assessPriority({ cvss, exposure: a, criticality });
            const sheltered = assessPriority({ cvss, exposure: b, criticality });
            expect(exposed.score).toBeGreaterThanOrEqual(sheltered.score);
          }
        }
      }
    }
  });

  it("never ranks a vulnerability lower when its asset matters more, all else equal", () => {
    for (const cvss of samples) {
      for (const exposure of EXPOSURES) {
        for (const a of CRITICALITIES) {
          for (const b of CRITICALITIES) {
            if (moreCritical[a] <= moreCritical[b]) continue;
            expect(assessPriority({ cvss, exposure, criticality: a }).score).toBeGreaterThanOrEqual(
              assessPriority({ cvss, exposure, criticality: b }).score,
            );
          }
        }
      }
    }
  });

  it("never ranks a milder flaw above a worse one on an identical asset", () => {
    for (const exposure of EXPOSURES) {
      for (const criticality of CRITICALITIES) {
        for (let i = 1; i < samples.length; i++) {
          expect(assessPriority({ cvss: samples[i], exposure, criticality }).score).toBeGreaterThanOrEqual(
            assessPriority({ cvss: samples[i - 1], exposure, criticality }).score,
          );
        }
      }
    }
  });

  it("produces a score inside the CVSS range for every possible combination", () => {
    for (const cvss of samples) {
      for (const exposure of EXPOSURES) {
        for (const criticality of CRITICALITIES) {
          const { score } = assessPriority({ cvss, exposure, criticality });
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe("assessPriority — refusing input it cannot judge", () => {
  it.each([-0.1, 10.1, Number.NaN])("rejects a CVSS score of %s", (cvss) => {
    expect(() => assessPriority({ cvss, exposure: "public", criticality: "high" })).toThrow(InvalidPriorityInput);
  });

  it("rejects an exposure level it does not know", () => {
    expect(() => assessPriority({ cvss: 5, exposure: "dmz" as Exposure, criticality: "high" })).toThrow(
      InvalidPriorityInput,
    );
  });

  it("rejects a criticality it does not know", () => {
    expect(() => assessPriority({ cvss: 5, exposure: "public", criticality: "urgent" as Criticality })).toThrow(
      InvalidPriorityInput,
    );
  });
});

describe("deadlines and overdue state", () => {
  it("counts the deadline forward from the day the item was opened", () => {
    expect(deadlineFor(at("2026-08-20T00:00:00Z"), "critical")?.toISOString()).toBe("2026-08-23T00:00:00.000Z");
    expect(deadlineFor(at("2026-08-20T00:00:00Z"), "high")?.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("gives the lowest class no deadline at all", () => {
    expect(deadlineFor(at("2026-08-20T00:00:00Z"), "low")).toBeNull();
    expect(overdueState(at("2026-01-01T00:00:00Z"), "low", at("2026-12-31T00:00:00Z"))).toEqual({
      hasDeadline: false,
      isOverdue: false,
      daysOverdue: 0,
    });
  });

  it("is not overdue on the deadline day itself", () => {
    const state = overdueState(at("2026-08-20T00:00:00Z"), "critical", at("2026-08-23T23:59:00Z"));
    expect(state.isOverdue).toBe(false);
    expect(state.daysOverdue).toBe(0);
  });

  it("counts whole days once the deadline has passed", () => {
    const state = overdueState(at("2026-08-20T00:00:00Z"), "critical", at("2026-08-26T09:00:00Z"));
    expect(state.isOverdue).toBe(true);
    expect(state.daysOverdue).toBe(3);
  });

  it("does not shift a deadline because of the time of day an item was opened", () => {
    const morning = overdueState(at("2026-08-20T06:00:00Z"), "critical", at("2026-08-24T12:00:00Z"));
    const evening = overdueState(at("2026-08-20T23:00:00Z"), "critical", at("2026-08-24T12:00:00Z"));
    expect(morning).toEqual(evening);
  });
});

describe("orderQueue", () => {
  const item = (
    id: string,
    cvss: number,
    exposure: Exposure,
    criticality: Criticality,
    openedAt: string,
  ): QueueItem => ({
    id,
    openedAt: at(openedAt),
    assessment: assessPriority({ cvss, exposure, criticality }),
  });

  it("orders by the rule, not by the raw CVSS score", () => {
    const queue = [
      item("a", 9.8, "isolated", "low", "2026-08-01T00:00:00Z"),
      item("b", 5.0, "public", "high", "2026-08-01T00:00:00Z"),
      item("c", 7.0, "internal", "medium", "2026-08-01T00:00:00Z"),
    ];
    expect(orderQueue(queue).map((i) => i.id)).toEqual(["b", "c", "a"]);

    const byCvssAlone = [...queue].sort((x, y) => y.assessment.factors.cvss - x.assessment.factors.cvss);
    expect(byCvssAlone.map((i) => i.id)).not.toEqual(orderQueue(queue).map((i) => i.id));
  });

  it("breaks an exact tie on the earlier deadline", () => {
    const older = item("older", 9.8, "public", "high", "2026-08-01T00:00:00Z");
    const newer = item("newer", 9.8, "public", "high", "2026-08-10T00:00:00Z");
    expect(orderQueue([newer, older]).map((i) => i.id)).toEqual(["older", "newer"]);
  });

  it("puts an item that has a deadline ahead of an equally scored one that has none", () => {
    const withDeadline: QueueItem = {
      id: "with",
      openedAt: at("2026-08-01T00:00:00Z"),
      assessment: { ...assessPriority({ cvss: 4.0, exposure: "public", criticality: "high" }), score: 1.5 },
    };
    const without = item("without", 5.0, "isolated", "low", "2026-08-01T00:00:00Z");
    expect(orderQueue([without, withDeadline]).map((i) => i.id)).toEqual(["with", "without"]);
  });

  it("returns a stable order and leaves the caller's array untouched", () => {
    const queue = [
      item("b", 6.0, "public", "high", "2026-08-01T00:00:00Z"),
      item("a", 6.0, "public", "high", "2026-08-01T00:00:00Z"),
    ];
    const before = queue.map((i) => i.id);
    expect(orderQueue(queue).map((i) => i.id)).toEqual(["a", "b"]);
    expect(orderQueue(queue).map((i) => i.id)).toEqual(["a", "b"]);
    expect(queue.map((i) => i.id)).toEqual(before);
  });
});
