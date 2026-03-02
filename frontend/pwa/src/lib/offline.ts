// ============================================================
// NEXCOM Exchange - Offline Support & IndexedDB
// ============================================================

const DB_NAME = "nexcom_exchange";
const DB_VERSION = 1;

interface OfflineOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  stopPrice?: number;
  createdAt: string;
  synced: boolean;
}

// ============================================================
// IndexedDB Wrapper
// ============================================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Offline order queue
      if (!db.objectStoreNames.contains("offline_orders")) {
        const store = db.createObjectStore("offline_orders", { keyPath: "id" });
        store.createIndex("synced", "synced", { unique: false });
      }

      // Cached market data
      if (!db.objectStoreNames.contains("market_data")) {
        db.createObjectStore("market_data", { keyPath: "symbol" });
      }

      // Portfolio snapshots
      if (!db.objectStoreNames.contains("portfolio_snapshots")) {
        const store = db.createObjectStore("portfolio_snapshots", { keyPath: "timestamp" });
        store.createIndex("date", "date", { unique: false });
      }

      // Watchlist
      if (!db.objectStoreNames.contains("watchlist")) {
        db.createObjectStore("watchlist", { keyPath: "symbol" });
      }

      // User preferences
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences", { keyPath: "key" });
      }
    };
  });
}

// ============================================================
// Offline Order Queue
// ============================================================

export async function queueOfflineOrder(order: Omit<OfflineOrder, "synced">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("offline_orders", "readwrite");
  const store = tx.objectStore("offline_orders");
  await new Promise<void>((resolve, reject) => {
    const request = store.put({ ...order, synced: false });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  const tx = db.transaction("offline_orders", "readonly");
  const store = tx.objectStore("offline_orders");
  const index = store.index("synced");

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markOrderSynced(orderId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("offline_orders", "readwrite");
  const store = tx.objectStore("offline_orders");

  return new Promise((resolve, reject) => {
    const getReq = store.get(orderId);
    getReq.onsuccess = () => {
      const order = getReq.result;
      if (order) {
        order.synced = true;
        const putReq = store.put(order);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ============================================================
// Market Data Cache
// ============================================================

export async function cacheMarketData(
  data: Array<{ symbol: string; [key: string]: unknown }>
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("market_data", "readwrite");
  const store = tx.objectStore("market_data");

  for (const item of data) {
    store.put({ ...item, cachedAt: Date.now() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedMarketData(): Promise<Array<{ symbol: string; [key: string]: unknown }>> {
  const db = await openDB();
  const tx = db.transaction("market_data", "readonly");
  const store = tx.objectStore("market_data");

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// Portfolio Snapshots
// ============================================================

export async function savePortfolioSnapshot(snapshot: {
  totalValue: number;
  pnl: number;
  positions: unknown[];
}): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("portfolio_snapshots", "readwrite");
  const store = tx.objectStore("portfolio_snapshots");

  const now = new Date();
  store.put({
    timestamp: now.getTime(),
    date: now.toISOString().split("T")[0],
    ...snapshot,
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// Background Sync
// ============================================================

export async function syncPendingOrders(): Promise<number> {
  const pending = await getPendingOrders();
  let synced = 0;

  for (const order of pending) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("nexcom_access_token") || ""}`,
          },
          body: JSON.stringify({
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            price: order.price,
            stopPrice: order.stopPrice,
          }),
        }
      );

      if (response.ok) {
        await markOrderSynced(order.id);
        synced++;
      }
    } catch {
      // Network error, will retry next sync
      break;
    }
  }

  return synced;
}

// ============================================================
// Online/Offline Detection
// ============================================================

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
