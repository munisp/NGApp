import { Platform } from 'react-native';
import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';

const NOTIFICATION_TOKEN_KEY = '@insureportal_push_token';
const NOTIFICATION_SETTINGS_KEY = '@insureportal_notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  policyReminders: boolean;
  paymentReminders: boolean;
  claimUpdates: boolean;
  promotions: boolean;
  securityAlerts: boolean;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'policy' | 'payment' | 'claim' | 'promotion' | 'security' | 'general';
  data?: Record<string, any>;
  timestamp: number;
  read: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  policyReminders: true,
  paymentReminders: true,
  claimUpdates: true,
  promotions: false,
  securityAlerts: true,
};

class PushNotificationService {
  private initialized = false;
  private onNotificationCallback: ((notification: NotificationData) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    PushNotification.configure({
      onRegister: async (token) => {
        console.log('Push notification token:', token);
        await this.saveToken(token.token);
        await this.registerTokenWithServer(token.token);
      },

      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        const notificationData: NotificationData = {
          id: notification.id?.toString() || Date.now().toString(),
          title: notification.title || '',
          message: notification.message?.toString() || '',
          type: (notification.data?.type as NotificationData['type']) || 'general',
          data: notification.data,
          timestamp: Date.now(),
          read: false,
        };

        this.onNotificationCallback?.(notificationData);

        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      onAction: (notification) => {
        console.log('Notification action:', notification.action);
      },

      onRegistrationError: (err) => {
        console.error('Push notification registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    this.createChannels();
    this.initialized = true;
  }

  private createChannels(): void {
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'policy-reminders',
          channelName: 'Policy Reminders',
          channelDescription: 'Notifications about policy renewals and updates',
          playSound: true,
          soundName: 'default',
          importance: Importance.HIGH,
          vibrate: true,
        },
        (created) => console.log(`Channel 'policy-reminders' created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'payment-reminders',
          channelName: 'Payment Reminders',
          channelDescription: 'Notifications about upcoming and overdue payments',
          playSound: true,
          soundName: 'default',
          importance: Importance.HIGH,
          vibrate: true,
        },
        (created) => console.log(`Channel 'payment-reminders' created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'claim-updates',
          channelName: 'Claim Updates',
          channelDescription: 'Notifications about claim status changes',
          playSound: true,
          soundName: 'default',
          importance: Importance.HIGH,
          vibrate: true,
        },
        (created) => console.log(`Channel 'claim-updates' created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'promotions',
          channelName: 'Promotions',
          channelDescription: 'Special offers and promotions',
          playSound: false,
          importance: Importance.LOW,
          vibrate: false,
        },
        (created) => console.log(`Channel 'promotions' created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'security-alerts',
          channelName: 'Security Alerts',
          channelDescription: 'Important security notifications',
          playSound: true,
          soundName: 'default',
          importance: Importance.HIGH,
          vibrate: true,
        },
        (created) => console.log(`Channel 'security-alerts' created: ${created}`)
      );
    }
  }

  private async saveToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await apiClient.post('/notifications/register', {
        token,
        platform: Platform.OS,
        deviceId: await this.getDeviceId(),
      });
    } catch (error) {
      console.error('Error registering push token with server:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('@insureportal_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@insureportal_device_id', deviceId);
    }
    return deviceId;
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.requestPermissions().then((result) => {
        resolve(result.alert || result.badge || result.sound);
      });
    });
  }

  async checkPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions) => {
        resolve(permissions.alert || permissions.badge || permissions.sound || false);
      });
    });
  }

  setOnNotificationCallback(callback: (notification: NotificationData) => void): void {
    this.onNotificationCallback = callback;
  }

  async getSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (settings) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      
      // Sync with server
      await apiClient.patch('/notifications/settings', newSettings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  localNotification(
    title: string,
    message: string,
    channelId: string = 'policy-reminders',
    data?: Record<string, any>
  ): void {
    PushNotification.localNotification({
      channelId,
      title,
      message,
      playSound: true,
      soundName: 'default',
      userInfo: data,
    });
  }

  scheduleNotification(
    title: string,
    message: string,
    date: Date,
    channelId: string = 'policy-reminders',
    data?: Record<string, any>
  ): void {
    PushNotification.localNotificationSchedule({
      channelId,
      title,
      message,
      date,
      playSound: true,
      soundName: 'default',
      userInfo: data,
      allowWhileIdle: true,
    });
  }

  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  cancelNotification(id: string): void {
    PushNotification.cancelLocalNotification(id);
  }

  setBadgeCount(count: number): void {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  clearBadge(): void {
    PushNotification.setApplicationIconBadgeNumber(0);
  }

  async unregister(): Promise<void> {
    try {
      const token = await this.getToken();
      if (token) {
        await apiClient.post('/notifications/unregister', { token });
      }
      await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
      PushNotification.unregister();
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
