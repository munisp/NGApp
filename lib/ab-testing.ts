/**
 * A/B Testing Framework for African Fintech Platform
 * 
 * This module provides infrastructure for running controlled experiments
 * to measure the impact of language-specific onboarding on user behavior.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type ExperimentVariant = 'control' | 'treatment';

export interface Experiment {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  variants: {
    control: ExperimentConfig;
    treatment: ExperimentConfig;
  };
  allocation: {
    control: number; // Percentage (0-100)
    treatment: number; // Percentage (0-100)
  };
  metrics: ExperimentMetric[];
  status: 'draft' | 'running' | 'completed' | 'paused';
}

export interface ExperimentConfig {
  name: string;
  description: string;
  features: Record<string, any>;
}

export interface ExperimentMetric {
  id: string;
  name: string;
  type: 'conversion' | 'duration' | 'count' | 'revenue';
  unit?: string;
  goal?: 'increase' | 'decrease';
}

export interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variant: ExperimentVariant;
  assignedAt: Date;
  deviceId: string;
  language: string;
}

export interface ExperimentEvent {
  experimentId: string;
  userId: string;
  variant: ExperimentVariant;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface ExperimentResults {
  experimentId: string;
  startDate: Date;
  endDate: Date;
  totalUsers: {
    control: number;
    treatment: number;
  };
  metrics: {
    [metricId: string]: {
      control: MetricResult;
      treatment: MetricResult;
      improvement: number; // Percentage
      pValue: number;
      significant: boolean;
    };
  };
}

export interface MetricResult {
  value: number;
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = '@ab_testing:';
const ASSIGNMENT_KEY = `${STORAGE_KEY_PREFIX}assignment`;
const EVENTS_KEY = `${STORAGE_KEY_PREFIX}events`;

// ============================================================================
// Experiments
// ============================================================================

/**
 * Language-Specific Onboarding Experiment
 * 
 * Tests whether showing region-specific payment methods, featured services,
 * and local partners improves onboarding completion and first transaction rates.
 */
export const LANGUAGE_ONBOARDING_EXPERIMENT: Experiment = {
  id: 'lang_onboarding_v1',
  name: 'Language-Specific Onboarding',
  description: 'Test impact of localized onboarding on completion rate and engagement',
  startDate: new Date('2026-02-01T00:00:00Z'),
  endDate: new Date('2026-03-01T23:59:59Z'),
  variants: {
    control: {
      name: 'Generic Onboarding',
      description: 'Standard onboarding flow with generic payment methods and services',
      features: {
        useLanguageSpecificOnboarding: false,
        showRegionalPaymentMethods: false,
        showFeaturedServices: false,
        showLocalPartners: false,
      },
    },
    treatment: {
      name: 'Language-Specific Onboarding',
      description: 'Customized onboarding with region-specific content',
      features: {
        useLanguageSpecificOnboarding: true,
        showRegionalPaymentMethods: true,
        showFeaturedServices: true,
        showLocalPartners: true,
      },
    },
  },
  allocation: {
    control: 50, // 50% of users
    treatment: 50, // 50% of users
  },
  metrics: [
    {
      id: 'onboarding_completion',
      name: 'Onboarding Completion Rate',
      type: 'conversion',
      goal: 'increase',
    },
    {
      id: 'time_to_complete',
      name: 'Time to Complete Onboarding',
      type: 'duration',
      unit: 'seconds',
      goal: 'decrease',
    },
    {
      id: 'first_transaction_rate',
      name: 'First Transaction Rate (within 24h)',
      type: 'conversion',
      goal: 'increase',
    },
    {
      id: 'time_to_first_transaction',
      name: 'Time to First Transaction',
      type: 'duration',
      unit: 'hours',
      goal: 'decrease',
    },
    {
      id: 'feature_adoption',
      name: 'Feature Adoption (used 2+ features)',
      type: 'conversion',
      goal: 'increase',
    },
    {
      id: 'day_7_retention',
      name: 'Day 7 Retention Rate',
      type: 'conversion',
      goal: 'increase',
    },
    {
      id: 'day_30_retention',
      name: 'Day 30 Retention Rate',
      type: 'conversion',
      goal: 'increase',
    },
  ],
  status: 'draft',
};

// ============================================================================
// Assignment Logic
// ============================================================================

/**
 * Assign user to experiment variant using deterministic hashing
 * 
 * This ensures:
 * - Same user always gets same variant (consistency)
 * - Even distribution across variants
 * - No server-side state required
 */
export function assignVariant(
  userId: string,
  experiment: Experiment
): ExperimentVariant {
  // Use simple hash function for deterministic assignment
  const hash = hashString(userId + experiment.id);
  const percentage = hash % 100;

  // Allocate based on experiment configuration
  if (percentage < experiment.allocation.control) {
    return 'control';
  } else {
    return 'treatment';
  }
}

/**
 * Simple string hash function (djb2 algorithm)
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ============================================================================
// Storage
// ============================================================================

/**
 * Get user's experiment assignment from local storage
 */
export async function getAssignment(
  experimentId: string
): Promise<ExperimentAssignment | null> {
  try {
    const assignmentJson = await AsyncStorage.getItem(
      `${ASSIGNMENT_KEY}:${experimentId}`
    );
    if (!assignmentJson) return null;

    const assignment = JSON.parse(assignmentJson);
    return {
      ...assignment,
      assignedAt: new Date(assignment.assignedAt),
    };
  } catch (error) {
    console.error('Error getting experiment assignment:', error);
    return null;
  }
}

/**
 * Save user's experiment assignment to local storage
 */
export async function saveAssignment(
  assignment: ExperimentAssignment
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${ASSIGNMENT_KEY}:${assignment.experimentId}`,
      JSON.stringify(assignment)
    );
  } catch (error) {
    console.error('Error saving experiment assignment:', error);
  }
}

/**
 * Get or create user's experiment assignment
 */
export async function getOrCreateAssignment(
  experimentId: string,
  userId: string,
  deviceId: string,
  language: string,
  experiment: Experiment
): Promise<ExperimentAssignment> {
  // Check if user already has assignment
  let assignment = await getAssignment(experimentId);

  if (!assignment) {
    // Assign user to variant
    const variant = assignVariant(userId, experiment);

    assignment = {
      experimentId,
      userId,
      variant,
      assignedAt: new Date(),
      deviceId,
      language,
    };

    // Save assignment
    await saveAssignment(assignment);

    // Track assignment event
    await trackEvent({
      experimentId,
      userId,
      variant,
      eventType: 'experiment_assigned',
      eventData: { language, deviceId },
      timestamp: new Date(),
    });
  }

  return assignment;
}

// ============================================================================
// Event Tracking
// ============================================================================

/**
 * Track experiment event (stored locally and synced to server)
 */
export async function trackEvent(event: ExperimentEvent): Promise<void> {
  try {
    // Store event locally
    const eventsJson = await AsyncStorage.getItem(EVENTS_KEY);
    const events: ExperimentEvent[] = eventsJson ? JSON.parse(eventsJson) : [];
    events.push(event);

    // Keep only last 1000 events to avoid storage bloat
    const recentEvents = events.slice(-1000);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(recentEvents));

    // Sync to server (fire and forget)
    syncEventToServer(event).catch((error) => {
      console.error('Error syncing event to server:', error);
    });
  } catch (error) {
    console.error('Error tracking experiment event:', error);
  }
}

/**
 * Sync event to server for analysis
 */
async function syncEventToServer(event: ExperimentEvent): Promise<void> {
  // TODO: Replace with actual API endpoint
  const response = await fetch('https://api.africanfintech.com/analytics/experiment-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync event: ${response.statusText}`);
  }
}

/**
 * Get all locally stored events
 */
export async function getLocalEvents(): Promise<ExperimentEvent[]> {
  try {
    const eventsJson = await AsyncStorage.getItem(EVENTS_KEY);
    if (!eventsJson) return [];

    const events = JSON.parse(eventsJson);
    return events.map((e: any) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }));
  } catch (error) {
    console.error('Error getting local events:', error);
    return [];
  }
}

/**
 * Clear all locally stored events
 */
export async function clearLocalEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EVENTS_KEY);
  } catch (error) {
    console.error('Error clearing local events:', error);
  }
}

// ============================================================================
// Experiment Hooks
// ============================================================================

/**
 * Track onboarding started
 */
export async function trackOnboardingStarted(
  experimentId: string,
  userId: string,
  variant: ExperimentVariant
): Promise<void> {
  await trackEvent({
    experimentId,
    userId,
    variant,
    eventType: 'onboarding_started',
    eventData: {},
    timestamp: new Date(),
  });
}

/**
 * Track onboarding completed
 */
export async function trackOnboardingCompleted(
  experimentId: string,
  userId: string,
  variant: ExperimentVariant,
  durationSeconds: number
): Promise<void> {
  await trackEvent({
    experimentId,
    userId,
    variant,
    eventType: 'onboarding_completed',
    eventData: { durationSeconds },
    timestamp: new Date(),
  });
}

/**
 * Track first transaction
 */
export async function trackFirstTransaction(
  experimentId: string,
  userId: string,
  variant: ExperimentVariant,
  hoursAfterOnboarding: number,
  transactionAmount: number,
  transactionType: string
): Promise<void> {
  await trackEvent({
    experimentId,
    userId,
    variant,
    eventType: 'first_transaction',
    eventData: {
      hoursAfterOnboarding,
      transactionAmount,
      transactionType,
    },
    timestamp: new Date(),
  });
}

/**
 * Track feature usage
 */
export async function trackFeatureUsage(
  experimentId: string,
  userId: string,
  variant: ExperimentVariant,
  featureName: string
): Promise<void> {
  await trackEvent({
    experimentId,
    userId,
    variant,
    eventType: 'feature_used',
    eventData: { featureName },
    timestamp: new Date(),
  });
}

/**
 * Track user retention
 */
export async function trackRetention(
  experimentId: string,
  userId: string,
  variant: ExperimentVariant,
  daysSinceOnboarding: number
): Promise<void> {
  await trackEvent({
    experimentId,
    userId,
    variant,
    eventType: 'retention_check',
    eventData: { daysSinceOnboarding },
    timestamp: new Date(),
  });
}

// ============================================================================
// Statistical Analysis
// ============================================================================

/**
 * Calculate statistical significance using two-proportion z-test
 */
export function calculateSignificance(
  controlSuccess: number,
  controlTotal: number,
  treatmentSuccess: number,
  treatmentTotal: number
): { pValue: number; significant: boolean } {
  // Calculate proportions
  const p1 = controlSuccess / controlTotal;
  const p2 = treatmentSuccess / treatmentTotal;

  // Calculate pooled proportion
  const pooled = (controlSuccess + treatmentSuccess) / (controlTotal + treatmentTotal);

  // Calculate standard error
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlTotal + 1 / treatmentTotal));

  // Calculate z-score
  const z = (p2 - p1) / se;

  // Calculate p-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  // Significant if p-value < 0.05 (95% confidence)
  const significant = pValue < 0.05;

  return { pValue, significant };
}

/**
 * Cumulative distribution function for standard normal distribution
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovement(
  controlValue: number,
  treatmentValue: number
): number {
  if (controlValue === 0) return 0;
  return ((treatmentValue - controlValue) / controlValue) * 100;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  LANGUAGE_ONBOARDING_EXPERIMENT,
  assignVariant,
  getOrCreateAssignment,
  trackEvent,
  trackOnboardingStarted,
  trackOnboardingCompleted,
  trackFirstTransaction,
  trackFeatureUsage,
  trackRetention,
  calculateSignificance,
  calculateImprovement,
};
