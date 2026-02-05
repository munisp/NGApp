/**
 * Onboarding Screen
 * Interactive onboarding flow for new users
 */

import { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { analytics, AnalyticsEvents } from '@/lib/analytics';
import { useColors } from '@/hooks/use-colors';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Welcome to African Fintech',
    description: 'Your intelligent financial companion for saving, investing, and growing wealth across Africa.',
    icon: '👋',
    features: [
      'Track all your accounts in one place',
      'Smart budgeting with AI insights',
      'Real-time African stock market data',
    ],
  },
  {
    id: 2,
    title: 'AI-Powered Insights',
    description: 'Get personalized financial advice from our intelligent chatbot powered by advanced AI.',
    icon: '🤖',
    features: [
      'Predictive alerts before you overspend',
      'Smart transaction categorization',
      'Tax optimization for your country',
    ],
  },
  {
    id: 3,
    title: 'Automated Savings',
    description: 'Save money effortlessly with intelligent round-up and pattern analysis.',
    icon: '💰',
    features: [
      'Automatic round-up on every purchase',
      'Smart savings recommendations',
      'Track progress towards your goals',
    ],
  },
  {
    id: 4,
    title: 'Investment Tracking',
    description: 'Monitor stocks, crypto, and investments with real-time data from African exchanges.',
    icon: '📈',
    features: [
      'Real-time prices from NSE, JSE, GSE',
      'Bitcoin and Ethereum tracking',
      'Portfolio risk assessment',
    ],
  },
  {
    id: 5,
    title: 'Bank-Level Security',
    description: 'Your data is protected with end-to-end encryption and biometric authentication.',
    icon: '🔒',
    features: [
      'Biometric authentication (Face ID, Fingerprint)',
      'End-to-end encryption',
      'KYC verification for enhanced security',
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useColors();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      scrollViewRef.current?.scrollTo({ x: nextStep * width, animated: true });
      
      analytics.track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
        step_number: currentStep + 1,
        step_title: step.title,
      });
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    analytics.track(AnalyticsEvents.ONBOARDING_SKIPPED, {
      last_step: currentStep + 1,
    });
    router.replace('/(tabs)');
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    analytics.track(AnalyticsEvents.ONBOARDING_COMPLETED);
    router.replace('/(tabs)');
  };

  const handleDotPress = (index: number) => {
    setCurrentStep(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1">
        {/* Skip Button */}
        {!isLastStep && (
          <View className="items-end p-4">
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-primary font-semibold text-base">Skip</Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          className="flex-1"
        >
          {ONBOARDING_STEPS.map((stepData) => (
            <View key={stepData.id} style={{ width }} className="flex-1 px-8 justify-center">
              {/* Icon */}
              <View className="items-center mb-8">
                <Text style={{ fontSize: 100 }}>{stepData.icon}</Text>
              </View>

              {/* Title */}
              <Text className="text-3xl font-bold text-foreground text-center mb-4">
                {stepData.title}
              </Text>

              {/* Description */}
              <Text className="text-base text-muted text-center mb-8 leading-relaxed">
                {stepData.description}
              </Text>

              {/* Features */}
              <View className="space-y-4">
                {stepData.features.map((feature, index) => (
                  <View key={index} className="flex-row items-start">
                    <Text className="text-primary text-xl mr-3">✓</Text>
                    <Text className="text-foreground text-base flex-1 leading-relaxed">
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        <View className="flex-row justify-center items-center py-6">
          {ONBOARDING_STEPS.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => handleDotPress(index)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View
                className={`h-2 rounded-full mx-1 ${
                  index === currentStep ? 'w-8 bg-primary' : 'w-2 bg-border'
                }`}
              />
            </Pressable>
          ))}
        </View>

        {/* Next/Get Started Button */}
        <View className="px-8 pb-8">
          <Pressable
            onPress={handleNext}
            className="bg-primary rounded-full py-4 items-center"
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.97 : 1 }],
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text className="text-background font-bold text-lg">
              {isLastStep ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}
