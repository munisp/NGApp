import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
  Appbar,
  List,
  Switch,
  Button,
  ActivityIndicator,
  Snackbar,
  useTheme,
  Text,
  Divider,
} from 'react-native-paper';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { trpc } from '@/services/api'; // Required tRPC client import
import { theme as appTheme } from '@/utils/theme'; // Required theme import
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Mock Types and Data Structures ---

// Define the type for the settings data
interface UserSettings {
  id: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  themePreference: 'light' | 'dark' | 'system';
}

// Mock initial data for the query (simulating a successful fetch)
const mockInitialSettings: UserSettings = {
  id: 'user-123',
  emailNotifications: true,
  pushNotifications: false,
  themePreference: 'light',
};

// --- Mock tRPC Hooks (Simulating real API calls) ---

// 1. Fetch Settings Query (Read operation)
const useGetSettingsQuery = () => {
  // In a real app, this would be: trpc.settings.get.useQuery()
  return useQuery<UserSettings, Error>({
    queryKey: ['userSettings'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockInitialSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// 2. Update Settings Mutation (Update operation)
const useUpdateSettingsMutation = () => {
  const queryClient = useQueryClient();
  // In a real app, this would be: trpc.settings.update.useMutation()
  return useMutation<UserSettings, Error, Partial<UserSettings>>({
    mutationFn: async (newSettings) => {
      // Simulate API delay and successful update
      await new Promise(resolve => setTimeout(resolve, 800));
      // Optimistically update the cache (or return the new data from the server)
      const currentSettings = queryClient.getQueryData<UserSettings>(['userSettings']) || mockInitialSettings;
      return { ...currentSettings, ...newSettings };
    },
    onSuccess: (data) => {
      // Invalidate and refetch after a successful update
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      // Optionally, set the new data directly
      queryClient.setQueryData(['userSettings'], data);
    },
  });
};

// 3. Logout Mutation (Action/Delete operation)
const useLogoutMutation = () => {
  // In a real app, this would be: trpc.auth.logout.useMutation()
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      // Simulate API call to clear session/token
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Clear local storage/state here
    },
  });
};

// --- Component Implementation ---

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const paperTheme = useTheme();
  const queryClient = useQueryClient();

  // State for toast notifications
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showToast = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  // Data fetching and state management
  const { data: settings, isLoading, isError, error, refetch } = useGetSettingsQuery();
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettingsMutation();
  const { mutate: logout, isPending: isLoggingOut } = useLogoutMutation();

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle setting changes (CRUD Update)
  const handleSettingChange = useCallback((key: keyof UserSettings, value: any) => {
    if (!settings) return;

    updateSettings(
      { [key]: value },
      {
        onSuccess: (updatedData) => {
          showToast(`${key} updated successfully!`);
          // Note: The theme change logic would typically be handled by a global context
          // that listens to the themePreference in the updatedData.
        },
        onError: (err) => {
          showToast(`Failed to update ${key}: ${err.message}`);
        },
      }
    );
  }, [settings, updateSettings, showToast]);

  // Handle Logout
  const handleLogout = useCallback(() => {
    logout(undefined, {
      onSuccess: () => {
        showToast('Logged out successfully!');
        // Reset navigation stack and navigate to Login screen
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' as never }], // Assuming 'Login' is a route name
          })
        );
      },
      onError: (err) => {
        showToast(`Logout failed: ${err.message}`);
      },
    });
  }, [logout, navigation, showToast]);

  // --- Render Logic ---

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
        <Text style={{ marginTop: 10 }}>Loading settings...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: paperTheme.colors.error }}>
          Error loading settings: {error.message}
        </Text>
        <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 10 }}>
          Try Again
        </Button>
      </View>
    );
  }

  const currentTheme = settings?.themePreference || 'light';

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: paperTheme.colors.background }}>
        <Appbar.Content title="App Settings" />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            colors={[paperTheme.colors.primary]}
            tintColor={paperTheme.colors.primary}
          />
        }
      >
        {/* Notification Preferences Section (CRUD Update) */}
        <List.Section title="Notification Preferences">
          <List.Item
            title="Email Notifications"
            description="Receive important updates via email"
            left={props => <List.Icon {...props} icon="email-outline" />}
            right={() => (
              <Switch
                value={settings?.emailNotifications || false}
                onValueChange={(value) => handleSettingChange('emailNotifications', value)}
                disabled={isUpdating || isLoggingOut}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Push Notifications"
            description="Receive real-time alerts on your device"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={() => (
              <Switch
                value={settings?.pushNotifications || false}
                onValueChange={(value) => handleSettingChange('pushNotifications', value)}
                disabled={isUpdating || isLoggingOut}
              />
            )}
          />
        </List.Section>

        <Divider />

        {/* Theme Toggle Section (CRUD Update) */}
        <List.Section title="Appearance">
          <List.Item
            title="Dark Mode"
            description={`Current: ${currentTheme}`}
            left={props => <List.Icon {...props} icon={currentTheme === 'dark' ? 'weather-night' : 'white-balance-sunny'} />}
            right={() => (
              <Switch
                value={currentTheme === 'dark'}
                onValueChange={(isDark) => handleSettingChange('themePreference', isDark ? 'dark' : 'light')}
                disabled={isUpdating || isLoggingOut}
              />
            )}
          />
        </List.Section>

        <Divider />

        {/* Account Actions Section */}
        <List.Section title="Account">
          <List.Item
            title="Change Password"
            description="Update your account security settings"
            left={props => <List.Icon {...props} icon="lock-outline" />}
            onPress={() => showToast('Navigating to Change Password screen...')}
          />
          <List.Item
            title="Privacy Policy"
            description="Review our data handling practices"
            left={props => <List.Icon {...props} icon="shield-lock-outline" />}
            onPress={() => showToast('Opening Privacy Policy...')}
          />
        </List.Section>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            mode="contained"
            onPress={handleLogout}
            loading={isLoggingOut}
            disabled={isUpdating || isLoggingOut}
            icon="logout"
            style={styles.logoutButton}
            labelStyle={styles.logoutButtonLabel}
          >
            {isLoggingOut ? 'Logging Out...' : 'Logout'}
          </Button>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Toast Notification (Snackbar) */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background color is inherited from paperTheme.colors.background via useTheme()
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutContainer: {
    padding: 16,
    marginTop: 20,
  },
  logoutButton: {
    borderRadius: 8,
    paddingVertical: 4,
  },
  logoutButtonLabel: {
    fontSize: 16,
  },
  spacer: {
    height: 50, // Extra space at the bottom
  }
});

export default SettingsScreen;
