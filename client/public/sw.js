/**
 * OG RMM Platform — Service Worker v3.0
 *
 * Features:
 *   1. Cache-first for static assets, network-first for API calls
 *   2. Offline fallback page for navigation requests
 *   3. IndexedDB mutation queue — workovers, damage assessments, PTW, and physics
 *      mutations are queued when offline and replayed when connectivity resumes
 *   4. Background sync via the Background Sync API (with polling fallback)
 *   5. Push notification handling
 *   6. PWA Digital Twin (/pwa-twin-physics) precached for offline use
 */

const CACHE_VERSION = "v3";
const STATIC_CACHE = `og-rmm-static-${CACHE_VERSION}`;
const API_CACHE = `og-rmm-api-${CACHE_VERSION}`;
const IDB_NAME = "og-rmm-offline";
const IDB_VERSION = 1;
const QUEUE_STORE = "mutation_queue";
const SYNC_TAG = "og-rmm-offline-sync";

const PRECACHE_URLS = ["/", "/alarms", "/permits", "/workovers", "/pwa-twin-physics", "/wells", "/manifest.json"];

// API paths whose mutations should be queued when offline
const QUEUEABLE_PATHS = [
  "/api/trpc/workovers.",
  "/api/trpc/damageAssessment.",
  "/api/trpc/permitToWork.",
  "/api/trpc/shiftHandover.",
  "/api/trpc/physicsEngine.",
];

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("by_timestamp", "timestamp");
        store.createIndex("by_status", "status");
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(request, body) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const entry = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
      status: "pending",
      retries: 0,
    };
    const addReq = store.add(entry);
    addReq.onsuccess = () => resolve(addReq.result);
    addReq.onerror = () => reject(addReq.error);
  });
}

async function getPendingQueue() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const idx = tx.objectStore(QUEUE_STORE).index("by_status");
    const getReq = idx.getAll("pending");
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error);
  });
}

async function updateQueueEntry(id, updates) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const putReq = store.put({ ...getReq.result, ...updates });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function getQueueCount() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const countReq = tx.objectStore(QUEUE_STORE).index("by_status").count("pending");
    countReq.onsuccess = () => resolve(countReq.result);
    countReq.onerror = () => reject(countReq.error);
  });
}

// ─── Drain the offline queue ──────────────────────────────────────────────────

async function drainQueue() {
  const pending = await getPendingQueue();
  if (pending.length === 0) return;
  console.log(`[SW] Draining ${pending.length} queued mutations`);
  let successCount = 0;
  let failCount = 0;
  for (const entry of pending) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body ? JSON.stringify(entry.body) : undefined,
        credentials: "include",
      });
      if (res.ok) {
        await updateQueueEntry(entry.id, { status: "synced", syncedAt: Date.now() });
        successCount++;
      } else {
        await updateQueueEntry(entry.id, {
          status: entry.retries >= 3 ? "failed" : "pending",
          retries: entry.retries + 1,
          lastError: `HTTP ${res.status}`,
        });
        failCount++;
      }
    } catch (err) {
      await updateQueueEntry(entry.id, { retries: entry.retries + 1, lastError: String(err) });
      failCount++;
    }
  }
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage({ type: "SYNC_COMPLETE", successCount, failCount, totalQueued: pending.length }));
  console.log(`[SW] Queue drain complete — ${successCount} synced, ${failCount} failed`);
}

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch((e) => console.warn("[SW] Pre-cache failed:", e)))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Queueable mutations — intercept and queue when offline
  if (request.method !== "GET" && QUEUEABLE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        try {
          const body = await request.clone().json().catch(() => null);
          await enqueueRequest(request, body);
          const clients = await self.clients.matchAll({ type: "window" });
          const count = await getQueueCount();
          clients.forEach((c) => c.postMessage({ type: "QUEUE_UPDATED", count }));
          return new Response(
            JSON.stringify({ result: { data: { queued: true, message: "Saved offline — will sync when connected" } } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ error: { message: "Network unavailable" } }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }
      })
    );
    return;
  }

  // Static assets — cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached ?? fetch(request).then((res) => {
          if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // API calls — network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request.clone()).then((res) => {
        if (res.ok && request.method === "GET") caches.open(API_CACHE).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() =>
        caches.match(request).then((cached) =>
          cached ?? new Response(JSON.stringify({ error: { message: "Offline" } }), { status: 503, headers: { "Content-Type": "application/json" } })
        )
      )
    );
    return;
  }

  // Navigation — network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) =>
          cached ?? new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } })
        )
      )
    );
    return;
  }
});

// ─── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(drainQueue());
});

// ─── Message channel (polling fallback + queue status) ────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "ONLINE") drainQueue().catch(console.error);
  if (event.data?.type === "GET_QUEUE_COUNT") {
    getQueueCount().then((count) => event.source?.postMessage({ type: "QUEUE_COUNT", count }));
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "OG-RMM Alert", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "OG-RMM Alert", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag ?? "og-rmm-notification",
      data: payload.data ?? {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
