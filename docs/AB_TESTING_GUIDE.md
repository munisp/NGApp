# A/B Testing Guide - African Fintech Platform

## Overview

This guide explains how to run controlled experiments to measure the impact of product changes on user behavior. The platform includes a complete A/B testing infrastructure for running experiments, tracking metrics, and analyzing results.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Experiment Design](#experiment-design)
3. [Implementation](#implementation)
4. [Tracking Events](#tracking-events)
5. [Analysis](#analysis)
6. [Best Practices](#best-practices)
7. [Example: Language-Specific Onboarding](#example-language-specific-onboarding)

---

## Quick Start

### 1. Use the Hook in Your Component

```tsx
import { useLanguageOnboardingExperiment } from '@/hooks/use-experiment';

export function OnboardingScreen() {
  const experiment = useLanguageOnboardingExperiment();

  // Track onboarding started
  useEffect(() => {
    experiment.trackOnboardingStarted();
  }, []);

  if (experiment.isLoading) {
    return <LoadingScreen />;
  }

  if (experiment.isTreatment) {
    // Show language-specific onboarding
    return <LanguageSpecificOnboarding />;
  } else {
    // Show generic onboarding
    return <GenericOnboarding />;
  }
}
```

### 2. Track Key Events

```tsx
// When user completes onboarding
await experiment.trackOnboardingCompleted(durationSeconds);

// When user makes first transaction
await experiment.trackFirstTransaction(
  hoursAfterOnboarding,
  transactionAmount,
  transactionType
);

// When user uses a feature
await experiment.trackFeatureUsage('school_fees');
```

### 3. Analyze Results

After collecting sufficient data (typically 2-4 weeks), analyze results using the analytics dashboard:

```
https://analytics.africanfintech.com/experiments/lang_onboarding_v1
```

---

## Experiment Design

### Key Principles

1. **One Variable at a Time**: Test only one change per experiment
2. **Sufficient Sample Size**: Aim for 1000+ users per variant
3. **Statistical Significance**: Run until p-value < 0.05 (95% confidence)
4. **Minimum Duration**: Run for at least 2 weeks to account for weekly patterns
5. **Clear Hypothesis**: Define expected outcome before starting

### Experiment Structure

```typescript
export interface Experiment {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description: string;           // What are we testing?
  startDate: Date;              // When to start
  endDate: Date;                // When to end
  variants: {
    control: ExperimentConfig;   // Baseline (current experience)
    treatment: ExperimentConfig; // New experience
  };
  allocation: {
    control: number;             // % of users (e.g., 50)
    treatment: number;           // % of users (e.g., 50)
  };
  metrics: ExperimentMetric[];   // What to measure
  status: 'draft' | 'running' | 'completed' | 'paused';
}
```

### Defining Metrics

```typescript
export interface ExperimentMetric {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  type: 'conversion' | 'duration' | 'count' | 'revenue';
  unit?: string;                 // e.g., 'seconds', 'hours', 'NGN'
  goal?: 'increase' | 'decrease'; // Expected direction
}
```

**Common Metrics**:
- **Conversion Rate**: % of users who complete an action
- **Duration**: Time to complete an action (seconds, hours)
- **Count**: Number of actions (e.g., transactions, feature uses)
- **Revenue**: Total revenue generated (NGN, USD)

---

## Implementation

### Step 1: Define Your Experiment

```typescript
// lib/experiments.ts
export const MY_EXPERIMENT: Experiment = {
  id: 'my_experiment_v1',
  name: 'My Experiment',
  description: 'Test impact of X on Y',
  startDate: new Date('2026-02-01T00:00:00Z'),
  endDate: new Date('2026-03-01T23:59:59Z'),
  variants: {
    control: {
      name: 'Control',
      description: 'Current experience',
      features: {
        showNewFeature: false,
      },
    },
    treatment: {
      name: 'Treatment',
      description: 'New experience',
      features: {
        showNewFeature: true,
      },
    },
  },
  allocation: {
    control: 50,
    treatment: 50,
  },
  metrics: [
    {
      id: 'conversion_rate',
      name: 'Conversion Rate',
      type: 'conversion',
      goal: 'increase',
    },
  ],
  status: 'draft',
};
```

### Step 2: Create a Hook

```typescript
// hooks/use-my-experiment.ts
import { useExperiment } from './use-experiment';
import { MY_EXPERIMENT } from '@/lib/experiments';

export function useMyExperiment() {
  return useExperiment(MY_EXPERIMENT);
}
```

### Step 3: Use in Your Component

```tsx
import { useMyExperiment } from '@/hooks/use-my-experiment';

export function MyScreen() {
  const experiment = useMyExperiment();

  if (experiment.isLoading) {
    return <LoadingScreen />;
  }

  if (experiment.features.showNewFeature) {
    return <NewFeature />;
  } else {
    return <OldFeature />;
  }
}
```

### Step 4: Track Events

```tsx
// Track when user starts the flow
await experiment.trackEvent({
  experimentId: experiment.id,
  userId: user.id,
  variant: experiment.variant,
  eventType: 'flow_started',
  eventData: {},
  timestamp: new Date(),
});

// Track when user completes the flow
await experiment.trackEvent({
  experimentId: experiment.id,
  userId: user.id,
  variant: experiment.variant,
  eventType: 'flow_completed',
  eventData: { durationSeconds: 120 },
  timestamp: new Date(),
});
```

---

## Tracking Events

### Built-in Event Types

The framework includes helper functions for common events:

```typescript
// Onboarding
await experiment.trackOnboardingStarted();
await experiment.trackOnboardingCompleted(durationSeconds);

// Transactions
await experiment.trackFirstTransaction(
  hoursAfterOnboarding,
  transactionAmount,
  transactionType
);

// Feature Usage
await experiment.trackFeatureUsage('school_fees');
await experiment.trackFeatureUsage('p2p_lending');

// Retention
await experiment.trackRetention(7);  // Day 7
await experiment.trackRetention(30); // Day 30
```

### Custom Events

For custom events, use the generic `trackEvent` function:

```typescript
import { trackEvent } from '@/lib/ab-testing';

await trackEvent({
  experimentId: 'my_experiment_v1',
  userId: user.id,
  variant: 'treatment',
  eventType: 'custom_event',
  eventData: {
    customField1: 'value1',
    customField2: 123,
  },
  timestamp: new Date(),
});
```

### Event Data Structure

```typescript
export interface ExperimentEvent {
  experimentId: string;          // Which experiment
  userId: string;                // Which user
  variant: ExperimentVariant;    // Which variant ('control' or 'treatment')
  eventType: string;             // What happened
  eventData: Record<string, any>; // Additional data
  timestamp: Date;               // When it happened
}
```

---

## Analysis

### Statistical Significance

The framework includes built-in statistical analysis using **two-proportion z-test** for conversion metrics:

```typescript
import { calculateSignificance } from '@/lib/ab-testing';

const result = calculateSignificance(
  controlSuccess: 450,  // 450 conversions
  controlTotal: 1000,   // out of 1000 users
  treatmentSuccess: 550, // 550 conversions
  treatmentTotal: 1000   // out of 1000 users
);

console.log(result.pValue);      // 0.0023 (p-value)
console.log(result.significant); // true (p < 0.05)
```

**Interpretation**:
- **p-value < 0.05**: Statistically significant (95% confidence)
- **p-value < 0.01**: Highly significant (99% confidence)
- **p-value ≥ 0.05**: Not significant (could be random chance)

### Calculating Improvement

```typescript
import { calculateImprovement } from '@/lib/ab-testing';

const improvement = calculateImprovement(
  controlValue: 45,    // 45% conversion rate
  treatmentValue: 55   // 55% conversion rate
);

console.log(improvement); // 22.22% improvement
```

### Sample Size Calculator

To determine how many users you need:

```typescript
/**
 * Calculate required sample size for experiment
 * 
 * @param baselineRate - Current conversion rate (e.g., 0.45 for 45%)
 * @param minDetectableEffect - Minimum improvement to detect (e.g., 0.10 for 10%)
 * @param alpha - Significance level (typically 0.05 for 95% confidence)
 * @param power - Statistical power (typically 0.80 for 80% power)
 * @returns Required sample size per variant
 */
function calculateSampleSize(
  baselineRate: number,
  minDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.80
): number {
  // Simplified formula (assumes equal allocation)
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minDetectableEffect);
  const pAvg = (p1 + p2) / 2;
  
  const zAlpha = 1.96;  // 95% confidence
  const zBeta = 0.84;   // 80% power
  
  const n = (
    (zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
     zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
  ) / ((p2 - p1) ** 2);
  
  return Math.ceil(n);
}

// Example: Detect 10% improvement from 45% baseline
const sampleSize = calculateSampleSize(0.45, 0.10);
console.log(sampleSize); // ~1,570 users per variant
```

### Experiment Dashboard

View results in the analytics dashboard:

```
https://analytics.africanfintech.com/experiments/lang_onboarding_v1
```

**Metrics Displayed**:
- Total users per variant
- Conversion rates with confidence intervals
- Statistical significance (p-value)
- Improvement percentage
- Time-series charts
- Segment breakdowns (by language, device, etc.)

---

## Best Practices

### 1. Run Experiments Sequentially

**Don't**:
```
Experiment A (50% control, 50% treatment)
Experiment B (50% control, 50% treatment)
→ Users split across 4 groups (25% each)
```

**Do**:
```
Experiment A (50% control, 50% treatment) → Complete
Experiment B (50% control, 50% treatment) → Start after A
```

### 2. Avoid Peeking

Don't stop experiments early because results look good. This increases false positive rate.

**Minimum Duration**: 2 weeks or 1000+ users per variant (whichever is longer)

### 3. Account for Novelty Effect

Users may engage more with new features simply because they're new. Run experiments for at least 2 weeks to let novelty wear off.

### 4. Segment Analysis

Analyze results by segment to find hidden insights:

```typescript
// Analyze by language
const englishResults = filterByLanguage(results, 'en');
const frenchResults = filterByLanguage(results, 'fr');

// Analyze by device
const iosResults = filterByDevice(results, 'ios');
const androidResults = filterByDevice(results, 'android');
```

### 5. Document Everything

Create a post-experiment report:

```markdown
# Experiment Report: Language-Specific Onboarding

## Hypothesis
Showing region-specific payment methods will increase onboarding completion rate.

## Results
- Control: 60% completion rate (1,000 users)
- Treatment: 72% completion rate (1,000 users)
- Improvement: +20% (p-value: 0.0001, highly significant)

## Decision
✅ Ship to 100% of users

## Next Steps
- Translate remaining screens
- A/B test featured services order
- Monitor retention over 30 days
```

---

## Example: Language-Specific Onboarding

### Hypothesis

**"Showing region-specific payment methods, featured services, and local partners will increase onboarding completion rate from 60% to 75%."**

### Experiment Setup

```typescript
export const LANGUAGE_ONBOARDING_EXPERIMENT: Experiment = {
  id: 'lang_onboarding_v1',
  name: 'Language-Specific Onboarding',
  description: 'Test impact of localized onboarding on completion rate',
  startDate: new Date('2026-02-01T00:00:00Z'),
  endDate: new Date('2026-03-01T23:59:59Z'),
  variants: {
    control: {
      name: 'Generic Onboarding',
      description: 'Standard onboarding with generic content',
      features: {
        useLanguageSpecificOnboarding: false,
      },
    },
    treatment: {
      name: 'Language-Specific Onboarding',
      description: 'Customized onboarding with regional content',
      features: {
        useLanguageSpecificOnboarding: true,
      },
    },
  },
  allocation: {
    control: 50,
    treatment: 50,
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
      name: 'First Transaction Rate (24h)',
      type: 'conversion',
      goal: 'increase',
    },
  ],
  status: 'running',
};
```

### Implementation

```tsx
// app/onboarding/index.tsx
import { useLanguageOnboardingExperiment } from '@/hooks/use-experiment';
import { getOnboardingConfig } from '@/lib/onboarding-config';
import { useTranslation } from '@/hooks/use-translation';

export default function OnboardingScreen() {
  const experiment = useLanguageOnboardingExperiment();
  const { i18n } = useTranslation();
  const [startTime] = useState(Date.now());

  // Track onboarding started
  useEffect(() => {
    experiment.trackOnboardingStarted();
  }, []);

  // Get onboarding config based on variant
  const config = experiment.isTreatment
    ? getOnboardingConfig(i18n.language)
    : getGenericOnboardingConfig();

  const handleComplete = async () => {
    const durationSeconds = (Date.now() - startTime) / 1000;
    await experiment.trackOnboardingCompleted(durationSeconds);
    
    // Navigate to home screen
    router.push('/(tabs)');
  };

  if (experiment.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ScreenContainer>
      <ScrollView>
        {/* Payment Methods */}
        <Text className="text-xl font-bold text-foreground mb-4">
          {t('onboarding.payment_methods')}
        </Text>
        {config.paymentMethods.map((method) => (
          <PaymentMethodCard
            key={method.id}
            name={method.name}
            icon={method.icon}
            popular={method.popular}
          />
        ))}

        {/* Featured Services */}
        <Text className="text-xl font-bold text-foreground mb-4 mt-8">
          {t('onboarding.featured_services')}
        </Text>
        {config.featuredServices.map((service) => (
          <ServiceCard
            key={service.id}
            title={service.title}
            description={service.description}
          />
        ))}

        {/* Local Partners */}
        {experiment.isTreatment && (
          <>
            <Text className="text-xl font-bold text-foreground mb-4 mt-8">
              {t('onboarding.local_partners')}
            </Text>
            <Text className="text-sm text-muted mb-4">
              {config.localPartners.join(', ')}
            </Text>
          </>
        )}

        {/* Complete Button */}
        <TouchableOpacity
          onPress={handleComplete}
          className="bg-primary px-6 py-4 rounded-full mt-8"
        >
          <Text className="text-background font-semibold text-center">
            {t('onboarding.get_started')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
```

### Expected Results

| Metric | Control | Treatment | Improvement | Significant? |
|--------|---------|-----------|-------------|--------------|
| Onboarding Completion | 60% | 72% | +20% | ✅ Yes (p<0.001) |
| Time to Complete | 180s | 150s | -17% | ✅ Yes (p<0.01) |
| First Transaction (24h) | 25% | 35% | +40% | ✅ Yes (p<0.001) |
| Day 7 Retention | 40% | 50% | +25% | ✅ Yes (p<0.01) |

### Decision

✅ **Ship to 100% of users**

The treatment variant significantly improved all key metrics. Language-specific onboarding increases completion rate by 20%, reduces time to complete by 17%, and increases first transaction rate by 40%.

### Next Steps

1. **Expand translations**: Complete translations for all 105 screens
2. **Test featured services order**: A/B test different service orderings
3. **Monitor long-term retention**: Track 30-day and 90-day retention
4. **Iterate on content**: Refine payment method descriptions based on user feedback

---

## Troubleshooting

### Issue: Users Not Being Assigned

**Symptom**: `experiment.variant` is always `null`

**Causes**:
1. User not logged in
2. Experiment not running (check `status` field)
3. Assignment logic error

**Solution**:
```tsx
if (experiment.isLoading) {
  return <LoadingScreen />;
}

if (!experiment.variant) {
  console.error('User not assigned to experiment');
  // Fallback to control
  return <ControlExperience />;
}
```

### Issue: Events Not Being Tracked

**Symptom**: No events in analytics dashboard

**Causes**:
1. Network error (events not syncing to server)
2. User ID not set
3. Tracking function not called

**Solution**:
```tsx
// Check local events
import { getLocalEvents } from '@/lib/ab-testing';

const events = await getLocalEvents();
console.log('Local events:', events);

// Manually sync to server
import { syncEventToServer } from '@/lib/ab-testing';
for (const event of events) {
  await syncEventToServer(event);
}
```

### Issue: Inconsistent Assignment

**Symptom**: User gets different variant on different devices

**Cause**: Using device ID instead of user ID for assignment

**Solution**: Always use user ID for assignment (deterministic hashing ensures consistency)

```typescript
// ✅ Correct: Use user ID
const variant = assignVariant(user.id, experiment);

// ❌ Wrong: Use device ID
const variant = assignVariant(deviceId, experiment);
```

---

## API Reference

### Functions

#### `assignVariant(userId, experiment)`
Deterministically assign user to experiment variant.

#### `getOrCreateAssignment(experimentId, userId, deviceId, language, experiment)`
Get existing assignment or create new one.

#### `trackEvent(event)`
Track experiment event (stored locally and synced to server).

#### `calculateSignificance(controlSuccess, controlTotal, treatmentSuccess, treatmentTotal)`
Calculate statistical significance using two-proportion z-test.

#### `calculateImprovement(controlValue, treatmentValue)`
Calculate improvement percentage.

### Hooks

#### `useExperiment(experiment)`
React hook for accessing experiment variant and tracking functions.

#### `useLanguageOnboardingExperiment()`
Convenience hook for language-specific onboarding experiment.

---

## Resources

- **Analytics Dashboard**: https://analytics.africanfintech.com/experiments
- **Sample Size Calculator**: https://www.evanmiller.org/ab-testing/sample-size.html
- **Statistical Significance Calculator**: https://www.evanmiller.org/ab-testing/chi-squared.html
- **A/B Testing Best Practices**: https://www.optimizely.com/optimization-glossary/ab-testing/

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Maintained by**: Product Team
