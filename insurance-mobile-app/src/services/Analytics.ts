import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient } from './api';

const ANALYTICS_QUEUE_KEY = '@insureportal_analytics_queue';
const USER_ID_KEY = '@insureportal_analytics_user_id';
const SESSION_ID_KEY = '@insureportal_analytics_session_id';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  kycVerified?: boolean;
  activePolicies?: number;
  totalPremium?: number;
  registrationDate?: string;
}

class AnalyticsService {
  private sessionId: string = '';
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.sessionId = this.generateSessionId();
    await this.loadQueue();
    await this.loadUserId();
    
    this.startFlushInterval();
    this.isInitialized = true;

    this.track('app_opened', {
      platform: Platform.OS,
      version: Platform.Version,
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
      if (stored) {
        this.eventQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading analytics queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(this.eventQueue));
    } catch (error) {
      console.error('Error saving analytics queue:', error);
    }
  }

  private async loadUserId(): Promise<void> {
    try {
      this.userId = await AsyncStorage.getItem(USER_ID_KEY);
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  async setUserId(userId: string): Promise<void> {
    this.userId = userId;
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }

  async clearUserId(): Promise<void> {
    this.userId = null;
    await AsyncStorage.removeItem(USER_ID_KEY);
  }

  track(eventName: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        platform: Platform.OS,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
    };

    this.eventQueue.push(event);
    this.saveQueue();

    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    await this.saveQueue();

    try {
      await apiClient.post('/analytics/events', { events: eventsToSend });
    } catch (error) {
      console.error('Error sending analytics events:', error);
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      await this.saveQueue();
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    try {
      await apiClient.post('/analytics/user-properties', properties);
    } catch (error) {
      console.error('Error setting user properties:', error);
    }
  }

  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.track('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  trackButtonClick(buttonName: string, screenName: string, properties?: Record<string, any>): void {
    this.track('button_click', {
      button_name: buttonName,
      screen_name: screenName,
      ...properties,
    });
  }

  trackPolicyView(policyId: number, policyType: string): void {
    this.track('policy_view', {
      policy_id: policyId,
      policy_type: policyType,
    });
  }

  trackClaimSubmission(claimId: number, policyType: string, amount: number): void {
    this.track('claim_submission', {
      claim_id: claimId,
      policy_type: policyType,
      amount,
    });
  }

  trackPaymentInitiated(paymentId: number, amount: number, method: string): void {
    this.track('payment_initiated', {
      payment_id: paymentId,
      amount,
      payment_method: method,
    });
  }

  trackPaymentCompleted(paymentId: number, amount: number, method: string): void {
    this.track('payment_completed', {
      payment_id: paymentId,
      amount,
      payment_method: method,
    });
  }

  trackPaymentFailed(paymentId: number, amount: number, method: string, error: string): void {
    this.track('payment_failed', {
      payment_id: paymentId,
      amount,
      payment_method: method,
      error,
    });
  }

  trackLogin(method: 'email' | 'biometric' | 'social'): void {
    this.track('login', { method });
  }

  trackLogout(): void {
    this.track('logout');
  }

  trackRegistration(): void {
    this.track('registration');
  }

  trackKYCStarted(step: string): void {
    this.track('kyc_started', { step });
  }

  trackKYCCompleted(step: string): void {
    this.track('kyc_completed', { step });
  }

  trackError(errorType: string, errorMessage: string, screenName?: string): void {
    this.track('error', {
      error_type: errorType,
      error_message: errorMessage,
      screen_name: screenName,
    });
  }

  trackSearch(query: string, resultCount: number, category?: string): void {
    this.track('search', {
      query,
      result_count: resultCount,
      category,
    });
  }

  trackReferral(referralCode: string): void {
    this.track('referral_sent', { referral_code: referralCode });
  }

  trackReviewSubmitted(rating: number): void {
    this.track('review_submitted', { rating });
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const analytics = new AnalyticsService();
export default analytics;
