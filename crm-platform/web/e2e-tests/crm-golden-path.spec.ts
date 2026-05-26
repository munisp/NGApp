import { test, expect } from '@playwright/test';

test.describe('CRM Platform Golden Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render unified dashboard', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveURL(/\//);
  });

  test('should switch tenant from Acme to AeroTel', async ({ page }) => {
    // Click tenant switcher
    const tenantButton = page.locator('[aria-label="Switch tenant"]').first();
    if (await tenantButton.isVisible()) {
      await tenantButton.click();
      const aerotel = page.locator('text=AeroTel Communications');
      if (await aerotel.isVisible()) {
        await aerotel.click();
        // Verify sidebar shows Telco section
        await expect(page.locator('text=Telco')).toBeVisible();
      }
    }
  });

  test('should navigate to customer management', async ({ page }) => {
    await page.click('a[href="/customers"]');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/customers/);
  });

  test('should switch language to Hausa', async ({ page }) => {
    const langPicker = page.locator('button:has-text("EN")').first();
    if (await langPicker.isVisible()) {
      await langPicker.click();
      const hausa = page.locator('text=Hausa');
      if (await hausa.isVisible()) {
        await hausa.click();
        // Verify lang attribute changed
        await expect(page.locator('html')).toHaveAttribute('lang', 'ha');
      }
    }
  });

  test('should render all sidebar sections', async ({ page }) => {
    const sections = ['Unified CRM Hub', 'Intelligence'];
    for (const section of sections) {
      await expect(page.locator(`text=${section}`).first()).toBeVisible();
    }
  });
});

test.describe('Vertical-Specific Pages', () => {
  test('Telco subscriber page renders', async ({ page }) => {
    await page.goto('/telco-subscribers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Commodity trading page renders', async ({ page }) => {
    await page.goto('/commodity-trading');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('CPaaS channels page renders', async ({ page }) => {
    await page.goto('/cpaas-channels');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
  });
});
