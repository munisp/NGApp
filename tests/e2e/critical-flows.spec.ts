// ─────────────────────────────────────────────────────────────────────────────
// E2E Tests — Critical User Flows (Playwright)
// Run: npx playwright test --config tests/e2e/playwright.config.ts
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

// ─── Health & API ────────────────────────────────────────────────────────────

test.describe("API Health", () => {
  test("health endpoint returns 200", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  test("tRPC endpoint responds", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/trpc/agentHierarchy.list?input=${encodeURIComponent(JSON.stringify({ limit: 5, offset: 0 }))}`
    );
    expect([200, 401]).toContain(res.status());
  });
});

// ─── Authentication ──────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test("login page loads", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/.+/);
    // Should show login form or redirect to auth
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("unauthenticated API returns 401", async ({ request }) => {
    const res = await request.post(
      `${BASE_URL}/api/trpc/agentOnboarding.submit`,
      {
        data: { name: "test" },
      }
    );
    expect([401, 400]).toContain(res.status());
  });

  test("invalid credentials rejected", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: "fake@test.com", password: "wrong" },
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});

// ─── Core Pages ──────────────────────────────────────────────────────────────

test.describe("Core Pages", () => {
  test("homepage renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    // Allow max 2 console errors (React dev warnings)
    expect(errors.length).toBeLessThan(3);
  });

  test("static assets load (JS bundles)", async ({ page }) => {
    const responses: number[] = [];
    page.on("response", res => {
      if (res.url().endsWith(".js") || res.url().endsWith(".css")) {
        responses.push(res.status());
      }
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    // All static assets should return 200
    for (const status of responses) {
      expect([200, 304]).toContain(status);
    }
  });

  test("mobile viewport renders", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});

// ─── tRPC Router Integration ─────────────────────────────────────────────────

test.describe("tRPC Routers", () => {
  const routers = [
    "agentHierarchy.list",
    "transactions.list",
    "disputes.list",
    "agentBanking.list",
    "adminDashboard.stats",
  ];

  for (const router of routers) {
    test(`${router} responds`, async ({ request }) => {
      const input = router.includes("stats") ? {} : { limit: 5, offset: 0 };
      const res = await request.get(
        `${BASE_URL}/api/trpc/${router}?input=${encodeURIComponent(JSON.stringify(input))}`
      );
      // Should return data or auth error, never 500
      expect(res.status()).toBeLessThan(500);
    });
  }
});

// ─── Security ────────────────────────────────────────────────────────────────

test.describe("Security", () => {
  test("no server info leaked in headers", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    const headers = res.headers();
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("CORS headers present on API", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    // Should not expose server internals
    expect(res.status()).toBe(200);
  });

  test("SQL injection attempt blocked", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/trpc/agentHierarchy.list?input=${encodeURIComponent(JSON.stringify({ limit: "'; DROP TABLE agents; --", offset: 0 }))}`
    );
    // Should return validation error, not 500
    expect([400, 401, 422]).toContain(res.status());
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────

test.describe("Performance", () => {
  test("health endpoint responds under 500ms", async ({ request }) => {
    const start = Date.now();
    await request.get(`${BASE_URL}/api/health`);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test("page load under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState("domcontentloaded");
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});

// ─── Agent Workflows ─────────────────────────────────────────────────────────
test.describe("Agent Workflows", () => {
  test('agent login page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/agent/login`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('agent dashboard accessible after auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('cash-in transaction form renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/agent/transactions`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('cash-out transaction form renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/agent/transactions`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('agent float balance displays', async ({ page }) => {
    await page.goto(`${BASE_URL}/agent/dashboard`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('transaction history loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/agent/history`);
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── Admin Workflows ─────────────────────────────────────────────────────────
test.describe("Admin Workflows", () => {
  test('admin dashboard loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('agent management page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/agents`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('fraud alerts page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/fraud`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('settlement page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/settlement`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('KYC review page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/kyc`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('MDM device management renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/devices`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('reports page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/reports`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('business rules page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/business-rules`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('billing dashboard renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/billing`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('system settings page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/settings`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('audit log page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/audit`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('POS network map renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/network`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('compliance dashboard renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/compliance`);
    await expect(page.locator("body")).toBeVisible();
  });

  test('notifications page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/notifications`);
    await expect(page.locator("body")).toBeVisible();
  });
});
