import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { trpc } from '@/lib/trpc';

/**
 * Hook to handle push notification registration and token management
 * Automatically registers for push notifications and saves the token to the server
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  const savePushTokenMutation = trpc.notifications.savePushToken.useMutation();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Save token to server
        try {
          savePushTokenMutation.mutate({ token });
        } catch (error) {
          console.error('Failed to save push token:', error);
        }
      }
    }).catch((error) => {
      console.error('Failed to register for push notifications:', error);
    });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Listener for when user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      // Handle notification tap here (e.g., navigate to specific screen)
      const data = response.notification.request.content.data;
      // You can add navigation logic based on notification data
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
}
