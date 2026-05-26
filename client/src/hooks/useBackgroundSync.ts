import { useCallback, useEffect, useState } from "react";

interface PendingItem {
  id: number;
  type: string;
  data: unknown;
  endpoint?: string;
  timestamp: number;
}

interface UseBackgroundSyncReturn {
  isSupported: boolean;
  pendingCount: number;
  addPendingTransaction: (data: unknown) => Promise<number>;
  addPendingFormData: (endpoint: string, data: unknown) => Promise<number>;
  getPendingItems: () => Promise<PendingItem[]>;
  clearPending: () => Promise<void>;
  requestSync: (tag?: string) => Promise<boolean>;
}

const DB_NAME = "payment-switch-offline";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("pending-transactions")) {
        db.createObjectStore("pending-transactions", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!db.objectStoreNames.contains("pending-form-data")) {
        db.createObjectStore("pending-form-data", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

export function useBackgroundSync(): UseBackgroundSyncReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Check support
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "SyncManager" in window &&
      "indexedDB" in window;
    setIsSupported(supported);

    if (supported) {
      updatePendingCount();
    }
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const db = await openDB();

      const txnTransaction = db.transaction("pending-transactions", "readonly");
      const txnStore = txnTransaction.objectStore("pending-transactions");
      const txnCount = await new Promise<number>((resolve, reject) => {
        const request = txnStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const formTransaction = db.transaction("pending-form-data", "readonly");
      const formStore = formTransaction.objectStore("pending-form-data");
      const formCount = await new Promise<number>((resolve, reject) => {
        const request = formStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      setPendingCount(txnCount + formCount);
    } catch (error) {
      console.error("[BackgroundSync] Error counting pending items:", error);
    }
  }, []);

  // Add pending transaction
  const addPendingTransaction = useCallback(
    async (data: unknown): Promise<number> => {
      try {
        const db = await openDB();
        const transaction = db.transaction("pending-transactions", "readwrite");
        const store = transaction.objectStore("pending-transactions");

        const id = await new Promise<number>((resolve, reject) => {
          const request = store.add({
            data,
            timestamp: Date.now(),
          });
          request.onsuccess = () => resolve(request.result as number);
          request.onerror = () => reject(request.error);
        });

        await updatePendingCount();

        // Request background sync
        await requestSync("sync-transactions");

        console.log("[BackgroundSync] Added pending transaction:", id);
        return id;
      } catch (error) {
        console.error("[BackgroundSync] Error adding transaction:", error);
        throw error;
      }
    },
    [updatePendingCount]
  );

  // Add pending form data
  const addPendingFormData = useCallback(
    async (endpoint: string, data: unknown): Promise<number> => {
      try {
        const db = await openDB();
        const transaction = db.transaction("pending-form-data", "readwrite");
        const store = transaction.objectStore("pending-form-data");

        const id = await new Promise<number>((resolve, reject) => {
          const request = store.add({
            endpoint,
            data,
            timestamp: Date.now(),
          });
          request.onsuccess = () => resolve(request.result as number);
          request.onerror = () => reject(request.error);
        });

        await updatePendingCount();

        // Request background sync
        await requestSync("sync-form-data");

        console.log("[BackgroundSync] Added pending form data:", id);
        return id;
      } catch (error) {
        console.error("[BackgroundSync] Error adding form data:", error);
        throw error;
      }
    },
    [updatePendingCount]
  );

  // Get all pending items
  const getPendingItems = useCallback(async (): Promise<PendingItem[]> => {
    try {
      const db = await openDB();
      const items: PendingItem[] = [];

      // Get transactions
      const txnTransaction = db.transaction("pending-transactions", "readonly");
      const txnStore = txnTransaction.objectStore("pending-transactions");
      const transactions = await new Promise<PendingItem[]>((resolve, reject) => {
        const request = txnStore.getAll();
        request.onsuccess = () =>
          resolve(
            request.result.map((item: { id: number; data: unknown; timestamp: number }) => ({
              ...item,
              type: "transaction",
            }))
          );
        request.onerror = () => reject(request.error);
      });
      items.push(...transactions);

      // Get form data
      const formTransaction = db.transaction("pending-form-data", "readonly");
      const formStore = formTransaction.objectStore("pending-form-data");
      const formData = await new Promise<PendingItem[]>((resolve, reject) => {
        const request = formStore.getAll();
        request.onsuccess = () =>
          resolve(
            request.result.map((item: { id: number; data: unknown; endpoint: string; timestamp: number }) => ({
              ...item,
              type: "form-data",
            }))
          );
        request.onerror = () => reject(request.error);
      });
      items.push(...formData);

      return items.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("[BackgroundSync] Error getting pending items:", error);
      return [];
    }
  }, []);

  // Clear all pending items
  const clearPending = useCallback(async (): Promise<void> => {
    try {
      const db = await openDB();

      const txnTransaction = db.transaction("pending-transactions", "readwrite");
      const txnStore = txnTransaction.objectStore("pending-transactions");
      await new Promise<void>((resolve, reject) => {
        const request = txnStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const formTransaction = db.transaction("pending-form-data", "readwrite");
      const formStore = formTransaction.objectStore("pending-form-data");
      await new Promise<void>((resolve, reject) => {
        const request = formStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      await updatePendingCount();
      console.log("[BackgroundSync] Cleared all pending items");
    } catch (error) {
      console.error("[BackgroundSync] Error clearing pending items:", error);
    }
  }, [updatePendingCount]);

  // Request background sync
  const requestSync = useCallback(
    async (tag: string = "sync-transactions"): Promise<boolean> => {
      if (!isSupported) {
        console.log("[BackgroundSync] Background sync not supported");
        return false;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-expect-error - SyncManager types not fully available
        await registration.sync.register(tag);
        console.log("[BackgroundSync] Sync registered:", tag);
        return true;
      } catch (error) {
        console.error("[BackgroundSync] Error registering sync:", error);
        return false;
      }
    },
    [isSupported]
  );

  return {
    isSupported,
    pendingCount,
    addPendingTransaction,
    addPendingFormData,
    getPendingItems,
    clearPending,
    requestSync,
  };
}

export default useBackgroundSync;
