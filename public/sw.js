const CACHE_NAME = 'fintech-pwa-v1';
const STATIC_CACHE = 'fintech-static-v1';
const API_CACHE = 'fintech-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const API_CACHE_PATTERNS = [
  /\/api\/trpc\/budgets/,
  /\/api\/trpc\/savingsGoals/,
  /\/api\/trpc\/creditScore/,
  /\/api\/trpc\/financialHealth/,
  /\/api\/trpc\/openBanking\.getLinkedAccounts/,
  /\/api\/notifications/,
];

const OFFLINE_QUEUE_KEY = 'offline-queue';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'GET' && API_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  if (event.request.method === 'POST' && url.pathname.includes('/api/')) {
    event.respondWith(networkWithOfflineQueue(event.request));
    return;
  }

  if (event.request.method === 'GET') {
    event.respondWith(cacheFirstWithNetwork(event.request));
    return;
  }
});

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkWithOfflineQueue(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const body = await request.clone().text();
    const queueItem = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    };

    const db = await openIndexedDB();
    const tx = db.transaction(OFFLINE_QUEUE_KEY, 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_KEY).add(queueItem);

    return new Response(JSON.stringify({ queued: true, message: 'Request queued for sync' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fintech-offline', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(OFFLINE_QUEUE_KEY, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-payments' || event.tag === 'sync-transfers') {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  const db = await openIndexedDB();
  const tx = db.transaction(OFFLINE_QUEUE_KEY, 'readwrite');
  const store = tx.objectStore(OFFLINE_QUEUE_KEY);

  const items = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  for (const item of items) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
    } catch (error) {
      console.error('[SW] Failed to sync queued request:', error);
    }
  }

  store.clear();
}
