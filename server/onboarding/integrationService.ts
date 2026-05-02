import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Provision a sandbox environment for integration development
 */
export async function provisionSandboxEnvironment(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Generate unique sandbox endpoint
  const sandboxId = crypto.randomBytes(8).toString('hex');
  const apiEndpoint = `https://sandbox-${sandboxId}.payment-switch.dev`;

  // Create sandbox environment
  const result = await db.execute(sql`
    INSERT INTO integration_environments (application_id, environment_type, api_endpoint, status)
    VALUES (${applicationId}, 'sandbox', ${apiEndpoint}, 'active')
  `);

  const environmentId = Number((result[0] as any).insertId);

  // Generate API credentials for sandbox
  const credentials = await generateApiCredentials(applicationId, environmentId);

  return {
    environmentId,
    apiEndpoint,
    credentials,
    status: 'active',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  };
}

/**
 * Generate API credentials for an environment
 */
export async function generateApiCredentials(applicationId: number, environmentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Generate secure API key and secret
  const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
  const apiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`;

  // Hash the secret before storing
  const hashedSecret = crypto.createHash('sha256').update(apiSecret).digest('hex');

  await db.execute(sql`
    INSERT INTO api_credentials (application_id, environment_id, api_key, api_secret, status)
    VALUES (${applicationId}, ${environmentId}, ${apiKey}, ${hashedSecret}, 'active')
  `);

  return {
    apiKey,
    apiSecret, // Return plain secret only once
  };
}

/**
 * Get integration environment details
 */
export async function getIntegrationEnvironment(applicationId: number, environmentType: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.execute(sql`
    SELECT * FROM integration_environments
    WHERE application_id = ${applicationId} AND environment_type = ${environmentType}
    LIMIT 1
  `);

  const rows = (result[0] as unknown) as any[];
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get API credentials for an environment
 */
export async function getApiCredentials(environmentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.execute(sql`
    SELECT api_key, created_at, last_used_at, status
    FROM api_credentials
    WHERE environment_id = ${environmentId} AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const rows = (result[0] as unknown) as any[];
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Record SDK download
 */
export async function recordSdkDownload(applicationId: number, sdkType: string, version: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.execute(sql`
    INSERT INTO sdk_downloads (application_id, sdk_type, version)
    VALUES (${applicationId}, ${sdkType}, ${version})
  `);

  return { success: true };
}

/**
 * Run integration test
 */
export async function runIntegrationTest(applicationId: number, testType: string, testName: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Create test record
  const result = await db.execute(sql`
    INSERT INTO integration_tests (application_id, test_type, test_name, status)
    VALUES (${applicationId}, ${testType}, ${testName}, 'running')
  `);

  const testId = Number((result[0] as any).insertId);

  // Simulate test execution (in real implementation, this would call actual test framework)
  const testResult = await executeTest(testType, testName);

  // Update test result
  await db.execute(sql`
    UPDATE integration_tests
    SET status = ${testResult.passed ? 'passed' : 'failed'},
        result_data = ${JSON.stringify(testResult)},
        executed_at = NOW()
    WHERE id = ${testId}
  `);

  return {
    testId,
    ...testResult,
  };
}

/**
 * Simulate test execution (placeholder for actual test framework)
 */
async function executeTest(testType: string, testName: string) {
  // In real implementation, this would execute actual tests
  // For now, simulate with random success/failure
  const passed = Math.random() > 0.2; // 80% pass rate

  return {
    passed,
    duration: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
    message: passed ? 'Test passed successfully' : 'Test failed: Connection timeout',
    details: {
      testType,
      testName,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Get all integration tests for an application
 */
export async function getIntegrationTests(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.execute(sql`
    SELECT * FROM integration_tests
    WHERE application_id = ${applicationId}
    ORDER BY created_at DESC
  `);

  return (result[0] as unknown) as any[];
}

/**
 * Get SDK download history
 */
export async function getSdkDownloads(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.execute(sql`
    SELECT * FROM sdk_downloads
    WHERE application_id = ${applicationId}
    ORDER BY downloaded_at DESC
  `);

  return (result[0] as unknown) as any[];
}
