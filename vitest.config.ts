import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Testy integracyjne czytają konfigurację ze środowiska. Lokalnie mieszka ona w .env,
// w pipelinie w sekretach repozytorium. Bez zależności zewnętrznej — Node potrafi to sam.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
