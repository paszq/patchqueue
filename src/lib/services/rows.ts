/**
 * Wiersze bazy i ich mapowanie na kontrakty domenowe.
 *
 * Wydzielone z jednego pliku warstwy danych: kształt wierszy jest wspólny dla operacji
 * na zasobach, podatnościach, rozstrzygnięciach i kolejce, więc trzymanie go razem z
 * którąkolwiek z nich wiązałoby pozostałe.
 */
import type { Asset, Decision, Vulnerability } from "@/types";

export interface AssetRow {
  id: string;
  name: string;
  component: string;
  version: string;
  exposure: Asset["exposure"];
  criticality: Asset["criticality"];
  created_at: string;
  updated_at: string;
}

export interface VulnerabilityRow {
  id: string;
  asset_id: string;
  identifier: string;
  // Kolumna numeric bywa zwracana jako łańcuch, zależnie od sterownika.
  cvss: number | string;
  description: string;
  status: Vulnerability["status"];
  opened_at: string;
  resolved_at: string | null;
}

export interface DecisionRow {
  id: string;
  vulnerability_id: string;
  kind: Decision["kind"];
  reason: string | null;
  created_at: string;
}

export const ASSET_COLUMNS = "id, name, component, version, exposure, criticality, created_at, updated_at";
export const VULNERABILITY_COLUMNS = "id, asset_id, identifier, cvss, description, status, opened_at, resolved_at";
export const DECISION_COLUMNS = "id, vulnerability_id, kind, reason, created_at";

export function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    component: row.component,
    version: row.version,
    exposure: row.exposure,
    criticality: row.criticality,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVulnerability(row: VulnerabilityRow): Vulnerability {
  return {
    id: row.id,
    assetId: row.asset_id,
    identifier: row.identifier,
    cvss: Number(row.cvss),
    description: row.description,
    status: row.status,
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at,
  };
}

export function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    vulnerabilityId: row.vulnerability_id,
    kind: row.kind,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class DataAccessError extends Error {}

export function must<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new DataAccessError(`Nie znaleziono: ${what}`);
  }
  return value;
}
