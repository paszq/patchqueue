/**
 * Operacje na podatnościach.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vulnerability } from "@/types";
import { DataAccessError, must, toVulnerability, VULNERABILITY_COLUMNS, type VulnerabilityRow } from "./rows";

/** Kod naruszenia unikalności w Postgresie. */
const UNIQUE_VIOLATION = "23505";

/**
 * Odmowa unikalności przychodzi z bazy jako komunikat sterownika, nazywający indeks.
 * Tłumaczymy ją na zdanie w języku produktu — tak samo, jak `deleteAsset` przepuszcza
 * dalej treść odmowy wyzwalacza. Reguła zostaje w bazie; tutaj zmienia się wyłącznie
 * to, co zobaczy człowiek.
 */
function translate(error: { message: string; code?: string }, identifier: string): DataAccessError {
  if (error.code === UNIQUE_VIOLATION) {
    return new DataAccessError(
      `Podatność ${identifier} jest już zapisana na tym zasobie. ` +
        "Jeśli została wcześniej rozstrzygnięta, przywróć ją do kolejki — historia rozstrzygnięć zostanie zachowana.",
    );
  }
  return new DataAccessError(error.message);
}

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
  const { data, error }: { data: VulnerabilityRow | null; error: { message: string; code?: string } | null } = await db
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
  if (error !== null) throw translate(error, input.identifier);
  return toVulnerability(must(data, "utworzona podatność"));
}

export async function updateVulnerability(
  db: SupabaseClient,
  id: string,
  input: Omit<VulnerabilityInput, "assetId">,
): Promise<Vulnerability> {
  const { data, error }: { data: VulnerabilityRow | null; error: { message: string; code?: string } | null } = await db
    .from("vulnerabilities")
    .update({ identifier: input.identifier, cvss: input.cvss, description: input.description })
    .eq("id", id)
    .select(VULNERABILITY_COLUMNS)
    .maybeSingle();
  if (error !== null) throw translate(error, input.identifier);
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
