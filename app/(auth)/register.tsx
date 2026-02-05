import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!firstName || !lastName || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, phone, firstName, lastName);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6 py-8">
          {/* Header */}
          <View className="gap-2 mb-4">
            <Text className="text-4xl font-bold text-foreground">Create Account</Text>
            <Text className="text-base text-muted">
              Sign up to get started with your fintech journey
            </Text>
          </View>

          {/* First Name */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">First Name</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Enter your first name"
              placeholderTextColor="#9BA1A6"
              value={firstName}
              onChangeText={setFirstName}
              autoComplete="given-name"
            />
          </View>

          {/* Last Name */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Last Name</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Enter your last name"
              placeholderTextColor="#9BA1A6"
              value={lastName}
              onChangeText={setLastName}
              autoComplete="family-name"
            />
          </View>

          {/* Email */}
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

          {/* Phone */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Phone Number</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Enter your phone number"
              placeholderTextColor="#9BA1A6"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {/* Password */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Password</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Create a password (min 8 characters)"
              placeholderTextColor="#9BA1A6"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
            />
          </View>

          {/* Confirm Password */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Confirm Password</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Re-enter your password"
              placeholderTextColor="#9BA1A6"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="password-new"
            />
          </View>

          {/* Register Button */}
          <TouchableOpacity
            className={cn(
              'bg-primary rounded-full py-4 items-center mt-4',
              isLoading && 'opacity-50'
            )}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-background font-semibold text-base">Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View className="flex-row items-center justify-center gap-2 mt-4">
            <Text className="text-muted">Already have an account?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary font-semibold">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
