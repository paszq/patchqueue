/**
 * Zrzuty dokumentujace przechodzacy zestaw testow w pipelinie.
 *
 * Zrodlem jest prawdziwy przebieg CI na galezi main, dostepny publicznie -
 * ten sam adres, ktory moze otworzyc kazdy czytelnik repozytorium.
 *
 * Uruchomienie:
 *   npx playwright test --config playwright.champion.config.ts
 */
import { expect, test } from "@playwright/test";

const DIR = "docs/screenshots";
const REPO = "https://github.com/paszq/patchqueue";
const RUN = "34253057964";
const JOB_BRAMKI = "102151942924";
const JOB_PRZEGLADOWE = "102152455273";

test("zrzuty przechodzacych testow", async ({ page }) => {
  test.setTimeout(180_000);

  // Testy jednostkowe i integracyjne — krok 8 w zadaniu bramek jakosci
  await page.goto(`${REPO}/actions/runs/${RUN}/job/${JOB_BRAMKI}#step:8:1`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5_000);
  await expect(page.getByText("Testy jednostkowe i integracyjne").first()).toBeVisible();
  await page.screenshot({ path: `${DIR}/07-testy-jednostkowe-i-integracyjne.png`, fullPage: true });

  // Testy przegladowe — osobne zadanie
  await page.goto(`${REPO}/actions/runs/${RUN}/job/${JOB_PRZEGLADOWE}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: `${DIR}/08-testy-przegladowe.png`, fullPage: true });
});
