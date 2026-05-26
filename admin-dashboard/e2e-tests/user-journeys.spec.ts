import { test, expect } from '@playwright/test';

/**
 * User Journeys Page Tests
 * Tests all 20 Run Journey buttons, search functionality, and category filters
 */

test.describe('User Journeys Page', () => {
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
    
    // Navigate to User Journeys
    await page.locator('aside nav button').filter({ hasText: /User Journeys/i }).click();
    await page.waitForTimeout(500);
  });

  test('should display User Journey Dashboard', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /User Journey Dashboard/i })).toBeVisible();
    await expect(page.locator('text=Overall Health')).toBeVisible();
  });

  test('should have all 20 Run Journey buttons', async ({ page }) => {
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    expect(count).toBe(20);
  });

  test('should click all 20 Run Journey buttons successfully', async ({ page }) => {
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    
    const results: { journey: number; clicked: boolean; error?: string }[] = [];
    
    for (let i = 0; i < count; i++) {
      const button = runButtons.nth(i);
      try {
        // Scroll button into view
        await button.scrollIntoViewIfNeeded();
        await button.click();
        results.push({ journey: i + 1, clicked: true });
      } catch (error) {
        results.push({ journey: i + 1, clicked: false, error: String(error) });
      }
    }
    
    // All buttons should have been clicked successfully
    const failedClicks = results.filter(r => !r.clicked);
    expect(failedClicks).toHaveLength(0);
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search journeys"]');
    await expect(searchInput).toBeVisible();
  });

  test('should have all 6 category filter buttons', async ({ page }) => {
    const filters = ['All', 'Onboarding', 'Payments', 'Operations', 'Analytics', 'Security'];
    
    for (const filter of filters) {
      const filterButton = page.locator('main button').filter({ hasText: new RegExp(`^${filter}$`) });
      await expect(filterButton).toBeVisible();
    }
  });

  test('should filter journeys by category - Onboarding', async ({ page }) => {
    const onboardingFilter = page.locator('main button').filter({ hasText: /^Onboarding$/ });
    await onboardingFilter.click();
    await page.waitForTimeout(300);
    
    // Should show only onboarding journeys (5)
    const journeyCards = page.locator('main div').filter({ hasText: /onboarding/i }).filter({ has: page.locator('button', { hasText: 'Run Journey' }) });
    const count = await journeyCards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  test('should filter journeys by category - Payments', async ({ page }) => {
    const paymentsFilter = page.locator('main button').filter({ hasText: /^Payments$/ });
    await paymentsFilter.click();
    await page.waitForTimeout(300);
    
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  test('should filter journeys by category - Security', async ({ page }) => {
    const securityFilter = page.locator('main button').filter({ hasText: /^Security$/ });
    await securityFilter.click();
    await page.waitForTimeout(300);
    
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    expect(count).toBe(2); // Security has exactly 2 journeys
  });

  test('should show all journeys when All filter is clicked', async ({ page }) => {
    // First filter to a category
    await page.locator('main button').filter({ hasText: /^Security$/ }).click();
    await page.waitForTimeout(300);
    
    // Then click All
    await page.locator('main button').filter({ hasText: /^All$/ }).click();
    await page.waitForTimeout(300);
    
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    expect(count).toBe(20);
  });

  test('search input should accept text', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search journeys"]');
    await searchInput.fill('P2P');
    await expect(searchInput).toHaveValue('P2P');
  });

  // Note: This test documents a known issue - search does not filter results
  test.skip('search should filter journeys (KNOWN ISSUE - NOT IMPLEMENTED)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search journeys"]');
    await searchInput.fill('P2P');
    await page.waitForTimeout(500);
    
    // This would test if search filters, but it's not implemented
    const runButtons = page.locator('button').filter({ hasText: 'Run Journey' });
    const count = await runButtons.count();
    expect(count).toBeLessThan(20);
  });
});
