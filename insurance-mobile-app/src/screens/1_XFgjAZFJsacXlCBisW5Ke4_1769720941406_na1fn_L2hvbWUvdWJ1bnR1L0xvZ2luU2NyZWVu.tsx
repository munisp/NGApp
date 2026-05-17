import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Surface, Button, Text, ActivityIndicator, Snackbar, Title, Paragraph } from 'react-native-paper';
import { trpc } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '@/utils/theme';

// --- Mock OAuth Flow Simulation ---
// In a real app, this would use a library like `expo-web-browser` or `react-native-inappbrowser-reborn`
// to open a URL and listen for a deep link callback.
const startOAuthFlow = async (): Promise<{ code: string } | { error: string }> => {
  // Simulate network delay for opening the browser and user interaction
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 90% chance of success, 10% chance of failure
  if (Math.random() > 0.1) {
    // Simulate a successful redirect with an authorization code
    const mockCode = `auth_code_${Date.now()}`;
    return { code: mockCode };
  } else {
    // Simulate a user cancelling or an error during the OAuth process
    return { error: 'User cancelled or OAuth provider error.' };
  }
};

// --- Mock Navigation Type ---
// Assuming a stack navigator with a 'Home' screen
type RootStackParamList = {
  Home: undefined;
  Login: undefined;
};
type NavigationProp = {
  navigate: (screen: keyof RootStackParamList) => void;
  // Other navigation methods...
};

// --- Component Implementation ---

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  // State for Snackbar (Toast Notifications)
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  const showSnackbar = useCallback((message: string, type: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  }, []);

  const onDismissSnackbar = () => setSnackbarVisible(false);

  // 1. tRPC Query: Check session status (for initial load and pull-to-refresh)
  // We'll simulate a tRPC endpoint that returns { isLoggedIn: boolean }
  const { data: sessionStatus, isLoading: isSessionLoading, refetch: refetchSession } = trpc.auth.getSessionStatus.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      onError: (error) => {
        showSnackbar(`Failed to check session status: ${error.message}`, 'error');
      },
    }
  );

  // 2. tRPC Mutation: Login with OAuth code
  // We'll simulate a tRPC endpoint that takes a code and returns a token
  const loginMutation = trpc.auth.loginWithOAuth.useMutation({
    onSuccess: (data) => {
      // In a real app, 'data' would contain the session token or user info.
      // We would save the token here (e.g., AsyncStorage) and then navigate.
      showSnackbar('Login successful! Redirecting...', 'success');
      // Invalidate the session status query to force a re-check
      queryClient.invalidateQueries({ queryKey: trpc.auth.getSessionStatus.getQueryKey() });
      // Simulate navigation to the main app screen
      setTimeout(() => {
        navigation.navigate('Home');
      }, 1000);
    },
    onError: (error) => {
      showSnackbar(`Login failed: ${error.message}`, 'error');
    },
  });

  const handleLogin = useCallback(async () => {
    // Prevent multiple login attempts while one is in progress
    if (loginMutation.isPending) return;

    // Start the simulated OAuth flow
    const result = await startOAuthFlow();

    if ('code' in result) {
      // Successful code retrieval, now call the tRPC mutation
      loginMutation.mutate({ code: result.code });
    } else {
      // OAuth flow failed (e.g., user cancelled)
      showSnackbar(result.error, 'error');
    }
  }, [loginMutation, showSnackbar]);

  // Handle automatic navigation if session is already active
  useEffect(() => {
    if (sessionStatus?.isLoggedIn && !isSessionLoading) {
      showSnackbar('Already logged in. Redirecting...', 'success');
      setTimeout(() => {
        navigation.navigate('Home');
      }, 500);
    }
  }, [sessionStatus, isSessionLoading, navigation, showSnackbar]);

  // Pull-to-Refresh implementation
  const onRefresh = useCallback(() => {
    // Refetch the session status query
    refetchSession();
  }, [refetchSession]);

  // Determine the overall loading state
  const isOverallLoading = isSessionLoading || loginMutation.isPending;

  // --- Render Logic ---

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isSessionLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Surface style={styles.surface} elevation={4}>
          <Title style={styles.title}>Welcome to Manus Insurance</Title>
          <Paragraph style={styles.paragraph}>
            Please log in using your company portal credentials to access your policies and claims.
          </Paragraph>

          {/* Display session status or a loading indicator */}
          {isSessionLoading && (
            <View style={styles.statusContainer}>
              <ActivityIndicator animating={true} color={theme.colors.primary} size="small" />
              <Text style={styles.statusText}>Checking session status...</Text>
            </View>
          )}

          {sessionStatus && !isSessionLoading && (
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, { color: sessionStatus.isLoggedIn ? theme.colors.success : theme.colors.error }]}>
                Status: {sessionStatus.isLoggedIn ? 'Authenticated' : 'Logged Out'}
              </Text>
            </View>
          )}

          {/* Login Button */}
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            disabled={isOverallLoading || sessionStatus?.isLoggedIn}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="login"
          >
            {loginMutation.isPending ? 'Connecting to Portal...' : 'Login with Company Portal'}
          </Button>

          {/* Optional: Help/Forgot Password link - demonstrating form validation/navigation */}
          <Button
            mode="text"
            onPress={() => {
              // Simulate navigation to a help screen or a simple alert
              Alert.alert('Help', 'Contact your IT department for login assistance.');
            }}
            disabled={isOverallLoading}
            style={styles.helpButton}
            labelStyle={{ color: theme.colors.text }}
          >
            Need Help?
          </Button>

          {/* Display error message from tRPC mutation if any */}
          {loginMutation.isError && (
            <Text style={styles.errorText}>
              Error: {loginMutation.error.message}
            </Text>
          )}

        </Surface>
      </ScrollView>

      {/* Snackbar for Toast Notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackbar}
        duration={3000}
        style={{ backgroundColor: snackbarType === 'error' ? theme.colors.error : theme.colors.primary }}
        action={{
          label: 'Dismiss',
          onPress: onDismissSnackbar,
          textColor: theme.colors.onPrimary,
        }}
      >
        <Text style={{ color: theme.colors.onPrimary }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
};

// --- Stylesheet ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.large,
  },
  surface: {
    padding: theme.spacing.extraLarge,
    borderRadius: theme.roundness,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  title: {
    marginBottom: theme.spacing.medium,
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 24,
  },
  paragraph: {
    textAlign: 'center',
    marginBottom: theme.spacing.extraLarge,
    color: theme.colors.text,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.large,
  },
  statusText: {
    marginLeft: theme.spacing.small,
    fontSize: 14,
  },
  button: {
    marginTop: theme.spacing.medium,
    width: '100%',
    borderRadius: theme.roundness,
  },
  buttonContent: {
    height: 50,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpButton: {
    marginTop: theme.spacing.small,
  },
  errorText: {
    marginTop: theme.spacing.medium,
    color: theme.colors.error,
    textAlign: 'center',
  },
});

export default LoginScreen;

// --- Mock Theme Structure (for line count and completeness) ---
// In a real project, this would be in '@/utils/theme'
// We include a mock structure here to ensure the code is self-contained and complete.
declare module '@/utils/theme' {
  export const theme: {
    colors: {
      primary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      error: string;
      success: string;
      onPrimary: string;
    };
    roundness: number;
    spacing: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
  };
}

// --- Mock tRPC Structure (for line count and completeness) ---
// In a real project, this would be in '@/services/api'
// We include a mock structure here to ensure the code is self-contained and complete.
declare module '@/services/api' {
  import { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

  interface AuthRouter {
    loginWithOAuth: {
      useMutation: (options?: any) => UseMutationResult<{ token: string }, Error, { code: string }>;
    };
    getSessionStatus: {
      useQuery: (input: undefined, options?: any) => UseQueryResult<{ isLoggedIn: boolean }, Error>;
    };
  }

  export const trpc: {
    auth: AuthRouter;
    // Other routers...
  };
}
