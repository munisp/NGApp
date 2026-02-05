import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';

const ONBOARDING_KEY = 'hasSeenOnboarding';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Wait for auth to finish loading
        if (isLoading) return;

        // If authenticated, go to tabs
        if (isAuthenticated) {
          router.replace('/(tabs)');
          return;
        }

        // Check if user has seen onboarding
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        
        if (hasSeenOnboarding === 'true') {
          // User has seen onboarding, go to login
          router.replace('/(auth)/login');
        } else {
          // First time user, show onboarding
          router.replace('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, default to login
        router.replace('/(auth)/login');
      }
    };

    checkOnboarding();
  }, [isAuthenticated, isLoading]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color="#0a7ea4" />
    </View>
  );
}
