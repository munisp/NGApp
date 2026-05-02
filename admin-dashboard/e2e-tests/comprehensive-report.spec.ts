import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Test Report Generator
 * Generates a detailed report of all test results
 */

interface TestResult {
  page: string;
  element: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
}

const results: TestResult[] = [];

test.describe('Comprehensive Admin Portal Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const demoUser = {
        id: 'demo-user-001',
        username: 'demo',
        email: 'demo@payment-switch.com',
        name: 'Admin User',
        roles: ['super_admin', 'kyc_reviewer', 'kyb_reviewer'],
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

  test('Generate comprehensive element inventory for all pages', async ({ page }) => {
    const pages = [
      'NOC Dashboard',
      'User Journeys',
      'Journey Analytics',
      'Transactions',
      'Participants',
      'Onboarding',
      'KYB Verification',
      'KYC Verification',
      'Apply',
      'KYC Portal',
      'Bulk Onboarding',
      'Integration Testing',
      'SLA Tracking',
      'Template Cloning',
      'Reviewer Rules',
      'User Management',
      'Settlements',
      'Fraud & Risk',
      'Reports',
      'Developer Portal',
      'Alerts',
      'Settings',
    ];

    const inventory: Record<string, { buttons: number; inputs: number; selects: number; links: number }> = {};

    for (const pageName of pages) {
      // Navigate to page
      const navButton = page.locator('aside nav button').filter({ hasText: new RegExp(pageName.replace(/[&]/g, ''), 'i') }).first();
      
      try {
        await navButton.click();
        await page.waitForTimeout(500);

        // Count interactive elements
        const buttons = await page.locator('main button').count();
        const inputs = await page.locator('main input').count();
        const selects = await page.locator('main select').count();
        const links = await page.locator('main a').count();

        inventory[pageName] = { buttons, inputs, selects, links };

        results.push({
          page: pageName,
          element: 'Page Load',
          status: 'PASS',
          details: `Buttons: ${buttons}, Inputs: ${inputs}, Selects: ${selects}, Links: ${links}`,
        });
      } catch (error) {
        results.push({
          page: pageName,
          element: 'Page Load',
          status: 'FAIL',
          details: String(error),
        });
      }
    }

    // Generate report
    console.log('\n=== COMPREHENSIVE ADMIN PORTAL TEST REPORT ===\n');
    console.log('Page Element Inventory:');
    console.log(JSON.stringify(inventory, null, 2));
    console.log('\nTest Results:');
    results.forEach(r => {
      console.log(`[${r.status}] ${r.page} - ${r.element}: ${r.details || ''}`);
    });

    // All pages should load
    const failedPages = results.filter(r => r.status === 'FAIL');
    expect(failedPages).toHaveLength(0);
  });

  test('Verify CRUD operations are available on applicable pages', async ({ page }) => {
    const crudPages = [
      { name: 'KYC Verification', createButton: /New KYC Case/i },
      { name: 'KYB Verification', createButton: /New KYB Case/i },
      { name: 'Participants', createButton: /Onboard Participant/i },
    ];

    for (const crudPage of crudPages) {
      await page.locator('aside nav button').filter({ hasText: new RegExp(crudPage.name, 'i') }).first().click();
      await page.waitForTimeout(500);

      const createButton = page.locator('button').filter({ hasText: crudPage.createButton });
      const hasCreate = await createButton.count() > 0;

      results.push({
        page: crudPage.name,
        element: 'Create Button',
        status: hasCreate ? 'PASS' : 'FAIL',
        details: hasCreate ? 'Create button found' : 'Create button NOT found',
      });

      expect(hasCreate).toBeTruthy();
    }
  });

  test('Verify search functionality exists on applicable pages', async ({ page }) => {
    const searchPages = [
      'User Journeys',
      'KYC Verification',
      'KYB Verification',
      'Onboarding',
      'Participants',
    ];

    for (const pageName of searchPages) {
      await page.locator('aside nav button').filter({ hasText: new RegExp(pageName, 'i') }).first().click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search"]');
      const hasSearch = await searchInput.count() > 0;

      results.push({
        page: pageName,
        element: 'Search Input',
        status: hasSearch ? 'PASS' : 'FAIL',
        details: hasSearch ? 'Search input found' : 'Search input NOT found',
      });

      expect(hasSearch).toBeTruthy();
    }
  });

  test('Verify filter dropdowns exist on applicable pages', async ({ page }) => {
    const filterPages = [
      'KYC Verification',
      'KYB Verification',
      'Onboarding',
      'Participants',
      'Integration Testing',
    ];

    for (const pageName of filterPages) {
      await page.locator('aside nav button').filter({ hasText: new RegExp(pageName, 'i') }).first().click();
      await page.waitForTimeout(500);

      const filterDropdowns = page.locator('select');
      const filterCount = await filterDropdowns.count();

      results.push({
        page: pageName,
        element: 'Filter Dropdowns',
        status: filterCount > 0 ? 'PASS' : 'FAIL',
        details: `Found ${filterCount} filter dropdown(s)`,
      });

      expect(filterCount).toBeGreaterThan(0);
    }
  });
});
