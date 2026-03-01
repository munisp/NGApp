import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, StyleSheet, Platform } from "react-native";

import DashboardScreen from "./screens/DashboardScreen";
import MarketsScreen from "./screens/MarketsScreen";
import TradeScreen from "./screens/TradeScreen";
import PortfolioScreen from "./screens/PortfolioScreen";
import AccountScreen from "./screens/AccountScreen";
import TradeDetailScreen from "./screens/TradeDetailScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import MarketMakersScreen from "./screens/MarketMakersScreen";
import IndicesScreen from "./screens/IndicesScreen";
import CorporateActionsScreen from "./screens/CorporateActionsScreen";
import BrokersScreen from "./screens/BrokersScreen";
import DigitalAssetsScreen from "./screens/DigitalAssetsScreen";
import Icon from "./components/Icon";
import type { IconName } from "./components/Icon";

import { colors, shadows } from "./styles/theme";
import { getLinkingConfig } from "./services/deeplink";
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

const TAB_ICONS: Record<string, IconName> = {
  Dashboard: "home",
  Markets: "activity",
  Trade: "candlestick",
  Portfolio: "briefcase",
  Account: "user",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICONS[name] || "circle-dot";
  return (
    <View style={styles.tabIconContainer}>
      {focused && <View style={styles.tabActiveIndicator} />}
      <Icon
        name={iconName}
        size={22}
        color={focused ? colors.brand.primary : colors.text.muted}
        strokeWidth={focused ? 2.2 : 1.8}
      />
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
        options={{ tabBarLabel: "Trade" }}
      />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} linking={getLinkingConfig()}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.bg.secondary,
            },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: "700", fontSize: 17 },
            headerShadowVisible: false,
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
          <Stack.Screen
            name="MarketMakers"
            component={MarketMakersScreen}
            options={{ title: "Market Makers" }}
          />
          <Stack.Screen
            name="Indices"
            component={IndicesScreen}
            options={{ title: "Indices" }}
          />
          <Stack.Screen
            name="CorporateActions"
            component={CorporateActionsScreen}
            options={{ title: "Corporate Actions" }}
          />
          <Stack.Screen
            name="Brokers"
            component={BrokersScreen}
            options={{ title: "Brokers" }}
          />
          <Stack.Screen
            name="DigitalAssets"
            component={DigitalAssetsScreen}
            options={{ title: "Digital Assets" }}
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
    height: Platform.OS === "ios" ? 88 : 72,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    paddingTop: 8,
    ...shadows.md,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 44,
    height: 28,
  },
  tabActiveIndicator: {
    position: "absolute",
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
  },
});
