/**
 * Dowód, że izolacja kont działa — nie przegląd konfiguracji, tylko próba sięgnięcia
 * po cudze dane z drugiego konta.
 *
 * `tech-stack.md` wymienia to jako przyjęte ryzyko: polityki dostępu na poziomie
 * wierszy łatwo skonfigurować pozornie, a polityka zapisana i nieaktywna wygląda
 * identycznie jak działająca. Ten test odróżnia jedno od drugiego.
 *
 * Testy uderzają w prawdziwy projekt i zakładają konta o losowych adresach. Pomijają
 * się same, gdy konfiguracja jest nieobecna — ale głośno o tym mówią, bo cicho
 * pominięty test bezpieczeństwa wygląda w raporcie tak samo jak zdany.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? "";
const configured = SUPABASE_URL !== "" && SUPABASE_KEY !== "";

const inCI = (process.env.CI ?? "") !== "";

if (!configured) {
  if (inCI) {
    // W pipelinie brak konfiguracji jest bledem, nie pominieciem. Cicho pominiety
    // test bezpieczenstwa wyglada w raporcie tak samo jak zdany - a nie jest.
    throw new Error(
      "Brak SUPABASE_URL / SUPABASE_KEY w pipelinie. Testy nie moga zostac pominiete " +
        "w miejscu, ktore ma pilnowac jakosci. Uzupelnij sekrety repozytorium.",
    );
  }
  console.warn("\n[UWAGA] Testy POMINIETE lokalnie - brak SUPABASE_URL / SUPABASE_KEY.\n");
}

const suite = configured ? describe : describe.skip;

interface IdRow {
  id: string;
}

interface Account {
  client: SupabaseClient;
  userId: string;
}

const PASSWORD = "TestoweHaslo123!";

function unwrap<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`Brak oczekiwanego wyniku: ${what}`);
  }
  return value;
}

function freshEmail(tag: string): string {
  return `patchqueue-test-${tag}-${Date.now().toString()}-${Math.floor(Math.random() * 1e6).toString()}@example.com`;
}

async function signUpAccount(tag: string): Promise<Account> {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await client.auth.signUp({ email: freshEmail(tag), password: PASSWORD });
  if (error !== null) {
    throw new Error(`Nie udało się założyć konta ${tag}: ${error.message}`);
  }
  if (data.session === null) {
    throw new Error("Rejestracja nie zwróciła sesji — czy potwierdzanie adresu jest wyłączone?");
  }
  const user = unwrap(data.user, `identyfikator użytkownika dla konta ${tag}`);
  return { client, userId: user.id };
}

async function insertAsset(account: Account, overrides: Record<string, string> = {}): Promise<string> {
  const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
    .from("assets")
    .insert({
      user_id: account.userId,
      name: "srv-web-01",
      component: "nginx",
      version: "1.18.0",
      exposure: "public",
      criticality: "high",
      ...overrides,
    })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`Nie udało się dodać zasobu: ${error.message}`);
  }
  return unwrap(data, "identyfikator dodanego zasobu").id;
}

async function insertVulnerability(
  account: Account,
  assetId: string,
  identifier: string,
  cvss: number,
): Promise<string> {
  const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
    .from("vulnerabilities")
    .insert({ user_id: account.userId, asset_id: assetId, identifier, cvss })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`Nie udało się dodać podatności: ${error.message}`);
  }
  return unwrap(data, "identyfikator dodanej podatności").id;
}

suite("izolacja danych między kontami", () => {
  let alice: Account;
  let bob: Account;
  let aliceAssetId: string;

  beforeAll(async () => {
    alice = await signUpAccount("alice");
    bob = await signUpAccount("bob");
    aliceAssetId = await insertAsset(alice);
  }, 30_000);

  afterAll(async () => {
    await alice.client.from("assets").delete().eq("id", aliceAssetId);
    await alice.client.auth.signOut();
    await bob.client.auth.signOut();
  });

  it("właściciel widzi własny zasób", async () => {
    const { data, error } = await alice.client.from("assets").select("id").eq("id", aliceAssetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("drugie konto nie widzi cudzego zasobu przy odczycie wszystkich", async () => {
    const { data, error }: { data: IdRow[] | null; error: unknown } = await bob.client.from("assets").select("id");
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.id)).not.toContain(aliceAssetId);
  });

  it("drugie konto nie widzi cudzego zasobu nawet znając jego identyfikator", async () => {
    const { data, error } = await bob.client.from("assets").select("id").eq("id", aliceAssetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("drugie konto nie może zmienić cudzego zasobu", async () => {
    const { data } = await bob.client
      .from("assets")
      .update({ exposure: "isolated" })
      .eq("id", aliceAssetId)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const { data: after }: { data: { exposure: string } | null; error: unknown } = await alice.client
      .from("assets")
      .select("exposure")
      .eq("id", aliceAssetId)
      .single();
    expect(unwrap(after, "zasób Alice po próbie zmiany").exposure).toBe("public");
  });

  it("drugie konto nie może usunąć cudzego zasobu", async () => {
    await bob.client.from("assets").delete().eq("id", aliceAssetId);
    const { data } = await alice.client.from("assets").select("id").eq("id", aliceAssetId);
    expect(data).toHaveLength(1);
  });

  it("nie da się podszyć pod cudze konto przy zapisie", async () => {
    const { error } = await bob.client.from("assets").insert({
      user_id: alice.userId,
      name: "podszycie",
      component: "x",
      version: "1",
      exposure: "public",
      criticality: "high",
    });
    expect(error).not.toBeNull();
  });

  it("niezalogowany nie widzi niczego", async () => {
    const anonymous = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await anonymous.from("assets").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

suite("nienaruszalność rozstrzygnięć", () => {
  it("zapisanego rozstrzygnięcia nie da się usunąć ani zmienić", async () => {
    const account = await signUpAccount("trail");
    try {
      const assetId = await insertAsset(account, { name: "srv-db-01", component: "postgresql", version: "14.2" });
      const vulnId = await insertVulnerability(account, assetId, "CVE-2026-0001", 7.5);

      const reason = "komponent nieużywany w tej konfiguracji";
      const { data, error }: { data: IdRow | null; error: { message: string } | null } = await account.client
        .from("decisions")
        .insert({ user_id: account.userId, vulnerability_id: vulnId, kind: "rejected", reason })
        .select("id")
        .single();
      expect(error).toBeNull();
      const decisionId = unwrap(data, "identyfikator rozstrzygnięcia").id;

      const { data: updated } = await account.client
        .from("decisions")
        .update({ reason: "zmienione uzasadnienie" })
        .eq("id", decisionId)
        .select("id");
      expect(updated ?? []).toHaveLength(0);

      await account.client.from("decisions").delete().eq("id", decisionId);
      const { data: still }: { data: { reason: string } | null; error: unknown } = await account.client
        .from("decisions")
        .select("reason")
        .eq("id", decisionId)
        .single();
      expect(unwrap(still, "rozstrzygnięcie po próbie usunięcia").reason).toBe(reason);

      await account.client.from("vulnerabilities").delete().eq("id", vulnId);
      await account.client.from("assets").delete().eq("id", assetId);
    } finally {
      await account.client.auth.signOut();
    }
  }, 30_000);

  it("odrzucenie bez powodu jest odrzucane przez bazę", async () => {
    const account = await signUpAccount("noreason");
    try {
      const assetId = await insertAsset(account, { name: "srv-app-01", component: "openssl", version: "3.0.2" });
      const vulnId = await insertVulnerability(account, assetId, "CVE-2026-0002", 5.3);

      const { error } = await account.client
        .from("decisions")
        .insert({ user_id: account.userId, vulnerability_id: vulnId, kind: "rejected", reason: "   " });
      expect(error).not.toBeNull();

      await account.client.from("vulnerabilities").delete().eq("id", vulnId);
      await account.client.from("assets").delete().eq("id", assetId);
    } finally {
      await account.client.auth.signOut();
    }
  }, 30_000);

  it("pozycji z zapisaną historią nie da się usunąć", async () => {
    const account = await signUpAccount("history");
    try {
      const assetId = await insertAsset(account, { name: "srv-hist-01", component: "nginx", version: "1.20" });
      const vulnId = await insertVulnerability(account, assetId, "CVE-2026-0004", 6.4);

      await account.client.from("decisions").insert({
        user_id: account.userId,
        vulnerability_id: vulnId,
        kind: "rejected",
        reason: "nie dotyczy tej konfiguracji",
      });

      // Kaskada z klucza obcego omijalaby polityki dostepu, wiec slad decyzji
      // musi chronic wyzwalacz, a nie brak polityki DELETE na historii.
      const { error } = await account.client.from("vulnerabilities").delete().eq("id", vulnId);
      expect(error).not.toBeNull();

      const { data: trail } = await account.client.from("decisions").select("id").eq("vulnerability_id", vulnId);
      expect(trail ?? []).toHaveLength(1);
    } finally {
      await account.client.auth.signOut();
    }
  }, 30_000);

  it("usunięcie zasobu z otwartą pozycją jest odrzucane", async () => {
    const account = await signUpAccount("openitem");
    try {
      const assetId = await insertAsset(account, { name: "srv-mail-01", component: "postfix", version: "3.6" });
      const vulnId = await insertVulnerability(account, assetId, "CVE-2026-0003", 9.1);

      const { error } = await account.client.from("assets").delete().eq("id", assetId);
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("CVE-2026-0003");

      await account.client.from("vulnerabilities").delete().eq("id", vulnId);
      await account.client.from("assets").delete().eq("id", assetId);
    } finally {
      await account.client.auth.signOut();
    }
  }, 30_000);
});
