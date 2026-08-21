/**
 * Dostęp do danych PatchQueue.
 *
 * Warstwa cienka z rozmysłem: pobiera wiersze, mapuje na kontrakty z `@/types` i
 * przepuszcza przez regułę domenową. Sama reguła żyje wyłącznie w
 * `@/lib/domain/priority` — tutaj nie ma ani jednego progu ani mnożnika.
 *
 * Izolacji danych między kontami pilnują polityki po stronie bazy. Ten moduł nie
 * dokłada własnych warunków `user_id` do odczytów, bo to dawałoby złudzenie, że to
 * one chronią dane. Wyjątkiem są zapisy, gdzie kolumna musi zostać wypełniona.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessPriority, deadlineFor, orderQueue, overdueState } from "@/lib/domain/priority";
import type { Asset, Decision, QueueEntry, Vulnerability } from "@/types";

interface AssetRow {
  id: string;
  name: string;
  component: string;
  version: string;
  exposure: Asset["exposure"];
  criticality: Asset["criticality"];
  created_at: string;
  updated_at: string;
}

interface VulnerabilityRow {
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

interface DecisionRow {
  id: string;
  vulnerability_id: string;
  kind: Decision["kind"];
  reason: string | null;
  created_at: string;
}

const ASSET_COLUMNS = "id, name, component, version, exposure, criticality, created_at, updated_at";
const VULNERABILITY_COLUMNS = "id, asset_id, identifier, cvss, description, status, opened_at, resolved_at";
const DECISION_COLUMNS = "id, vulnerability_id, kind, reason, created_at";

function toAsset(row: AssetRow): Asset {
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

function toVulnerability(row: VulnerabilityRow): Vulnerability {
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

function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    vulnerabilityId: row.vulnerability_id,
    kind: row.kind,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class DataAccessError extends Error {}

function must<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new DataAccessError(`Nie znaleziono: ${what}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Zasoby
// ---------------------------------------------------------------------------

export async function listAssets(db: SupabaseClient): Promise<Asset[]> {
  const { data, error }: { data: AssetRow[] | null; error: { message: string } | null } = await db
    .from("assets")
    .select(ASSET_COLUMNS)
    .order("name");
  if (error !== null) throw new DataAccessError(error.message);
  return (data ?? []).map(toAsset);
}

export async function getAsset(db: SupabaseClient, id: string): Promise<Asset> {
  const { data, error }: { data: AssetRow | null; error: { message: string } | null } = await db
    .from("assets")
    .select(ASSET_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw new DataAccessError(error.message);
  return toAsset(must(data, "zasób"));
}

export interface AssetInput {
  name: string;
  component: string;
  version: string;
  exposure: Asset["exposure"];
  criticality: Asset["criticality"];
}

export async function createAsset(db: SupabaseClient, userId: string, input: AssetInput): Promise<Asset> {
  const { data, error }: { data: AssetRow | null; error: { message: string } | null } = await db
    .from("assets")
    .insert({ user_id: userId, ...input })
    .select(ASSET_COLUMNS)
    .single();
  if (error !== null) throw new DataAccessError(error.message);
  return toAsset(must(data, "utworzony zasób"));
}

export async function updateAsset(db: SupabaseClient, id: string, input: AssetInput): Promise<Asset> {
  const { data, error }: { data: AssetRow | null; error: { message: string } | null } = await db
    .from("assets")
    .update(input)
    .eq("id", id)
    .select(ASSET_COLUMNS)
    .maybeSingle();
  if (error !== null) throw new DataAccessError(error.message);
  return toAsset(must(data, "zmieniony zasób"));
}

/**
 * Odmowa usunięcia zasobu z otwartymi pozycjami pochodzi z wyzwalacza w bazie —
 * tutaj jedynie przekazujemy jej treść dalej, żeby użytkownik zobaczył, co blokuje.
 */
export async function deleteAsset(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("assets").delete().eq("id", id);
  if (error !== null) throw new DataAccessError(error.message);
}

// ---------------------------------------------------------------------------
// Podatności
// ---------------------------------------------------------------------------

export interface VulnerabilityInput {
  assetId: string;
  identifier: string;
  cvss: number;
  description: string;
}

export async function createVulnerability(
  db: SupabaseClient,
  userId: string,
  input: VulnerabilityInput,
): Promise<Vulnerability> {
  const { data, error }: { data: VulnerabilityRow | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .insert({
      user_id: userId,
      asset_id: input.assetId,
      identifier: input.identifier,
      cvss: input.cvss,
      description: input.description,
    })
    .select(VULNERABILITY_COLUMNS)
    .single();
  if (error !== null) throw new DataAccessError(error.message);
  return toVulnerability(must(data, "utworzona podatność"));
}

export async function updateVulnerability(
  db: SupabaseClient,
  id: string,
  input: Omit<VulnerabilityInput, "assetId">,
): Promise<Vulnerability> {
  const { data, error }: { data: VulnerabilityRow | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .update({ identifier: input.identifier, cvss: input.cvss, description: input.description })
    .eq("id", id)
    .select(VULNERABILITY_COLUMNS)
    .maybeSingle();
  if (error !== null) throw new DataAccessError(error.message);
  return toVulnerability(must(data, "zmieniona podatność"));
}

export async function deleteVulnerability(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("vulnerabilities").delete().eq("id", id);
  if (error !== null) throw new DataAccessError(error.message);
}

export async function listVulnerabilitiesForAsset(db: SupabaseClient, assetId: string): Promise<Vulnerability[]> {
  const { data, error }: { data: VulnerabilityRow[] | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .select(VULNERABILITY_COLUMNS)
    .eq("asset_id", assetId)
    .order("opened_at", { ascending: false });
  if (error !== null) throw new DataAccessError(error.message);
  return (data ?? []).map(toVulnerability);
}

// ---------------------------------------------------------------------------
// Rozstrzygnięcia
// ---------------------------------------------------------------------------

export interface DecisionInput {
  vulnerabilityId: string;
  kind: Decision["kind"];
  reason: string | null;
}

/**
 * Rozstrzygnięcie to jedna operacja: wpis do historii i zmiana stanu pozycji.
 *
 * Oba zapisy wykonuje funkcja w bazie, w jednej transakcji. Wcześniej robiła to
 * warstwa danych dwoma niezależnymi wywołaniami — gdy drugie zawiodło, historia
 * twierdziła, że pozycję rozstrzygnięto, a pozycja zostawała otwarta. Ponieważ
 * historia nie przyjmuje ani zmian, ani usunięć, taka rozbieżność była trwała.
 *
 * Funkcja działa w kontekście wywołującego, więc polityki dostępu obowiązują tak samo
 * jak przy zwykłych zapytaniach — cudzej pozycji nie rozstrzygnie.
 */
export async function recordDecision(db: SupabaseClient, input: DecisionInput): Promise<void> {
  const { error } = await db.rpc("record_decision", {
    p_vulnerability_id: input.vulnerabilityId,
    p_kind: input.kind,
    p_reason: input.reason,
  });
  if (error !== null) throw new DataAccessError(error.message);
}

export async function listDecisions(db: SupabaseClient, vulnerabilityId: string): Promise<Decision[]> {
  const { data, error }: { data: DecisionRow[] | null; error: { message: string } | null } = await db
    .from("decisions")
    .select(DECISION_COLUMNS)
    .eq("vulnerability_id", vulnerabilityId)
    .order("created_at");
  if (error !== null) throw new DataAccessError(error.message);
  return (data ?? []).map(toDecision);
}

// ---------------------------------------------------------------------------
// Kolejka
// ---------------------------------------------------------------------------

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
