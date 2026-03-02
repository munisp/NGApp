import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("loads dashboard page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NEXCOM Exchange/);
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("navigates to trade page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/trade"]');
    await expect(page).toHaveURL("/trade");
  });

  test("navigates to markets page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/markets"]');
    await expect(page).toHaveURL("/markets");
  });

  test("navigates to portfolio page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/portfolio"]');
    await expect(page).toHaveURL("/portfolio");
  });

  test("navigates to analytics page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/analytics"]');
    await expect(page).toHaveURL("/analytics");
  });

  test("navigates to login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Sign in to NEXCOM Exchange")).toBeVisible();
  });
});

test.describe("Trading Terminal", () => {
  test("displays symbol selector and order entry", async ({ page }) => {
    await page.goto("/trade");
    await expect(page.locator("select")).toBeVisible();
    await expect(page.locator("text=Place Order")).toBeVisible();
  });

  test("shows order book", async ({ page }) => {
    await page.goto("/trade");
    await expect(page.locator("text=Order Book")).toBeVisible();
  });
});

test.describe("Analytics Dashboard", () => {
  test("displays analytics tabs", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.locator("text=Analytics & Insights")).toBeVisible();
  });
});
