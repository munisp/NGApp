/**
 * App Navigator — Insurance Platform Mobile
 * Handles: auth flow, bottom tabs, stack navigation, deep links
 */

import React, { Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAppSelector } from '../store/hooks';
import DashboardScreen from '../screens/DashboardScreen';

// ---- Lazy imports for code splitting ----
// All screens use default exports
const LoginScreen = React.lazy(() => import('../screens/auth/LoginScreen'));
const BiometricScreen = React.lazy(() => import('../screens/auth/BiometricScreen'));
const PoliciesScreen = React.lazy(() => import('../screens/policies/PoliciesScreen'));
const PolicyDetailScreen = React.lazy(() => import('../screens/policies/PolicyDetailScreen'));
const ClaimsScreen = React.lazy(() => import('../screens/claims/ClaimsScreen'));
const ClaimDetailScreen = React.lazy(() => import('../screens/claims/ClaimDetailScreen'));
const SubmitClaimScreen = React.lazy(() => import('../screens/claims/SubmitClaimScreen'));
const PaymentsScreen = React.lazy(() => import('../screens/payments/PaymentsScreen'));
const MakePaymentScreen = React.lazy(() => import('../screens/payments/MakePaymentScreen'));
const ProfileScreen = React.lazy(() => import('../screens/profile/ProfileScreen'));
const AnalyticsScreen = React.lazy(() => import('../screens/analytics/AnalyticsScreen'));
const NotificationsScreen = React.lazy(() => import('../screens/notifications/NotificationsScreen'));

// ---- Navigation types ----
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Biometric: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Policies: undefined;
  Claims: undefined;
  Payments: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  PolicyDetail: { policyId: string };
  ClaimDetail: { claimId: string };
  SubmitClaim: { policyId?: string };
  MakePayment: { policyId?: string };
  Analytics: undefined;
  Notifications: undefined;
  Activity: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const COLORS = {
  primary: '#1E40AF',
  inactive: '#94A3B8',
  background: '#FFFFFF',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '🏠',
    Policies: '📄',
    Claims: '📋',
    Payments: '💳',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '●'}
    </Text>
  );
}

// Suspense wrapper for lazy screens
function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<ActivityIndicator size="large" color="#1E40AF" style={{ flex: 1 }} />}>{children}</Suspense>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Policies" component={() => <S><PoliciesScreen /></S>} />
      <Tab.Screen name="Claims" component={() => <S><ClaimsScreen /></S>} />
      <Tab.Screen name="Payments" component={() => <S><PaymentsScreen /></S>} />
      <Tab.Screen name="Profile" component={() => <S><ProfileScreen /></S>} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={() => <S><LoginScreen /></S>} />
      <AuthStack.Screen name="Biometric" component={() => <S><BiometricScreen /></S>} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <MainStack.Screen
        name="Tabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <MainStack.Screen name="PolicyDetail" component={() => <S><PolicyDetailScreen /></S>} options={{ title: 'Policy Details' }} />
      <MainStack.Screen name="ClaimDetail" component={() => <S><ClaimDetailScreen /></S>} options={{ title: 'Claim Details' }} />
      <MainStack.Screen name="SubmitClaim" component={() => <S><SubmitClaimScreen /></S>} options={{ title: 'File a Claim' }} />
      <MainStack.Screen name="MakePayment" component={() => <S><MakePaymentScreen /></S>} options={{ title: 'Make Payment' }} />
      <MainStack.Screen name="Analytics" component={() => <S><AnalyticsScreen /></S>} options={{ title: 'My Analytics' }} />
      <MainStack.Screen name="Notifications" component={() => <S><NotificationsScreen /></S>} options={{ title: 'Notifications' }} />
    </MainStack.Navigator>
  );
}

const linking = {
  prefixes: ['insurance://', 'https://app.insurance-platform.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Tabs: {
            screens: {
              Dashboard: 'dashboard',
              Policies: 'policies',
              Claims: 'claims',
              Payments: 'payments',
              Profile: 'profile',
            },
          },
          PolicyDetail: 'policies/:policyId',
          ClaimDetail: 'claims/:claimId',
          SubmitClaim: 'claims/new',
          MakePayment: 'payments/new',
        },
      },
    },
  },
};

export function AppNavigator() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
