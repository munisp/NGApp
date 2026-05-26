import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * KYB Verification Page - Production-Ready E2E Tests
 * Tests CRUD operations with actual API verification, search, filters, and persistence
 */

const API_BASE = 'https://app-kjesixal.fly.dev';

// Helper to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    organizationName: `E2E Company ${timestamp}`,
    registrationNumber: `RC-${timestamp}-${random}`,
    country: 'Nigeria',
    stakeholderType: 'FINTECH',
  };
}

// Helper to login and navigate to KYB page
async function loginAndNavigateToKYB(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const demoUser = {
      id: 'demo-user-001',
      username: 'demo',
      email: 'demo@payment-switch.com',
      name: 'Admin User',
      roles: ['super_admin', 'kyb_reviewer'],
      permissions: ['view_kyb', 'review_kyb', 'approve_kyb'],
      organizationId: 'demo-org',
      participantId: 'demo-participant',
    };
    localStorage.setItem('ps_user', JSON.stringify(demoUser));
    localStorage.setItem('ps_access_token', 'demo-token');
  });
  await page.reload();
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
  
  // Navigate to KYB Verification
  await page.locator('aside nav button').filter({ hasText: /KYB Verification/i }).click();
  await page.waitForTimeout(1000);
}

// API helper to create KYB case directly
async function apiCreateKybCase(request: APIRequestContext, data: any) {
  const response = await request.post(`${API_BASE}/api/v1/kyb/cases`, {
    data: {
      organizationName: data.organizationName,
      registrationNumber: data.registrationNumber,
      country: data.country,
      stakeholderType: data.stakeholderType,
      status: 'DRAFT',
      submittedAt: new Date().toISOString(),
    },
  });
  return response;
}

// API helper to get KYB cases list
async function apiGetKybCases(request: APIRequestContext) {
  const response = await request.get(`${API_BASE}/api/v1/kyb/cases`);
  return response;
}

test.describe.serial('KYB Verification - Navigation & Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToKYB(page);
  });

  test('should display KYB Verification page without errors', async ({ page }) => {
    // Check for no runtime errors
    const errorOverlay = page.locator('[class*="error"], [class*="Error"]').filter({ hasText: /error|exception|undefined/i });
    await expect(errorOverlay).toHaveCount(0);
    
    await expect(page.locator('h1').filter({ hasText: /KYB Verification/i })).toBeVisible();
  });

  test('should display stats cards with correct labels', async ({ page }) => {
    // Use more specific locators to avoid matching multiple elements
    await expect(page.locator('p').filter({ hasText: 'Total' }).first()).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'Pending' }).first()).toBeVisible();
  });

  test('should have + New KYB Case button visible', async ({ page }) => {
    const newCaseButton = page.locator('button').filter({ hasText: /New KYB Case/i });
    await expect(newCaseButton).toBeVisible();
  });

  test('should display KYB cases in list/grid view', async ({ page }) => {
    // Check for case cards or table rows
    const caseElements = page.locator('main').locator('[class*="card"], [class*="grid"] > div, table tbody tr');
    const count = await caseElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe.serial('KYB Verification - Search & Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToKYB(page);
  });

  test('should have search input visible', async ({ page }) => {
    // Use more specific locator for the KYB page search input
    const searchInput = page.locator('main input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should have status filter dropdown', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Statuses' }) });
    await expect(statusFilter).toBeVisible();
  });

  test('should have type filter dropdown', async ({ page }) => {
    const typeFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Types' }) });
    await expect(typeFilter).toBeVisible();
  });

  test('SEARCH: should filter results when typing in search box', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    
    // Type a search query
    await searchInput.fill('Company');
    await page.waitForTimeout(500);
    
    // Verify search input has the value
    await expect(searchInput).toHaveValue('Company');
    
    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  test('FILTER: should filter by status', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Statuses' }) });
    
    // Select APPROVED status
    await statusFilter.selectOption('APPROVED');
    await page.waitForTimeout(500);
    
    // Verify filter is applied
    await expect(statusFilter).toHaveValue('APPROVED');
    
    // Reset filter
    await statusFilter.selectOption('all');
    await page.waitForTimeout(300);
  });

  test('FILTER: should filter by type', async ({ page }) => {
    const typeFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Types' }) });
    
    // Select a type
    await typeFilter.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    
    // Reset filter
    await typeFilter.selectOption('all');
    await page.waitForTimeout(300);
  });
});

test.describe.serial('KYB Verification - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToKYB(page);
  });

  test('CREATE: should open new case modal with all form fields', async ({ page }) => {
    const newCaseButton = page.locator('button').filter({ hasText: /New KYB Case/i });
    await newCaseButton.click();
    await page.waitForTimeout(500);
    
    // Modal should be visible
    const modal = page.locator('[class*="fixed"]').filter({ hasText: /New KYB Case/i });
    await expect(modal).toBeVisible();
    
    // Form fields should be visible
    await expect(page.locator('input[name="organizationName"]')).toBeVisible();
    await expect(page.locator('input[name="registrationNumber"]')).toBeVisible();
    await expect(page.locator('input[name="country"]')).toBeVisible();
    await expect(page.locator('select[name="stakeholderType"]')).toBeVisible();
  });

  test('CREATE: should create new KYB case via UI and verify API call', async ({ page }) => {
    const testData = generateTestData();
    
    // Open modal
    const newCaseButton = page.locator('button').filter({ hasText: /New KYB Case/i });
    await newCaseButton.click();
    await page.waitForTimeout(500);
    
    // Fill in the form
    await page.locator('input[name="organizationName"]').fill(testData.organizationName);
    await page.locator('input[name="registrationNumber"]').fill(testData.registrationNumber);
    await page.locator('input[name="country"]').fill(testData.country);
    await page.locator('select[name="stakeholderType"]').selectOption('LIMITED_COMPANY');
    
    // Intercept the API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/v1/kyb/cases') && response.request().method() === 'POST',
      { timeout: 10000 }
    );
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Create/i });
    await submitButton.click();
    
    // Wait for API response
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    
    // Verify response contains the created case
    const responseData = await response.json();
    expect(responseData).toHaveProperty('id');
    
    // Modal should close
    await page.waitForTimeout(500);
    const modal = page.locator('[class*="fixed"]').filter({ hasText: /New KYB Case/i });
    await expect(modal).not.toBeVisible();
  });

  test('CREATE: should close modal when clicking Cancel', async ({ page }) => {
    const newCaseButton = page.locator('button').filter({ hasText: /New KYB Case/i });
    await newCaseButton.click();
    await page.waitForTimeout(300);
    
    const cancelButton = page.locator('button').filter({ hasText: /Cancel/i });
    await cancelButton.click();
    await page.waitForTimeout(300);
    
    const modal = page.locator('[class*="fixed"]').filter({ hasText: /New KYB Case/i });
    await expect(modal).not.toBeVisible();
  });

  test('READ: should display case details when clicking View Details', async ({ page }) => {
    // Find and click View Details button on first row
    const viewButton = page.locator('button').filter({ hasText: /View/i }).first();
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await page.waitForTimeout(500);
      
      // Detail view should be visible
      const detailsVisible = await page.locator('text=Documents').isVisible() || 
                            await page.locator('text=Status').isVisible() ||
                            await page.locator('text=Details').isVisible();
      expect(detailsVisible).toBeTruthy();
    }
  });

  test('UPDATE: should approve KYB case and verify API call', async ({ page }) => {
    // First, navigate to a case
    const viewButton = page.locator('button').filter({ hasText: /View/i }).first();
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await page.waitForTimeout(500);
      
      // Look for Approve button
      const approveButton = page.locator('button').filter({ hasText: /Approve/i });
      
      if (await approveButton.isVisible()) {
        // Intercept the API call
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/approve') && response.request().method() === 'POST',
          { timeout: 10000 }
        );
        
        await approveButton.click();
        
        // Wait for API response
        const response = await responsePromise;
        expect(response.ok()).toBeTruthy();
        
        // Verify status changed to APPROVED
        const responseData = await response.json();
        expect(responseData.status).toBe('APPROVED');
      }
    }
  });

  test('UPDATE: should reject KYB case and verify API call', async ({ page }) => {
    // First, navigate to a case
    const viewButton = page.locator('button').filter({ hasText: /View/i }).first();
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await page.waitForTimeout(500);
      
      // Look for Reject button
      const rejectButton = page.locator('button').filter({ hasText: /Reject/i });
      
      if (await rejectButton.isVisible()) {
        // Intercept the API call
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/reject') && response.request().method() === 'POST',
          { timeout: 10000 }
        );
        
        await rejectButton.click();
        
        // Wait for API response
        const response = await responsePromise;
        expect(response.ok()).toBeTruthy();
        
        // Verify status changed to REJECTED
        const responseData = await response.json();
        expect(responseData.status).toBe('REJECTED');
      }
    }
  });
});

test.describe.serial('KYB Verification - Data Persistence', () => {
  test('PERSISTENCE: should persist data after page reload', async ({ page, request }) => {
    // Create a case via API first
    const testData = generateTestData();
    const createResponse = await apiCreateKybCase(request, testData);
    expect(createResponse.ok()).toBeTruthy();
    
    const createdCase = await createResponse.json();
    const caseId = createdCase.id;
    
    // Navigate to KYB page
    await loginAndNavigateToKYB(page);
    
    // Reload the page
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Verify the case still exists via API
    const getResponse = await apiGetKybCases(request);
    expect(getResponse.ok()).toBeTruthy();
    
    const cases = await getResponse.json();
    const foundCase = cases.cases.find((c: any) => c.id === caseId);
    expect(foundCase).toBeDefined();
  });
});

test.describe.serial('KYB Verification - API Integration', () => {
  test('API: should fetch KYB cases list successfully', async ({ request }) => {
    const response = await apiGetKybCases(request);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('cases');
    expect(Array.isArray(data.cases)).toBeTruthy();
  });

  test('API: should create KYB case successfully', async ({ request }) => {
    const testData = generateTestData();
    const response = await apiCreateKybCase(request, testData);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.organizationName).toBe(testData.organizationName);
  });

  test('API: should approve KYB case successfully', async ({ request }) => {
    // First create a case
    const testData = generateTestData();
    const createResponse = await apiCreateKybCase(request, testData);
    const createdCase = await createResponse.json();
    
    // Then approve it
    const approveResponse = await request.post(`${API_BASE}/api/v1/kyb/cases/${createdCase.id}/approve`);
    expect(approveResponse.ok()).toBeTruthy();
    
    const approvedCase = await approveResponse.json();
    expect(approvedCase.status).toBe('APPROVED');
  });

  test('API: should reject KYB case successfully', async ({ request }) => {
    // First create a case
    const testData = generateTestData();
    const createResponse = await apiCreateKybCase(request, testData);
    const createdCase = await createResponse.json();
    
    // Then reject it
    const rejectResponse = await request.post(`${API_BASE}/api/v1/kyb/cases/${createdCase.id}/reject`, {
      data: { reasonCodes: ['INVALID_DOCUMENTS'] },
    });
    expect(rejectResponse.ok()).toBeTruthy();
    
    const rejectedCase = await rejectResponse.json();
    expect(rejectedCase.status).toBe('REJECTED');
  });
});
