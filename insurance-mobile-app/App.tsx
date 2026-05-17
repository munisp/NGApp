/**
 * InsurePortal Mobile App
 * React Native application for iOS and Android
 */

import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/services/AuthContext';
import { theme } from './src/utils/theme';

const queryClient = new QueryClient();

function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <NavigationContainer>
              <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;
