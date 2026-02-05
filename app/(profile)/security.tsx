import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';

export default function SecuritySettingsScreen() {
  const { authenticateBiometric } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      setIsChangingPassword(true);

      // Require biometric authentication
      const authenticated = await authenticateBiometric();
      if (!authenticated) {
        Alert.alert('Error', 'Biometric authentication failed');
        return;
      }

      // In a real app, you would call the API here
      // await authService.changePassword({ currentPassword, newPassword });

      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const securityOptions = [
    {
      icon: '🔐',
      title: 'Two-Factor Authentication',
      description: 'Add an extra layer of security',
      action: () => Alert.alert('Coming Soon', 'Two-factor authentication will be available soon'),
    },
    {
      icon: '📱',
      title: 'Trusted Devices',
      description: 'Manage devices that can access your account',
      action: () => Alert.alert('Coming Soon', 'Device management will be available soon'),
    },
    {
      icon: '🔔',
      title: 'Login Alerts',
      description: 'Get notified of new logins',
      action: () => Alert.alert('Coming Soon', 'Login alerts will be available soon'),
    },
    {
      icon: '📜',
      title: 'Activity Log',
      description: 'View your recent account activity',
      action: () => Alert.alert('Coming Soon', 'Activity log will be available soon'),
    },
  ];

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Security Settings' }} />

      <ScrollView className="flex-1">
        {/* Change Password Section */}
        <Text className="text-lg font-bold text-foreground mb-3">Change Password</Text>
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
            placeholder="Current Password"
            placeholderTextColor="#9BA1A6"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
            placeholder="New Password"
            placeholderTextColor="#9BA1A6"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
            placeholder="Confirm New Password"
            placeholderTextColor="#9BA1A6"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={isChangingPassword}
            className={`rounded-lg p-3 ${isChangingPassword ? 'bg-primary/50' : 'bg-primary'}`}
            style={{ opacity: 1 }}
          >
            {isChangingPassword ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center font-semibold">Change Password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Options */}
        <Text className="text-lg font-bold text-foreground mb-3">Security Options</Text>
        <View className="bg-surface rounded-xl border border-border overflow-hidden mb-6">
          {securityOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              onPress={option.action}
              className={`flex-row items-center p-4 ${
                index < securityOptions.length - 1 ? 'border-b border-border' : ''
              }`}
              style={{ opacity: 1 }}
            >
              <Text className="text-3xl mr-3">{option.icon}</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">{option.title}</Text>
                <Text className="text-muted text-sm">{option.description}</Text>
              </View>
              <Text className="text-muted">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <Text className="text-lg font-bold text-error mb-3">Danger Zone</Text>
        <View className="bg-error/10 rounded-xl border border-error p-4">
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Delete Account',
                'This action cannot be undone. Are you sure you want to delete your account?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => Alert.alert('Coming Soon', 'Account deletion will be available soon'),
                  },
                ]
              )
            }
            style={{ opacity: 1 }}
          >
            <Text className="text-error font-semibold text-center">Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
