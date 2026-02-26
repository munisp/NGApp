import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet } from "react-native";

import DashboardScreen from "./screens/DashboardScreen";
import MarketsScreen from "./screens/MarketsScreen";
import TradeScreen from "./screens/TradeScreen";
import PortfolioScreen from "./screens/PortfolioScreen";
import AccountScreen from "./screens/AccountScreen";
import TradeDetailScreen from "./screens/TradeDetailScreen";
import NotificationsScreen from "./screens/NotificationsScreen";

import { colors } from "./styles/theme";
import type { RootStackParamList, MainTabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg.primary,
    card: colors.bg.secondary,
    text: colors.text.primary,
    border: colors.border,
    primary: colors.brand.primary,
  },
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, string> = {
    Dashboard: "◻",
    Markets: "◈",
    Trade: "⇅",
    Portfolio: "◰",
    Account: "◉",
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconActive]}>
        {iconMap[name] || "○"}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen
        name="Trade"
        component={TradeScreen}
        options={{
          tabBarLabel: "Trade",
          tabBarStyle: { ...styles.tabBar },
        }}
      />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg.secondary },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TradeDetail"
            component={TradeDetailScreen}
            options={{ title: "Trade" }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: "Notifications" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.secondary,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  tabIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconText: {
    fontSize: 20,
    color: colors.text.muted,
  },
  tabIconActive: {
    color: colors.brand.primary,
  },
});
