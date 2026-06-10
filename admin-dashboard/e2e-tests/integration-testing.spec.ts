import { test, expect } from '@playwright/test';

/**
 * Integration Testing Portal Tests
 * Tests all interactive elements including Run Test buttons, credentials, and filters
 */

test.describe('Integration Testing Portal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const demoUser = {
        id: 'demo-user-001',
        username: 'demo',
        email: 'demo@payment-switch.com',
        name: 'Admin User',
        roles: ['super_admin'],
        permissions: ['view_kyc', 'review_kyc', 'approve_kyc'],
        organizationId: 'demo-org',
        participantId: 'demo-participant',
      };
      localStorage.setItem('ps_user', JSON.stringify(demoUser));
      localStorage.setItem('ps_access_token', 'demo-token');
    });
    await page.reload();
    await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
    
    // Navigate to Integration Testing
    await page.locator('aside nav button').filter({ hasText: /Integration Testing/i }).click();
    await page.waitForTimeout(500);
  });

  test('should display Integration Testing Portal', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: /Integration Testing Portal/i })).toBeVisible();
  });

  test('should display Certification Progress', async ({ page }) => {
    await expect(page.locator('text=Certification Progress')).toBeVisible();
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.locator('text=Passed')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
  });

  test('should display Sandbox Credentials section', async ({ page }) => {
    await expect(page.locator('text=Sandbox Credentials')).toBeVisible();
    await expect(page.locator('text=Client ID')).toBeVisible();
    await expect(page.locator('text=Client Secret')).toBeVisible();
    await expect(page.locator('text=API Key')).toBeVisible();
    await expect(page.locator('text=Base URL')).toBeVisible();
  });

  test('should have Show Secrets button', async ({ page }) => {
    const showSecretsButton = page.locator('button').filter({ hasText: /Show Secrets/i });
    await expect(showSecretsButton).toBeVisible();
  });

  test('should have copy buttons for credentials', async ({ page }) => {
    // Look for copy buttons (usually SVG icons)
    const copyButtons = page.locator('button').filter({ has: page.locator('svg') });
    const count = await copyButtons.count();
    expect(count).toBeGreaterThan(3); // At least 4 copy buttons for credentials
  });

  test('should have category filter dropdown', async ({ page }) => {
    const categoryFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Categories' }) });
    await expect(categoryFilter).toBeVisible();
  });

  test('should have difficulty filter dropdown', async ({ page }) => {
    const difficultyFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Difficulties' }) });
    await expect(difficultyFilter).toBeVisible();
  });

  test('should display Test Scenarios section', async ({ page }) => {
    await expect(page.locator('h3').filter({ hasText: /Test Scenarios/i })).toBeVisible();
  });

  test('should have 6 Run Test buttons', async ({ page }) => {
    const runTestButtons = page.locator('button').filter({ hasText: 'Run Test' });
    const count = await runTestButtons.count();
    expect(count).toBe(6);
  });

  test('should click all Run Test buttons successfully', async ({ page }) => {
    const runTestButtons = page.locator('button').filter({ hasText: 'Run Test' });
    const count = await runTestButtons.count();
    
    for (let i = 0; i < count; i++) {
      const button = runTestButtons.nth(i);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.waitForTimeout(200);
    }
    
    // All buttons should be clickable without errors
    expect(count).toBe(6);
  });

  test('should filter by category - TRANSFER', async ({ page }) => {
    const categoryFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Categories' }) });
    await categoryFilter.selectOption('TRANSFER');
    await page.waitForTimeout(300);
    
    await expect(categoryFilter).toHaveValue('TRANSFER');
  });

  test('should filter by difficulty - BASIC', async ({ page }) => {
    const difficultyFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Difficulties' }) });
    await difficultyFilter.selectOption('BASIC');
    await page.waitForTimeout(300);
    
    await expect(difficultyFilter).toHaveValue('BASIC');
  });

  test('should display test scenario details', async ({ page }) => {
    // Check for test scenario cards with titles and descriptions
    await expect(page.locator('text=Party Lookup by MSISDN')).toBeVisible();
    await expect(page.locator('text=P2P Transfer - Happy Path')).toBeVisible();
  });

  test('should show Required badge for mandatory tests', async ({ page }) => {
    const requiredBadges = page.locator('text=Required');
    const count = await requiredBadges.count();
    expect(count).toBeGreaterThan(0);
  });
});
