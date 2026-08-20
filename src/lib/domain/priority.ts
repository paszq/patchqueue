/**
 * The domain rule of PatchQueue.
 *
 * A vulnerability's CVSS score says how bad the flaw is in the abstract. It does not
 * know whether the affected asset is reachable from the public internet or sitting in
 * an isolated segment, nor how much the business depends on it. This module combines
 * all three, so the same vulnerability lands at a different place in the queue
 * depending on where it actually sits.
 *
 * Pure functions only: no database, no HTTP, no clock reads except where a reference
 * date is passed in explicitly. Everything here is covered by `priority.test.ts`.
 */

export const EXPOSURES = ["public", "internal", "isolated"] as const;
export const CRITICALITIES = ["high", "medium", "low"] as const;
export const PRIORITY_CLASSES = ["critical", "high", "medium", "low"] as const;

export type Exposure = (typeof EXPOSURES)[number];
export type Criticality = (typeof CRITICALITIES)[number];
export type PriorityClass = (typeof PRIORITY_CLASSES)[number];

/**
 * Multipliers are strictly decreasing along both scales. That is what guarantees the
 * PRD guardrail: a vulnerability on a publicly reachable asset can never rank below
 * the same vulnerability on an isolated one.
 */
const EXPOSURE_WEIGHT: Record<Exposure, number> = {
  public: 1.0,
  internal: 0.6,
  isolated: 0.3,
};

const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/** Lower bound of each class, checked from the top down. */
const CLASS_THRESHOLD: readonly (readonly [PriorityClass, number])[] = [
  ["critical", 7.0],
  ["high", 4.5],
  ["medium", 2.0],
  ["low", 0],
];

/** Days allowed before an item of each class is overdue. `null` means no deadline. */
const DEADLINE_DAYS: Record<PriorityClass, number | null> = {
  critical: 3,
  high: 14,
  medium: 60,
  low: null,
};

export const MIN_CVSS = 0;
export const MAX_CVSS = 10;

export interface PriorityInput {
  cvss: number;
  exposure: Exposure;
  criticality: Criticality;
}

export interface PriorityBreakdown {
  /** Rounded to two decimals so the same input always renders identically. */
  score: number;
  priority: PriorityClass;
  deadlineDays: number | null;
  /** The three inputs, echoed back so the interface can explain the result. */
  factors: {
    cvss: number;
    exposure: Exposure;
    exposureWeight: number;
    criticality: Criticality;
    criticalityWeight: number;
  };
}

export class InvalidPriorityInput extends Error {}

function assertValid({ cvss, exposure, criticality }: PriorityInput): void {
  if (typeof cvss !== "number" || Number.isNaN(cvss)) {
    throw new InvalidPriorityInput("CVSS score must be a number");
  }
  if (cvss < MIN_CVSS || cvss > MAX_CVSS) {
    throw new InvalidPriorityInput(`CVSS score must be between ${MIN_CVSS} and ${MAX_CVSS}, got ${cvss}`);
  }
  if (!EXPOSURES.includes(exposure)) {
    throw new InvalidPriorityInput(`Unknown exposure: ${exposure}`);
  }
  if (!CRITICALITIES.includes(criticality)) {
    throw new InvalidPriorityInput(`Unknown criticality: ${criticality}`);
  }
}

/** The rule. Everything else in this module is derived from it. */
export function assessPriority(input: PriorityInput): PriorityBreakdown {
  assertValid(input);
  const { cvss, exposure, criticality } = input;

  const exposureWeight = EXPOSURE_WEIGHT[exposure];
  const criticalityWeight = CRITICALITY_WEIGHT[criticality];
  const score = Math.round(cvss * exposureWeight * criticalityWeight * 100) / 100;

  const priority = CLASS_THRESHOLD.find(([, floor]) => score >= floor)?.[0] ?? "low";

  return {
    score,
    priority,
    deadlineDays: DEADLINE_DAYS[priority],
    factors: { cvss, exposure, exposureWeight, criticality, criticalityWeight },
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight-aligned day difference, so a deadline never shifts with the time of day. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / MS_PER_DAY);
}

export function deadlineFor(openedAt: Date, priority: PriorityClass): Date | null {
  const days = DEADLINE_DAYS[priority];
  if (days === null) return null;
  const due = new Date(openedAt);
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

export interface OverdueState {
  hasDeadline: boolean;
  isOverdue: boolean;
  /** Positive once the deadline has passed; 0 while it has not. */
  daysOverdue: number;
}

export function overdueState(openedAt: Date, priority: PriorityClass, now: Date): OverdueState {
  const due = deadlineFor(openedAt, priority);
  if (due === null) return { hasDeadline: false, isOverdue: false, daysOverdue: 0 };
  const overdueBy = daysBetween(due, now);
  return { hasDeadline: true, isOverdue: overdueBy > 0, daysOverdue: Math.max(0, overdueBy) };
}

export interface QueueItem {
  id: string;
  openedAt: Date;
  assessment: PriorityBreakdown;
}

/**
 * Queue order: highest score first. Ties break on the earlier deadline, then on id so
 * the order is stable and reproducible rather than dependent on insertion sequence.
 */
export function orderQueue<T extends QueueItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.assessment.score !== a.assessment.score) return b.assessment.score - a.assessment.score;

    const aDue = deadlineFor(a.openedAt, a.assessment.priority);
    const bDue = deadlineFor(b.openedAt, b.assessment.priority);
    if (aDue && bDue && aDue.getTime() !== bDue.getTime()) return aDue.getTime() - bDue.getTime();
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    return a.id.localeCompare(b.id);
  });
}
