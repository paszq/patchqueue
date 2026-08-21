/**
 * Operacje na zasobach.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "@/types";
import { ASSET_COLUMNS, DataAccessError, must, toAsset, type AssetRow } from "./rows";

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
