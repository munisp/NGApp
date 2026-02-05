/**
 * React Hook for A/B Testing
 * 
 * Provides easy access to experiment variants and tracking functions.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import {
  type Experiment,
  type ExperimentVariant,
  type ExperimentAssignment,
  getOrCreateAssignment,
  trackOnboardingStarted,
  trackOnboardingCompleted,
  trackFirstTransaction,
  trackFeatureUsage,
  trackRetention,
  LANGUAGE_ONBOARDING_EXPERIMENT,
} from '@/lib/ab-testing';
import { useAuth } from './use-auth';

// ============================================================================
// Types
// ============================================================================

export interface UseExperimentResult {
  variant: ExperimentVariant | null;
  isControl: boolean;
  isTreatment: boolean;
  isLoading: boolean;
  features: Record<string, any>;
  trackOnboardingStarted: () => Promise<void>;
  trackOnboardingCompleted: (durationSeconds: number) => Promise<void>;
  trackFirstTransaction: (
    hoursAfterOnboarding: number,
    transactionAmount: number,
    transactionType: string
  ) => Promise<void>;
  trackFeatureUsage: (featureName: string) => Promise<void>;
  trackRetention: (daysSinceOnboarding: number) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access experiment variant and tracking functions
 * 
 * Usage:
 * ```tsx
 * const experiment = useExperiment(LANGUAGE_ONBOARDING_EXPERIMENT);
 * 
 * if (experiment.isTreatment) {
 *   // Show language-specific onboarding
 * } else {
 *   // Show generic onboarding
 * }
 * 
 * // Track events
 * await experiment.trackOnboardingStarted();
 * await experiment.trackOnboardingCompleted(120); // 120 seconds
 * ```
 */
export function useExperiment(experiment: Experiment): UseExperimentResult {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<ExperimentAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get or create assignment when user is available
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadAssignment = async () => {
      try {
        const deviceId = await getDeviceId();
        const language = await getDeviceLanguage();

        const userAssignment = await getOrCreateAssignment(
          experiment.id,
          String(user.id),
          deviceId,
          language,
          experiment
        );

        setAssignment(userAssignment);
      } catch (error) {
        console.error('Error loading experiment assignment:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignment();
  }, [user, experiment.id]);

  // Get variant features
  const variant = assignment?.variant ?? null;
  const features = variant
    ? experiment.variants[variant].features
    : {};

  // Tracking functions
  const trackOnboardingStartedFn = async () => {
    if (!assignment) return;
    await trackOnboardingStarted(
      experiment.id,
      assignment.userId,
      assignment.variant
    );
  };

  const trackOnboardingCompletedFn = async (durationSeconds: number) => {
    if (!assignment) return;
    await trackOnboardingCompleted(
      experiment.id,
      assignment.userId,
      assignment.variant,
      durationSeconds
    );
  };

  const trackFirstTransactionFn = async (
    hoursAfterOnboarding: number,
    transactionAmount: number,
    transactionType: string
  ) => {
    if (!assignment) return;
    await trackFirstTransaction(
      experiment.id,
      assignment.userId,
      assignment.variant,
      hoursAfterOnboarding,
      transactionAmount,
      transactionType
    );
  };

  const trackFeatureUsageFn = async (featureName: string) => {
    if (!assignment) return;
    await trackFeatureUsage(
      experiment.id,
      assignment.userId,
      assignment.variant,
      featureName
    );
  };

  const trackRetentionFn = async (daysSinceOnboarding: number) => {
    if (!assignment) return;
    await trackRetention(
      experiment.id,
      assignment.userId,
      assignment.variant,
      daysSinceOnboarding
    );
  };

  return {
    variant,
    isControl: variant === 'control',
    isTreatment: variant === 'treatment',
    isLoading,
    features,
    trackOnboardingStarted: trackOnboardingStartedFn,
    trackOnboardingCompleted: trackOnboardingCompletedFn,
    trackFirstTransaction: trackFirstTransactionFn,
    trackFeatureUsage: trackFeatureUsageFn,
    trackRetention: trackRetentionFn,
  };
}

/**
 * Convenience hook for language-specific onboarding experiment
 */
export function useLanguageOnboardingExperiment(): UseExperimentResult {
  return useExperiment(LANGUAGE_ONBOARDING_EXPERIMENT);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get device ID (unique identifier for this device)
 */
async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'web') {
    // Use localStorage for web
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } else {
    // Use expo-device for native
    return Device.deviceName ?? generateUUID();
  }
}

/**
 * Get device language
 */
async function getDeviceLanguage(): Promise<string> {
  if (Platform.OS === 'web') {
    return navigator.language.split('-')[0]; // e.g., "en-US" -> "en"
  } else {
    // This would use expo-localization in a real app
    return 'en';
  }
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
