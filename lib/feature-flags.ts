/**
 * Feature Flags System
 * Simple A/B testing and feature toggle system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';

export type FeatureFlag = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  variant?: 'A' | 'B';
  rolloutPercentage?: number;
};

// Define all feature flags here
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  AI_ADVISOR_CHAT: {
    key: 'ai_advisor_chat',
    name: 'AI Advisor Chat',
    description: 'Enable AI-powered financial advisor chatbot',
    enabled: true,
  },
  PREDICTIVE_ALERTS: {
    key: 'predictive_alerts',
    name: 'Predictive Alerts',
    description: 'Enable ML-based predictive spending alerts',
    enabled: true,
  },
  SMART_CATEGORIZATION: {
    key: 'smart_categorization',
    name: 'Smart Categorization',
    description: 'Enable ML-based transaction categorization',
    enabled: true,
  },
  CRYPTO_TRACKING: {
    key: 'crypto_tracking',
    name: 'Crypto Tracking',
    description: 'Enable cryptocurrency portfolio tracking',
    enabled: true,
  },
  AFRICAN_STOCKS: {
    key: 'african_stocks',
    name: 'African Stocks',
    description: 'Enable real-time African stock market data',
    enabled: true,
  },
  TAX_OPTIMIZATION: {
    key: 'tax_optimization',
    name: 'Tax Optimization',
    description: 'Enable country-specific tax optimization',
    enabled: true,
  },
  CREDIT_SCORE: {
    key: 'credit_score',
    name: 'Credit Score',
    description: 'Enable ML-based credit score prediction',
    enabled: true,
  },
  INVESTMENT_RISK: {
    key: 'investment_risk',
    name: 'Investment Risk',
    description: 'Enable advanced investment risk assessment',
    enabled: true,
  },
  KYC_VERIFICATION: {
    key: 'kyc_verification',
    name: 'KYC Verification',
    description: 'Enable KYC verification with facial recognition',
    enabled: true,
  },
  PAYMENT_GATEWAY: {
    key: 'payment_gateway',
    name: 'Payment Gateway',
    description: 'Enable Paystack/Flutterwave payment integration',
    enabled: true,
  },
  ROUND_UP_SAVINGS: {
    key: 'round_up_savings',
    name: 'Round-Up Savings',
    description: 'Enable automated round-up savings',
    enabled: true,
  },
  DARK_MODE: {
    key: 'dark_mode',
    name: 'Dark Mode',
    description: 'Enable dark mode theme',
    enabled: true,
  },
  BIOMETRIC_AUTH: {
    key: 'biometric_auth',
    name: 'Biometric Auth',
    description: 'Enable biometric authentication',
    enabled: true,
  },
  PUSH_NOTIFICATIONS: {
    key: 'push_notifications',
    name: 'Push Notifications',
    description: 'Enable push notifications',
    enabled: true,
  },
  // A/B Test Examples
  ONBOARDING_VARIANT: {
    key: 'onboarding_variant',
    name: 'Onboarding Variant',
    description: 'A/B test for onboarding flow',
    enabled: true,
    variant: 'A', // Will be randomly assigned
  },
  HOME_LAYOUT: {
    key: 'home_layout',
    name: 'Home Layout',
    description: 'A/B test for home screen layout',
    enabled: true,
    variant: 'A',
  },
};

class FeatureFlagsService {
  private flags: Record<string, FeatureFlag> = {};
  private initialized = false;

  /**
   * Initialize feature flags
   * Load from storage and assign A/B test variants
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load saved flags from storage
      const savedFlags = await AsyncStorage.getItem('feature_flags');
      if (savedFlags) {
        this.flags = JSON.parse(savedFlags);
      } else {
        // First time: use defaults and assign variants
        this.flags = { ...DEFAULT_FLAGS };
        await this.assignVariants();
        await this.save();
      }

      this.initialized = true;
      console.log('[FeatureFlags] Initialized:', this.flags);
    } catch (error) {
      console.error('[FeatureFlags] Failed to initialize:', error);
      this.flags = { ...DEFAULT_FLAGS };
    }
  }

  /**
   * Assign A/B test variants randomly
   */
  private async assignVariants() {
    Object.keys(this.flags).forEach((key) => {
      const flag = this.flags[key];
      if (flag.variant) {
        // Randomly assign variant A or B (50/50 split)
        flag.variant = Math.random() < 0.5 ? 'A' : 'B';
        
        // Track variant assignment
        analytics.track('Feature Flag Variant Assigned', {
          flag_key: flag.key,
          flag_name: flag.name,
          variant: flag.variant,
        });
      }
    });
  }

  /**
   * Save flags to storage
   */
  private async save() {
    try {
      await AsyncStorage.setItem('feature_flags', JSON.stringify(this.flags));
    } catch (error) {
      console.error('[FeatureFlags] Failed to save:', error);
    }
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string): boolean {
    const flag = this.flags[key];
    return flag ? flag.enabled : false;
  }

  /**
   * Get variant for A/B test
   */
  getVariant(key: string): 'A' | 'B' | undefined {
    const flag = this.flags[key];
    return flag?.variant;
  }

  /**
   * Enable a feature
   */
  async enable(key: string) {
    if (this.flags[key]) {
      this.flags[key].enabled = true;
      await this.save();
      
      analytics.track('Feature Flag Enabled', {
        flag_key: key,
        flag_name: this.flags[key].name,
      });
    }
  }

  /**
   * Disable a feature
   */
  async disable(key: string) {
    if (this.flags[key]) {
      this.flags[key].enabled = false;
      await this.save();
      
      analytics.track('Feature Flag Disabled', {
        flag_key: key,
        flag_name: this.flags[key].name,
      });
    }
  }

  /**
   * Set variant for A/B test
   */
  async setVariant(key: string, variant: 'A' | 'B') {
    if (this.flags[key]) {
      this.flags[key].variant = variant;
      await this.save();
      
      analytics.track('Feature Flag Variant Changed', {
        flag_key: key,
        flag_name: this.flags[key].name,
        variant,
      });
    }
  }

  /**
   * Get all flags
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  /**
   * Reset to defaults
   */
  async reset() {
    this.flags = { ...DEFAULT_FLAGS };
    await this.assignVariants();
    await this.save();
    
    analytics.track('Feature Flags Reset');
  }

  /**
   * Update flags from server (for remote config)
   */
  async updateFromServer(serverFlags: Record<string, Partial<FeatureFlag>>) {
    Object.keys(serverFlags).forEach((key) => {
      if (this.flags[key]) {
        this.flags[key] = {
          ...this.flags[key],
          ...serverFlags[key],
        };
      }
    });
    
    await this.save();
    console.log('[FeatureFlags] Updated from server');
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsService();

// Export flag keys for type safety
export const FeatureFlagKeys = {
  AI_ADVISOR_CHAT: 'AI_ADVISOR_CHAT',
  PREDICTIVE_ALERTS: 'PREDICTIVE_ALERTS',
  SMART_CATEGORIZATION: 'SMART_CATEGORIZATION',
  CRYPTO_TRACKING: 'CRYPTO_TRACKING',
  AFRICAN_STOCKS: 'AFRICAN_STOCKS',
  TAX_OPTIMIZATION: 'TAX_OPTIMIZATION',
  CREDIT_SCORE: 'CREDIT_SCORE',
  INVESTMENT_RISK: 'INVESTMENT_RISK',
  KYC_VERIFICATION: 'KYC_VERIFICATION',
  PAYMENT_GATEWAY: 'PAYMENT_GATEWAY',
  ROUND_UP_SAVINGS: 'ROUND_UP_SAVINGS',
  DARK_MODE: 'DARK_MODE',
  BIOMETRIC_AUTH: 'BIOMETRIC_AUTH',
  PUSH_NOTIFICATIONS: 'PUSH_NOTIFICATIONS',
  ONBOARDING_VARIANT: 'ONBOARDING_VARIANT',
  HOME_LAYOUT: 'HOME_LAYOUT',
} as const;

// React hook for using feature flags
import { useState, useEffect } from 'react';

export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    featureFlags.initialize().then(() => {
      setEnabled(featureFlags.isEnabled(key));
    });
  }, [key]);

  return enabled;
}

export function useFeatureVariant(key: string): 'A' | 'B' | undefined {
  const [variant, setVariant] = useState<'A' | 'B' | undefined>();

  useEffect(() => {
    featureFlags.initialize().then(() => {
      setVariant(featureFlags.getVariant(key));
    });
  }, [key]);

  return variant;
}
