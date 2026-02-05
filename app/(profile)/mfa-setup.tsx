import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Clipboard } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';

/**
 * MFA Setup Screen
 * Allows users to enable two-factor authentication
 */
export default function MfaSetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'backup'>('intro');
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaData, setMfaData] = useState<{
    secret: string;
    qrCodeUri: string;
    backupCodes: string[];
  } | null>(null);
  
  const enableMutation = trpc.mfa.enable.useMutation();
  const verifyMutation = trpc.mfa.verify.useMutation();
  
  const handleStartSetup = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await enableMutation.mutateAsync();
      
      if (result.success) {
        setMfaData({
          secret: result.secret,
          qrCodeUri: result.qrCodeUri,
          backupCodes: result.backupCodes,
        });
        setStep('qr');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start MFA setup. Please try again.');
    }
  };
  
  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code from your authenticator app.');
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await verifyMutation.mutateAsync({ code: verificationCode });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('backup');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Verification Failed', 'The code you entered is incorrect. Please try again.');
      setVerificationCode('');
    }
  };
  
  const handleCopySecret = () => {
    if (mfaData?.secret) {
      Clipboard.setString(mfaData.secret);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Copied', 'Secret key copied to clipboard');
    }
  };
  
  const handleCopyBackupCode = (code: string) => {
    Clipboard.setString(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'MFA Enabled',
      'Two-factor authentication has been successfully enabled for your account.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };
  
  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {step === 'intro' && (
          <View className="flex-1 gap-6">
            <View>
              <Text className="text-3xl font-bold text-foreground mb-2">
                Enable Two-Factor Authentication
              </Text>
              <Text className="text-base text-muted leading-relaxed">
                Add an extra layer of security to your account by requiring a verification code in addition to your password.
              </Text>
            </View>
            
            <View className="bg-surface rounded-2xl p-6 gap-4">
              <Text className="text-lg font-semibold text-foreground">
                What you'll need:
              </Text>
              
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <Text className="text-2xl">📱</Text>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      Authenticator App
                    </Text>
                    <Text className="text-sm text-muted">
                      Google Authenticator, Authy, or similar
                    </Text>
                  </View>
                </View>
                
                <View className="flex-row gap-3">
                  <Text className="text-2xl">🔑</Text>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      Backup Codes
                    </Text>
                    <Text className="text-sm text-muted">
                      Save these in a secure location
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View className="flex-1" />
            
            <TouchableOpacity
              className="bg-primary py-4 rounded-full active:opacity-80"
              onPress={handleStartSetup}
              disabled={enableMutation.isPending}
            >
              {enableMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center text-background font-semibold text-base">
                  Get Started
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {step === 'qr' && mfaData && (
          <View className="flex-1 gap-6">
            <View>
              <Text className="text-3xl font-bold text-foreground mb-2">
                Scan QR Code
              </Text>
              <Text className="text-base text-muted leading-relaxed">
                Open your authenticator app and scan this QR code, or enter the secret key manually.
              </Text>
            </View>
            
            <View className="bg-surface rounded-2xl p-6 gap-4 items-center">
              {/* QR Code placeholder - In production, use a QR code library */}
              <View className="w-64 h-64 bg-background rounded-xl items-center justify-center border-2 border-border">
                <Text className="text-muted text-center px-4">
                  QR Code{'\n'}
                  {mfaData.qrCodeUri.substring(0, 50)}...
                </Text>
              </View>
              
              <View className="w-full gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Secret Key:
                </Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 bg-background rounded-lg p-3">
                    <Text className="text-sm font-mono text-foreground">
                      {mfaData.secret}
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="bg-primary px-4 rounded-lg items-center justify-center active:opacity-80"
                    onPress={handleCopySecret}
                  >
                    <Text className="text-background font-semibold">
                      Copy
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View className="flex-1" />
            
            <TouchableOpacity
              className="bg-primary py-4 rounded-full active:opacity-80"
              onPress={() => setStep('verify')}
            >
              <Text className="text-center text-background font-semibold text-base">
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {step === 'verify' && (
          <View className="flex-1 gap-6">
            <View>
              <Text className="text-3xl font-bold text-foreground mb-2">
                Verify Setup
              </Text>
              <Text className="text-base text-muted leading-relaxed">
                Enter the 6-digit code from your authenticator app to verify the setup.
              </Text>
            </View>
            
            <View className="bg-surface rounded-2xl p-6 gap-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Verification Code
              </Text>
              <TextInput
                className="bg-background rounded-lg p-4 text-foreground text-2xl font-mono text-center"
                placeholder="000000"
                placeholderTextColor="#9BA1A6"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            
            <View className="flex-1" />
            
            <TouchableOpacity
              className="bg-primary py-4 rounded-full active:opacity-80"
              onPress={handleVerify}
              disabled={verifyMutation.isPending || verificationCode.length !== 6}
              style={{
                opacity: verificationCode.length !== 6 ? 0.5 : 1,
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
          </View>
        )}
        
        {step === 'backup' && mfaData && (
          <View className="flex-1 gap-6">
            <View>
              <Text className="text-3xl font-bold text-foreground mb-2">
                Save Backup Codes
              </Text>
              <Text className="text-base text-muted leading-relaxed">
                Save these backup codes in a secure location. You can use them to access your account if you lose your phone.
              </Text>
            </View>
            
            <View className="bg-surface rounded-2xl p-6 gap-3">
              {mfaData.backupCodes.map((code, index) => (
                <TouchableOpacity
                  key={index}
                  className="flex-row items-center justify-between bg-background rounded-lg p-4 active:opacity-70"
                  onPress={() => handleCopyBackupCode(code)}
                >
                  <Text className="text-base font-mono text-foreground">
                    {code}
                  </Text>
                  <Text className="text-sm text-primary">
                    Tap to copy
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View className="bg-warning/10 rounded-xl p-4 border border-warning/30">
              <Text className="text-sm text-warning font-medium">
                ⚠️ Important: Each backup code can only be used once. Store them securely.
              </Text>
            </View>
            
            <View className="flex-1" />
            
            <TouchableOpacity
              className="bg-primary py-4 rounded-full active:opacity-80"
              onPress={handleFinish}
            >
              <Text className="text-center text-background font-semibold text-base">
                Finish Setup
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
