/**
 * Operacje na zasobach.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset, AssetSummary } from "@/types";
import { ASSET_COLUMNS, DataAccessError, must, toAsset, type AssetRow } from "./rows";

export async function listAssets(db: SupabaseClient): Promise<Asset[]> {
  const { data, error }: { data: AssetRow[] | null; error: { message: string } | null } = await db
    .from("assets")
    .select(ASSET_COLUMNS)
    .order("name");
  if (error !== null) throw new DataAccessError(error.message);
  return (data ?? []).map(toAsset);
}

/**
 * Zasoby wraz z liczbą otwartych pozycji.
 *
 * Licznik idzie osobnym zapytaniem, a nie złączeniem z agregatem, bo złączenie
 * wewnętrzne gubiłoby zasoby bez ani jednej otwartej pozycji — a to właśnie one mają
 * na liście pokazać zero. Dwa zapytania na całą listę, nie jedno na zasób.
 */
export async function listAssetsWithOpenItems(db: SupabaseClient): Promise<AssetSummary[]> {
  const assets = await listAssets(db);

  const { data, error }: { data: { asset_id: string }[] | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .select("asset_id")
    .eq("status", "open");
  if (error !== null) throw new DataAccessError(error.message);

  const openPerAsset = new Map<string, number>();
  for (const row of data ?? []) {
    openPerAsset.set(row.asset_id, (openPerAsset.get(row.asset_id) ?? 0) + 1);
  }

  return assets.map((asset) => ({ ...asset, openItems: openPerAsset.get(asset.id) ?? 0 }));
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
