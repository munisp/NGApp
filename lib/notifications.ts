import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './api/services-mock';

const PUSH_TOKEN_KEY = 'pushToken';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', token);
      
      // Store token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      
      // Register token with backend
      try {
        await notificationService.registerPushToken(token);
      } catch (error) {
        console.error('Failed to register push token with backend:', error);
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Get the stored push token
 */
export async function getPushToken(): Promise<string | null> {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Add a notification received listener
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Add a notification response listener (when user taps notification)
 */
export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger ?? null,
  });
}

/**
 * Get notification badge count
 */
export async function getBadgeCountAsync(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set notification badge count
 */
export async function setBadgeCountAsync(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all notifications
 */
export async function dismissAllNotificationsAsync(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Send KYC status change notification
 */
export async function sendKYCStatusNotification(
  status: 'approved' | 'rejected' | 'in_review',
  reason?: string
): Promise<void> {
  let title = '';
  let body = '';

  switch (status) {
    case 'approved':
      title = '✅ KYC Approved!';
      body = 'Your identity verification has been approved. You now have full access to all features.';
      break;
    case 'rejected':
      title = '❌ KYC Rejected';
      body = reason || 'Your identity verification was rejected. Please review the feedback and resubmit.';
      break;
    case 'in_review':
      title = '🔍 KYC Under Review';
      body = 'Your identity verification documents are being reviewed. This usually takes 24-48 hours.';
      break;
  }

  await scheduleLocalNotification(title, body, {
    type: 'kyc_status_change',
    status,
    reason,
  });
}
