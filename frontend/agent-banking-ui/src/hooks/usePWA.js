import { useState, useEffect } from 'react'

// Hook for PWA installation
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInWebAppiOS = window.navigator.standalone === true
      const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches
      
      setIsInstalled(isStandalone || isInWebAppiOS || isInWebAppChrome)
    }

    checkInstalled()

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (event) => {
      console.log('PWA: Install prompt available')
      event.preventDefault()
      setInstallPrompt(event)
      setIsInstallable(true)
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('PWA: App installed successfully')
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installPrompt) {
      console.log('PWA: No install prompt available')
      return false
    }

    try {
      const result = await installPrompt.prompt()
      console.log('PWA: Install prompt result:', result.outcome)
      
      if (result.outcome === 'accepted') {
        setIsInstallable(false)
        setInstallPrompt(null)
        return true
      }
      
      return false
    } catch (error) {
      console.error('PWA: Install failed:', error)
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    installApp
  }
}

// Hook for online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionType, setConnectionType] = useState('unknown')

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('Network: Offline')
      setIsOnline(false)
    }

    const updateConnectionType = () => {
      if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (connection) {
          setConnectionType(connection.effectiveType || connection.type || 'unknown')
        }
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Update connection type
    updateConnectionType()
    
    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      if (connection) {
        connection.addEventListener('change', updateConnectionType)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (connection) {
          connection.removeEventListener('change', updateConnectionType)
        }
      }
    }
  }, [])

  return {
    isOnline,
    connectionType,
    isSlowConnection: connectionType === 'slow-2g' || connectionType === '2g'
  }
}

// Hook for service worker management
export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true)
      registerServiceWorker()
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('Service Worker: Registered successfully', reg)
      setIsRegistered(true)
      setRegistration(reg)

      // Check for updates
      reg.addEventListener('updatefound', () => {
        console.log('Service Worker: Update found')
        const newWorker = reg.installing

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Service Worker: Update available')
            setUpdateAvailable(true)
          }
        })
      })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Service Worker: Message received', event.data)
        
        if (event.data.type === 'SYNC_COMPLETE') {
          console.log(`Service Worker: Synced ${event.data.synced} transactions`)
          // You can dispatch a custom event here to update the UI
          window.dispatchEvent(new CustomEvent('transactionsSynced', {
            detail: { count: event.data.synced }
          }))
        }
      })

    } catch (error) {
      console.error('Service Worker: Registration failed', error)
    }
  }

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  const cacheOfflineTransaction = (transaction) => {
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'CACHE_TRANSACTION',
        transaction
      })
    }
  }

  return {
    isSupported,
    isRegistered,
    updateAvailable,
    updateServiceWorker,
    cacheOfflineTransaction
  }
}

// Hook for push notifications
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) {
      console.log('Push notifications not supported')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)
      
      if (permission === 'granted') {
        console.log('Push notifications: Permission granted')
        return true
      } else {
        console.log('Push notifications: Permission denied')
        return false
      }
    } catch (error) {
      console.error('Push notifications: Permission request failed', error)
      return false
    }
  }

  const subscribe = async () => {
    if (!isSupported || permission !== 'granted') {
      return null
    }

    try {
      const registration = await navigator.serviceWorker.ready
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9VqLRdWfuWFLTjHyIT-3fPOQqJF3-Oq-q6Z4wou2P13No4-aEkw' // Demo VAPID key
        )
      })

      console.log('Push notifications: Subscribed successfully', subscription)
      setSubscription(subscription)
      
      // Send subscription to server
      await sendSubscriptionToServer(subscription)
      
      return subscription
    } catch (error) {
      console.error('Push notifications: Subscription failed', error)
      return null
    }
  }

  const unsubscribe = async () => {
    if (subscription) {
      try {
        await subscription.unsubscribe()
        setSubscription(null)
        console.log('Push notifications: Unsubscribed successfully')
        return true
      } catch (error) {
        console.error('Push notifications: Unsubscribe failed', error)
        return false
      }
    }
    return false
  }

  const sendNotification = (title, options = {}) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        ...options
      })
    }
  }

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    sendNotification
  }
}

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Helper function to send subscription to server
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(subscription)
    })
    
    if (response.ok) {
      console.log('Push subscription sent to server successfully')
    } else {
      console.error('Failed to send push subscription to server')
    }
  } catch (error) {
    console.error('Error sending push subscription to server:', error)
  }
}

// Hook for device capabilities detection
export function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    hasTouch: false,
    hasCamera: false,
    hasGeolocation: false,
    hasBiometrics: false,
    hasNFC: false,
    orientation: 'portrait'
  })

  useEffect(() => {
    const detectCapabilities = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)
      const isDesktop = !isMobile && !isTablet

      setCapabilities({
        isMobile,
        isTablet,
        isDesktop,
        hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        hasGeolocation: 'geolocation' in navigator,
        hasBiometrics: 'credentials' in navigator && 'create' in navigator.credentials,
        hasNFC: 'nfc' in navigator,
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      })
    }

    detectCapabilities()

    const handleOrientationChange = () => {
      setTimeout(() => {
        setCapabilities(prev => ({
          ...prev,
          orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
        }))
      }, 100)
    }

    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return capabilities
}

