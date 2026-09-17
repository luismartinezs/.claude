import { defineConfig, devices } from "@playwright/test"

/**
 * Runs against the local dev stack. Start it with ./dev first; the suite does
 * not boot servers itself so a failing run points at the app, not at start-up.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.ts",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    // The site origin, as in production: it serves the site and proxies /app and /api.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
