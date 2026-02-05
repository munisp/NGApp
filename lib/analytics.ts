/**
 * Analytics Service
 * Wrapper around Mixpanel for tracking user events and behavior
 */

import { Mixpanel } from 'mixpanel-react-native';

class AnalyticsService {
  private mixpanel: Mixpanel | null = null;
  private initialized = false;

  /**
   * Initialize Mixpanel
   * Call this once when the app starts
   */
  async initialize(token: string) {
    if (this.initialized) return;

    try {
      this.mixpanel = await Mixpanel.init(token, false);
      this.initialized = true;
      console.log('[Analytics] Mixpanel initialized');
    } catch (error) {
      console.error('[Analytics] Failed to initialize Mixpanel:', error);
    }
  }

  /**
   * Identify user
   * Call this after user logs in
   */
  identify(userId: string, traits?: Record<string, any>) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.identify(userId);
      if (traits) {
        this.mixpanel.getPeople().set(traits);
      }
      console.log('[Analytics] User identified:', userId);
    } catch (error) {
      console.error('[Analytics] Failed to identify user:', error);
    }
  }

  /**
   * Track event
   * Use this to track user actions
   */
  track(eventName: string, properties?: Record<string, any>) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.track(eventName, properties);
      console.log('[Analytics] Event tracked:', eventName, properties);
    } catch (error) {
      console.error('[Analytics] Failed to track event:', error);
    }
  }

  /**
   * Track screen view
   * Call this when user navigates to a new screen
   */
  trackScreen(screenName: string, properties?: Record<string, any>) {
    this.track('Screen Viewed', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Set user properties
   * Use this to update user profile
   */
  setUserProperties(properties: Record<string, any>) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.getPeople().set(properties);
      console.log('[Analytics] User properties set:', properties);
    } catch (error) {
      console.error('[Analytics] Failed to set user properties:', error);
    }
  }

  /**
   * Increment user property
   * Use this for counters (e.g., transactions_count)
   */
  incrementUserProperty(property: string, by: number = 1) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.getPeople().increment(property, by);
      console.log(`[Analytics] User property incremented: ${property} by ${by}`);
    } catch (error) {
      console.error('[Analytics] Failed to increment user property:', error);
    }
  }

  /**
   * Reset user
   * Call this when user logs out
   */
  reset() {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.reset();
      console.log('[Analytics] User reset');
    } catch (error) {
      console.error('[Analytics] Failed to reset user:', error);
    }
  }

  /**
   * Set super properties
   * These properties are sent with every event
   */
  setSuperProperties(properties: Record<string, any>) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.registerSuperProperties(properties);
      console.log('[Analytics] Super properties set:', properties);
    } catch (error) {
      console.error('[Analytics] Failed to set super properties:', error);
    }
  }

  /**
   * Time event
   * Start timing an event (e.g., how long user spends on a screen)
   */
  timeEvent(eventName: string) {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.timeEvent(eventName);
      console.log('[Analytics] Event timing started:', eventName);
    } catch (error) {
      console.error('[Analytics] Failed to time event:', error);
    }
  }

  /**
   * Flush events
   * Force send all queued events to Mixpanel
   */
  flush() {
    if (!this.mixpanel) return;

    try {
      this.mixpanel.flush();
      console.log('[Analytics] Events flushed');
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Event names constants
export const AnalyticsEvents = {
  // Authentication
  USER_SIGNED_UP: 'User Signed Up',
  USER_LOGGED_IN: 'User Logged In',
  USER_LOGGED_OUT: 'User Logged Out',
  
  // Onboarding
  ONBOARDING_STARTED: 'Onboarding Started',
  ONBOARDING_STEP_COMPLETED: 'Onboarding Step Completed',
  ONBOARDING_COMPLETED: 'Onboarding Completed',
  ONBOARDING_SKIPPED: 'Onboarding Skipped',
  
  // Transactions
  TRANSACTION_ADDED: 'Transaction Added',
  TRANSACTION_VIEWED: 'Transaction Viewed',
  TRANSACTION_EDITED: 'Transaction Edited',
  TRANSACTION_DELETED: 'Transaction Deleted',
  RECEIPT_SCANNED: 'Receipt Scanned',
  
  // Budgets
  BUDGET_CREATED: 'Budget Created',
  BUDGET_UPDATED: 'Budget Updated',
  BUDGET_DELETED: 'Budget Deleted',
  BUDGET_EXCEEDED: 'Budget Exceeded',
  
  // Savings
  SAVINGS_GOAL_CREATED: 'Savings Goal Created',
  SAVINGS_GOAL_UPDATED: 'Savings Goal Updated',
  SAVINGS_GOAL_ACHIEVED: 'Savings Goal Achieved',
  ROUND_UP_ENABLED: 'Round Up Enabled',
  ROUND_UP_DISABLED: 'Round Up Disabled',
  
  // Investments
  INVESTMENT_ADDED: 'Investment Added',
  INVESTMENT_VIEWED: 'Investment Viewed',
  PORTFOLIO_VIEWED: 'Portfolio Viewed',
  STOCK_SEARCHED: 'Stock Searched',
  
  // ML Features
  AI_ADVISOR_OPENED: 'AI Advisor Opened',
  AI_ADVISOR_MESSAGE_SENT: 'AI Advisor Message Sent',
  PREDICTIVE_ALERT_VIEWED: 'Predictive Alert Viewed',
  SMART_CATEGORIZATION_USED: 'Smart Categorization Used',
  TAX_OPTIMIZATION_VIEWED: 'Tax Optimization Viewed',
  CREDIT_SCORE_CHECKED: 'Credit Score Checked',
  INVESTMENT_RISK_ANALYZED: 'Investment Risk Analyzed',
  
  // KYC
  KYC_STARTED: 'KYC Started',
  KYC_DOCUMENT_UPLOADED: 'KYC Document Uploaded',
  KYC_FACIAL_RECOGNITION_COMPLETED: 'KYC Facial Recognition Completed',
  KYC_COMPLETED: 'KYC Completed',
  
  // Payments
  PAYMENT_INITIATED: 'Payment Initiated',
  PAYMENT_COMPLETED: 'Payment Completed',
  PAYMENT_FAILED: 'Payment Failed',
  PAYMENT_GATEWAY_SELECTED: 'Payment Gateway Selected',
  
  // Settings
  SETTINGS_VIEWED: 'Settings Viewed',
  THEME_CHANGED: 'Theme Changed',
  NOTIFICATIONS_TOGGLED: 'Notifications Toggled',
  BIOMETRIC_AUTH_ENABLED: 'Biometric Auth Enabled',
  
  // Errors
  ERROR_OCCURRED: 'Error Occurred',
  API_ERROR: 'API Error',
  ML_SERVICE_ERROR: 'ML Service Error',
} as const;

// Screen names constants
export const AnalyticsScreens = {
  HOME: 'Home',
  TRANSACTIONS: 'Transactions',
  BUDGETS: 'Budgets',
  SAVINGS: 'Savings',
  INVESTMENTS: 'Investments',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  AI_ADVISOR: 'AI Advisor',
  PREDICTIVE_ALERTS: 'Predictive Alerts',
  TAX_OPTIMIZATION: 'Tax Optimization',
  CREDIT_SCORE: 'Credit Score',
  KYC: 'KYC Verification',
  ONBOARDING: 'Onboarding',
} as const;
