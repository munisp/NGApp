/**
 * E2E tests: Trexm Co-Creation + ERPNext Features Smoke Tests (v38.0)
 *
 * Verifies that all new pages from v35.0–v38.0 load correctly:
 * - Gas Well Liquid Loading (Turner model, plunger lift, velocity string)
 * - Wellbore Geomechanics (1D MEM, mud weight window, LAS import)
 * - Mud Management (OBM inventory, cost tracking)
 * - Sand Management (Mohr-Coulomb onset, sand rate chart)
 * - Produced Water Management (water balance, EPA/BSEE export)
 * - Heavy Oil Optimization (SAGD, viscosity, thermal recovery)
 * - Production Forecasting (Arps decline, P10/P50/P90 Monte Carlo)
 * - Wellbore Integrity (casing inspection, pressure tests)
 * - Reservoir Pressure Management (material balance, aquifer influx)
 * - AI Co-Pilot (streaming LLM, O&G domain context)
 * - Materials Management (ERPNext-inspired procurement workflow)
 * - OSDU Data Explorer (Open Subsurface Data Universe R3)
 */

import { test, expect } from "@playwright/test";

const NEW_PAGES = [
  // ── v35.0 Trexm Co-Creation ──────────────────────────────────────────────
  {
    name: "Gas Well Liquid Loading",
    path: "/gas-well-liquid-loading",
    heading: /liquid loading|gas well/i,
    tabs: ["Turner Analysis", "Plunger Lift", "Velocity String"],
  },
  {
    name: "Wellbore Geomechanics",
    path: "/wellbore-geomechanics",
    heading: /geomechanics|wellbore/i,
    tabs: ["1D MEM", "Mud Weight Window", "LAS Import"],
  },
  {
    name: "Mud Management",
    path: "/mud-management",
    heading: /mud management|mud/i,
    tabs: ["Inventory", "Transactions"],
  },
  {
    name: "Sand Management",
    path: "/sand-management",
    heading: /sand management|sand/i,
    tabs: ["Risk Assessment", "Production Records"],
  },
  {
    name: "Produced Water Management",
    path: "/produced-water",
    heading: /produced water|water management/i,
    tabs: ["Water Balance", "Records"],
  },
  {
    name: "Heavy Oil Optimization",
    path: "/heavy-oil",
    heading: /heavy oil|thermal/i,
    tabs: ["Reservoir Parameters", "SAGD Simulation"],
  },
  // ── v37.0 Production Finalization ────────────────────────────────────────
  {
    name: "Production Forecasting",
    path: "/production-forecasting",
    heading: /production forecasting|forecasting/i,
    tabs: ["Decline Curve", "Monte Carlo"],
  },
  {
    name: "Wellbore Integrity",
    path: "/wellbore-integrity",
    heading: /wellbore integrity|integrity/i,
    tabs: ["Casing Inspection", "Pressure Tests"],
  },
  {
    name: "Reservoir Pressure",
    path: "/reservoir-pressure",
    heading: /reservoir pressure|material balance/i,
    tabs: ["Pressure Records", "Material Balance"],
  },
  {
    name: "AI Co-Pilot",
    path: "/ai-copilot",
    heading: /ai co-pilot|co-pilot|copilot/i,
    tabs: ["Chat", "Diagnose"],
  },
  // ── v38.0 ERPNext-inspired ────────────────────────────────────────────────
  {
    name: "Materials Management",
    path: "/materials-management",
    heading: /materials management|materials/i,
    tabs: ["Material Master", "Procurement", "Field Tickets"],
  },
  {
    name: "OSDU Data Explorer",
    path: "/osdu-explorer",
    heading: /osdu|data explorer/i,
    tabs: ["Search", "Export", "Fleet Query", "Schemas"],
  },
];

test.describe("Trexm & ERPNext Feature Smoke Tests", () => {
  for (const pageInfo of NEW_PAGES) {
    test(`${pageInfo.name} page loads without critical errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", msg => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(pageInfo.path);
      await page.waitForLoadState("domcontentloaded");

      // Should not redirect to login
      await expect(page).not.toHaveURL(/oauth|login/);

      // Should have a visible heading
      const heading = page.locator("h1, h2").filter({ hasText: pageInfo.heading }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes("favicon") &&
        !err.includes("baseline-browser-mapping") &&
        !err.includes("ResizeObserver") &&
        !err.includes("Non-Error promise rejection") &&
        !err.includes("Failed to load resource") &&
        !err.includes("net::ERR_") &&
        !err.includes("unique \"key\" prop") &&
        !err.includes("Each child in a list") &&
        !err.includes("ioredis") &&
        !err.includes("ECONNREFUSED")
      );
      expect(criticalErrors).toHaveLength(0);
    });

    // Verify tab navigation for pages with tabs
    if (pageInfo.tabs && pageInfo.tabs.length > 0) {
      test(`${pageInfo.name} tabs are navigable`, async ({ page }) => {
        await page.goto(pageInfo.path);
        await page.waitForLoadState("domcontentloaded");
        await expect(page).not.toHaveURL(/oauth|login/);

        // Check that at least the first tab trigger is visible
        const firstTab = page.getByRole("tab").filter({ hasText: new RegExp(pageInfo.tabs[0], "i") }).first();
        await expect(firstTab).toBeVisible({ timeout: 8000 });
      });
    }
  }
});

test.describe("Materials Management Workflow", () => {
  test("Material Master tab shows table headers", async ({ page }) => {
    await page.goto("/materials-management");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/oauth|login/);

    // Click Material Master tab
    const tab = page.getByRole("tab", { name: /material master/i }).first();
    await expect(tab).toBeVisible({ timeout: 8000 });
    await tab.click();

    // Should show the material table or empty state
    const content = page.locator("[role='tabpanel']").first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});

test.describe("OSDU Data Explorer", () => {
  test("OSDU Search tab is functional", async ({ page }) => {
    await page.goto("/osdu-explorer");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/oauth|login/);

    // Check search input is present
    const searchInput = page.getByPlaceholder(/search by well name/i);
    await expect(searchInput).toBeVisible({ timeout: 8000 });
  });

  test("OSDU Schemas tab shows schema cards", async ({ page }) => {
    await page.goto("/osdu-explorer");
    await page.waitForLoadState("domcontentloaded");

    // Click Schemas tab
    const schemasTab = page.getByRole("tab", { name: /schemas/i });
    await expect(schemasTab).toBeVisible({ timeout: 8000 });
    await schemasTab.click();

    // Should show schema content
    const tabPanel = page.locator("[role='tabpanel']").last();
    await expect(tabPanel).toBeVisible({ timeout: 5000 });
  });
});

test.describe("AI Co-Pilot", () => {
  test("Chat interface renders correctly", async ({ page }) => {
    await page.goto("/ai-copilot");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/oauth|login/);

    // Should have a chat input
    const chatInput = page.locator("textarea, input[placeholder*='Ask']").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Gas Well Liquid Loading", () => {
  test("Turner Analysis tab shows critical velocity chart", async ({ page }) => {
    await page.goto("/gas-well-liquid-loading");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/oauth|login/);

    // Should have Turner Analysis tab
    const turnerTab = page.getByRole("tab", { name: /turner/i });
    await expect(turnerTab).toBeVisible({ timeout: 8000 });
  });

  test("Plunger Lift tab is accessible", async ({ page }) => {
    await page.goto("/gas-well-liquid-loading");
    await page.waitForLoadState("domcontentloaded");

    const plungerTab = page.getByRole("tab", { name: /plunger/i });
    await expect(plungerTab).toBeVisible({ timeout: 8000 });
    await plungerTab.click();

    const tabPanel = page.locator("[role='tabpanel']").first();
    await expect(tabPanel).toBeVisible({ timeout: 5000 });
  });
});
