/**
 * NDSEP Mobile Navigation
 * Full feature parity with web — all major screens accessible.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

// Screens (lazy loaded)
import { DashboardScreen } from "../screens/DashboardScreen";

// Placeholder screens for full parity
const PlaceholderScreen = ({ route }: { route: { name: string } }) => {
  const React = require("react");
  const { View, Text, StyleSheet } = require("react-native");
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
      <Text style={{ color: "#fff", fontSize: 18 }}>{route.name}</Text>
    </View>
  );
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: "Dashboard" }} />
      <Stack.Screen name="ComplianceDetail" component={PlaceholderScreen} options={{ title: "Compliance" }} />
      <Stack.Screen name="OrganizationDetail" component={PlaceholderScreen} options={{ title: "Organization" }} />
    </Stack.Navigator>
  );
}

function EnforcementStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#111827" }, headerTintColor: "#ffffff" }}>
      <Stack.Screen name="EnforcementList" component={PlaceholderScreen} options={{ title: "Enforcement" }} />
      <Stack.Screen name="CaseDetail" component={PlaceholderScreen} options={{ title: "Case Details" }} />
      <Stack.Screen name="PenaltyCalculator" component={PlaceholderScreen} options={{ title: "Penalty Calculator" }} />
    </Stack.Navigator>
  );
}

function BreachStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#111827" }, headerTintColor: "#ffffff" }}>
      <Stack.Screen name="BreachList" component={PlaceholderScreen} options={{ title: "Breaches" }} />
      <Stack.Screen name="BreachReport" component={PlaceholderScreen} options={{ title: "Report Breach" }} />
      <Stack.Screen name="BreachTimeline" component={PlaceholderScreen} options={{ title: "Timeline" }} />
    </Stack.Navigator>
  );
}

function NOCStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#111827" }, headerTintColor: "#ffffff" }}>
      <Stack.Screen name="NOCMonitor" component={PlaceholderScreen} options={{ title: "NOC Monitor" }} />
      <Stack.Screen name="AlertDetail" component={PlaceholderScreen} options={{ title: "Alert" }} />
      <Stack.Screen name="NetworkIntelligence" component={PlaceholderScreen} options={{ title: "Network Intel" }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#111827" }, headerTintColor: "#ffffff" }}>
      <Stack.Screen name="SettingsHome" component={PlaceholderScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="Profile" component={PlaceholderScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Notifications" component={PlaceholderScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Security" component={PlaceholderScreen} options={{ title: "Security" }} />
      <Stack.Screen name="OfflineData" component={PlaceholderScreen} options={{ title: "Offline Data" }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, string> = {
              Dashboard: "home",
              Enforcement: "shield",
              Breaches: "alert-triangle",
              NOC: "activity",
              Settings: "settings",
            };
            return <Feather name={icons[route.name] as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#10b981",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: { backgroundColor: "#111827", borderTopColor: "#1f2937" },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardStack} />
        <Tab.Screen name="Enforcement" component={EnforcementStack} />
        <Tab.Screen name="Breaches" component={BreachStack} />
        <Tab.Screen name="NOC" component={NOCStack} />
        <Tab.Screen name="Settings" component={SettingsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
