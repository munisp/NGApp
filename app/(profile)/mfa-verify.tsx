import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';

/**
 * MFA Verification Screen
 * Verifies MFA code during login or sensitive operations
 */
export default function MfaVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  const verifyMutation = trpc.mfa.verifyLogin.useMutation();
  
  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid verification code.');
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await verifyMutation.mutateAsync({ code });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Navigate back
        router.back();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Verification Failed',
        'The code you entered is incorrect. Please try again.',
        [{ text: 'OK' }]
      );
      setCode('');
    }
  };
  
  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 gap-6">
        <View>
          <Text className="text-3xl font-bold text-foreground mb-2">
            Two-Factor Authentication
          </Text>
          <Text className="text-base text-muted leading-relaxed">
            {useBackupCode
              ? 'Enter one of your backup codes to continue.'
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </Text>
        </View>
        
        <View className="bg-surface rounded-2xl p-6 gap-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </Text>
          <TextInput
            className="bg-background rounded-lg p-4 text-foreground text-2xl font-mono text-center"
            placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
            placeholderTextColor="#9BA1A6"
            value={code}
            onChangeText={setCode}
            keyboardType={useBackupCode ? 'default' : 'number-pad'}
            maxLength={useBackupCode ? 8 : 6}
            autoCapitalize="characters"
            autoFocus
          />
          
          <TouchableOpacity
            className="self-center active:opacity-70"
            onPress={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text className="text-primary text-sm font-medium">
              {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-sm text-muted leading-relaxed">
            💡 <Text className="font-medium">Tip:</Text> If you've lost access to your authenticator app, use one of your backup codes instead.
          </Text>
        </View>
        
        <View className="flex-1" />
        
        <TouchableOpacity
          className="bg-primary py-4 rounded-full active:opacity-80"
          onPress={handleVerify}
          disabled={verifyMutation.isPending || code.length < 6}
          style={{
            opacity: code.length < 6 ? 0.5 : 1,
          }}
        >
          {verifyMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-background font-semibold text-base">
              Verify
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          className="py-3 active:opacity-70"
          onPress={() => router.back()}
        >
          <Text className="text-center text-muted text-base">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
