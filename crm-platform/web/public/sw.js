// CRM Platform Service Worker — Offline-first for African low-bandwidth markets
const CACHE_VERSION = 'crm-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

const API_PATTERNS = [
  /\/api\/v1\/customers/,
  /\/api\/v1\/tenants/,
  /\/api\/v1\/tasks/,
  /\/api\/v1\/documents/,
  /\/api\/v1\/campaigns/,
  /\/api\/v1\/compliance/,
  /\/api\/v1\/ledger/,
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy: Network-first for API, Cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    // Queue POST/PUT/DELETE for background sync
    if (!navigator.onLine || isSlowConnection()) {
      event.respondWith(queueForSync(request));
      return;
    }
    return;
  }

  // API requests: Network-first with cache fallback
  if (API_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets: Cache-first
  event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
});

// Network-first strategy — try network, fall back to cache
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'Data unavailable offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Cache-first strategy — serve from cache, update in background
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Stale-while-revalidate: update cache in background
    fetchWithTimeout(request, 5000).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response);
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetchWithTimeout(request, 10000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    return new Response('', { status: 503 });
  }
}

// Fetch with timeout for slow connections
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
    fetch(request, { signal: controller.signal })
      .then((response) => { clearTimeout(timer); resolve(response); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// Detect slow connection (for African rural markets)
function isSlowConnection() {
  if ('connection' in navigator) {
    const conn = navigator.connection;
    return conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.downlink < 0.25;
  }
  return false;
}

// Queue mutations for background sync
async function queueForSync(request) {
  const body = await request.clone().text();
  const syncQueue = await getSyncQueue();
  syncQueue.push({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body,
    timestamp: Date.now(),
    retries: 0,
  });
  await saveSyncQueue(syncQueue);
  return new Response(JSON.stringify({ queued: true, message: 'Request queued for sync' }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'crm-sync') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const queue = await getSyncQueue();
  const remaining = [];

  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
    } catch (err) {
      item.retries++;
      if (item.retries < 100) {
        remaining.push(item);
      }
    }
  }

  await saveSyncQueue(remaining);

  // Notify clients of sync completion
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      synced: queue.length - remaining.length,
      pending: remaining.length,
    });
  });
}

// Periodic sync for data freshness
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'crm-data-refresh') {
    event.waitUntil(refreshCriticalData());
  }
});

async function refreshCriticalData() {
  const criticalEndpoints = [
    '/api/v1/tenants/current/config',
    '/api/v1/dashboard/metrics',
  ];

  const cache = await caches.open(API_CACHE);
  for (const endpoint of criticalEndpoints) {
    try {
      const response = await fetchWithTimeout(new Request(endpoint), 5000);
      if (response.ok) {
        cache.put(new Request(endpoint), response);
      }
    } catch (err) {
      // Silently continue — data will be stale but available
    }
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'CRM Update', body: 'New activity in your CRM' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'crm-notification',
      data: { url: data.url || '/' },
      actions: data.actions || [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const url = event.notification.data?.url || '/';
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// IndexedDB helpers for sync queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('crm-sw-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSyncQueue() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('sync-queue', 'readonly');
    const store = tx.objectStore('sync-queue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveSyncQueue(items) {
  const db = await openDB();
  const tx = db.transaction('sync-queue', 'readwrite');
  const store = tx.objectStore('sync-queue');
  store.clear();
  for (const item of items) {
    store.add(item);
  }
}
