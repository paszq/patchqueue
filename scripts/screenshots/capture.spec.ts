/**
 * Zrzuty ekranu do formularza zgłoszeniowego certyfikacji.
 *
 * To nie jest test zestawu jakościowego — asercje służą wyłącznie temu, żeby
 * obrazek nie powstał, zanim strona faktycznie się załaduje. Leży poza `e2e/`,
 * bo pipeline nie ma powodu tego uruchamiać przy każdej zmianie.
 *
 * Uruchomienie (domyślnie przeciw produkcji):
 *   npx playwright test --config playwright.screenshots.config.ts
 */
import { expect, test } from "@playwright/test";

const DIR = "docs/screenshots";
const EMAIL = process.env.DEMO_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345!";

test("zrzuty ekranu do zgłoszenia", async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Ekran logowania — mechanizm kontroli dostępu
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/01-logowanie.png`, fullPage: true });

  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/queue/, { timeout: 30_000 });

  // 2. Kolejka — teza produktu: 5.0 na zasobie wystawionym nad 9.8 na odciętym
  await expect(page.getByRole("heading", { name: "Kolejka" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/02-kolejka.png`, fullPage: true });

  // 3. Pozycja — składniki priorytetu i historia rozstrzygnięć
  await page.getByRole("link", { name: /^CVE-/ }).first().click();
  await page.waitForURL(/\/items\//);
  await expect(page.getByText("Skąd ten priorytet")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/03-pozycja-priorytet.png`, fullPage: true });

  // 4. Zasoby — CRUD oraz kolumna z liczbą otwartych pozycji
  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: "Zasoby" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/04-zasoby.png`, fullPage: true });

  // 5. Wczytywanie — załącznik pliku i opis oczekiwanych kolumn
  await page.goto("/import");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/05-wczytywanie.png`, fullPage: true });

  // 6. Guardrail w działaniu: odmowa usunięcia zasobu z otwartymi pozycjami.
  //    Operacja jest bezpieczna — zasób ma otwarte pozycje, więc baza odmawia
  //    i nic nie znika. Odmowa wymienia pozycje, które blokują.
  await page.goto("/assets");
  await page.getByRole("link", { name: "srv-web-01" }).click();
  await page.waitForURL(/\/assets\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Usuń zasób" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.screenshot({ path: `${DIR}/06-guardrail-odmowa.png`, fullPage: true });
});
