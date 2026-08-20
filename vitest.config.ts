import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Zdejmowane, gdy S-03 dostarczy pierwszy test reguly priorytetu.
    passWithNoTests: true,
  },
});
