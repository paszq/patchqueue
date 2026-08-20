/**
 * Dowód, że izolacja kont działa — nie przegląd konfiguracji, tylko próba sięgnięcia
 * po cudze dane z drugiego konta.
 *
 * `tech-stack.md` wymienia to jako przyjęte ryzyko: polityki dostępu na poziomie
 * wierszy łatwo skonfigurować pozornie, a polityka zapisana i nieaktywna wygląda
 * identycznie jak działająca. Ten test odróżnia jedno od drugiego.
 *
 * Test uderza w prawdziwy projekt i zakłada dwa konta o losowych adresach. Pomija się
 * sam, gdy konfiguracja jest nieobecna, żeby nie wywracać pipeline'u bez sekretów.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const configured = Boolean(URL && KEY);

if (!configured) {
  // Cicho pominięty test bezpieczeństwa wygląda w raporcie tak samo jak zdany.
  console.warn(
    "\n[UWAGA] Testy izolacji kont POMINIĘTE — brak SUPABASE_URL / SUPABASE_KEY.\n" +
      "         Dowód na izolację danych NIE został przeprowadzony w tym przebiegu.\n"
  );
}

const suite = configured ? describe : describe.skip;

function freshEmail(tag: string): string {
  return `patchqueue-test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUpClient(tag: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(URL!, KEY!);
  const email = freshEmail(tag);
  const { data, error } = await client.auth.signUp({ email, password: "TestoweHaslo123!" });
  if (error) throw new Error(`Nie udało się założyć konta ${tag}: ${error.message}`);
  const userId = data.user?.id;
  if (!userId) throw new Error(`Konto ${tag} powstało bez identyfikatora użytkownika`);
  if (!data.session) throw new Error("Rejestracja nie zwróciła sesji — czy potwierdzanie e-maila jest wyłączone?");
  return { client, userId };
}

suite("izolacja danych między kontami", () => {
  let alice: { client: SupabaseClient; userId: string };
  let bob: { client: SupabaseClient; userId: string };
  let aliceAssetId: string;

  beforeAll(async () => {
    alice = await signUpClient("alice");
    bob = await signUpClient("bob");

    const { data, error } = await alice.client
      .from("assets")
      .insert({
        user_id: alice.userId,
        name: "srv-web-01",
        component: "nginx",
        version: "1.18.0",
        exposure: "public",
        criticality: "high",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Alice nie mogła dodać zasobu: ${error.message}`);
    aliceAssetId = data.id as string;
  }, 30_000);

  afterAll(async () => {
    await alice?.client.from("assets").delete().eq("id", aliceAssetId);
    await alice?.client.auth.signOut();
    await bob?.client.auth.signOut();
  });

  it("właściciel widzi własny zasób", async () => {
    const { data, error } = await alice.client.from("assets").select("id").eq("id", aliceAssetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("drugie konto nie widzi cudzego zasobu przy odczycie wszystkich", async () => {
    const { data, error } = await bob.client.from("assets").select("id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).not.toContain(aliceAssetId);
  });

  it("drugie konto nie widzi cudzego zasobu nawet znając jego identyfikator", async () => {
    const { data, error } = await bob.client.from("assets").select("id").eq("id", aliceAssetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("drugie konto nie może zmienić cudzego zasobu", async () => {
    const { data, error } = await bob.client
      .from("assets")
      .update({ exposure: "isolated" })
      .eq("id", aliceAssetId)
      .select("id");
    expect(error?.code ?? "").not.toBe("PGRST301");
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await alice.client.from("assets").select("exposure").eq("id", aliceAssetId).single();
    expect(after?.exposure).toBe("public");
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
    const anonymous = createClient(URL!, KEY!);
    const { data } = await anonymous.from("assets").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

suite("nienaruszalność rozstrzygnięć", () => {
  it("zapisanego rozstrzygnięcia nie da się usunąć ani zmienić", async () => {
    const { client, userId } = await signUpClient("trail");
    try {
      const { data: asset } = await client
        .from("assets")
        .insert({
          user_id: userId,
          name: "srv-db-01",
          component: "postgresql",
          version: "14.2",
          exposure: "internal",
          criticality: "high",
        })
        .select("id")
        .single();

      const { data: vuln } = await client
        .from("vulnerabilities")
        .insert({
          user_id: userId,
          asset_id: asset!.id,
          identifier: "CVE-2026-0001",
          cvss: 7.5,
          description: "test",
        })
        .select("id")
        .single();

      const { data: decision, error: insertError } = await client
        .from("decisions")
        .insert({
          user_id: userId,
          vulnerability_id: vuln!.id,
          kind: "rejected",
          reason: "komponent nieużywany w tej konfiguracji",
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();

      const { data: updated } = await client
        .from("decisions")
        .update({ reason: "zmienione uzasadnienie" })
        .eq("id", decision!.id)
        .select("id");
      expect(updated ?? []).toHaveLength(0);

      await client.from("decisions").delete().eq("id", decision!.id);
      const { data: still } = await client.from("decisions").select("reason").eq("id", decision!.id).single();
      expect(still?.reason).toBe("komponent nieużywany w tej konfiguracji");

      await client.from("vulnerabilities").delete().eq("id", vuln!.id);
      await client.from("assets").delete().eq("id", asset!.id);
    } finally {
      await client.auth.signOut();
    }
  }, 30_000);

  it("odrzucenie bez powodu jest odrzucane przez bazę", async () => {
    const { client, userId } = await signUpClient("noreason");
    try {
      const { data: asset } = await client
        .from("assets")
        .insert({
          user_id: userId,
          name: "srv-app-01",
          component: "openssl",
          version: "3.0.2",
          exposure: "public",
          criticality: "medium",
        })
        .select("id")
        .single();

      const { data: vuln } = await client
        .from("vulnerabilities")
        .insert({ user_id: userId, asset_id: asset!.id, identifier: "CVE-2026-0002", cvss: 5.3 })
        .select("id")
        .single();

      const { error } = await client
        .from("decisions")
        .insert({ user_id: userId, vulnerability_id: vuln!.id, kind: "rejected", reason: "   " });
      expect(error).not.toBeNull();

      await client.from("vulnerabilities").delete().eq("id", vuln!.id);
      await client.from("assets").delete().eq("id", asset!.id);
    } finally {
      await client.auth.signOut();
    }
  }, 30_000);

  it("usunięcie zasobu z otwartą pozycją jest odrzucane", async () => {
    const { client, userId } = await signUpClient("openitem");
    try {
      const { data: asset } = await client
        .from("assets")
        .insert({
          user_id: userId,
          name: "srv-mail-01",
          component: "postfix",
          version: "3.6",
          exposure: "public",
          criticality: "high",
        })
        .select("id")
        .single();

      const { data: vuln } = await client
        .from("vulnerabilities")
        .insert({ user_id: userId, asset_id: asset!.id, identifier: "CVE-2026-0003", cvss: 9.1 })
        .select("id")
        .single();

      const { error } = await client.from("assets").delete().eq("id", asset!.id);
      expect(error).not.toBeNull();
      expect(error?.message).toContain("CVE-2026-0003");

      await client.from("vulnerabilities").delete().eq("id", vuln!.id);
      await client.from("assets").delete().eq("id", asset!.id);
    } finally {
      await client.auth.signOut();
    }
  }, 30_000);
});
