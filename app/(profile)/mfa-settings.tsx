import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';

/**
 * MFA Settings Screen
 * Manage MFA configuration, backup codes, and disable MFA
 */
export default function MfaSettingsScreen() {
  const router = useRouter();
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  
  const { data: statusData, isLoading, refetch } = trpc.mfa.getStatus.useQuery();
  const disableMutation = trpc.mfa.disable.useMutation();
  const regenerateMutation = trpc.mfa.regenerateBackupCodes.useMutation();
  
  const status = statusData?.status;
  
  const handleEnableMfa = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/mfa-setup');
  };
  
  const handleDisableMfa = async () => {
    if (verificationCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid verification code.');
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await disableMutation.mutateAsync({ code: verificationCode });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowDisableModal(false);
        setVerificationCode('');
        refetch();
        
        Alert.alert(
          'MFA Disabled',
          'Two-factor authentication has been disabled for your account.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to disable MFA. Please check your code and try again.');
      setVerificationCode('');
    }
  };
  
  const handleRegenerateBackupCodes = async () => {
    if (verificationCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid verification code.');
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await regenerateMutation.mutateAsync({ code: verificationCode });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNewBackupCodes(result.backupCodes);
        setVerificationCode('');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to regenerate backup codes. Please check your code and try again.');
      setVerificationCode('');
    }
  };
  
  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      </ScreenContainer>
    );
  }
  
  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          <View>
            <Text className="text-3xl font-bold text-foreground mb-2">
              Two-Factor Authentication
            </Text>
            <Text className="text-base text-muted leading-relaxed">
              Manage your account security settings and backup codes.
            </Text>
          </View>
          
          {/* MFA Status */}
          <View className="bg-surface rounded-2xl p-6 gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground mb-1">
                  Status
                </Text>
                <Text className="text-sm text-muted">
                  {status?.enabled ? 'MFA is enabled' : 'MFA is disabled'}
                </Text>
              </View>
              <View
                className={`px-4 py-2 rounded-full ${
                  status?.enabled ? 'bg-success/20' : 'bg-error/20'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    status?.enabled ? 'text-success' : 'text-error'
                  }`}
                >
                  {status?.enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
            
            {status?.enabled && status.lastUsedAt && (
              <Text className="text-sm text-muted">
                Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
          
          {/* Backup Codes */}
          {status?.enabled && (
            <View className="bg-surface rounded-2xl p-6 gap-4">
              <View>
                <Text className="text-lg font-semibold text-foreground mb-1">
                  Backup Codes
                </Text>
                <Text className="text-sm text-muted">
                  You have {status.backupCodesRemaining} backup codes remaining
                </Text>
              </View>
              
              {status.backupCodesRemaining < 3 && (
                <View className="bg-warning/10 rounded-xl p-4 border border-warning/30">
                  <Text className="text-sm text-warning">
                    ⚠️ You're running low on backup codes. Consider regenerating them.
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                className="bg-primary py-3 rounded-full active:opacity-80"
                onPress={() => setShowRegenerateModal(true)}
              >
                <Text className="text-center text-background font-semibold">
                  Regenerate Backup Codes
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Actions */}
          <View className="bg-surface rounded-2xl p-6 gap-3">
            {!status?.enabled ? (
              <TouchableOpacity
                className="bg-primary py-3 rounded-full active:opacity-80"
                onPress={handleEnableMfa}
              >
                <Text className="text-center text-background font-semibold">
                  Enable Two-Factor Authentication
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="bg-error py-3 rounded-full active:opacity-80"
                onPress={() => setShowDisableModal(true)}
              >
                <Text className="text-center text-background font-semibold">
                  Disable Two-Factor Authentication
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Disable MFA Modal */}
          {showDisableModal && (
            <View className="absolute inset-0 bg-black/50 items-center justify-center p-6">
              <View className="bg-surface rounded-2xl p-6 w-full max-w-sm gap-4">
                <Text className="text-xl font-bold text-foreground">
                  Disable MFA
                </Text>
                <Text className="text-sm text-muted">
                  Enter your verification code to disable two-factor authentication.
                </Text>
                
                <TextInput
                  className="bg-background rounded-lg p-4 text-foreground text-center font-mono"
                  placeholder="000000"
                  placeholderTextColor="#9BA1A6"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border py-3 rounded-full active:opacity-80"
                    onPress={() => {
                      setShowDisableModal(false);
                      setVerificationCode('');
                    }}
                  >
                    <Text className="text-center text-foreground font-semibold">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    className="flex-1 bg-error py-3 rounded-full active:opacity-80"
                    onPress={handleDisableMfa}
                    disabled={disableMutation.isPending}
                  >
                    {disableMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-center text-background font-semibold">
                        Disable
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          
          {/* Regenerate Backup Codes Modal */}
          {showRegenerateModal && (
            <View className="absolute inset-0 bg-black/50 items-center justify-center p-6">
              <View className="bg-surface rounded-2xl p-6 w-full max-w-sm gap-4">
                <Text className="text-xl font-bold text-foreground">
                  Regenerate Backup Codes
                </Text>
                
                {newBackupCodes.length === 0 ? (
                  <>
                    <Text className="text-sm text-muted">
                      This will invalidate your existing backup codes and generate new ones. Enter your verification code to continue.
                    </Text>
                    
                    <TextInput
                      className="bg-background rounded-lg p-4 text-foreground text-center font-mono"
                      placeholder="000000"
                      placeholderTextColor="#9BA1A6"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                    
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-surface border border-border py-3 rounded-full active:opacity-80"
                        onPress={() => {
                          setShowRegenerateModal(false);
                          setVerificationCode('');
                        }}
                      >
                        <Text className="text-center text-foreground font-semibold">
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        className="flex-1 bg-primary py-3 rounded-full active:opacity-80"
                        onPress={handleRegenerateBackupCodes}
                        disabled={regenerateMutation.isPending}
                      >
                        {regenerateMutation.isPending ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className="text-center text-background font-semibold">
                            Generate
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text className="text-sm text-muted">
                      Save these new backup codes in a secure location.
                    </Text>
                    
                    <ScrollView className="max-h-64">
                      <View className="gap-2">
                        {newBackupCodes.map((code, index) => (
                          <View
                            key={index}
                            className="bg-background rounded-lg p-3"
                          >
                            <Text className="text-sm font-mono text-foreground text-center">
                              {code}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    
                    <TouchableOpacity
                      className="bg-primary py-3 rounded-full active:opacity-80"
                      onPress={() => {
                        setShowRegenerateModal(false);
                        setNewBackupCodes([]);
                        refetch();
                      }}
                    >
                      <Text className="text-center text-background font-semibold">
                        Done
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
