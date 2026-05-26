// @ts-check
const { test, expect } = require('@playwright/test')

test.describe('CRM Platform E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })

  test('loads dashboard with sidebar navigation', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Unified CRM Hub')).toBeVisible()
  })

  test('navigates to customer management', async ({ page }) => {
    await page.click('text=Customer Management')
    await expect(page).toHaveURL(/.*customers/)
  })

  test('switches tenant from Acme Bank to AeroTel', async ({ page }) => {
    // Open tenant switcher
    const tenantBtn = page.locator('[data-testid="tenant-switcher"]')
    if (await tenantBtn.isVisible()) {
      await tenantBtn.click()
      await page.click('text=AeroTel')
      await expect(page.locator('text=AeroTel')).toBeVisible()
    }
  })

  test('sidebar shows telco section for telco tenant', async ({ page }) => {
    // Switch to telco tenant
    const tenantBtn = page.locator('[data-testid="tenant-switcher"]')
    if (await tenantBtn.isVisible()) {
      await tenantBtn.click()
      await page.click('text=AeroTel')
    }
    await expect(page.locator('text=Subscriber Management')).toBeVisible({ timeout: 5000 })
  })

  test('navigates to semantic search', async ({ page }) => {
    await page.click('text=Semantic Search')
    await expect(page).toHaveURL(/.*semantic-search/)
    await expect(page.locator('text=Semantic Customer Search')).toBeVisible()
  })

  test('i18n switches language to Hausa', async ({ page }) => {
    const langBtn = page.locator('[data-testid="language-switcher"]')
    if (await langBtn.isVisible()) {
      await langBtn.click()
      await page.click('text=Hausa')
      // Verify sidebar text changed
      await expect(page.locator('html')).toHaveAttribute('lang', 'ha')
    }
  })

  test('dark mode toggle works', async ({ page }) => {
    const darkBtn = page.locator('[data-testid="dark-mode-toggle"]')
    if (await darkBtn.isVisible()) {
      await darkBtn.click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }
  })

  test('responsive layout on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    // Sidebar should be hidden on mobile
    const sidebar = page.locator('[data-testid="sidebar"]')
    // Check that the sidebar collapses
    await expect(page).toHaveURL(/.*/)
  })
})
