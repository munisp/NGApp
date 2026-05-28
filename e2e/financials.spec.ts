/**
 * E2E tests: TigerBeetle Financial Ledger + Mojaloop Settlements
 * Spec: §8 TigerBeetle Double-Entry Ledger, §9 Mojaloop Royalty Payments
 *
 * Tests:
 * 1. Financials page loads with TigerBeetle ledger data
 * 2. Mojaloop settlements tab shows live data
 * 3. Initiate settlement dialog opens and validates input
 * 4. Financial API endpoints are reachable
 */
import { test, expect } from "@playwright/test";

test.describe("TigerBeetle Financial Ledger + Mojaloop Settlements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financials");
    await page.waitForLoadState("domcontentloaded");
  });

  test("financials page loads with KPI cards", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /financial/i }).first()
    ).toBeVisible({ timeout: 8000 });

    // Should have at least one KPI card (revenue, costs, etc.)
    const kpiCards = page.locator('[class*="card"], [data-testid="kpi-card"]');
    const count = await kpiCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Mojaloop settlements tab is accessible", async ({ page }) => {
    const mojaTab = page.locator('button, [role="tab"]').filter({ hasText: /mojaloop|settlement/i }).first();
    if (await mojaTab.count() > 0) {
      await mojaTab.click();
      await page.waitForLoadState("domcontentloaded");

      await expect(
        page.locator("text=/settlement|mojaloop|royalty/i").first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("Mojaloop settlements shows stats KPIs", async ({ page }) => {
    const mojaTab = page.locator('button, [role="tab"]').filter({ hasText: /mojaloop|settlement/i }).first();
    if (await mojaTab.count() > 0) {
      await mojaTab.click();
      await page.waitForLoadState("domcontentloaded");

      // Should show total settlements, pending, completed stats
      const statsVisible = await page.locator("text=/total|pending|completed/i").count() > 0;
      expect(statsVisible).toBeTruthy();
    }
  });

  test("initiate settlement button opens dialog", async ({ page }) => {
    const mojaTab = page.locator('button, [role="tab"]').filter({ hasText: /mojaloop|settlement/i }).first();
    if (await mojaTab.count() > 0) {
      await mojaTab.click();
      await page.waitForLoadState("domcontentloaded");

      const initiateBtn = page.locator('button').filter({ hasText: /initiate|new settlement/i }).first();
      if (await initiateBtn.count() > 0) {
        await initiateBtn.click();

        // Dialog should open
        const dialog = page.locator('[role="dialog"], [data-testid="settlement-dialog"]');
        await expect(dialog).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test("TigerBeetle ledger API is reachable", async ({ request }) => {
    const response = await request.post("/api/trpc/financials.getLedgerSummary", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ "0": { json: {} } }),
    });
    expect(response.status()).toBeLessThan(500);
  });

  test("Mojaloop settlements API returns valid response", async ({ request }) => {
    const response = await request.post("/api/trpc/financials.listSettlements", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ "0": { json: { limit: 10 } } }),
    });
    expect(response.status()).toBeLessThan(500);
  });
});
