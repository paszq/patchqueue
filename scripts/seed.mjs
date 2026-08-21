/**
 * Wypełnia konto demonstracyjne danymi do oglądania i klikania.
 *
 * Zestaw jest dobrany tak, żeby dało się zobaczyć wszystkie cztery klasy priorytetu,
 * pozycje po terminie, pozycje bez terminu oraz historię rozstrzygnięć — a przede
 * wszystkim tezę produktu: ta sama ocena CVSS daje inny priorytet zależnie od tego,
 * na jakim zasobie stoi.
 *
 * Uruchomienie: npm run seed
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
if (!URL || !KEY) {
  console.error("Brak SUPABASE_URL / SUPABASE_KEY w .env");
  process.exit(1);
}

const EMAIL = process.env.SEED_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo12345!";

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const ASSETS = [
  { key: "web", name: "srv-web-01", component: "nginx", version: "1.18.0", exposure: "public", criticality: "high" },
  { key: "api", name: "srv-api-01", component: "node", version: "18.12.0", exposure: "public", criticality: "high" },
  { key: "db", name: "srv-db-01", component: "postgresql", version: "14.2", exposure: "internal", criticality: "high" },
  {
    key: "mail",
    name: "srv-mail-01",
    component: "postfix",
    version: "3.6.4",
    exposure: "public",
    criticality: "medium",
  },
  {
    key: "ws",
    name: "ws-ksiegowosc-03",
    component: "windows",
    version: "10 22H2",
    exposure: "internal",
    criticality: "medium",
  },
  {
    key: "nas",
    name: "nas-backup-01",
    component: "synology-dsm",
    version: "7.1.1",
    exposure: "internal",
    criticality: "high",
  },
  {
    key: "lab",
    name: "lab-offline-01",
    component: "openssl",
    version: "3.0.2",
    exposure: "isolated",
    criticality: "low",
  },
  {
    key: "prn",
    name: "drukarka-hall",
    component: "hp-firmware",
    version: "1.4.2",
    exposure: "internal",
    criticality: "low",
  },
];

const VULNS = [
  // Sedno: 5.0 na zasobie wystawionym stoi nad 9.8 na maszynie odciętej.
  {
    asset: "web",
    id: "CVE-2026-1111",
    cvss: 5.0,
    days: 2,
    desc: "Ujawnienie nagłówków serwera w odpowiedzi na spreparowane żądanie.",
  },
  {
    asset: "lab",
    id: "CVE-2026-9999",
    cvss: 9.8,
    days: 30,
    desc: "Zdalne wykonanie kodu w bibliotece kryptograficznej.",
  },

  {
    asset: "web",
    id: "CVE-2026-1234",
    cvss: 9.8,
    days: 10,
    desc: "Przepełnienie bufora w obsłudze nagłówka Host prowadzące do wykonania kodu.",
  },
  {
    asset: "api",
    id: "CVE-2026-2001",
    cvss: 7.5,
    days: 1,
    desc: "Odmowa usługi przez rekurencyjne rozwijanie JSON-a.",
  },
  { asset: "api", id: "CVE-2026-8080", cvss: 4.3, days: 5, desc: "Wyciek ścieżek systemu plików w komunikacie błędu." },
  {
    asset: "db",
    id: "CVE-2026-3310",
    cvss: 9.1,
    days: 20,
    desc: "Podniesienie uprawnień przez funkcję definiowaną przez użytkownika.",
  },
  {
    asset: "mail",
    id: "CVE-2026-4102",
    cvss: 8.1,
    days: 3,
    desc: "Przemyt nagłówków SMTP umożliwiający podszycie się pod nadawcę.",
  },
  {
    asset: "ws",
    id: "CVE-2026-5150",
    cvss: 7.8,
    days: 70,
    desc: "Podniesienie uprawnień lokalnych przez usługę drukowania.",
  },
  {
    asset: "nas",
    id: "CVE-2026-6001",
    cvss: 6.5,
    days: 12,
    desc: "Nieuwierzytelniony odczyt konfiguracji przez panel zarządzania.",
  },
  {
    asset: "prn",
    id: "CVE-2026-7050",
    cvss: 5.3,
    days: 40,
    desc: "Ujawnienie listy zadań drukowania bez uwierzytelnienia.",
  },

  // Rozstrzygnięte — pokazują historię i to, że decyzja zostaje.
  {
    asset: "db",
    id: "CVE-2026-0500",
    cvss: 6.1,
    days: 45,
    desc: "Wyciek metadanych zapytań w logach.",
    decision: { kind: "patched", reason: null },
  },
  {
    asset: "lab",
    id: "CVE-2026-0600",
    cvss: 8.2,
    days: 60,
    desc: "Podatność w module TLS.",
    decision: {
      kind: "rejected",
      reason: "Maszyna w segmencie bez trasy na zewnatrz, modul TLS nieuzywany w tej konfiguracji.",
    },
  },
];

const db = createClient(URL, KEY);

const { data: signIn } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
let userId = signIn?.user?.id ?? null;

if (!userId) {
  const { data, error } = await db.auth.signUp({ email: EMAIL, password: PASSWORD });
  if (error) {
    console.error(`Nie udało się przygotować konta demonstracyjnego: ${error.message}`);
    process.exit(1);
  }
  userId = data.user?.id ?? null;
  console.log(`Założono konto demonstracyjne: ${EMAIL}`);
}

if (!userId) {
  console.error("Konto bez identyfikatora użytkownika — przerywam.");
  process.exit(1);
}

const { data: existing } = await db.from("assets").select("id");
if ((existing ?? []).length > 0) {
  console.log(`Konto ${EMAIL} ma już ${existing.length} zasobów — nie dokładam duplikatów.`);
  console.log("Aby zacząć od zera, usuń zasoby w aplikacji albo użyj innego SEED_EMAIL.");
  process.exit(0);
}

const ids = {};
for (const asset of ASSETS) {
  const { key, ...row } = asset;
  const { data, error } = await db
    .from("assets")
    .insert({ user_id: userId, ...row })
    .select("id")
    .single();
  if (error) {
    console.error(`Zasób ${row.name}: ${error.message}`);
    process.exit(1);
  }
  ids[key] = data.id;
}
console.log(`Dodano ${ASSETS.length} zasobów.`);

let open = 0;
let resolved = 0;
for (const vuln of VULNS) {
  const { data, error } = await db
    .from("vulnerabilities")
    .insert({
      user_id: userId,
      asset_id: ids[vuln.asset],
      identifier: vuln.id,
      cvss: vuln.cvss,
      description: vuln.desc,
      opened_at: daysAgo(vuln.days),
    })
    .select("id")
    .single();
  if (error) {
    console.error(`Podatność ${vuln.id}: ${error.message}`);
    process.exit(1);
  }

  if (vuln.decision) {
    const { error: decisionError } = await db.from("decisions").insert({
      user_id: userId,
      vulnerability_id: data.id,
      kind: vuln.decision.kind,
      reason: vuln.decision.reason,
    });
    if (decisionError) {
      console.error(`Rozstrzygnięcie ${vuln.id}: ${decisionError.message}`);
      process.exit(1);
    }
    await db
      .from("vulnerabilities")
      .update({ status: vuln.decision.kind, resolved_at: daysAgo(vuln.days - 1) })
      .eq("id", data.id);
    resolved += 1;
  } else {
    open += 1;
  }
}

console.log(`Dodano ${VULNS.length} podatności: ${open} otwartych, ${resolved} rozstrzygniętych.`);
console.log("");
console.log(`Zaloguj się na:  ${EMAIL}`);
console.log(`Hasło:           ${PASSWORD}`);
await db.auth.signOut();
