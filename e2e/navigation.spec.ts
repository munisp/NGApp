/**
 * E2E tests: Navigation smoke test
 * Verifies that all major pages load without errors.
 * Uses the authenticated session from auth.setup.ts.
 */
import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "Overview", path: "/", heading: /overview|operations/i },
  { name: "Wells", path: "/wells", heading: /well fleet|wells/i },
  { name: "Alarms", path: "/alarms", heading: /alarm management|alarms/i },
  { name: "Analytics", path: "/analytics", heading: /production analytics|analytics/i },
  { name: "Field Map", path: "/map", heading: /field map|map/i },
  { name: "Workovers", path: "/workovers", heading: /workover/i },
  { name: "PTW", path: "/permits", heading: /permit|ptw/i },
  { name: "Regulatory", path: "/regulatory", heading: /regulatory/i },
  { name: "Shift Handover", path: "/shift-handover", heading: /shift|handover/i },
  { name: "FPSO", path: "/fpso", heading: /fpso|offshore/i },
  { name: "Calibration", path: "/calibration", heading: /calibration/i },
  { name: "Connectivity", path: "/connectivity", heading: /site connectivity|connectivity/i },
  { name: "Actuator Control", path: "/actuator-control", heading: /actuator/i },
  { name: "ML Insights", path: "/ml-insights", heading: /ml insights|machine learning|insights/i },
  { name: "HSE", path: "/hse", heading: /hse|health|safety/i },
  { name: "SIS", path: "/sis", heading: /safety instrumented|sis/i },
  { name: "Digital Twin", path: "/digital-twin", heading: /digital twin/i },
  { name: "Production Optimization", path: "/production-optimization", heading: /production optimization/i },
  { name: "Financials", path: "/financials", heading: /financial operations|financial/i },
  { name: "Devices", path: "/device-management", heading: /device management|device|fleet/i },
  { name: "OTA", path: "/ota-management", heading: /ota firmware|ota|firmware/i },
  { name: "Settings", path: "/settings", heading: /settings/i },
  { name: "Benchmarking", path: "/influx-benchmark", heading: /influxdb benchmark|benchmark|influx/i },
];

test.describe("Navigation Smoke Tests", () => {
  for (const page_info of PAGES) {
    test(`${page_info.name} page loads without errors`, async ({ page }) => {
      // Collect console errors
      const consoleErrors: string[] = [];
      page.on("console", msg => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(page_info.path);
      // Use domcontentloaded instead of networkidle — the app has continuous polling
      await page.waitForLoadState("domcontentloaded");

      // Should not redirect to login
      await expect(page).not.toHaveURL(/oauth|login/);

      // Should have a visible heading
      const heading = page.locator("h1, h2").filter({ hasText: page_info.heading }).first();
      await expect(heading).toBeVisible({ timeout: 8000 });

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes("favicon") &&
        !err.includes("baseline-browser-mapping") &&
        !err.includes("ResizeObserver") &&
        !err.includes("Non-Error promise rejection") &&
        !err.includes("Failed to load resource") &&
        !err.includes("net::ERR_") &&
        !err.includes("unique \"key\" prop") &&
        !err.includes("Each child in a list")
      );

      expect(criticalErrors).toHaveLength(0);
    });
  }
});
