import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from './notifications';

interface NotificationContextType {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: undefined,
  notification: undefined,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string>();
  const [notification, setNotification] = useState<Notifications.Notification>();
  const router = useRouter();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // Listen for notifications received while app is foregrounded
    const notificationListener = addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // Listen for notification taps
    const responseListener = addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      // Handle navigation based on notification data
      if (data.screen) {
        router.push(data.screen as any);
      } else if (data.transactionId) {
        router.push(`/(account)/transactions?id=${data.transactionId}` as any);
      } else if (data.accountId) {
        router.push(`/(account)/${data.accountId}` as any);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ expoPushToken, notification }}>
      {children}
    </NotificationContext.Provider>
  );
}
