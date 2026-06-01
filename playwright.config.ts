import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration for OG-RMM Platform.
 * Tests run against the local dev server (port 3000).
 * Authentication is handled via a shared storageState fixture.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run sequentially to avoid DB state conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30000, // 30s per test (app has continuous polling so networkidle can be slow)
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Accept all cookies including session cookies
    ignoreHTTPSErrors: true,
  },
  projects: [
    // Setup project: create authenticated session
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // Main test project: uses authenticated session
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    // API-only tests (no browser needed)
    {
      name: "api",
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  // Dev server is already running; no need to start it
  // webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: true },
});
