import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

interface OnboardingSlide {
  emoji: string;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    emoji: '🏦',
    title: 'Secure Banking',
    description: 'Manage your accounts with bank-level security. Your money is protected with advanced encryption and biometric authentication.',
  },
  {
    emoji: '💸',
    title: 'Fast Payments',
    description: 'Send and receive money instantly. Transfer funds to anyone, anywhere in Africa with just a few taps.',
  },
  {
    emoji: '✅',
    title: 'Easy Verification',
    description: 'Complete KYC verification in minutes. Upload your ID, take a selfie, and get verified to unlock all features.',
  },
  {
    emoji: '🔒',
    title: 'Your Privacy Matters',
    description: 'We never share your data without permission. Your financial information is encrypted and stored securely.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(slideIndex);
  };

  const scrollToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollToSlide(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      {/* Skip Button */}
      {currentIndex < slides.length - 1 && (
        <View className="absolute top-12 right-6 z-10">
          <TouchableOpacity onPress={handleSkip} className="px-4 py-2" style={{ opacity: 1 }}>
            <Text className="text-primary font-semibold text-base">Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {slides.map((slide, index) => (
          <View key={index} style={{ width }} className="flex-1 justify-center items-center px-8">
            <Text className="text-8xl mb-8">{slide.emoji}</Text>
            <Text className="text-3xl font-bold text-foreground text-center mb-4">
              {slide.title}
            </Text>
            <Text className="text-lg text-muted text-center leading-relaxed">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View className="flex-row justify-center items-center mb-8">
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => scrollToSlide(index)}
            className={`h-2 rounded-full mx-1 ${
              index === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-border'
            }`}
            style={{ opacity: 1 }}
          />
        ))}
      </View>

      {/* Action Buttons */}
      <View className="px-6 pb-8">
        <TouchableOpacity
          onPress={handleNext}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {currentIndex === slides.length - 1 && (
          <TouchableOpacity
            onPress={handleSkip}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">
              I already have an account
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}
