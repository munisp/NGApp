/**
 * usePushNotifications.ts
 * React hook for managing PWA push notification subscriptions.
 * Handles permission request, subscription creation, and server registration.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  const statusQuery = trpc.push.status.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  const vapidPublicKey = statusQuery.data?.publicKey;
  const vapidConfigured = statusQuery.data?.vapidConfigured ?? false;

  // Check if push is supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Check current permission and subscription state on mount
  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (registration) => {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        setIsSubscribed(true);
        setCurrentEndpoint(sub.endpoint);
      }
    }).catch(() => {});
  }, [isSupported]);

  /**
   * Convert VAPID public key from base64url to Uint8Array
   */
  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  }

  /**
   * Request permission and subscribe to push notifications.
   */
  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidPublicKey || !vapidConfigured) {
      toast.error("Push notifications not available", {
        description: vapidConfigured ? "Browser not supported" : "VAPID keys not configured",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== "granted") {
        toast.warning("Permission denied", {
          description: "Enable notifications in your browser settings to receive critical alarm alerts.",
        });
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = subscription.toJSON();
      if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid subscription keys");
      }

      // Save to server
      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      setCurrentEndpoint(subscription.endpoint);
      toast.success("Push notifications enabled", {
        description: "You will receive critical alarm alerts on this device.",
      });
    } catch (err: any) {
      toast.error("Failed to enable push notifications", {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, vapidConfigured, subscribeMutation]);

  /**
   * Unsubscribe from push notifications.
   */
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        if (currentEndpoint) {
          await unsubscribeMutation.mutateAsync({ endpoint: currentEndpoint });
        }
      }

      setIsSubscribed(false);
      setCurrentEndpoint(null);
      toast.success("Push notifications disabled");
    } catch (err: any) {
      toast.error("Failed to disable push notifications", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [currentEndpoint, unsubscribeMutation]);

  return {
    isSupported,
    vapidConfigured,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
