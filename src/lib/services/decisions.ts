/**
 * Rozstrzygnięcia pozycji.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Decision } from "@/types";
import { DECISION_COLUMNS, DataAccessError, toDecision, type DecisionRow } from "./rows";

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
