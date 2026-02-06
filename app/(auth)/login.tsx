import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function LoginScreen() {
  const { login, authenticateBiometric } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const success = await authenticateBiometric();
    if (success) {
      // If biometric succeeds, check if we have stored credentials
      // For now, just show success message
      Alert.alert('Success', 'Biometric authentication successful');
    } else {
      Alert.alert('Failed', 'Biometric authentication failed');
    }
  };

  return (
    <ScreenContainer className="p-6 justify-center items-center">
      <View className="gap-6" style={{ maxWidth: 440, width: '100%' }}>
        {/* Header */}
        <View className="items-center gap-2 mb-8">
          <Text className="text-4xl font-bold text-foreground">Welcome Back</Text>
          <Text className="text-base text-muted text-center">
            Sign in to your account to continue
          </Text>
        </View>

        {/* Email Input */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Email</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            placeholder="Enter your email"
            placeholderTextColor="#9BA1A6"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        {/* Password Input */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Password</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            placeholder="Enter your password"
            placeholderTextColor="#9BA1A6"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {/* Forgot Password */}
        <TouchableOpacity className="self-end">
          <Text className="text-sm text-primary font-medium">Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          className={cn(
            'bg-primary rounded-full py-4 items-center',
            isLoading && 'opacity-50'
          )}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-background font-semibold text-base">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Biometric Login */}
        <TouchableOpacity
          className="border border-primary rounded-full py-4 items-center"
          onPress={handleBiometricLogin}
        >
          <Text className="text-primary font-semibold text-base">Use Face ID / Touch ID</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <View className="flex-row items-center justify-center gap-2 mt-4">
          <Text className="text-muted">Don't have an account?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text className="text-primary font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScreenContainer>
  );
}
