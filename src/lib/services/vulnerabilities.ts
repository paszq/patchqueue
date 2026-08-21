/**
 * Operacje na podatnościach.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vulnerability } from "@/types";
import { DataAccessError, must, toVulnerability, VULNERABILITY_COLUMNS, type VulnerabilityRow } from "./rows";

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
