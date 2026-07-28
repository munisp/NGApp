import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../services/AuthContext';
import { ErrorBoundary } from '../components';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// Main Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import PoliciesScreen from '../screens/Policies/PoliciesScreen';
import PolicyDetailScreen from '../screens/Policies/PolicyDetailScreen';
import ClaimsScreen from '../screens/Claims/ClaimsScreen';
import ClaimDetailScreen from '../screens/Claims/ClaimDetailScreen';
import NewClaimScreen from '../screens/Claims/NewClaimScreen';
import PaymentsScreen from '../screens/Payments/PaymentsScreen';
import PaymentDetailScreen from '../screens/Payments/PaymentDetailScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ReferralsScreen from '../screens/Referrals/ReferralsScreen';
import ReviewsScreen from '../screens/Reviews/ReviewsScreen';

// New Feature Screens
import AIAdvisorScreen from '../screens/AIAdvisor/AIAdvisorScreen';
import MarketplaceScreen from '../screens/Marketplace/MarketplaceScreen';
import RewardsScreen from '../screens/Gamification/RewardsScreen';
import GeospatialMapScreen from '../screens/Map/GeospatialMapScreen';

// Knowledge Graph Screens
import { KnowledgeGraphScreen, AIAssistantScreen, FraudNetworkScreen } from '../screens/KnowledgeGraph';

// New Platform Improvement Screens
import VoiceAssistantScreen from '../screens/VoiceAssistant/VoiceAssistantScreen';
import ChurnPredictionScreen from '../screens/ChurnPrediction/ChurnPredictionScreen';
import LoyaltyProgramScreen from '../screens/LoyaltyProgram/LoyaltyProgramScreen';
import InsuranceLiteracyScreen from '../screens/InsuranceLiteracy/InsuranceLiteracyScreen';
import SmartClaimRoutingScreen from '../screens/SmartClaimRouting/SmartClaimRoutingScreen';
import MCMCRiskModelingScreen from '../screens/MCMCRiskModeling/MCMCRiskModelingScreen';

// New Customer Experience Screens
import PremiumCalculatorScreen from '../screens/PremiumCalculator/PremiumCalculatorScreen';
import InsuranceScoreScreen from '../screens/InsuranceScore/InsuranceScoreScreen';
import EmergencySOSScreen from '../screens/EmergencySOS/EmergencySOSScreen';
import DigitalWalletScreen from '../screens/DigitalWallet/DigitalWalletScreen';
import TelcoCreditScoringScreen from '../screens/TelcoCreditScoring/TelcoCreditScoringScreen';
import MicroinsuranceScreen from '../screens/Microinsurance/MicroinsuranceScreen';
import ModelSecurityScreen from '../screens/ModelSecurity/ModelSecurityScreen';

// New Feature Screens (14 categories)
import ClaimsEvidenceScreen from '../screens/ClaimsEvidence/ClaimsEvidenceScreen';
import PolicyRenewalScreen from '../screens/PolicyRenewal/PolicyRenewalScreen';
import FamilyCoverageScreen from '../screens/FamilyCoverage/FamilyCoverageScreen';
import ClaimsTrackerScreen from '../screens/ClaimsTracker/ClaimsTrackerScreen';
import HealthWellnessScreen from '../screens/HealthWellness/HealthWellnessScreen';
import EmbeddedInsuranceScreen from '../screens/EmbeddedInsurance/EmbeddedInsuranceScreen';
import SavingsInvestmentScreen from '../screens/SavingsInvestment/SavingsInvestmentScreen';
import P2PInsuranceScreen from '../screens/P2PInsurance/P2PInsuranceScreen';
import ParametricInsuranceScreen from '../screens/ParametricInsurance/ParametricInsuranceScreen';
import BancassuranceScreen from '../screens/Bancassurance/BancassuranceScreen';
import GigEconomyScreen from '../screens/GigEconomy/GigEconomyScreen';
import SMEBusinessScreen from '../screens/SMEBusiness/SMEBusinessScreen';
import LoyaltyRewardsScreen from '../screens/LoyaltyRewards/LoyaltyRewardsScreen';
import FinancialWellnessScreen from '../screens/FinancialWellness/FinancialWellnessScreen';
import ReinsuranceManagementScreen from '../screens/ReinsuranceManagement/ReinsuranceManagementScreen';

// Settings Screens
import NotificationSettingsScreen from '../screens/Settings/NotificationSettingsScreen';
import ChangePasswordScreen from '../screens/Settings/ChangePasswordScreen';
import BiometricSettingsScreen from '../screens/Settings/BiometricSettingsScreen';
import LanguageSettingsScreen from '../screens/Settings/LanguageSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Policies"
        component={PoliciesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="shield-check" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Claims"
        component={ClaimsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="file-document" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="credit-card" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Show splash screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="PolicyDetail" component={PolicyDetailScreen} />
          <Stack.Screen name="ClaimDetail" component={ClaimDetailScreen} />
          <Stack.Screen name="NewClaim" component={NewClaimScreen} />
          <Stack.Screen name="PaymentDetail" component={PaymentDetailScreen} />
          <Stack.Screen name="Referrals" component={ReferralsScreen} />
          <Stack.Screen name="Reviews" component={ReviewsScreen} />
          {/* New Feature Screens */}
          <Stack.Screen name="AIAdvisor" component={AIAdvisorScreen} />
          <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
          <Stack.Screen name="Rewards" component={RewardsScreen} />
          <Stack.Screen name="Map" component={GeospatialMapScreen} />
                    {/* Knowledge Graph Screens */}
                    <Stack.Screen name="KnowledgeGraph" component={KnowledgeGraphScreen} />
                    <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
                    <Stack.Screen name="FraudNetwork" component={FraudNetworkScreen} />
                    {/* Platform Improvement Screens */}
                    <Stack.Screen name="VoiceAssistant" component={VoiceAssistantScreen} />
                    <Stack.Screen name="ChurnPrediction" component={ChurnPredictionScreen} />
                    <Stack.Screen name="LoyaltyProgram" component={LoyaltyProgramScreen} />
                    <Stack.Screen name="InsuranceLiteracy" component={InsuranceLiteracyScreen} />
                                                                                <Stack.Screen name="SmartClaimRouting" component={SmartClaimRoutingScreen} />
                                                                                <Stack.Screen name="MCMCRiskModeling" component={MCMCRiskModelingScreen} />
                                                  {/* Customer Experience Screens */}
                                                  <Stack.Screen name="PremiumCalculator" component={PremiumCalculatorScreen} />
                                                  <Stack.Screen name="InsuranceScore" component={InsuranceScoreScreen} />
                                                  <Stack.Screen name="EmergencySOS" component={EmergencySOSScreen} />
                                                                                                    <Stack.Screen name="DigitalWallet" component={DigitalWalletScreen} />
                                                                                                                                                                                                        <Stack.Screen name="TelcoCreditScoring" component={TelcoCreditScoringScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                <Stack.Screen name="Microinsurance" component={MicroinsuranceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <Stack.Screen name="ModelSecurity" component={ModelSecurityScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          {/* New Feature Screens (14 categories) */}
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="ClaimsEvidence" component={ClaimsEvidenceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="PolicyRenewal" component={PolicyRenewalScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="FamilyCoverage" component={FamilyCoverageScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="ClaimsTracker" component={ClaimsTrackerScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="HealthWellness" component={HealthWellnessScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="EmbeddedInsurance" component={EmbeddedInsuranceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="SavingsInvestment" component={SavingsInvestmentScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="P2PInsurance" component={P2PInsuranceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="ParametricInsurance" component={ParametricInsuranceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="Bancassurance" component={BancassuranceScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="GigEconomy" component={GigEconomyScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="SMEBusiness" component={SMEBusinessScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                          <Stack.Screen name="LoyaltyRewards" component={LoyaltyRewardsScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <Stack.Screen name="FinancialWellness" component={FinancialWellnessScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <Stack.Screen name="ReinsuranceManagement" component={ReinsuranceManagementScreen} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    {/* Settings Screens */}
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="BiometricSettings" component={BiometricSettingsScreen} />
          <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// Deep linking configuration
export const linking = {
  prefixes: ['insureportal://', 'https://insureportal.ng'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Policies: 'policies',
          Claims: 'claims',
          Payments: 'payments',
          Profile: 'profile',
        },
      },
      PolicyDetail: 'policy/:id',
      ClaimDetail: 'claim/:id',
      NewClaim: 'claims/new',
      PaymentDetail: 'payment/:id',
      Referrals: 'referrals',
      Reviews: 'reviews',
      AIAdvisor: 'ai-advisor',
      Marketplace: 'marketplace',
      Rewards: 'rewards',
      Map: 'map',
            KnowledgeGraph: 'knowledge-graph',
            AIAssistant: 'ai-assistant',
            FraudNetwork: 'fraud-network',
            VoiceAssistant: 'voice-assistant',
            ChurnPrediction: 'churn-prediction',
            LoyaltyProgram: 'loyalty-program',
            InsuranceLiteracy: 'insurance-literacy',
                        SmartClaimRouting: 'smart-claim-routing',
                        MCMCRiskModeling: 'mcmc-risk',
                        NotificationSettings: 'settings/notifications',
      ChangePassword: 'settings/password',
      BiometricSettings: 'settings/biometric',
      LanguageSettings: 'settings/language',
    },
  },
};
