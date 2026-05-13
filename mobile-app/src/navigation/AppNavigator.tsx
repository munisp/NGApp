import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';

// Import screens
import JourneyScreen from '../screens/JourneyScreen';
import JourneyAnalyticsScreen from '../screens/JourneyAnalyticsScreen';

// Placeholder screens for other tabs
function DashboardScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>NOC Dashboard</Text>
    </View>
  );
}

function TransactionsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Transactions</Text>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Settings</Text>
    </View>
  );
}

// Tab icons
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Dashboard: 'D',
    Journeys: 'J',
    Analytics: 'A',
    Transactions: 'T',
    Settings: 'S',
  };

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextFocused]}>
        {icons[name] || '?'}
      </Text>
    </View>
  );
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function JourneyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JourneyList" component={JourneyScreen} />
    </Stack.Navigator>
  );
}

function AnalyticsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsDashboard" component={JourneyAnalyticsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Journeys" component={JourneyStack} />
        <Tab.Screen name="Analytics" component={AnalyticsStack} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: 8,
    height: 70,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  tabIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconFocused: {
    backgroundColor: '#DBEAFE',
  },
  tabIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabIconTextFocused: {
    color: '#2563EB',
  },
});
