import { Platform } from 'react-native';

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available');
          }
        });
      });

      console.log('[SW] Registered successfully');
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  });
}

export async function requestBackgroundSync(tag: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      return true;
    }
  } catch (error) {
    console.error('[SW] Background sync registration failed:', error);
  }
  return false;
}

export async function checkOnlineStatus(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}
