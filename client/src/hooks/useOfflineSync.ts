/**
 * useOfflineSync.ts — React hook for PWA offline sync status
 *
 * Tracks:
 *   - Online/offline status
 *   - Number of pending mutations in the IndexedDB queue
 *   - Last sync result (success/fail counts)
 *   - Triggers manual sync drain via service worker message
 *
 * Usage:
 *   const { isOnline, pendingCount, lastSync, triggerSync } = useOfflineSync();
 */

import { useState, useEffect, useCallback } from "react";

export interface SyncResult {
  successCount: number;
  failCount: number;
  totalQueued: number;
  syncedAt: Date;
}

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSync: SyncResult | null;
  isSyncing: boolean;
  triggerSync: () => void;
  clearSyncResult: () => void;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get the service worker registration
  const getSW = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return null;
    return navigator.serviceWorker.ready.catch(() => null);
  }, []);

  // Request queue count from service worker
  const refreshQueueCount = useCallback(async () => {
    const reg = await getSW();
    if (!reg?.active) return;
    reg.active.postMessage({ type: "GET_QUEUE_COUNT" });
  }, [getSW]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    const reg = await getSW();
    if (!reg) {
      setIsSyncing(false);
      return;
    }

    // Try Background Sync API first
    if ("sync" in reg) {
      try {
        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("og-rmm-offline-sync");
        return; // Result will come via message event
      } catch {
        // Fall through to manual trigger
      }
    }

    // Fallback: send ONLINE message to trigger drain
    reg.active?.postMessage({ type: "ONLINE" });
  }, [getSW]);

  const clearSyncResult = useCallback(() => setLastSync(null), []);

  useEffect(() => {
    // Online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Notify SW to drain queue when we come back online
      getSW().then((reg) => {
        reg?.active?.postMessage({ type: "ONLINE" });
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Service worker message listener
    const handleSWMessage = (event: MessageEvent) => {
      const { data } = event;
      if (!data) return;

      switch (data.type) {
        case "QUEUE_UPDATED":
          setPendingCount(data.count ?? 0);
          break;
        case "QUEUE_COUNT":
          setPendingCount(data.count ?? 0);
          break;
        case "SYNC_COMPLETE":
          setIsSyncing(false);
          setLastSync({
            successCount: data.successCount ?? 0,
            failCount: data.failCount ?? 0,
            totalQueued: data.totalQueued ?? 0,
            syncedAt: new Date(),
          });
          setPendingCount((prev) => Math.max(0, prev - (data.successCount ?? 0)));
          break;
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    // Initial queue count
    refreshQueueCount();

    // Poll queue count every 30s
    const interval = setInterval(refreshQueueCount, 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
      clearInterval(interval);
    };
  }, [getSW, refreshQueueCount]);

  return { isOnline, pendingCount, lastSync, isSyncing, triggerSync, clearSyncResult };
}
