/**
 * Service Worker Registration
 * 
 * Registers the service worker for PWA functionality including:
 * - Offline support
 * - Asset caching
 * - Background sync
 * - Push notifications
 */

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[PWA] New content available, please refresh');
              
              // Optionally show a notification to the user
              if (window.confirm('New version available! Reload to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Controller changed, reloading page');
        window.location.reload();
      });

      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.log('[PWA] Service Workers not supported');
    return null;
  }
}

export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    console.log('[PWA] Service Worker unregistered:', success);
    return success;
  }
  return false;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function canInstallPWA(): boolean {
  return 'BeforeInstallPromptEvent' in window;
}
