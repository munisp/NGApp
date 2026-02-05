import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

export interface PushNotificationToken {
  token: string;
  platform: string;
}

/**
 * Register for push notifications and get the push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

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
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Send push notification to user
 */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: any
) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: any
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get notification permission status
 */
export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Notification types for the platform
 */
export enum NotificationType {
  LOAN_APPROVED = 'loan_approved',
  LOAN_REJECTED = 'loan_rejected',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_DUE = 'payment_due',
  SAVINGS_PAYOUT = 'savings_payout',
  INSURANCE_CLAIM = 'insurance_claim',
  BILL_SPLIT_REQUEST = 'bill_split_request',
  COMMUNITY_FUND_UPDATE = 'community_fund_update',
  TRANSACTION_COMPLETE = 'transaction_complete',
}

/**
 * Send notification based on type
 */
export async function sendNotificationByType(
  token: string,
  type: NotificationType,
  data: any
) {
  const notifications = {
    [NotificationType.LOAN_APPROVED]: {
      title: '✅ Loan Approved!',
      body: `Your loan of ₦${data.amount} has been approved`,
    },
    [NotificationType.LOAN_REJECTED]: {
      title: '❌ Loan Rejected',
      body: `Your loan application was not approved`,
    },
    [NotificationType.PAYMENT_RECEIVED]: {
      title: '💰 Payment Received',
      body: `You received ₦${data.amount} from ${data.sender}`,
    },
    [NotificationType.PAYMENT_DUE]: {
      title: '⏰ Payment Due',
      body: `Payment of ₦${data.amount} is due ${data.dueDate}`,
    },
    [NotificationType.SAVINGS_PAYOUT]: {
      title: '💎 Savings Payout',
      body: `Your savings circle payout of ₦${data.amount} is ready`,
    },
    [NotificationType.INSURANCE_CLAIM]: {
      title: '🛡️ Insurance Claim Update',
      body: `Your claim status: ${data.status}`,
    },
    [NotificationType.BILL_SPLIT_REQUEST]: {
      title: '💰 Bill Split Request',
      body: `${data.requester} wants to split ₦${data.amount}`,
    },
    [NotificationType.COMMUNITY_FUND_UPDATE]: {
      title: '🏘️ Community Fund Update',
      body: `${data.projectName}: ${data.message}`,
    },
    [NotificationType.TRANSACTION_COMPLETE]: {
      title: '✅ Transaction Complete',
      body: `Your transaction of ₦${data.amount} was successful`,
    },
  };

  const notification = notifications[type];
  if (notification) {
    await sendPushNotification(token, notification.title, notification.body, data);
  }
}
