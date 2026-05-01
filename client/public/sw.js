// NDSEP Service Worker — Offline-first caching strategy
const CACHE_NAME = 'ndsep-v1';
const STATIC_ASSETS = [
  '/',
  '/portal',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-fatal: some assets may not be available offline
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go network for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Offline — API unavailable', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico|json)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML navigation (SPA routes)
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 }))
    )
  );
});

// Background sync for portal submissions made while offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'portal-submission-sync') {
    event.waitUntil(syncPendingSubmissions());
  }
});

async function syncPendingSubmissions() {
  // Re-submit any portal forms queued while offline
  const db = await openDB();
  const pending = await db.getAll('pending-submissions');
  for (const submission of pending) {
    try {
      await fetch('/api/trpc/portal.submitAssets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      await db.delete('pending-submissions', submission.id);
    } catch {
      // Will retry on next sync
    }
  }
}

function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('ndsep-offline', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending-submissions', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
  });
}
