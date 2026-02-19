// Agent Banking Network Service Worker
// Provides offline functionality and caching for PWA

const CACHE_NAME = 'agent-banking-v1.0.0'
const API_CACHE_NAME = 'agent-banking-api-v1.0.0'

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/dashboard/stats',
  '/api/transactions',
  '/api/system/health'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Static assets cached successfully')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated successfully')
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }
  
  // Handle static assets
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(handleStaticRequest(request))
    return
  }
  
  // Default: network first
  event.respondWith(fetch(request))
})

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url)
  
  try {
    // Try network first
    const networkResponse = await fetch(request.clone())
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE_NAME)
      cache.put(request.clone(), networkResponse.clone())
      
      // Add offline indicator to response
      const responseData = await networkResponse.clone().json()
      responseData._offline = false
      responseData._cached_at = new Date().toISOString()
      
      return new Response(JSON.stringify(responseData), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: networkResponse.headers
      })
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for', url.pathname)
    
    // Fallback to cache
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      const cachedData = await cachedResponse.json()
      cachedData._offline = true
      cachedData._cached_at = cachedData._cached_at || new Date().toISOString()
      
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (Cached)',
        headers: {
          'Content-Type': 'application/json',
          'X-Served-By': 'ServiceWorker-Cache'
        }
      })
    }
    
    // Return offline fallback data
    return new Response(JSON.stringify(getOfflineFallbackData(url.pathname)), {
      status: 200,
      statusText: 'OK (Offline)',
      headers: {
        'Content-Type': 'application/json',
        'X-Served-By': 'ServiceWorker-Offline'
      }
    })
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fallback to network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Service Worker: Failed to fetch static asset', error)
    
    // Return offline page for document requests
    if (request.destination === 'document') {
      return caches.match('/')
    }
    
    throw error
  }
}

// Offline fallback data
function getOfflineFallbackData(pathname) {
  const baseData = {
    _offline: true,
    _message: 'You are currently offline. Showing cached data.',
    _cached_at: new Date().toISOString()
  }
  
  switch (pathname) {
    case '/api/dashboard/stats':
      return {
        ...baseData,
        total_agents: 1247,
        total_customers: 45678,
        total_transactions: 234567,
        system_health: 95.0,
        active_agents: 1156,
        online_agents: 0, // No agents online when offline
        fraud_alerts: 0,
        balance: 125000,
        commission: 15750,
        customers_count: 47,
        rating: 4.8
      }
      
    case '/api/transactions':
      return {
        ...baseData,
        transactions: [
          {
            id: 'offline_001',
            type: 'deposit',
            amount: 50000,
            created_at: new Date().toISOString(),
            status: 'pending_sync',
            agent_name: 'Offline Agent',
            description: 'Offline transaction - will sync when online'
          }
        ]
      }
      
    case '/api/system/health':
      return {
        ...baseData,
        api_gateway: 'offline',
        database: 'offline',
        payment_processing: 'offline',
        fraud_detection: 'offline',
        timestamp: new Date().toISOString()
      }
      
    default:
      return {
        ...baseData,
        error: 'No offline data available for this endpoint'
      }
  }
}

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag)
  
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncOfflineTransactions())
  }
})

// Sync offline transactions when connection is restored
async function syncOfflineTransactions() {
  try {
    console.log('Service Worker: Syncing offline transactions...')
    
    // Get offline transactions from IndexedDB or localStorage
    const offlineTransactions = await getOfflineTransactions()
    
    for (const transaction of offlineTransactions) {
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify(transaction)
        })
        
        if (response.ok) {
          await removeOfflineTransaction(transaction.id)
          console.log('Service Worker: Synced transaction', transaction.id)
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync transaction', transaction.id, error)
      }
    }
    
    // Notify the main app about sync completion
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        synced: offlineTransactions.length
      })
    })
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error)
  }
}

// Helper functions for offline transaction management
async function getOfflineTransactions() {
  // In a real implementation, this would read from IndexedDB
  return []
}

async function removeOfflineTransaction(transactionId) {
  // In a real implementation, this would remove from IndexedDB
  console.log('Removing offline transaction:', transactionId)
}

async function getAuthToken() {
  // In a real implementation, this would get the token from storage
  return 'offline-token'
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New banking notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/dismiss-icon.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Agent Banking Network', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked')
  
  event.notification.close()
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Message handling from main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_TRANSACTION') {
    // Cache offline transaction
    cacheOfflineTransaction(event.data.transaction)
  }
})

async function cacheOfflineTransaction(transaction) {
  // In a real implementation, this would store in IndexedDB
  console.log('Service Worker: Caching offline transaction', transaction)
  
  // Register for background sync
  try {
    await self.registration.sync.register('sync-transactions')
    console.log('Service Worker: Background sync registered')
  } catch (error) {
    console.error('Service Worker: Background sync registration failed', error)
  }
}

console.log('Service Worker: Loaded successfully')

