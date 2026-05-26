/**
 * Background Job Scheduler for Webhook Retry Processing
 */

import { processAllPendingRetries } from "./retryService";

let retryInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * Start the retry processor background job
 * Runs every minute to process pending retries
 */
export function startRetryProcessor() {
  if (retryInterval) {
    console.log("[RetryScheduler] Retry processor already running");
    return;
  }

  console.log("[RetryScheduler] Starting retry processor (runs every minute)");

  // Run immediately on start
  processRetries();

  // Then run every minute
  retryInterval = setInterval(processRetries, 60 * 1000);
}

/**
 * Stop the retry processor background job
 */
export function stopRetryProcessor() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    console.log("[RetryScheduler] Retry processor stopped");
  }
}

/**
 * Process retries (with lock to prevent concurrent execution)
 */
async function processRetries() {
  if (isProcessing) {
    console.log("[RetryScheduler] Skipping retry processing - already in progress");
    return;
  }

  isProcessing = true;

  try {
    const result = await processAllPendingRetries();
    
    if (result.processed > 0) {
      console.log(
        `[RetryScheduler] Completed: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`
      );
    }
  } catch (error) {
    console.error("[RetryScheduler] Error processing retries:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Get retry processor status
 */
export function getRetryProcessorStatus() {
  return {
    running: retryInterval !== null,
    processing: isProcessing,
  };
}
