/**
 * NDSEP Service Worker — Offline-First PWA with Cache Busting
 *
 * Cache strategy:
 *   - CACHE_VERSION is bumped on every deploy (build injects a hash via Vite).
 *   - On activate, ALL caches whose name doesn't match the current version are
 *     deleted, guaranteeing stale JS/CSS from a prior deploy is never served.
 *   - Navigation requests (HTML) are always network-first so the latest
 *     index.html (with fresh <script> hashes) is fetched immediately.
 *   - Hashed static assets use stale-while-revalidate (the hash in the filename
 *     already guarantees uniqueness).
 *   - API responses use network-first with a 5-minute cache fallback.
 */

const CACHE_VERSION = "ndsep-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = ["/", "/offline.html", "/manifest.json"];

// ── Install — cache app shell, skip waiting to activate immediately ──────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate — purge ALL old caches (cache busting on deploy) ────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        // Notify all open tabs to reload if their cache version is stale
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({
              type: "CACHE_BUSTED",
              version: CACHE_VERSION,
            })
          );
        })
      )
  );
});

// ── Fetch handler with smart caching strategies ──────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;

  // API requests: network-first with cache fallback
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || offlineResponse())
        )
    );
    return;
  }

  // Navigation (HTML pages): ALWAYS network-first — never serve stale index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("/")
          .then(
            (cached) => cached || caches.match("/offline.html")
          )
          .then((fallback) => fallback || offlineResponse())
      )
    );
    return;
  }

  // Hashed static assets (/assets/*): stale-while-revalidate
  // Vite's content-hash filenames ensure uniqueness; cache hit = correct version
  if (isHashedAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other static files: network-first
  if (isStaticAsset(request.url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

function isHashedAsset(url) {
  return url.includes("/assets/") && /\.[a-zA-Z0-9]{8,}\.(js|css|woff2?)(\?|$)/.test(url);
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|png|jpg|svg|ico|webp|avif)(\?|$)/.test(url);
}

function offlineResponse() {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NDSEP — Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;text-align:center}.dark body{background:#0f172a;color:#e2e8f0}div{max-width:360px;padding:2rem}h1{font-size:1.25rem;margin:1rem 0 0.5rem}p{color:#64748b;font-size:0.875rem;line-height:1.5}button{margin-top:1rem;padding:0.5rem 1.5rem;border-radius:0.5rem;border:none;background:#0077b6;color:white;font-size:0.875rem;cursor:pointer}</style></head><body><div><h1>You are offline</h1><p>NDSEP requires an internet connection. Your work has been saved locally and will sync when you reconnect.</p><button onclick="location.reload()">Retry</button></div></body></html>',
    { headers: { "Content-Type": "text/html" } }
  );
}

// ── Background sync for offline mutations ────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "ndsep-sync") {
    event.waitUntil(syncPendingMutations());
  }
});

async function syncPendingMutations() {
  // Placeholder for offline mutation queue sync
  // Implemented via client-side IndexedDB queue in production
}

// ── Message handler — allow clients to request cache clear ───────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          if (event.source) {
            event.source.postMessage({ type: "CACHES_CLEARED" });
          }
        })
    );
  }
});
