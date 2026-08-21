import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Bez tego proces uruchamiajacy testy nie widzi konfiguracji i caly zestaw pomija sie
// po cichu, mimo ze serwer deweloperski dziala poprawnie.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const PORT = 4321;

export default defineConfig({
  testDir: "./e2e",
  // Testy dzielą jeden serwer deweloperski i jeden projekt bazy. Równoległość dawała
  // zatory na kompilacji stron w locie, a nie realny zysk przy czterech scenariuszach.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
