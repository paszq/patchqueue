/**
 * Budowanie i porządkowanie kolejki.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessPriority, deadlineFor, orderQueue, overdueState } from "@/lib/domain/priority";
import type { Asset, QueueEntry, Vulnerability } from "@/types";
import {
  ASSET_COLUMNS,
  DataAccessError,
  must,
  toAsset,
  toVulnerability,
  VULNERABILITY_COLUMNS,
  type AssetRow,
  type VulnerabilityRow,
} from "./rows";

function entryFor(vulnerability: Vulnerability, asset: Asset, now: Date): QueueEntry {
  const assessment = assessPriority({
    cvss: vulnerability.cvss,
    exposure: asset.exposure,
    criticality: asset.criticality,
  });
  const openedAt = new Date(vulnerability.openedAt);
  const deadline = deadlineFor(openedAt, assessment.priority);
  const overdue = overdueState(openedAt, assessment.priority, now);

  return {
    vulnerability,
    asset,
    assessment,
    deadline: deadline === null ? null : deadline.toISOString(),
    isOverdue: overdue.isOverdue,
    daysOverdue: overdue.daysOverdue,
  };
}

export function buildEntry(vulnerability: Vulnerability, asset: Asset, now = new Date()): QueueEntry {
  return entryFor(vulnerability, asset, now);
}

interface JoinedRow extends VulnerabilityRow {
  // Bez wygenerowanych typów schematu klient opisuje osadzoną relację jako tablicę,
  // choć klucz obcy jest jeden do wielu i w praktyce przychodzi pojedynczy obiekt.
  assets: AssetRow[] | AssetRow | null;
}

function joinedAsset(row: JoinedRow): AssetRow | null {
  if (row.assets === null) return null;
  return Array.isArray(row.assets) ? (row.assets[0] ?? null) : row.assets;
}

/** Otwarte pozycje, uporządkowane regułą domenową. */
export async function loadQueue(db: SupabaseClient, now = new Date()): Promise<QueueEntry[]> {
  const { data, error }: { data: JoinedRow[] | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .select(`${VULNERABILITY_COLUMNS}, assets ( ${ASSET_COLUMNS} )`)
    .eq("status", "open");
  if (error !== null) throw new DataAccessError(error.message);

  const entries = (data ?? [])
    .map((row) => ({ row, asset: joinedAsset(row) }))
    .filter((pair): pair is { row: JoinedRow; asset: AssetRow } => pair.asset !== null)
    .map(({ row, asset }) => entryFor(toVulnerability(row), toAsset(asset), now));

  const ordered = orderQueue(
    entries.map((entry) => ({
      id: entry.vulnerability.id,
      openedAt: new Date(entry.vulnerability.openedAt),
      assessment: entry.assessment,
      entry,
    })),
  );

  return ordered.map((item) => item.entry);
}

export async function getVulnerabilityWithAsset(db: SupabaseClient, id: string, now = new Date()): Promise<QueueEntry> {
  const { data, error }: { data: JoinedRow | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .select(`${VULNERABILITY_COLUMNS}, assets ( ${ASSET_COLUMNS} )`)
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw new DataAccessError(error.message);
  const row = must(data, "podatność");
  return entryFor(toVulnerability(row), toAsset(must(joinedAsset(row), "zasób podatności")), now);
}
