/**
 * NDSEP Service Worker
 * =====================
 * Provides offline-first capabilities for low-bandwidth African deployments.
 *
 * Strategies:
 * - Cache-first for static assets (CSS, JS, images, fonts)
 * - Network-first for API data (falls back to cached)
 * - Background sync for offline mutations
 * - Stale-while-revalidate for dashboard data
 */

const CACHE_VERSION = "ndsep-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// ── Install ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may not exist yet during development
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith("ndsep-") && key !== STATIC_CACHE && key !== API_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch strategies ────────────────────────────────────────────────────────

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)(\?.*)?$/.test(url.pathname);
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/.test(url.pathname);
}

// Cache-first for static assets
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback for navigation requests
    if (request.mode === "navigate") {
      const cached = await caches.match("/index.html");
      if (cached) return cached;
    }
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// Network-first for API data with cache fallback
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Add header to indicate cached data
      const headers = new Headers(cached.headers);
      headers.set("X-Cache-Status", "HIT");
      headers.set("X-Cache-Date", cached.headers.get("date") || "unknown");
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(JSON.stringify({ error: "Offline", cached: false }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Stale-while-revalidate for dashboard data
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response(JSON.stringify({ error: "Offline" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (mutations are handled by the offline queue)
  if (event.request.method !== "GET") return;

  // Skip WebSocket upgrades
  if (event.request.headers.get("upgrade") === "websocket") return;

  // API requests: network-first (dashboard stats use stale-while-revalidate)
  if (isApiRequest(url)) {
    if (url.pathname.includes("/dashboard") || url.pathname.includes("/stats")) {
      event.respondWith(staleWhileRevalidate(event.request, API_CACHE));
    } else {
      event.respondWith(networkFirst(event.request, API_CACHE));
    }
    return;
  }

  // Images: cache-first with separate cache
  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Navigation: network-first (SPA)
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, STATIC_CACHE));
    return;
  }
});

// ── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "ndsep-mutation-sync") {
    event.waitUntil(replayOfflineMutations());
  }
});

async function replayOfflineMutations() {
  // Communicate with the main thread to replay queued mutations
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "REPLAY_OFFLINE_MUTATIONS" });
  }
}

// ── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "NDSEP Alert", body: "New notification", icon: "/favicon.ico" };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag || "ndsep-notification",
      data: data.url || "/",
      actions: data.actions || [],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const url = event.notification.data || "/";
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
