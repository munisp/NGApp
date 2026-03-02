// ============================================================
// NEXCOM Exchange - Enhanced Service Worker with Workbox Strategies
// ============================================================
// This file defines the Workbox configuration for the PWA service worker.
// It provides advanced caching strategies for different resource types.

/**
 * Workbox caching strategy configuration
 * Used by next-pwa to generate the service worker
 */
export const workboxConfig = {
  // Cache API responses with NetworkFirst (try network, fall back to cache)
  runtimeCaching: [
    {
      // API calls - network first with 10s timeout, fall back to cache
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: "NetworkFirst" as const,
      options: {
        cacheName: "nexcom-api-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      // WebSocket fallback data - cache only
      urlPattern: /^https?:\/\/.*\/ws\/.*/i,
      handler: "CacheFirst" as const,
      options: {
        cacheName: "nexcom-ws-fallback",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
      },
    },
    {
      // Static assets (JS, CSS) - stale while revalidate
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate" as const,
      options: {
        cacheName: "nexcom-static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      // Images - cache first with long expiry
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst" as const,
      options: {
        cacheName: "nexcom-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
        },
      },
    },
    {
      // Fonts - cache first with long expiry
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
      handler: "CacheFirst" as const,
      options: {
        cacheName: "nexcom-fonts",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      // Market data endpoints - network first with short cache
      urlPattern: /\/api\/v1\/(commodities|tickers|orderbook)/i,
      handler: "NetworkFirst" as const,
      options: {
        cacheName: "nexcom-market-data",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 2, // 2 minutes
        },
        networkTimeoutSeconds: 5,
      },
    },
    {
      // User profile and portfolio - network first
      urlPattern: /\/api\/v1\/(user|portfolio|positions|orders)/i,
      handler: "NetworkFirst" as const,
      options: {
        cacheName: "nexcom-user-data",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 30, // 30 minutes
        },
        networkTimeoutSeconds: 8,
      },
    },
    {
      // Google Fonts
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "StaleWhileRevalidate" as const,
      options: {
        cacheName: "google-fonts-stylesheets",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: "CacheFirst" as const,
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
  ],

  // Background sync for order submissions
  // Orders placed while offline will be queued and synced when back online
  backgroundSync: {
    name: "nexcom-order-queue",
    options: {
      maxRetentionTime: 24 * 60, // 24 hours in minutes
    },
  },
};

/**
 * Register background sync for offline order submissions
 */
export function registerBackgroundSync(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    // Listen for sync events
    if ("sync" in registration) {
      console.log("[SW] Background sync available");
    }
  });
}

/**
 * Queue an order for background sync when offline
 */
export async function queueOrderForSync(orderData: Record<string, unknown>): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      // Store order in IndexedDB for the service worker to pick up
      const db = await openSyncDB();
      const tx = db.transaction("pending-orders", "readwrite");
      const store = tx.objectStore("pending-orders");
      await store.add({
        ...orderData,
        timestamp: Date.now(),
        synced: false,
      });

      // Register sync event
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-orders");
    }
  } catch (err) {
    console.error("[SW] Failed to queue order for sync:", err);
  }
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nexcom-sync", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("pending-orders")) {
        db.createObjectStore("pending-orders", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
