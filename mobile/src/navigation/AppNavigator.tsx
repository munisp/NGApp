/**
 * NDSEP Mobile Navigation
 * Full feature parity with web — all major screens accessible.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

// Screens
import { DashboardScreen } from "../screens/DashboardScreen";
import { ComplianceDetailScreen } from "../screens/ComplianceDetailScreen";
import { OrganizationDetailScreen } from "../screens/OrganizationDetailScreen";
import { EnforcementListScreen } from "../screens/EnforcementListScreen";
import { CaseDetailScreen } from "../screens/CaseDetailScreen";
import { PenaltyCalculatorScreen } from "../screens/PenaltyCalculatorScreen";
import { BreachListScreen } from "../screens/BreachListScreen";
import { BreachReportScreen } from "../screens/BreachReportScreen";
import { BreachTimelineScreen } from "../screens/BreachTimelineScreen";
import { NOCMonitorScreen } from "../screens/NOCMonitorScreen";
import { AlertDetailScreen } from "../screens/AlertDetailScreen";
import { NetworkIntelligenceScreen } from "../screens/NetworkIntelligenceScreen";
import { SettingsHomeScreen } from "../screens/SettingsHomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SecurityScreen } from "../screens/SecurityScreen";
import { OfflineDataScreen } from "../screens/OfflineDataScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackOpts = {
  headerStyle: { backgroundColor: "#111827" },
  headerTintColor: "#ffffff",
  headerTitleStyle: { fontWeight: "600" as const },
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: "Dashboard" }} />
      <Stack.Screen name="ComplianceDetail" component={ComplianceDetailScreen} options={{ title: "Compliance" }} />
      <Stack.Screen name="OrganizationDetail" component={OrganizationDetailScreen} options={{ title: "Organization" }} />
    </Stack.Navigator>
  );
}

function EnforcementStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="EnforcementList" component={EnforcementListScreen} options={{ title: "Enforcement" }} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: "Case Details" }} />
      <Stack.Screen name="PenaltyCalculator" component={PenaltyCalculatorScreen} options={{ title: "Penalty Calculator" }} />
    </Stack.Navigator>
  );
}

function BreachStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="BreachList" component={BreachListScreen} options={{ title: "Breaches" }} />
      <Stack.Screen name="BreachReport" component={BreachReportScreen} options={{ title: "Report Breach" }} />
      <Stack.Screen name="BreachTimeline" component={BreachTimelineScreen} options={{ title: "Timeline" }} />
    </Stack.Navigator>
  );
}

function NOCStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="NOCMonitor" component={NOCMonitorScreen} options={{ title: "NOC Monitor" }} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: "Alert" }} />
      <Stack.Screen name="NetworkIntelligence" component={NetworkIntelligenceScreen} options={{ title: "Network Intel" }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: "Security" }} />
      <Stack.Screen name="OfflineData" component={OfflineDataScreen} options={{ title: "Offline Data" }} />
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
