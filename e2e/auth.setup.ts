/**
 * Playwright auth setup — creates a real JWT session cookie for E2E tests.
 * Runs once before all tests via the "setup" project in playwright.config.ts.
 * The resulting storageState is saved to e2e/.auth/user.json and reused.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

setup("authenticate as admin operator", async ({ page }) => {
  // Use page.request so the session cookie is stored in the browser context
  const response = await page.request.post("http://localhost:3000/api/e2e/session", {
    data: { role: "admin" },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.role).toBe("admin");

  // Navigate to the app to confirm the session works
  // Use domcontentloaded instead of networkidle — the app has continuous polling
  // which prevents networkidle from ever resolving
  await page.goto("http://localhost:3000/");
  await page.waitForLoadState("domcontentloaded");

  // Wait for the React app to render the sidebar (confirms auth is working)
  await page.waitForSelector("nav, aside, [class*='sidebar']", { timeout: 10000 }).catch(() => {});

  // The app should show the Overview page (not a login redirect)
  await expect(page).not.toHaveURL(/oauth|login/, { timeout: 5000 });

  // Save the authenticated browser state (includes cookies) for reuse in all tests
  await page.context().storageState({ path: AUTH_FILE });
});
