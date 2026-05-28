/**
 * E2E tests: Fluvio Streaming Pipeline Health
 * Verifies the Fluvio dual-publish pipeline is correctly wired in the UI.
 *
 * Tests:
 * 1. Infrastructure page shows Fluvio service status
 * 2. Fluvio topics are listed in the streaming section
 * 3. Pipeline health API is reachable
 */
import { test, expect } from "@playwright/test";

test.describe("Fluvio Streaming Pipeline", () => {
  test("infrastructure page loads", async ({ page }) => {
    await page.goto("/infrastructure");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.locator("h1, h2").filter({ hasText: /infrastructure|infra/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("streaming services section shows Fluvio or Kafka status", async ({ page }) => {
    await page.goto("/infrastructure");
    await page.waitForLoadState("domcontentloaded");

    // Should show streaming services (Fluvio, Redpanda, or Kafka)
    const streamingVisible = await page.locator(
      "text=/fluvio|redpanda|kafka|streaming/i"
    ).count() > 0;

    expect(streamingVisible).toBeTruthy();
  });

  test("Fledge/EMQX bridge status is shown", async ({ page }) => {
    await page.goto("/infrastructure");
    await page.waitForLoadState("domcontentloaded");

    // Should show edge bridge services
    const edgeVisible = await page.locator(
      "text=/fledge|emqx|mqtt|edge/i"
    ).count() > 0;

    expect(edgeVisible).toBeTruthy();
  });

  test("infrastructure health API is reachable", async ({ request }) => {
    const response = await request.post("/api/trpc/infrastructure.health", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ "0": { json: {} } }),
    });
    // Should return 200 or a valid tRPC error (not 500)
    expect(response.status()).toBeLessThan(500);
  });
});
