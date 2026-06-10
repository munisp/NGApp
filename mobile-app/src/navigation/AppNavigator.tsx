import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, Platform } from 'react-native';

import DashboardScreen from '../screens/DashboardScreen';
import JourneyScreen from '../screens/JourneyScreen';
import JourneyAnalyticsScreen from '../screens/JourneyAnalyticsScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import SettingsScreen from '../screens/SettingsScreen';

/**
 * SVG-style tab icon using pure RN Views.
 * Avoids needing @expo/vector-icons or any native icon library.
 */
function DashboardIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#2563EB' : '#6B7280';
  return (
    <View style={[iconStyles.grid, { borderColor: color }]}>
      <View style={[iconStyles.gridCell, { backgroundColor: color }]} />
      <View style={[iconStyles.gridCell, { backgroundColor: color }]} />
      <View style={[iconStyles.gridCell, { backgroundColor: color }]} />
      <View style={[iconStyles.gridCell, { backgroundColor: color }]} />
    </View>
  );
}

function JourneysIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#2563EB' : '#6B7280';
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.lineH, { backgroundColor: color, top: 6 }]} />
      <View style={[iconStyles.dot, { backgroundColor: color, left: 2, top: 4 }]} />
      <View style={[iconStyles.lineH, { backgroundColor: color, top: 14 }]} />
      <View style={[iconStyles.dot, { backgroundColor: color, left: 14, top: 12 }]} />
      <View style={[iconStyles.lineH, { backgroundColor: color, top: 22 }]} />
      <View style={[iconStyles.dot, { backgroundColor: color, left: 8, top: 20 }]} />
    </View>
  );
}

function AnalyticsIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#2563EB' : '#6B7280';
  return (
    <View style={[iconStyles.container, { flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingHorizontal: 4 }]}>
      <View style={{ width: 4, height: 10, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 18, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 14, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 24, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

function TransactionsIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#2563EB' : '#6B7280';
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.arrowUp, { borderBottomColor: color }]} />
      <View style={[iconStyles.arrowDown, { borderTopColor: color }]} />
    </View>
  );
}

function SettingsIcon({ focused }: { focused: boolean }) {
  const color = focused ? '#2563EB' : '#6B7280';
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.gear, { borderColor: color }]} />
      <View style={[iconStyles.gearCenter, { backgroundColor: color }]} />
    </View>
  );
}

const TAB_ICONS: Record<string, React.FC<{ focused: boolean }>> = {
  Dashboard: DashboardIcon,
  Journeys: JourneysIcon,
  Analytics: AnalyticsIcon,
  Transactions: TransactionsIcon,
  Settings: SettingsIcon,
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function JourneyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JourneyList" component={JourneyScreen} />
      <Stack.Screen name="JourneyAnalytics" component={JourneyAnalyticsScreen} />
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
          tabBarIcon: ({ focused }) => {
            const IconComponent = TAB_ICONS[route.name];
            if (IconComponent) return <IconComponent focused={focused} />;
            return null;
          },
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

const iconStyles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  grid: {
    width: 26,
    height: 26,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 2,
  },
  gridCell: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  lineH: {
    position: 'absolute',
    height: 2,
    width: 24,
    borderRadius: 1,
    left: 2,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  arrowUp: {
    position: 'absolute',
    top: 2,
    left: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  gear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    position: 'absolute',
    top: 3,
    left: 3,
  },
  gearCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 10,
    left: 10,
  },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    height: Platform.OS === 'ios' ? 84 : 70,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
