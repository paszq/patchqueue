/**
 * Ta sama podatność nie może stać dwa razy na tym samym zasobie.
 *
 * Zakres dowodu — czytać przed interpretacją wyników:
 *
 * 1. Reguła mieszka w bazie, jako unikalny indeks. Testy uderzają w prawdziwy projekt
 *    bazy, bez atrap — atrapa odtwarzałaby regułę zamiast ją sprawdzać i przeszłaby
 *    także po usunięciu migracji.
 *
 * 2. Asercja „ma być błąd" nie wystarcza. Zapis odrzucony dlatego, że indeksu nie ma,
 *    wygląda w wyniku identycznie jak zapis odrzucony przez regułę. `expectUniqueness`
 *    rozróżnia jedno od drugiego po kodzie błędu Postgresa, bo w tym projekcie taka
 *    pomyłka już raz przepuściła zielony wynik — patrz `atomic-decisions.test.ts`.
 *
 * Czego te testy NIE dowodzą: że warstwa aplikacji ładnie tłumaczy odmowę. To sprawdza
 * test przeglądowy — tutaj chodzi wyłącznie o to, czy reguła w ogóle obowiązuje.
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

/** Kod naruszenia unikalności w Postgresie. */
const UNIQUE_VIOLATION = "23505";

/**
 * Odróżnia odmowę przez regułę od odmowy z jakiegokolwiek innego powodu — w tym od
 * braku samego indeksu, gdy migracja nie została zastosowana. Bez tego test byłby
 * zielony także wtedy, gdy reguły nie ma.
 */
function expectUniqueness(error: PostgrestError | null): void {
  expect(error, "zapis przeszedł, choć reguła miała go odrzucić").not.toBeNull();
  expect(
    error?.code,
    `oczekiwano naruszenia unikalności (${UNIQUE_VIOLATION}), a przyszło: ${error?.code ?? "brak kodu"} — ${error?.message ?? ""}`,
  ).toBe(UNIQUE_VIOLATION);
}

async function freshAccount(tag: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);
  const email = `patchqueue-dup-${tag}-${Date.now().toString()}-${Math.floor(Math.random() * 1e6).toString()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: "TestoweHaslo123!" });
  if (error !== null) throw new Error(`Konto ${tag}: ${error.message}`);
  const userId = data.user?.id;
  if (userId === undefined) throw new Error(`Konto ${tag} bez identyfikatora`);
  return { client, userId };
}

suite("unikalność pozycji na zasobie", () => {
  let account: { client: SupabaseClient; userId: string };
  let assetId: string;
  let otherAssetId: string;

  async function newAsset(name: string, component: string): Promise<string> {
    const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
      .from("assets")
      .insert({
        user_id: account.userId,
        name,
        component,
        version: "1.0.0",
        exposure: "public",
        criticality: "high",
      })
      .select("id")
      .single();
    if (error !== null || data === null) throw new Error(`Zasób ${name}: ${error?.message ?? "brak wyniku"}`);
    return data.id;
  }

  async function addItem(
    asset: string,
    identifier: string,
  ): Promise<{ id: string | null; error: PostgrestError | null }> {
    const { data, error }: { data: IdRow | null; error: PostgrestError | null } = await account.client
      .from("vulnerabilities")
      .insert({ user_id: account.userId, asset_id: asset, identifier, cvss: 7.4 })
      .select("id")
      .maybeSingle();
    return { id: data?.id ?? null, error };
  }

  beforeAll(async () => {
    account = await freshAccount("main");
    assetId = await newAsset("srv-dup-01", "nginx");
    otherAssetId = await newAsset("srv-dup-02", "openssl");
  }, 30_000);

  afterAll(async () => {
    await account.client.auth.signOut();
  });

  it("odrzuca drugą pozycję o tym samym identyfikatorze na tym samym zasobie", async () => {
    const first = await addItem(assetId, "CVE-2026-DUP-1");
    expect(first.error).toBeNull();

    const second = await addItem(assetId, "CVE-2026-DUP-1");
    expectUniqueness(second.error);
  });

  it("odrzuca duplikat różniący się wyłącznie wielkością liter", async () => {
    const first = await addItem(assetId, "CVE-2026-DUP-2");
    expect(first.error).toBeNull();

    // Ścieżka wczytywania normalizuje identyfikator do wielkich liter, formularz nie.
    // Gdyby reguła nie działała na znormalizowanej postaci, dałaby się obejść zmianą
    // wielkości liter — a dla człowieka to ta sama podatność.
    const second = await addItem(assetId, "cve-2026-dup-2");
    expectUniqueness(second.error);
  });

  it("dopuszcza tę samą podatność na innym zasobie", async () => {
    // To jest teza produktu, więc reguła nie może jej złamać: ta sama podatność na
    // dwóch zasobach to dwie różne pozycje o różnym priorytecie.
    const first = await addItem(assetId, "CVE-2026-DUP-3");
    expect(first.error).toBeNull();

    const onOtherAsset = await addItem(otherAssetId, "CVE-2026-DUP-3");
    expect(onOtherAsset.error, "ta sama podatność na innym zasobie musi przejść").toBeNull();
  });

  /**
   * Zmiana identyfikatora istniejącej pozycji to druga droga do tej samej kolizji.
   * Plan zakładał, że reguła i jej tłumaczenie obowiązują przy zapisie ORAZ przy
   * aktualizacji, ale testy jechały wyłącznie wstawianiem — lukę wskazał agent
   * przeglądający PR, nie autor.
   */
  it("odrzuca zmianę identyfikatora na kolidujący z inną pozycją tego zasobu", async () => {
    const first = await addItem(assetId, "CVE-2026-DUP-5");
    expect(first.error).toBeNull();
    const second = await addItem(assetId, "CVE-2026-DUP-6");
    expect(second.error).toBeNull();
    if (second.id === null) throw new Error("brak identyfikatora drugiej pozycji");

    const { error } = await account.client
      .from("vulnerabilities")
      .update({ identifier: "CVE-2026-DUP-5" })
      .eq("id", second.id);
    expectUniqueness(error);

    // Kolizja przy zmianie wielkości liter musi być odrzucona tak samo.
    const { error: caseError } = await account.client
      .from("vulnerabilities")
      .update({ identifier: "cve-2026-dup-5" })
      .eq("id", second.id);
    expectUniqueness(caseError);
  });

  it("odrzuca duplikat także wtedy, gdy istniejąca pozycja jest już rozstrzygnięta", async () => {
    const first = await addItem(assetId, "CVE-2026-DUP-4");
    expect(first.error).toBeNull();
    if (first.id === null) throw new Error("brak identyfikatora utworzonej pozycji");

    const { error: decisionError } = await account.client.rpc("record_decision", {
      p_vulnerability_id: first.id,
      p_kind: "patched",
      p_reason: "aktualizacja pakietu",
    });
    expect(decisionError).toBeNull();

    // Powrót rozstrzygniętej pozycji do kolejki ma iść przez przywrócenie, które
    // dopisuje wpis do istniejącej historii. Nowa pozycja rozbiłaby ślad tej samej
    // podatności na dwie połowy, z których żadna nie jest kompletna.
    const second = await addItem(assetId, "CVE-2026-DUP-4");
    expectUniqueness(second.error);
  });
});
