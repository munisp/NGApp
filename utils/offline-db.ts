import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DB_NAME = "fintech_offline.db";
const SYNC_QUEUE_KEY = "sync_queue";
const LAST_SYNC_KEY = "last_sync_timestamp";

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize offline database
 */
export async function initOfflineDatabase(): Promise<void> {
  if (Platform.OS === "web") {
    console.log("SQLite not available on web, using AsyncStorage fallback");
    return;
  }

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        recipient TEXT,
        description TEXT,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        balance REAL NOT NULL,
        currency TEXT NOT NULL,
        type TEXT NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(synced);
      CREATE INDEX IF NOT EXISTS idx_pending_operations_created ON pending_operations(created_at);
    `);

    console.log("Offline database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize offline database:", error);
  }
}

/**
 * Cache transaction for offline access
 */
export async function cacheTransaction(transaction: {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  recipient?: string;
  description?: string;
  timestamp: number;
}): Promise<void> {
  if (!db) {
    // Fallback to AsyncStorage
    const key = `transaction_${transaction.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(transaction));
    return;
  }

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO transactions (id, amount, currency, type, status, recipient, description, timestamp, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        transaction.id,
        transaction.amount,
        transaction.currency,
        transaction.type,
        transaction.status,
        transaction.recipient || null,
        transaction.description || null,
        transaction.timestamp,
      ]
    );
  } catch (error) {
    console.error("Failed to cache transaction:", error);
  }
}

/**
 * Get cached transactions
 */
export async function getCachedTransactions(limit: number = 50): Promise<any[]> {
  if (!db) {
    // Fallback: get from AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const transactionKeys = keys.filter((k) => k.startsWith("transaction_"));
    const items = await AsyncStorage.multiGet(transactionKeys);
    return items
      .map(([_, value]) => (value ? JSON.parse(value) : null))
      .filter(Boolean)
      .slice(0, limit);
  }

  try {
    const result = await db.getAllAsync(
      `SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?`,
      [limit]
    );
    return result as any[];
  } catch (error) {
    console.error("Failed to get cached transactions:", error);
    return [];
  }
}

/**
 * Cache account data
 */
export async function cacheAccount(account: {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: string;
}): Promise<void> {
  if (!db) {
    const key = `account_${account.id}`;
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ ...account, last_updated: Date.now() })
    );
    return;
  }

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO accounts (id, name, balance, currency, type, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.balance,
        account.currency,
        account.type,
        Date.now(),
      ]
    );
  } catch (error) {
    console.error("Failed to cache account:", error);
  }
}

/**
 * Get cached accounts
 */
export async function getCachedAccounts(): Promise<any[]> {
  if (!db) {
    const keys = await AsyncStorage.getAllKeys();
    const accountKeys = keys.filter((k) => k.startsWith("account_"));
    const items = await AsyncStorage.multiGet(accountKeys);
    return items
      .map(([_, value]) => (value ? JSON.parse(value) : null))
      .filter(Boolean);
  }

  try {
    const result = await db.getAllAsync(`SELECT * FROM accounts`);
    return result as any[];
  } catch (error) {
    console.error("Failed to get cached accounts:", error);
    return [];
  }
}

/**
 * Add operation to sync queue
 */
export async function addToSyncQueue(
  operationType: string,
  payload: any
): Promise<string> {
  const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (!db) {
    // Fallback: use AsyncStorage
    const queue = await getSyncQueue();
    queue.push({
      id: operationId,
      operation_type: operationType,
      payload: JSON.stringify(payload),
      created_at: Date.now(),
      retry_count: 0,
    });
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return operationId;
  }

  try {
    await db.runAsync(
      `INSERT INTO pending_operations (id, operation_type, payload, created_at, retry_count)
       VALUES (?, ?, ?, ?, 0)`,
      [operationId, operationType, JSON.stringify(payload), Date.now()]
    );
    return operationId;
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
    throw error;
  }
}

/**
 * Get sync queue
 */
export async function getSyncQueue(): Promise<any[]> {
  if (!db) {
    const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  }

  try {
    const result = await db.getAllAsync(
      `SELECT * FROM pending_operations ORDER BY created_at ASC`
    );
    return result as any[];
  } catch (error) {
    console.error("Failed to get sync queue:", error);
    return [];
  }
}

/**
 * Remove operation from sync queue
 */
export async function removeFromSyncQueue(operationId: string): Promise<void> {
  if (!db) {
    const queue = await getSyncQueue();
    const filtered = queue.filter((op) => op.id !== operationId);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    return;
  }

  try {
    await db.runAsync(`DELETE FROM pending_operations WHERE id = ?`, [
      operationId,
    ]);
  } catch (error) {
    console.error("Failed to remove from sync queue:", error);
  }
}

/**
 * Increment retry count for operation
 */
export async function incrementRetryCount(operationId: string): Promise<void> {
  if (!db) {
    const queue = await getSyncQueue();
    const operation = queue.find((op) => op.id === operationId);
    if (operation) {
      operation.retry_count = (operation.retry_count || 0) + 1;
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
    return;
  }

  try {
    await db.runAsync(
      `UPDATE pending_operations SET retry_count = retry_count + 1 WHERE id = ?`,
      [operationId]
    );
  } catch (error) {
    console.error("Failed to increment retry count:", error);
  }
}

/**
 * Update last sync timestamp
 */
export async function updateLastSyncTimestamp(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
  const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return timestamp ? parseInt(timestamp, 10) : null;
}

/**
 * Clear all cached data (for testing/debugging)
 */
export async function clearOfflineCache(): Promise<void> {
  if (!db) {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (k) =>
        k.startsWith("transaction_") ||
        k.startsWith("account_") ||
        k === SYNC_QUEUE_KEY ||
        k === LAST_SYNC_KEY
    );
    await AsyncStorage.multiRemove(cacheKeys);
    return;
  }

  try {
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM pending_operations;
    `);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  } catch (error) {
    console.error("Failed to clear offline cache:", error);
  }
}

/**
 * Get database statistics
 */
export async function getOfflineStats(): Promise<{
  transactionCount: number;
  accountCount: number;
  pendingOperations: number;
  lastSync: number | null;
}> {
  if (!db) {
    const keys = await AsyncStorage.getAllKeys();
    const queue = await getSyncQueue();
    return {
      transactionCount: keys.filter((k) => k.startsWith("transaction_")).length,
      accountCount: keys.filter((k) => k.startsWith("account_")).length,
      pendingOperations: queue.length,
      lastSync: await getLastSyncTimestamp(),
    };
  }

  try {
    const transactionCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions`
    );
    const accountCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM accounts`
    );
    const pendingCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pending_operations`
    );

    return {
      transactionCount: transactionCount?.count || 0,
      accountCount: accountCount?.count || 0,
      pendingOperations: pendingCount?.count || 0,
      lastSync: await getLastSyncTimestamp(),
    };
  } catch (error) {
    console.error("Failed to get offline stats:", error);
    return {
      transactionCount: 0,
      accountCount: 0,
      pendingOperations: 0,
      lastSync: null,
    };
  }
}
