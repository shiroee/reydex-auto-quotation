import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The suites here cover pure modules only, so no DOM environment is needed.
    environment: "node",
    include: ["{app,lib,components}/**/*.test.{ts,tsx}"],
  },
});
