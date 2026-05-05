// Offline-first data sync with IndexedDB for African low-bandwidth markets
// Handles: conflict resolution, background sync, bandwidth detection, delta sync

const DB_NAME = 'crm-offline-db';
const DB_VERSION = 1;

const STORES = [
  { name: 'customers', keyPath: 'id', indexes: [{ name: 'tenant_id', keyPath: 'tenant_id' }, { name: 'status', keyPath: 'status' }, { name: 'synced', keyPath: '_synced' }] },
  { name: 'transactions', keyPath: 'id', indexes: [{ name: 'customer_id', keyPath: 'customer_id' }, { name: 'tenant_id', keyPath: 'tenant_id' }] },
  { name: 'tasks', keyPath: 'id', indexes: [{ name: 'status', keyPath: 'status' }, { name: 'assignee', keyPath: 'assignee' }] },
  { name: 'documents', keyPath: 'id', indexes: [{ name: 'category', keyPath: 'category' }] },
  { name: 'campaigns', keyPath: 'id', indexes: [{ name: 'status', keyPath: 'status' }] },
  { name: 'sync_queue', keyPath: 'id', autoIncrement: true, indexes: [{ name: 'timestamp', keyPath: 'timestamp' }] },
  { name: 'sync_metadata', keyPath: 'store_name' },
];

let db = null;

export async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store.name)) {
          const objectStore = database.createObjectStore(store.name, {
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement || false,
          });
          for (const index of (store.indexes || [])) {
            objectStore.createIndex(index.name, index.keyPath, { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getDB() {
  if (!db) await initOfflineDB();
  return db;
}

// CRUD operations with offline support
export async function offlineGet(storeName, id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function offlineGetAll(storeName, indexName, value) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let req;
    if (indexName && value !== undefined) {
      const index = store.index(indexName);
      req = index.getAll(IDBKeyRange.only(value));
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function offlinePut(storeName, data) {
  const database = await getDB();
  const record = {
    ...data,
    _synced: false,
    _updated_at: Date.now(),
    _version: (data._version || 0) + 1,
  };
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => {
      queueForSync(storeName, 'put', record);
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function offlineDelete(storeName, id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => {
      queueForSync(storeName, 'delete', { id });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// Sync queue management
async function queueForSync(storeName, operation, data) {
  const database = await getDB();
  const syncItem = {
    store_name: storeName,
    operation,
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };
  return new Promise((resolve) => {
    const tx = database.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.add(syncItem);
    tx.oncomplete = () => resolve();
  });
}

export async function getSyncQueueCount() {
  const database = await getDB();
  return new Promise((resolve) => {
    const tx = database.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

export async function processSyncQueue(apiBase = '') {
  const database = await getDB();
  const items = await new Promise((resolve) => {
    const tx = database.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const results = { synced: 0, failed: 0, conflicts: 0 };

  for (const item of items) {
    try {
      const url = `${apiBase}/api/v1/${item.store_name}`;
      const method = item.operation === 'delete' ? 'DELETE' : 'PUT';
      const response = await fetch(`${url}/${item.data.id || ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined,
      });

      if (response.ok) {
        // Remove from queue
        const tx = database.transaction('sync_queue', 'readwrite');
        tx.objectStore('sync_queue').delete(item.id);
        results.synced++;

        // Mark record as synced
        if (item.operation !== 'delete') {
          const dataTx = database.transaction(item.store_name, 'readwrite');
          const existingReq = dataTx.objectStore(item.store_name).get(item.data.id);
          existingReq.onsuccess = () => {
            if (existingReq.result) {
              dataTx.objectStore(item.store_name).put({ ...existingReq.result, _synced: true });
            }
          };
        }
      } else if (response.status === 409) {
        results.conflicts++;
        await handleConflict(item, response);
      } else {
        results.failed++;
      }
    } catch (err) {
      results.failed++;
    }
  }

  return results;
}

// Conflict resolution: server-wins by default, can be configured
async function handleConflict(syncItem, response) {
  try {
    const serverData = await response.json();
    const database = await getDB();

    // Server-wins strategy: overwrite local with server version
    const tx = database.transaction(syncItem.store_name, 'readwrite');
    const store = tx.objectStore(syncItem.store_name);
    store.put({ ...serverData, _synced: true, _conflict_resolved: true, _resolved_at: Date.now() });

    // Remove from sync queue
    const queueTx = database.transaction('sync_queue', 'readwrite');
    queueTx.objectStore('sync_queue').delete(syncItem.id);
  } catch (err) {
    // Keep in queue for retry
  }
}

// Bandwidth detection for adaptive sync
export function getBandwidthProfile() {
  if (!navigator.onLine) return { profile: 'offline', maxPayload: 0, syncInterval: 0 };

  const conn = navigator.connection || {};
  const downlink = conn.downlink || 10; // Mbps
  const effectiveType = conn.effectiveType || '4g';

  if (effectiveType === 'slow-2g' || downlink < 0.064) {
    return { profile: 'poor', maxPayload: 1024, syncInterval: 300000, compression: true };
  }
  if (effectiveType === '2g' || downlink < 0.256) {
    return { profile: 'fair', maxPayload: 10240, syncInterval: 120000, compression: true };
  }
  if (effectiveType === '3g' || downlink < 1) {
    return { profile: 'good', maxPayload: 102400, syncInterval: 60000, compression: false };
  }
  return { profile: 'excellent', maxPayload: 1048576, syncInterval: 30000, compression: false };
}

// Register service worker
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // Register for background sync
    if ('SyncManager' in window) {
      await registration.sync.register('crm-sync');
    }

    // Register for periodic background sync (for data freshness)
    if ('periodicSync' in registration) {
      try {
        await registration.periodicSync.register('crm-data-refresh', { minInterval: 60 * 60 * 1000 }); // 1 hour
      } catch (err) {
        // Periodic sync may not be allowed — fall back to manual
      }
    }

    // Listen for sync completion messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        window.dispatchEvent(new CustomEvent('crm-sync-complete', { detail: event.data }));
      }
    });

    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

// Auto-sync loop
let syncTimer = null;

export function startAutoSync() {
  const bandwidth = getBandwidthProfile();
  if (bandwidth.syncInterval <= 0) return;

  stopAutoSync();
  syncTimer = setInterval(async () => {
    if (navigator.onLine) {
      const count = await getSyncQueueCount();
      if (count > 0) {
        await processSyncQueue();
      }
    }
  }, bandwidth.syncInterval);
}

export function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
