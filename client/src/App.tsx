import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import ReminderEmailManagement from "./pages/admin/ReminderEmailManagement";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import OfflineIndicator from "./components/OfflineIndicator";
import PWAUpdateNotification from "./components/PWAUpdateNotification";
import OnboardingHome from "./pages/OnboardingHome";
import PaymentGateway from "./pages/PaymentGateway";
import Checkout from "./pages/Checkout";
import Dashboard from "./pages/Dashboard";
import DeveloperPortal from "./pages/DeveloperPortal";
import BrandingSettings from "./pages/BrandingSettings";
import BrandingPreview from "./pages/BrandingPreview";
import TechnicalOnboardingReview from "@/pages/admin/TechnicalOnboardingReview";
import NotificationPreferences from "@/pages/admin/NotificationPreferences";
import IntegrationDevelopment from "@/pages/onboarding/IntegrationDevelopment";
import SharedComparisonView from "@/pages/onboarding/SharedComparisonView";
import RemittanceDemo from "@/pages/RemittanceDemo";
import RemittanceAdminDashboard from "@/pages/RemittanceAdminDashboard";
import RateAlerts from "./pages/RateAlerts";
import TwoFactorSettings from "./pages/TwoFactorSettings";
import VerifyTwoFactor from "./pages/VerifyTwoFactor";
import AccountRecovery from "./pages/AccountRecovery";
import RateAlertAnalytics from "@/pages/RateAlertAnalytics";
import RecoveryRequests from "@/pages/admin/RecoveryRequests";
import TrustedDevices from "@/pages/TrustedDevices";
import NotificationSettings from "@/pages/NotificationSettings";
import AccountActivity from "@/pages/AccountActivity";
import IntegrationsDashboard from "@/pages/IntegrationsDashboard";
import OutboundRemittance from "@/pages/OutboundRemittance";
import OutboundApply from "@/pages/OutboundApply";
import InboundRemittance from "@/pages/InboundRemittance";
import DomesticPayments from "@/pages/DomesticPayments";
import TradePayments from "@/pages/TradePayments";
import CardProcessing from "@/pages/CardProcessing";
import GovernmentPayments from "@/pages/GovernmentPayments";
import OpenBanking from "@/pages/OpenBanking";
import MiddlewareMonitoring from "@/pages/MiddlewareMonitoring";
import SecurityDashboard from "@/pages/SecurityDashboard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={OnboardingHome} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/reminders" component={ReminderEmailManagement} />
      <Route path="/admin/recovery-requests" component={RecoveryRequests} />
      <Route path="/admin/integrations" component={IntegrationsDashboard} />
      <Route path={"/payments"} component={PaymentGateway} />
      <Route path={"/checkout/:sessionId"} component={Checkout} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/branding"} component={BrandingSettings} />
      <Route path={"/preview/:previewId"} component={BrandingPreview} />
      <Route path={"/docs"} component={DeveloperPortal} />
      <Route path="/admin/technical-onboarding" component={TechnicalOnboardingReview} />
      <Route path="/admin/notification-preferences" component={NotificationPreferences} />
      <Route path="/onboarding/integration" component={IntegrationDevelopment} />
      <Route path="/shared-comparison/:shareToken" component={SharedComparisonView} />
      <Route path="/remittance-demo" component={RemittanceDemo} />
      <Route path="/admin/remittances" component={RemittanceAdminDashboard} />
      <Route path="/rate-alerts" component={RateAlerts} />
      <Route path="/rate-alert-analytics" component={RateAlertAnalytics} />
      <Route path="/settings/2fa" component={TwoFactorSettings} />
      <Route path="/settings/trusted-devices" component={TrustedDevices} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/settings/activity" component={AccountActivity} />
      <Route path="/verify-2fa" component={VerifyTwoFactor} />
      <Route path="/account-recovery" component={AccountRecovery} />
      <Route path="/outbound-remittance" component={OutboundRemittance} />
      <Route path="/outbound/apply" component={OutboundApply} />
      <Route path="/inbound-remittance" component={InboundRemittance} />
      <Route path="/domestic-payments" component={DomesticPayments} />
      <Route path="/trade-payments" component={TradePayments} />
      <Route path="/card-processing" component={CardProcessing} />
      <Route path="/government-payments" component={GovernmentPayments} />
      <Route path="/open-banking" component={OpenBanking} />
      <Route path="/middleware" component={MiddlewareMonitoring} />
      <Route path="/security" component={SecurityDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <OfflineIndicator />
          {/* PWA Update Notification disabled for testing */}
          {/* <PWAUpdateNotification /> */}
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
