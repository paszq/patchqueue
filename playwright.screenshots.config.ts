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
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "https://patchqueue.paszekkrystian-19.workers.dev",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    ...devices["Desktop Chrome"],
  },
});
