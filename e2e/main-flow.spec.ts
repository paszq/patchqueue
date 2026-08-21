/**
 * Test głównego przepływu z perspektywy użytkownika — US-01 z PRD, od rejestracji do
 * rozstrzygnięcia pozycji.
 *
 * Sprawdza nie samo „da się kliknąć", lecz tezę produktu: że kolejka układa pozycje
 * inaczej, niż zrobiłoby to sortowanie po samej ocenie CVSS. Podatność 5.0 na zasobie
 * wystawionym do sieci publicznej musi stanąć nad podatnością 9.8 na maszynie odciętej.
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "TestoweHaslo123!";

const configured = (process.env.SUPABASE_URL ?? "") !== "" && (process.env.SUPABASE_KEY ?? "") !== "";

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

function freshEmail(): string {
  return `patchqueue-e2e-${Date.now().toString()}-${Math.floor(Math.random() * 1e6).toString()}@example.com`;
}

/**
 * Formularze uwierzytelniania są wyspami Reacta ze stanem kontrolowanym. Wypełnienie
 * pola przed hydracją ustawia wartość w DOM, ale nie w stanie komponentu — walidacja
 * po stronie przeglądarki widzi wtedy pustkę i blokuje wysłanie. Wpisujemy więc do
 * skutku, aż wartość utrzyma się po przejęciu pola przez komponent.
 */
async function fillHydrated(page: Page, selector: string, value: string): Promise<void> {
  const field = page.locator(selector);
  for (let attempt = 0; attempt < 5; attempt++) {
    await field.fill(value);
    try {
      await expect(field).toHaveValue(value, { timeout: 1_000 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  throw new Error(`Pole ${selector} nie przyjęło wartości — wyspa nie została uaktywniona`);
}

async function signUp(page: Page): Promise<void> {
  await page.goto("/auth/signup");
  await page.waitForLoadState("networkidle");
  await fillHydrated(page, "#email", freshEmail());
  await fillHydrated(page, "#password", PASSWORD);
  await fillHydrated(page, "#confirmPassword", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await page.waitForURL(/\/queue/, { timeout: 20_000 });
  } catch {
    const visible = await page.locator("body").innerText();
    throw new Error(`Rejestracja nie doprowadziła do kolejki. Adres: ${page.url()}\n${visible.slice(0, 400)}`);
  }
}

async function addAsset(
  page: Page,
  asset: { name: string; component: string; version: string; exposure: string; criticality: string },
): Promise<void> {
  await page.goto("/assets");
  await page.locator("#name").fill(asset.name);
  await page.locator("#component").fill(asset.component);
  await page.locator("#version").fill(asset.version);
  await page.locator("#exposure").selectOption(asset.exposure);
  await page.locator("#criticality").selectOption(asset.criticality);
  await page.getByRole("button", { name: "Dodaj zasób" }).click();
  await page.waitForURL(/\/assets\/[0-9a-f-]{36}/);
}

async function addVulnerability(page: Page, identifier: string, cvss: string): Promise<void> {
  await page.locator("#identifier").fill(identifier);
  await page.locator("#cvss").fill(cvss);
  await page.getByRole("button", { name: "Dopisz i wylicz priorytet" }).click();
  await page.waitForURL(/\/items\/[0-9a-f-]{36}/);
}

test.describe("główny przepływ", () => {
  test.skip(!configured, "brak konfiguracji Supabase");

  test("od pustej kolejki do rozstrzygniętej pozycji", async ({ page }) => {
    await signUp(page);

    // Pusta kolejka tłumaczy, co zrobić — nie jest listą zerową.
    await page.goto("/queue");
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Przejdź do zasobów" })).toBeVisible();

    // Zasób wystawiony do sieci publicznej, krytyczny dla działania.
    await addAsset(page, {
      name: "srv-web-01",
      component: "nginx",
      version: "1.18.0",
      exposure: "public",
      criticality: "high",
    });
    await addVulnerability(page, "CVE-2026-1234", "9.8");

    // Priorytet widoczny natychmiast, wraz ze składnikami, z których powstał.
    await expect(page.getByText("krytyczny")).toBeVisible();
    await expect(page.getByText("Skąd ten priorytet")).toBeVisible();
    await expect(page.getByRole("cell", { name: "9.8", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "× 1" }).first()).toBeVisible();

    // Kolejka pokazuje pozycję na szczycie.
    await page.goto("/queue");
    await expect(page.getByRole("link", { name: "CVE-2026-1234" })).toBeVisible();

    // Rozstrzygnięcie zdejmuje pozycję z kolejki i zostaje w historii.
    await page.getByRole("link", { name: "CVE-2026-1234" }).click();
    await page.getByRole("button", { name: "Oznacz jako załataną" }).click();
    await expect(page.getByText("załatana").first()).toBeVisible();
    await expect(page.getByText("Historia rozstrzygnięć")).toBeVisible();
    await expect(page.getByText("załatane")).toBeVisible();

    await page.goto("/queue");
    await expect(page.getByText("Kolejka jest pusta.")).toBeVisible();
  });

  test("kolejka układa się inaczej niż sortowanie po samej ocenie CVSS", async ({ page }) => {
    await signUp(page);

    await addAsset(page, {
      name: "lab-offline-01",
      component: "openssl",
      version: "3.0.2",
      exposure: "isolated",
      criticality: "low",
    });
    await addVulnerability(page, "CVE-2026-9999", "9.8");

    await addAsset(page, {
      name: "srv-public-01",
      component: "nginx",
      version: "1.18.0",
      exposure: "public",
      criticality: "high",
    });
    await addVulnerability(page, "CVE-2026-1111", "5.0");

    await page.goto("/queue");
    const identifiers = (await page.locator("tbody tr td:nth-child(2) a").allTextContents()).map((t) => t.trim());

    // Wyższa ocena CVSS na maszynie odciętej ustępuje niższej na zasobie wystawionym.
    expect(identifiers).toEqual(["CVE-2026-1111", "CVE-2026-9999"]);
  });

  test("odrzucenie bez powodu nie przechodzi, a zapisane rozstrzygnięcie zostaje w historii", async ({ page }) => {
    await signUp(page);

    await addAsset(page, {
      name: "srv-db-01",
      component: "postgresql",
      version: "14.2",
      exposure: "internal",
      criticality: "medium",
    });
    await addVulnerability(page, "CVE-2026-2222", "7.5");

    const reasonField = page.locator("#reason");
    await expect(reasonField).toHaveAttribute("required", "");

    await reasonField.fill("komponent nieużywany w tej konfiguracji");
    await page.getByRole("button", { name: "Odrzuć" }).click();

    await expect(page.getByText("odrzucone")).toBeVisible();
    await expect(page.getByText("komponent nieużywany w tej konfiguracji")).toBeVisible();

    // Przywrócenie dopisuje wpis, nie kasuje poprzedniego.
    await page.getByRole("button", { name: "Przywróć do kolejki" }).click();
    await expect(page.getByText("przywrócone do kolejki")).toBeVisible();
    await expect(page.getByText("komponent nieużywany w tej konfiguracji")).toBeVisible();
  });

  test("zasobu z otwartą pozycją nie da się usunąć", async ({ page }) => {
    await signUp(page);

    await addAsset(page, {
      name: "srv-mail-01",
      component: "postfix",
      version: "3.6",
      exposure: "public",
      criticality: "high",
    });
    await addVulnerability(page, "CVE-2026-3333", "9.1");

    await page.getByRole("link", { name: "srv-mail-01" }).click();
    await page.getByRole("button", { name: "Usuń zasób" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("CVE-2026-3333");
    await expect(page.getByRole("link", { name: "CVE-2026-3333" })).toBeVisible();
  });
});
