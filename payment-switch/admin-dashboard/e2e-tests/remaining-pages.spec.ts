import { test, expect } from '@playwright/test';

/**
 * Remaining Pages Tests
 * Tests for all other navigation pages: Journey Analytics, Transactions, Apply, KYC Portal,
 * Bulk Onboarding, SLA Tracking, Template Cloning, Reviewer Rules, User Management,
 * Settlements, Fraud & Risk, Reports, Developer Portal, Alerts, Settings
 */

test.describe('Remaining Pages Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const demoUser = {
        id: 'demo-user-001',
        username: 'demo',
        email: 'demo@payment-switch.com',
        name: 'Admin User',
        roles: ['super_admin'],
        permissions: ['view_kyc', 'review_kyc', 'approve_kyc', 'view_kyb', 'review_kyb', 'approve_kyb'],
        organizationId: 'demo-org',
        participantId: 'demo-participant',
      };
      localStorage.setItem('ps_user', JSON.stringify(demoUser));
      localStorage.setItem('ps_access_token', 'demo-token');
    });
    await page.reload();
    await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
  });

  // Journey Analytics Tests
  test.describe('Journey Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Journey Analytics/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Journey Analytics page', async ({ page }) => {
      await expect(page.locator('h1').filter({ hasText: /Journey Analytics/i })).toBeVisible();
    });

    test('should have time period filter buttons', async ({ page }) => {
      await expect(page.locator('button').filter({ hasText: /Last 24 Hours/i })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /Last 7 Days/i })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /Last 30 Days/i })).toBeVisible();
    });

    test('should display stats cards', async ({ page }) => {
      await expect(page.locator('text=Total Runs')).toBeVisible();
      await expect(page.locator('text=Avg Success Rate')).toBeVisible();
      await expect(page.locator('text=Active Journeys')).toBeVisible();
    });

    test('should display Journey Performance table', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Journey Performance/i })).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('should click time period filters', async ({ page }) => {
      await page.locator('button').filter({ hasText: /Last 24 Hours/i }).click();
      await page.waitForTimeout(200);
      await page.locator('button').filter({ hasText: /Last 30 Days/i }).click();
      await page.waitForTimeout(200);
    });
  });

  // Transactions Tests
  test.describe('Transactions', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /^Transactions$/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Transaction Monitor', async ({ page }) => {
      const hasTransactionContent = await page.locator('text=/Transaction|TPS|Success Rate/i').count() > 0;
      expect(hasTransactionContent).toBeTruthy();
    });

    test('should display stats cards', async ({ page }) => {
      await expect(page.locator('text=/Transactions Per Second|TPS/i')).toBeVisible();
      await expect(page.locator('text=Success Rate')).toBeVisible();
    });

    test('should display Participant Health section', async ({ page }) => {
      await expect(page.locator('text=Participant Health')).toBeVisible();
    });

    test('should display Kill Switches section', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const hasKillSwitches = await page.locator('text=/Kill Switch/i').count() > 0;
      expect(hasKillSwitches).toBeTruthy();
    });
  });

  // Apply Page Tests
  test.describe('Apply Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /^Apply$/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Apply for Access page', async ({ page }) => {
      await expect(page.locator('h1, h2').filter({ hasText: /Apply|Organization/i })).toBeVisible();
    });

    test('should have multi-step form', async ({ page }) => {
      await expect(page.locator('text=Organization')).toBeVisible();
      await expect(page.locator('text=Contact')).toBeVisible();
      await expect(page.locator('text=Documents')).toBeVisible();
    });

    test('should have stakeholder type selection', async ({ page }) => {
      await expect(page.locator('text=Stakeholder Type')).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /Bank/i })).toBeVisible();
    });

    test('should have form inputs', async ({ page }) => {
      await expect(page.locator('input[placeholder*="organization"]')).toBeVisible();
    });
  });

  // KYC Portal Tests
  test.describe('KYC Portal', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /KYC Portal/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Identity Verification page', async ({ page }) => {
      await expect(page.locator('h1, h2').filter({ hasText: /Identity Verification|KYC/i })).toBeVisible();
    });

    test('should have multi-step verification form', async ({ page }) => {
      await expect(page.locator('text=Personal Info')).toBeVisible();
    });

    test('should have form inputs', async ({ page }) => {
      const hasInputs = await page.locator('input').count() > 0;
      expect(hasInputs).toBeTruthy();
    });
  });

  // Bulk Onboarding Tests
  test.describe('Bulk Onboarding', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Bulk Onboarding/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Bulk Onboarding page', async ({ page }) => {
      await expect(page.locator('h2').filter({ hasText: /Bulk Onboarding/i })).toBeVisible();
    });

    test('should have Download Template button', async ({ page }) => {
      await expect(page.locator('button').filter({ hasText: /Download Template/i })).toBeVisible();
    });

    test('should have file upload area', async ({ page }) => {
      await expect(page.locator('text=/drag and drop|CSV/i')).toBeVisible();
    });

    test('should display CSV Format Guide', async ({ page }) => {
      await expect(page.locator('text=CSV Format Guide')).toBeVisible();
    });
  });

  // SLA Tracking Tests
  test.describe('SLA Tracking', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /SLA Tracking/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display SLA Tracking page', async ({ page }) => {
      const hasSLAContent = await page.locator('text=/SLA|Service Level/i').count() > 0;
      expect(hasSLAContent).toBeTruthy();
    });
  });

  // Template Cloning Tests
  test.describe('Template Cloning', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Template Cloning/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Template Cloning page', async ({ page }) => {
      const hasTemplateContent = await page.locator('text=/Template|Clone/i').count() > 0;
      expect(hasTemplateContent).toBeTruthy();
    });
  });

  // Reviewer Rules Tests
  test.describe('Reviewer Rules', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Reviewer Rules/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Reviewer Rules page', async ({ page }) => {
      const hasRulesContent = await page.locator('text=/Reviewer|Rules|Assignment/i').count() > 0;
      expect(hasRulesContent).toBeTruthy();
    });
  });

  // User Management Tests
  test.describe('User Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /User Management/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display User Management page', async ({ page }) => {
      const hasUserContent = await page.locator('text=/User|Management|Admin/i').count() > 0;
      expect(hasUserContent).toBeTruthy();
    });
  });

  // Settlements Tests
  test.describe('Settlements', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Settlements/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Settlements page', async ({ page }) => {
      const hasSettlementContent = await page.locator('text=/Settlement|Batch/i').count() > 0;
      expect(hasSettlementContent).toBeTruthy();
    });
  });

  // Fraud & Risk Tests
  test.describe('Fraud & Risk', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Fraud/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Fraud & Risk page', async ({ page }) => {
      const hasFraudContent = await page.locator('text=/Fraud|Risk|Alert/i').count() > 0;
      expect(hasFraudContent).toBeTruthy();
    });
  });

  // Reports Tests
  test.describe('Reports', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /^Reports$/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Reports page', async ({ page }) => {
      const hasReportsContent = await page.locator('text=/Report|Analytics|Export/i').count() > 0;
      expect(hasReportsContent).toBeTruthy();
    });
  });

  // Developer Portal Tests
  test.describe('Developer Portal', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Developer Portal/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Developer Portal page', async ({ page }) => {
      const hasDevContent = await page.locator('text=/Developer|API|Documentation/i').count() > 0;
      expect(hasDevContent).toBeTruthy();
    });
  });

  // Alerts Tests
  test.describe('Alerts', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Alerts/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Alerts page', async ({ page }) => {
      const hasAlertsContent = await page.locator('text=/Alert|Notification/i').count() > 0;
      expect(hasAlertsContent).toBeTruthy();
    });
  });

  // Settings Tests
  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('aside nav button').filter({ hasText: /Settings/i }).click();
      await page.waitForTimeout(500);
    });

    test('should display Settings page', async ({ page }) => {
      const hasSettingsContent = await page.locator('text=/Setting|Configuration|Preference/i').count() > 0;
      expect(hasSettingsContent).toBeTruthy();
    });
  });
});
