/**
 * AppNavigator — Root navigation for OG-RMM React Native app.
 *
 * Structure:
 *   AuthStack        — Login, ServerConfig
 *   MainTabs         — Dashboard, Wells, Alarms, Workovers, More
 *     MoreDrawer     — All remaining features accessible from "More" tab
 *
 * All screens that require authentication check useAuth() and redirect
 * to AuthStack if the session is invalid.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// Auth screens
import LoginScreen from "../screens/auth/LoginScreen";
import ServerConfigScreen from "../screens/auth/ServerConfigScreen";

// Main tab screens
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import WellsScreen from "../screens/wells/WellsScreen";
import WellDetailScreen from "../screens/wells/WellDetailScreen";
import AlarmsScreen from "../screens/alarms/AlarmsScreen";
import WorkoversScreen from "../screens/workovers/WorkoversScreen";

// More drawer screens
import FinancialsScreen from "../screens/financials/FinancialsScreen";
import ProductionScreen from "../screens/production/ProductionScreen";
import PermitsScreen from "../screens/permits/PermitsScreen";
import CalibrationScreen from "../screens/calibration/CalibrationScreen";
import HSEScreen from "../screens/hse/HSEScreen";
import ShiftHandoverScreen from "../screens/shifts/ShiftHandoverScreen";
import DamageAssessmentScreen from "../screens/damage/DamageAssessmentScreen";
import DamageAssessmentNewScreen from "../screens/damage/DamageAssessmentNewScreen";
import MaterialsScreen from "../screens/materials/MaterialsScreen";
import DigitalTwinScreen from "../screens/digitaltwin/DigitalTwinScreen";
import AIAssistantScreen from "../screens/ai/AIAssistantScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";

import { useAuth } from "../hooks/useAuth";
import { COLORS } from "../utils/theme";

export type AuthStackParamList = {
  Login: undefined;
  ServerConfig: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Wells: undefined;
  WellDetail: { wellId: string };
  Alarms: undefined;
  Workovers: undefined;
  More: undefined;
};

export type MoreDrawerParamList = {
  Financials: undefined;
  Production: undefined;
  Permits: undefined;
  Calibration: undefined;
  HSE: undefined;
  ShiftHandover: undefined;
  DamageAssessment: undefined;
  DamageAssessmentNew: undefined;
  Materials: undefined;
  DigitalTwin: undefined;
  AIAssistant: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator<MoreDrawerParamList>();

function MoreDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        drawerStyle: { backgroundColor: COLORS.surface },
        drawerActiveTintColor: COLORS.primary,
        drawerInactiveTintColor: COLORS.textSecondary,
      }}
    >
      <Drawer.Screen name="Financials" component={FinancialsScreen} options={{ drawerIcon: ({ color }) => <Icon name="currency-usd" size={20} color={color} /> }} />
      <Drawer.Screen name="Production" component={ProductionScreen} options={{ drawerIcon: ({ color }) => <Icon name="oil" size={20} color={color} /> }} />
      <Drawer.Screen name="Permits" component={PermitsScreen} options={{ drawerIcon: ({ color }) => <Icon name="file-document-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="Calibration" component={CalibrationScreen} options={{ drawerIcon: ({ color }) => <Icon name="tune" size={20} color={color} /> }} />
      <Drawer.Screen name="HSE" component={HSEScreen} options={{ drawerIcon: ({ color }) => <Icon name="shield-check-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="ShiftHandover" component={ShiftHandoverScreen} options={{ title: "Shift Handover", drawerIcon: ({ color }) => <Icon name="account-switch-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="DamageAssessment" component={DamageAssessmentScreen} options={{ title: "Damage Assessment", drawerIcon: ({ color }) => <Icon name="alert-circle-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="DamageAssessmentNew" component={DamageAssessmentNewScreen} options={{ title: "New Assessment", drawerIcon: ({ color }) => <Icon name="plus-circle-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="Materials" component={MaterialsScreen} options={{ drawerIcon: ({ color }) => <Icon name="package-variant-closed" size={20} color={color} /> }} />
      <Drawer.Screen name="DigitalTwin" component={DigitalTwinScreen} options={{ title: "Digital Twin", drawerIcon: ({ color }) => <Icon name="cube-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="AIAssistant" component={AIAssistantScreen} options={{ title: "AI Copilot", drawerIcon: ({ color }) => <Icon name="robot-outline" size={20} color={color} /> }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerIcon: ({ color }) => <Icon name="cog-outline" size={20} color={color} /> }} />
    </Drawer.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="view-dashboard-outline" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Wells"
        component={WellsScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="oil-lamp" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Alarms"
        component={AlarmsScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="bell-outline" size={22} color={color} />, tabBarBadge: undefined }}
      />
      <Tab.Screen
        name="Workovers"
        component={WorkoversScreen}
        options={{ tabBarIcon: ({ color }) => <Icon name="wrench-outline" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="More"
        component={MoreDrawer}
        options={{ tabBarIcon: ({ color }) => <Icon name="dots-horizontal" size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // Splash screen handles this

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="ServerConfig" component={ServerConfigScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
