import { test as setup, expect } from '@playwright/test';

/**
 * Authentication Setup
 * Sets up demo login credentials in localStorage before tests run
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/');
  
  // Set demo authentication in localStorage
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
  
  // Reload to apply auth
  await page.reload();
  
  // Verify we're logged in by checking for sidebar
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
  
  // Save storage state
  await page.context().storageState({ path: 'e2e-tests/.auth/user.json' });
});
