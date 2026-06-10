import { test, expect, Page } from '@playwright/test';

/**
 * Navigation Tests - Production-Ready E2E Tests
 * Tests that all 22 navigation pages load correctly without errors
 */

// All navigation items in the sidebar
const navigationPages = [
  { name: 'NOC Dashboard', expectedTitle: /Dashboard|NOC|Transaction Monitor/i },
  { name: 'User Journeys', expectedTitle: /User Journey/i },
  { name: 'Journey Analytics', expectedTitle: /Journey Analytics/i },
  { name: 'Transactions', expectedTitle: /Transaction/i },
  { name: 'Participants', expectedTitle: /Participant/i },
  { name: 'Onboarding', expectedTitle: /Onboarding/i },
  { name: 'KYB Verification', expectedTitle: /KYB/i },
  { name: 'KYC Verification', expectedTitle: /KYC/i },
  { name: 'Apply', expectedTitle: /Apply/i },
  { name: 'KYC Portal', expectedTitle: /Identity Verification|KYC/i },
  { name: 'Bulk Onboarding', expectedTitle: /Bulk Onboarding/i },
  { name: 'Integration Testing', expectedTitle: /Integration Testing/i },
  { name: 'SLA Tracking', expectedTitle: /SLA/i },
  { name: 'Template Cloning', expectedTitle: /Template/i },
  { name: 'Reviewer Rules', expectedTitle: /Reviewer|Rules/i },
  { name: 'User Management', expectedTitle: /User Management/i },
  { name: 'Settlements', expectedTitle: /Settlement/i },
  { name: 'Fraud & Risk', expectedTitle: /Fraud|Risk/i },
  { name: 'Reports', expectedTitle: /Report/i },
  { name: 'Developer Portal', expectedTitle: /Developer/i },
  { name: 'Alerts', expectedTitle: /Alert/i },
  { name: 'Settings', expectedTitle: /Setting/i },
];

// Helper to login
async function login(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const demoUser = {
      id: 'demo-user-001',
      username: 'demo',
      email: 'demo@payment-switch.com',
      name: 'Admin User',
      roles: ['super_admin', 'kyc_reviewer', 'kyb_reviewer', 'compliance_officer'],
      permissions: ['view_kyc', 'review_kyc', 'approve_kyc', 'view_kyb', 'review_kyb', 'approve_kyb'],
      organizationId: 'demo-org',
      participantId: 'demo-participant',
    };
    localStorage.setItem('ps_user', JSON.stringify(demoUser));
    localStorage.setItem('ps_access_token', 'demo-token');
  });
  await page.reload();
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
}

test.describe.serial('Navigation - Sidebar Structure', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should have all 22 navigation items visible', async ({ page }) => {
    const navButtons = page.locator('aside nav button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThanOrEqual(22);
  });

  test('should display sidebar with navigation menu', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    const nav = page.locator('aside nav');
    await expect(nav).toBeVisible();
  });
});

test.describe.serial('Navigation - Page Loading', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const navItem of navigationPages) {
    test(`should navigate to ${navItem.name} without errors`, async ({ page }) => {
      // Find and click the navigation button
      const navButton = page.locator('aside nav button').filter({ hasText: new RegExp(navItem.name.replace(/[&]/g, ''), 'i') }).first();
      await expect(navButton).toBeVisible();
      await navButton.click();
      
      // Wait for page to load
      await page.waitForTimeout(1000);
      
      // Verify page loaded (check for main content)
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      
      // Check for no error overlays
      const errorOverlay = page.locator('[class*="error"], [class*="Error"]').filter({ hasText: /error|exception|undefined/i });
      await expect(errorOverlay).toHaveCount(0);
    });
  }
});

test.describe.serial('Navigation - Critical Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('KYC Verification page should load with table and stats', async ({ page }) => {
    await page.locator('aside nav button').filter({ hasText: /KYC Verification/i }).click();
    await page.waitForTimeout(1000);
    
    // Should have stats cards
    await expect(page.locator('text=Total')).toBeVisible();
    
    // Should have table
    await expect(page.locator('table')).toBeVisible();
    
    // Should have New Case button
    await expect(page.locator('button').filter({ hasText: /New KYC Case/i })).toBeVisible();
  });

  test('KYB Verification page should load with table and stats', async ({ page }) => {
    await page.locator('aside nav button').filter({ hasText: /KYB Verification/i }).click();
    await page.waitForTimeout(1000);
    
    // Should have stats cards
    await expect(page.locator('text=Total')).toBeVisible();
    
    // Should have New Case button
    await expect(page.locator('button').filter({ hasText: /New KYB Case/i })).toBeVisible();
  });

  test('Onboarding page should load with applications', async ({ page }) => {
    await page.locator('aside nav button').filter({ hasText: /^Onboarding/i }).click();
    await page.waitForTimeout(1000);
    
    // Should have main content
    await expect(page.locator('main')).toBeVisible();
    
    // Should have search input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('Participants page should load with participant cards', async ({ page }) => {
    await page.locator('aside nav button').filter({ hasText: /^Participants$/i }).click();
    await page.waitForTimeout(1000);
    
    // Should have stats cards
    await expect(page.locator('text=Total Participants')).toBeVisible();
    
    // Should have Onboard button
    await expect(page.locator('button').filter({ hasText: /Onboard Participant/i })).toBeVisible();
  });
});
