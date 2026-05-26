import { useCallback, useEffect, useState } from "react";

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  update: () => Promise<void>;
  skipWaiting: () => void;
  clearCache: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    isOffline: !navigator.onLine,
    registration: null,
  });

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOffline: false }));
    const handleOffline = () => setState((s) => ({ ...s, isOffline: true }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] Service workers not supported");
      return;
    }

    setState((s) => ({ ...s, isSupported: true }));

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[PWA] Service worker registered:", registration.scope);

        setState((s) => ({
          ...s,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[PWA] New version available");
                setState((s) => ({ ...s, isUpdateAvailable: true }));
              }
            });
          }
        });

        // Check for waiting worker (update already downloaded)
        if (registration.waiting) {
          setState((s) => ({ ...s, isUpdateAvailable: true }));
        }
      } catch (error) {
        console.error("[PWA] Service worker registration failed:", error);
      }
    };

    registerSW();

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] New service worker activated, reloading...");
      window.location.reload();
    });
  }, []);

  // Update service worker
  const update = useCallback(async () => {
    if (state.registration) {
      await state.registration.update();
    }
  }, [state.registration]);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, [state.registration]);

  // Clear all caches
  const clearCache = useCallback(async () => {
    if (state.registration?.active) {
      const messageChannel = new MessageChannel();
      state.registration.active.postMessage(
        { type: "CLEAR_CACHE" },
        [messageChannel.port2]
      );
    }
  }, [state.registration]);

  return {
    ...state,
    update,
    skipWaiting,
    clearCache,
  };
}

export default useServiceWorker;
