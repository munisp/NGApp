/**
 * NDSEP Mobile — Root Navigation
 * Feature parity with the web PWA sidebar navigation.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

// Screens
import DashboardScreen from "../screens/DashboardScreen";
import ComplianceScreen from "../screens/ComplianceScreen";
import EnforcementScreen from "../screens/EnforcementScreen";
import OrganizationsScreen from "../screens/OrganizationsScreen";
import SecurityAlertsScreen from "../screens/SecurityAlertsScreen";
import AssetRegistryScreen from "../screens/AssetRegistryScreen";
import CitizenRightsScreen from "../screens/CitizenRightsScreen";
import PortalScreen from "../screens/PortalScreen";
import AuditLogScreen from "../screens/AuditLogScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import LoginScreen from "../screens/LoginScreen";
import OrganizationDetailScreen from "../screens/OrganizationDetailScreen";
import PenaltyDetailScreen from "../screens/PenaltyDetailScreen";

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/** Bottom tab navigator for the 4 most-used sections */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0a0e1a", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#00d4ff",
        tabBarInactiveTintColor: "#64748b",
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Compliance" component={ComplianceScreen} />
      <Tab.Screen name="Enforcement" component={EnforcementScreen} />
      <Tab.Screen name="Alerts" component={SecurityAlertsScreen} />
    </Tab.Navigator>
  );
}

/** Full drawer navigator with all platform sections */
function DrawerNav() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerStyle: { backgroundColor: "#0a0e1a", width: 280 },
        drawerActiveTintColor: "#00d4ff",
        drawerInactiveTintColor: "#94a3b8",
        headerStyle: { backgroundColor: "#0a0e1a" },
        headerTintColor: "#f1f5f9",
      }}
    >
      <Drawer.Screen name="Home" component={MainTabs} options={{ title: "Dashboard" }} />
      <Drawer.Screen name="Organizations" component={OrganizationsScreen} />
      <Drawer.Screen name="AssetRegistry" component={AssetRegistryScreen} options={{ title: "Asset Registry" }} />
      <Drawer.Screen name="CitizenRights" component={CitizenRightsScreen} options={{ title: "Citizen Rights" }} />
      <Drawer.Screen name="Portal" component={PortalScreen} options={{ title: "Org Portal" }} />
      <Drawer.Screen name="AuditLog" component={AuditLogScreen} options={{ title: "Audit Log" }} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
    </Drawer.Navigator>
  );
}

/** Root stack — handles auth gate */
export default function AppNavigator({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={DrawerNav} />
            <Stack.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
            <Stack.Screen name="PenaltyDetail" component={PenaltyDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
