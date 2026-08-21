/**
 * Wczytywanie znalezisk z zewnętrznych źródeł.
 *
 * Ten moduł nie wie nic o formatach — dostaje gotowe `ImportedFinding` z warstwy
 * tłumaczącej i zajmuje się wyłącznie tym, co należy do aplikacji: dopasowaniem
 * znaleziska do zasobu, odrzuceniem duplikatów i zapisem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedFinding } from "@/lib/domain/import/finding";
import type { Asset } from "@/types";
import { DataAccessError } from "./rows";
import { listAssets } from "./assets";

export interface ImportOutcome {
  identifier: string;
  status: "dodane" | "duplikat" | "bez-zasobu" | "niejednoznaczne";
  assetName: string | null;
  detail: string;
}

export interface ImportSummary {
  added: number;
  skipped: number;
  outcomes: ImportOutcome[];
}

/** Dopasowanie po nazwie komponentu; wielkość liter bez znaczenia. */
function matchAssets(finding: ImportedFinding, assets: Asset[], fallbackId: string | null): Asset[] {
  if (finding.component !== null) {
    const byComponent = assets.filter((asset) => asset.component.toLowerCase() === finding.component?.toLowerCase());
    if (byComponent.length > 0) return byComponent;
  }
  const fallback = assets.find((asset) => asset.id === fallbackId);
  return fallback === undefined ? [] : [fallback];
}

export async function importFindings(
  db: SupabaseClient,
  userId: string,
  findings: readonly ImportedFinding[],
  fallbackAssetId: string | null,
): Promise<ImportSummary> {
  const assets = await listAssets(db);

  const {
    data: existingRows,
    error: existingError,
  }: { data: { identifier: string; asset_id: string }[] | null; error: { message: string } | null } = await db
    .from("vulnerabilities")
    .select("identifier, asset_id");
  if (existingError !== null) throw new DataAccessError(existingError.message);

  const seen = new Set((existingRows ?? []).map((row) => `${row.asset_id}:${row.identifier.toUpperCase()}`));
  const outcomes: ImportOutcome[] = [];
  const toInsert: { user_id: string; asset_id: string; identifier: string; cvss: number; description: string }[] = [];

  for (const finding of findings) {
    const candidates = matchAssets(finding, assets, fallbackAssetId);

    if (candidates.length === 0) {
      outcomes.push({
        identifier: finding.identifier,
        status: "bez-zasobu",
        assetName: null,
        detail:
          finding.component === null
            ? "źródło nie podaje komponentu, a nie wskazano zasobu domyślnego"
            : `nie ma zasobu z komponentem „${finding.component}"`,
      });
      continue;
    }

    if (candidates.length > 1) {
      outcomes.push({
        identifier: finding.identifier,
        status: "niejednoznaczne",
        assetName: null,
        detail: `komponent „${finding.component ?? ""}" pasuje do ${candidates.length} zasobów`,
      });
      continue;
    }

    const asset = candidates[0];
    const key = `${asset.id}:${finding.identifier}`;
    if (seen.has(key)) {
      outcomes.push({
        identifier: finding.identifier,
        status: "duplikat",
        assetName: asset.name,
        detail: "ta pozycja jest już zapisana dla tego zasobu",
      });
      continue;
    }

    seen.add(key);
    toInsert.push({
      user_id: userId,
      asset_id: asset.id,
      identifier: finding.identifier,
      // Źródła bez oceny trafiają z zerem — pozycja ląduje nisko i czeka na uzupełnienie,
      // zamiast nie wejść wcale albo dostać zmyśloną wartość.
      cvss: finding.cvss ?? 0,
      description: finding.description,
    });
    outcomes.push({
      identifier: finding.identifier,
      status: "dodane",
      assetName: asset.name,
      detail: finding.cvss === null ? "źródło nie podało oceny — uzupełnij ją ręcznie" : "",
    });
  }

  if (toInsert.length > 0) {
    const { error } = await db.from("vulnerabilities").insert(toInsert);
    if (error !== null) throw new DataAccessError(error.message);
  }

  return { added: toInsert.length, skipped: outcomes.length - toInsert.length, outcomes };
}
