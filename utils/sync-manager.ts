import NetInfo from "@react-native-community/netinfo";
import {
  getSyncQueue,
  removeFromSyncQueue,
  incrementRetryCount,
  updateLastSyncTimestamp,
  cacheTransaction,
  cacheAccount,
} from "./offline-db";
import { paymentService, accountService } from "@/lib/api/services-mock";

const MAX_RETRIES = 3;
let isSyncing = false;

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
}

/**
 * Process a single sync operation
 */
async function processSyncOperation(operation: any): Promise<boolean> {
  try {
    const payload = JSON.parse(operation.payload);

    switch (operation.operation_type) {
      case "send_money":
        await paymentService.sendMoney(payload);
        break;

      case "pay_bill":
        // Bill payment operation
        console.log("Syncing bill payment:", payload);
        break;

      case "transfer":
        // Transfer operation (same as send_money)
        await paymentService.sendMoney(payload);
        break;

      case "update_account":
        // Update account on server
        console.log("Syncing account update:", payload);
        break;

      default:
        console.warn("Unknown operation type:", operation.operation_type);
        return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to process sync operation:", error);
    return false;
  }
}

/**
 * Sync all pending operations
 */
export async function syncPendingOperations(): Promise<{
  success: number;
  failed: number;
  skipped: number;
}> {
  if (isSyncing) {
    console.log("Sync already in progress");
    return { success: 0, failed: 0, skipped: 0 };
  }

  const online = await isOnline();
  if (!online) {
    console.log("Device is offline, skipping sync");
    return { success: 0, failed: 0, skipped: 0 };
  }

  isSyncing = true;
  let success = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const queue = await getSyncQueue();
    console.log(`Syncing ${queue.length} pending operations`);

    for (const operation of queue) {
      // Skip operations that have exceeded max retries
      if (operation.retry_count >= MAX_RETRIES) {
        console.warn(
          `Skipping operation ${operation.id} (max retries exceeded)`
        );
        skipped++;
        continue;
      }

      const processed = await processSyncOperation(operation);

      if (processed) {
        await removeFromSyncQueue(operation.id);
        success++;
      } else {
        await incrementRetryCount(operation.id);
        failed++;
      }
    }

    if (success > 0) {
      await updateLastSyncTimestamp();
    }

    console.log(
      `Sync complete: ${success} success, ${failed} failed, ${skipped} skipped`
    );
  } catch (error) {
    console.error("Sync error:", error);
  } finally {
    isSyncing = false;
  }

  return { success, failed, skipped };
}

/**
 * Sync transactions from server
 */
export async function syncTransactionsFromServer(
  limit: number = 50
): Promise<number> {
  const online = await isOnline();
  if (!online) {
    return 0;
  }

  try {
    // Fetch recent transactions from server
    const response = await fetch("http://127.0.0.1:3000/api/trpc/getTransactions", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch transactions");
    }

    const data = await response.json();
    const transactions = data.result?.data || [];

    // Cache each transaction
    for (const transaction of transactions.slice(0, limit)) {
      await cacheTransaction({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency || "USD",
        type: transaction.type || "transfer",
        status: transaction.status || "completed",
        recipient: transaction.recipient,
        description: transaction.description,
        timestamp: new Date(transaction.created_at).getTime(),
      });
    }

    return transactions.length;
  } catch (error) {
    console.error("Failed to sync transactions from server:", error);
    return 0;
  }
}

/**
 * Sync accounts from server
 */
export async function syncAccountsFromServer(): Promise<number> {
  const online = await isOnline();
  if (!online) {
    return 0;
  }

  try {
    const accounts = await accountService.getAccounts();

    // Cache each account
    for (const account of accounts) {
      await cacheAccount({
        id: account.id,
        name: (account as any).name || "Account",
        balance: account.balance,
        currency: (account as any).currency || "USD",
        type: (account as any).type || "checking",
      });
    }

    return accounts.length;
  } catch (error) {
    console.error("Failed to sync accounts from server:", error);
    return 0;
  }
}

/**
 * Perform full sync (both directions)
 */
export async function performFullSync(): Promise<{
  pendingOps: { success: number; failed: number; skipped: number };
  transactionsSynced: number;
  accountsSynced: number;
}> {
  const online = await isOnline();
  if (!online) {
    return {
      pendingOps: { success: 0, failed: 0, skipped: 0 },
      transactionsSynced: 0,
      accountsSynced: 0,
    };
  }

  console.log("Starting full sync...");

  // 1. Sync pending operations to server
  const pendingOps = await syncPendingOperations();

  // 2. Sync transactions from server
  const transactionsSynced = await syncTransactionsFromServer();

  // 3. Sync accounts from server
  const accountsSynced = await syncAccountsFromServer();

  console.log("Full sync complete:", {
    pendingOps,
    transactionsSynced,
    accountsSynced,
  });

  return {
    pendingOps,
    transactionsSynced,
    accountsSynced,
  };
}

/**
 * Setup automatic sync on network connection
 */
export function setupAutoSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: any) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log("Network connected, triggering auto-sync");
      // Delay sync by 2 seconds to ensure connection is stable
      setTimeout(() => {
        performFullSync();
      }, 2000);
    }
  });

  return unsubscribe;
}
