/**
 * Kontrakty wspólne dla warstwy danych i widoków.
 *
 * Priorytet i termin nie są tu przechowywane jako pola zapisywalne — wynikają z reguły
 * w `@/lib/domain/priority` i doklejane są przy odczycie.
 */
import type { Criticality, Exposure, PriorityBreakdown } from "@/lib/domain/priority";

export type { Criticality, Exposure, PriorityBreakdown };

export type VulnerabilityStatus = "open" | "patched" | "rejected";
export type DecisionKind = "patched" | "rejected" | "reopened";

export interface Asset {
  id: string;
  name: string;
  component: string;
  version: string;
  exposure: Exposure;
  criticality: Criticality;
  createdAt: string;
  updatedAt: string;
}

/** Zasób wraz z liczbą nierozstrzygniętych pozycji — kształt listy zasobów. */
export interface AssetSummary extends Asset {
  openItems: number;
}

export interface Vulnerability {
  id: string;
  assetId: string;
  identifier: string;
  cvss: number;
  description: string;
  status: VulnerabilityStatus;
  openedAt: string;
  resolvedAt: string | null;
}

export interface Decision {
  id: string;
  vulnerabilityId: string;
  kind: DecisionKind;
  reason: string | null;
  createdAt: string;
}

/** Pozycja kolejki: podatność wraz z zasobem i wyliczoną oceną. */
export interface QueueEntry {
  vulnerability: Vulnerability;
  asset: Asset;
  assessment: PriorityBreakdown;
  deadline: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}

export const EXPOSURE_LABEL: Record<Exposure, string> = {
  public: "z sieci publicznej",
  internal: "tylko wewnętrznie",
  isolated: "odcięty",
};

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  high: "wysoka",
  medium: "średnia",
  low: "niska",
};

export const PRIORITY_LABEL = {
  critical: "krytyczny",
  high: "wysoki",
  medium: "średni",
  low: "niski",
} as const;
