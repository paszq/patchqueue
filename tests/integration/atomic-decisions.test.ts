/**
 * Rozstrzygnięcie pozycji ma być operacją niepodzielną.
 *
 * Zakres dowodu — czytać przed interpretacją wyników:
 *
 * 1. Pierwszy test **demonstruje zagrożenie**, a nie testuje naszego kodu. Odtwarza
 *    sekwencję dwóch niezależnych zapisów w kolejności, w jakiej robiła to warstwa
 *    danych, z drugim celowo naruszającym ograniczenie schematu. Pokazuje, że powstała
 *    rozbieżność jest trwała, bo historia nie przyjmuje ani zmian, ani usunięć.
 *    Ten test przechodzi zarówno przed zmianą, jak i po niej — jego rolą jest
 *    udokumentowanie, dlaczego zmiana była potrzebna.
 *
 * 2. Pozostałe testy sprawdzają nową funkcję bazy: spójność wyniku, egzekwowanie
 *    ograniczeń domenowych i izolację kont.
 *
 * Czego te testy NIE dowodzą: rzeczywistego wycofania transakcji po awarii między
 * dwoma zapisami. Wywołanie takiej awarii wymagałoby przerwania bazy w trakcie
 * transakcji, co jest poza zasięgiem klienta. Niepodzielność wynika tu z tego, że oba
 * zapisy dzieją się wewnątrz jednej funkcji, a nie z asercji w tym pliku.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? "";
const configured = SUPABASE_URL !== "" && SUPABASE_KEY !== "";
const inCI = (process.env.CI ?? "") !== "";

if (!configured && inCI) {
  throw new Error("Brak SUPABASE_URL / SUPABASE_KEY w pipelinie — testy nie mogą zostać pominięte.");
}

const suite = configured ? describe : describe.skip;

interface IdRow {
  id: string;
}

interface PostgrestError {
  message: string;
  code?: string;
}

interface RpcResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Klient bazy opisuje wynik wywołania funkcji jako `any`, bo projekt nie generuje
 * typów schematu. Jedno miejsce z rzutowaniem zamiast powtarzania go przy każdym
 * wywołaniu — i jedno miejsce do usunięcia, gdy typy zaczną być generowane.
 */
async function callRecordDecision(
  client: SupabaseClient,
  params: { p_vulnerability_id: string; p_kind: string; p_reason: string | null },
): Promise<RpcResult<string>> {
  return (await client.rpc("record_decision", params)) as RpcResult<string>;
}

/**
 * Asercja "ma być błąd" jest spełniona także wtedy, gdy funkcja w bazie nie istnieje —
 * test przeszedłby wtedy z niewłaściwego powodu, zanim migracja zostanie wgrana.
 * Ta funkcja odróżnia odrzucenie przez regułę domenową od braku samej funkcji.
 */
function expectDomainRejection(error: PostgrestError | null): void {
  expect(error).not.toBeNull();
  const message = error?.message ?? "";
  const missingFunction = error?.code === "PGRST202" || /could not find the function|does not exist/i.test(message);
  expect(missingFunction, `funkcja record_decision nie istnieje w bazie: ${message}`).toBe(false);
}

async function freshAccount(tag: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);
  const email = `patchqueue-atomic-${tag}-${Date.now().toString()}-${Math.floor(Math.random() * 1e6).toString()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: "TestoweHaslo123!" });
  if (error !== null) throw new Error(`Konto ${tag}: ${error.message}`);
  const userId = data.user?.id;
  if (userId === undefined) throw new Error(`Konto ${tag} bez identyfikatora`);
  return { client, userId };
}

suite("rozstrzygnięcie jako operacja niepodzielna", () => {
  let account: { client: SupabaseClient; userId: string };
  let assetId: string;

  beforeAll(async () => {
    account = await freshAccount("main");
    const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
      .from("assets")
      .insert({
        user_id: account.userId,
        name: "srv-atomic-01",
        component: "nginx",
        version: "1.20.0",
        exposure: "public",
        criticality: "high",
      })
      .select("id")
      .single();
    if (error !== null || data === null) throw new Error(`Zasób: ${error?.message ?? "brak wyniku"}`);
    assetId = data.id;
  }, 30_000);

  afterAll(async () => {
    await account.client.auth.signOut();
  });

  async function newItem(identifier: string): Promise<string> {
    const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
      .from("vulnerabilities")
      .insert({ user_id: account.userId, asset_id: assetId, identifier, cvss: 7.4 })
      .select("id")
      .single();
    if (error !== null || data === null) throw new Error(`Pozycja: ${error?.message ?? "brak wyniku"}`);
    return data.id;
  }

  it("DEMONSTRACJA ZAGROŻENIA: dwa osobne zapisy zostawiają trwałą rozbieżność", async () => {
    const vulnId = await newItem("CVE-2026-ATOM-1");

    // Krok 1 — wpis do historii. Przechodzi.
    const { error: insertError } = await account.client.from("decisions").insert({
      user_id: account.userId,
      vulnerability_id: vulnId,
      kind: "patched",
      reason: null,
    });
    expect(insertError).toBeNull();

    // Krok 2 — zmiana stanu, tu celowo niezgodna ze schematem: status rozstrzygnięty
    // wymaga daty rozstrzygnięcia. Odpowiednik awarii między dwoma zapisami.
    const { error: updateError } = await account.client
      .from("vulnerabilities")
      .update({ status: "patched", resolved_at: null })
      .eq("id", vulnId);
    expect(updateError).not.toBeNull();

    // Skutek: historia mówi "załatane", pozycja nadal otwarta.
    const { data: item }: { data: { status: string } | null; error: unknown } = await account.client
      .from("vulnerabilities")
      .select("status")
      .eq("id", vulnId)
      .single();
    expect(item?.status).toBe("open");

    const { data: trail } = await account.client.from("decisions").select("id").eq("vulnerability_id", vulnId);
    expect(trail ?? []).toHaveLength(1);

    // I rozbieżność jest trwała — historia nie przyjmuje ani usunięcia, ani zmiany.
    await account.client.from("decisions").delete().eq("vulnerability_id", vulnId);
    const { data: afterDelete } = await account.client.from("decisions").select("id").eq("vulnerability_id", vulnId);
    expect(afterDelete ?? []).toHaveLength(1);
  }, 30_000);

  it("funkcja bazy zapisuje rozstrzygnięcie i stan zgodnie", async () => {
    const vulnId = await newItem("CVE-2026-ATOM-2");

    const { data: decisionId, error } = await callRecordDecision(account.client, {
      p_vulnerability_id: vulnId,
      p_kind: "rejected",
      p_reason: "komponent nieużywany w tej konfiguracji",
    });
    expect(error).toBeNull();
    expect(decisionId).toBeTruthy();

    const { data: item }: { data: { status: string; resolved_at: string | null } | null; error: unknown } =
      await account.client.from("vulnerabilities").select("status, resolved_at").eq("id", vulnId).single();
    expect(item?.status).toBe("rejected");
    expect(item?.resolved_at).not.toBeNull();

    const { data: trail } = await account.client.from("decisions").select("id").eq("vulnerability_id", vulnId);
    expect(trail ?? []).toHaveLength(1);
  }, 30_000);

  it("przywrócenie przez funkcję otwiera pozycję i zdejmuje datę rozstrzygnięcia", async () => {
    const vulnId = await newItem("CVE-2026-ATOM-3");
    const patched = await callRecordDecision(account.client, {
      p_vulnerability_id: vulnId,
      p_kind: "patched",
      p_reason: null,
    });
    expect(patched.error).toBeNull();
    const reopened = await callRecordDecision(account.client, {
      p_vulnerability_id: vulnId,
      p_kind: "reopened",
      p_reason: null,
    });
    expect(reopened.error).toBeNull();

    const { data: item }: { data: { status: string; resolved_at: string | null } | null; error: unknown } =
      await account.client.from("vulnerabilities").select("status, resolved_at").eq("id", vulnId).single();
    expect(item?.status).toBe("open");
    expect(item?.resolved_at).toBeNull();

    // Oba rozstrzygnięcia zostają w historii — przywrócenie dopisuje, nie nadpisuje.
    const { data: trail } = await account.client.from("decisions").select("kind").eq("vulnerability_id", vulnId);
    expect(trail ?? []).toHaveLength(2);
  }, 30_000);

  it("odrzucenie bez powodu nie przechodzi i nie zostawia śladu", async () => {
    const vulnId = await newItem("CVE-2026-ATOM-4");

    const { error } = await callRecordDecision(account.client, {
      p_vulnerability_id: vulnId,
      p_kind: "rejected",
      p_reason: "   ",
    });
    expectDomainRejection(error);

    const { data: item }: { data: { status: string } | null; error: unknown } = await account.client
      .from("vulnerabilities")
      .select("status")
      .eq("id", vulnId)
      .single();
    expect(item?.status).toBe("open");

    const { data: trail } = await account.client.from("decisions").select("id").eq("vulnerability_id", vulnId);
    expect(trail ?? []).toHaveLength(0);
  }, 30_000);

  it("funkcja nie pozwala rozstrzygnąć cudzej pozycji", async () => {
    const vulnId = await newItem("CVE-2026-ATOM-5");
    const intruder = await freshAccount("intruder");
    try {
      const { error } = await callRecordDecision(intruder.client, {
        p_vulnerability_id: vulnId,
        p_kind: "patched",
        p_reason: null,
      });
      expectDomainRejection(error);

      const { data: item }: { data: { status: string } | null; error: unknown } = await account.client
        .from("vulnerabilities")
        .select("status")
        .eq("id", vulnId)
        .single();
      expect(item?.status).toBe("open");
    } finally {
      await intruder.client.auth.signOut();
    }
  }, 30_000);
});
