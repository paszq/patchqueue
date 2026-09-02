import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

/**
 * Osobna konfiguracja wyłącznie do generowania zrzutów ekranu. Nie należy do
 * zestawu jakościowego: `e2e/` zostaje nietknięte, więc pipeline nie zaczyna
 * nagle logować się na konto demonstracyjne przy każdej zmianie.
 */
export default defineConfig({
  testDir: "./scripts/screenshots",
  testMatch: "champion.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    // Rozwiniecie profilu urzadzenia MUSI byc pierwsze. Postawione na koncu
    // nadpisywalo viewport i deviceScaleFactor ponizej, wiec zrzuty wychodzily
    // w 1280 px bez skalowania, mimo ze konfiguracja mowila co innego.
    ...devices["Desktop Chrome"],
    baseURL: "https://github.com",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
});
