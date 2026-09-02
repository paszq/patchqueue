/**
 * Zrzuty ekranu do zgłoszenia bloku 10xChampion.
 *
 * Kurs wymaga trzech dowodów na działający pipeline CI/CD do przeglądu kodu:
 * widoku pipeline'u z co najmniej jednym jobem, logów podczas operacji przeglądu
 * oraz PR-a z komentarzem code review od agenta.
 *
 * Repozytorium jest publiczne, więc strony przebiegów i logi są dostępne bez
 * logowania — zrzuty powstają na tych samych adresach, które zobaczy sprawdzający.
 *
 * Uruchomienie:
 *   npx playwright test --config playwright.champion.config.ts
 */
import { expect, test } from "@playwright/test";

const DIR = "docs/screenshots/champion";
const REPO = "https://github.com/paszq/patchqueue";
const RUN = "33672256570";
const JOB = "100388450963";

test("zrzuty do zgłoszenia Championa", async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Widok pipeline'u: lista przebiegów workflow przegladajacego PR-y
  await page.goto(`${REPO}/actions/workflows/impl-review.yml`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/01-pipeline-lista-przebiegow.png`, fullPage: true });

  // 2. Pojedynczy przebieg wraz z jobem i jego krokami
  await page.goto(`${REPO}/actions/runs/${RUN}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/02-przebieg-z-jobem.png`, fullPage: true });

  // 3. Logi joba podczas operacji przeglądu kodu
  await page.goto(`${REPO}/actions/runs/${RUN}/job/${JOB}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: `${DIR}/03-logi-joba.png`, fullPage: true });

  // 4. PR z komentarzem code review od agenta
  await page.goto(`${REPO}/pull/1`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Implementation Review (CI)").first()).toBeVisible();
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${DIR}/04-pr-komentarz-agenta.png`, fullPage: true });

  // 5. Raport przeglądu zacommitowany na gałąź przez agenta
  await page.goto(`${REPO}/blob/duplicate-items/context/changes/duplicate-items/reviews/impl-review.md`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/05-raport-przegladu.png`, fullPage: true });
});
