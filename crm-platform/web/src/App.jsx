import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

// Core components (not lazy — needed immediately)
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Login from './components/Login'
import NotificationCenter from './components/NotificationCenter'

// UI infrastructure
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { ToastProvider } from './components/ui/Toast'

// Providers
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { TenantProvider } from './contexts/TenantContext'
import { I18nProvider, useTranslation } from './lib/i18n/useTranslation.jsx'
import { queryClient } from './lib/queryClient'

// Lazy-loaded page components — code-split by section
// Core CRM
const Dashboard = lazy(() => import('./components/Dashboard'))
const CustomerManagement = lazy(() => import('./components/CustomerManagement'))
const CRMCore = lazy(() => import('./components/CRMCore'))
const InventoryManagement = lazy(() => import('./components/InventoryManagement'))
const Analytics = lazy(() => import('./components/Analytics'))
const Settings = lazy(() => import('./components/Settings'))
const UnifiedDashboard = lazy(() => import('./components/UnifiedDashboard'))
const Customer360 = lazy(() => import('./components/Customer360'))

// Banking
const CoreBankingView = lazy(() => import('./components/CoreBankingView'))
const AgentBankingView = lazy(() => import('./components/AgentBankingView'))
const RemittanceView = lazy(() => import('./components/RemittanceView'))
const IntegrationHub = lazy(() => import('./components/IntegrationHub'))
const CrossSystemAnalytics = lazy(() => import('./components/CrossSystemAnalytics'))

// Telco vertical
const TelcoSubscriberManagement = lazy(() => import('./components/TelcoSubscriberManagement'))
const TelcoFieldOps = lazy(() => import('./components/TelcoFieldOps'))
const TelcoInterconnect = lazy(() => import('./components/TelcoInterconnect'))

// Commodity vertical
const CommodityTradingDesk = lazy(() => import('./components/CommodityTradingDesk'))
const CommodityBrokerPortal = lazy(() => import('./components/CommodityBrokerPortal'))
const CommoditySettlement = lazy(() => import('./components/CommoditySettlement'))

// CPaaS vertical
const CPaaSChannelDashboard = lazy(() => import('./components/CPaaSChannelDashboard'))
const CPaaSDeveloperOnboarding = lazy(() => import('./components/CPaaSDeveloperOnboarding'))

// Campaign & Engagement
const CampaignManager = lazy(() => import('./components/CampaignManager'))
const RealTimeDashboard = lazy(() => import('./components/RealTimeDashboard'))
const JourneyOrchestrator = lazy(() => import('./components/JourneyOrchestrator'))
const ChurnPrevention = lazy(() => import('./components/ChurnPrevention'))
const ConversationalFlows = lazy(() => import('./components/ConversationalFlows'))
const GeoTargeting = lazy(() => import('./components/GeoTargeting'))
const ABTestAutomation = lazy(() => import('./components/ABTestAutomation'))
const ConsentCompliance = lazy(() => import('./components/ConsentCompliance'))
const NotificationPreferences = lazy(() => import('./components/NotificationPreferences'))
const RevenueAttribution = lazy(() => import('./components/RevenueAttribution'))
const AgentGamification = lazy(() => import('./components/AgentGamification'))
const TenantAdmin = lazy(() => import('./components/TenantAdmin'))

// Developer Portal
const APIKeyManager = lazy(() => import('./components/APIKeyManager'))
const UsageMetering = lazy(() => import('./components/UsageMetering'))
const SDKDocs = lazy(() => import('./components/SDKDocs'))
const WebhookManager = lazy(() => import('./components/WebhookManager'))
const SandboxManager = lazy(() => import('./components/SandboxManager'))

// Intelligence & AI
const ChannelValueAnalysis = lazy(() => import('./components/ChannelValueAnalysis'))
const AcquisitionEngine = lazy(() => import('./components/AcquisitionEngine'))
const SocialMediaHub = lazy(() => import('./components/SocialMediaHub'))
const MDMCustomer360 = lazy(() => import('./components/MDMCustomer360'))
const AgenticAI = lazy(() => import('./components/AgenticAI'))

// AI/ML Stack
const GNNNeo4j = lazy(() => import('./components/GNNNeo4j'))
const FalkorDBGraph = lazy(() => import('./components/FalkorDBGraph'))
const MCMCRisk = lazy(() => import('./components/MCMCRisk'))
const CocoIndexPipeline = lazy(() => import('./components/CocoIndexPipeline'))
const EPRKGQAChat = lazy(() => import('./components/EPRKGQAChat'))
const ARTSecurity = lazy(() => import('./components/ARTSecurity'))
const OllamaInference = lazy(() => import('./components/OllamaInference'))

// Next-Gen CRM — Tier 1: AI-Native
const CustomerHealthScore = lazy(() => import('./components/CustomerHealthScore'))
const OmnichannelInbox = lazy(() => import('./components/OmnichannelInbox'))
const ConversationIntelligence = lazy(() => import('./components/ConversationIntelligence'))
const DealScoring = lazy(() => import('./components/DealScoring'))
const SmartComposer = lazy(() => import('./components/SmartComposer'))

// Next-Gen CRM — Tier 2: Relationship Intelligence
const RelationshipMapping = lazy(() => import('./components/RelationshipMapping'))
const CustomerTimeline = lazy(() => import('./components/CustomerTimeline'))
const JourneyReplay = lazy(() => import('./components/JourneyReplay'))
const NextBestAction = lazy(() => import('./components/NextBestAction'))
const SentimentAnalysis = lazy(() => import('./components/SentimentAnalysis'))

// Next-Gen CRM — Tier 3: Engagement
const DigitalSalesRoom = lazy(() => import('./components/DigitalSalesRoom'))
const MutualActionPlan = lazy(() => import('./components/MutualActionPlan'))
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'))
const OnboardingTours = lazy(() => import('./components/OnboardingTours'))
const FeedbackLoop = lazy(() => import('./components/FeedbackLoop'))

// Next-Gen CRM — Tier 4: Automation
const WorkflowBuilder = lazy(() => import('./components/WorkflowBuilder'))
const SmartTaskAutomation = lazy(() => import('./components/SmartTaskAutomation'))
const DocGeneration = lazy(() => import('./components/DocGeneration'))
const DataEnrichment = lazy(() => import('./components/DataEnrichment'))
const DuplicateDetection = lazy(() => import('./components/DuplicateDetection'))

// Next-Gen CRM — Tier 5: Analytics
const RevenueIntelligence = lazy(() => import('./components/RevenueIntelligence'))
const CohortStudio = lazy(() => import('./components/CohortStudio'))
const WinLossAnalysis = lazy(() => import('./components/WinLossAnalysis'))
const MultiTouchAttribution = lazy(() => import('./components/MultiTouchAttribution'))
const ExecutiveCockpit = lazy(() => import('./components/ExecutiveCockpit'))

// Next-Gen CRM — Tier 6: Ecosystem
const CustomerAppBuilder = lazy(() => import('./components/CustomerAppBuilder'))
const PluginMarketplace = lazy(() => import('./components/PluginMarketplace'))
const WhiteLabelConfig = lazy(() => import('./components/WhiteLabelConfig'))
const MobileCRM = lazy(() => import('./components/MobileCRM'))
const AICoPilot = lazy(() => import('./components/AICoPilot'))

// v2 Improvements — Tier 2: Agentic AI
const SemanticSearch = lazy(() => import('./components/SemanticSearch'))
const AgentGovernanceDashboard = lazy(() => import('./components/AgentGovernanceDashboard'))
const SalesAgentDashboard = lazy(() => import('./components/SalesAgentDashboard'))
const CustomerSuccessAgent = lazy(() => import('./components/CustomerSuccessAgent'))
const PredictiveAnalytics = lazy(() => import('./components/PredictiveAnalytics'))
const WorkflowRuntime = lazy(() => import('./components/WorkflowRuntime'))
const EmbeddedAnalytics = lazy(() => import('./components/EmbeddedAnalytics'))

// v2 Improvements — Tier 3: Vertical Deepening — Telco
const TelcoCellSiteMap = lazy(() => import('./components/TelcoCellSiteMap'))
const TelcoSIMLifecycle = lazy(() => import('./components/TelcoSIMLifecycle'))
const TelcoRevenueAssurance = lazy(() => import('./components/TelcoRevenueAssurance'))
const TelcoNCCCompliance = lazy(() => import('./components/TelcoNCCCompliance'))
const TelcoNumberPortability = lazy(() => import('./components/TelcoNumberPortability'))
const TelcoUSSDReplay = lazy(() => import('./components/TelcoUSSDReplay'))

// v2 Improvements — Tier 3: Vertical Deepening — Commodity
const CommodityPriceFeed = lazy(() => import('./components/CommodityPriceFeed'))
const CommodityTradeBlotter = lazy(() => import('./components/CommodityTradeBlotter'))
const CommodityCounterpartyRisk = lazy(() => import('./components/CommodityCounterpartyRisk'))
const CommodityCFTCReporting = lazy(() => import('./components/CommodityCFTCReporting'))
const CommodityMarkToMarket = lazy(() => import('./components/CommodityMarkToMarket'))

// v2 Improvements — Tier 3: Vertical Deepening — CPaaS
const CPaaSAPIExplorer = lazy(() => import('./components/CPaaSAPIExplorer'))
const CPaaSMessageInspector = lazy(() => import('./components/CPaaSMessageInspector'))
const CPaaSA2PCompliance = lazy(() => import('./components/CPaaSA2PCompliance'))
const CPaaSChannelAnalytics = lazy(() => import('./components/CPaaSChannelAnalytics'))
const CPaaSWebhookTester = lazy(() => import('./components/CPaaSWebhookTester'))

// v2 Improvements — Tier 3: Vertical Deepening — Banking
const BankingOpenBankingConsent = lazy(() => import('./components/BankingOpenBankingConsent'))
const BankingNIPPayments = lazy(() => import('./components/BankingNIPPayments'))
const BankingRegulatoryReports = lazy(() => import('./components/BankingRegulatoryReports'))
const BankingFXRateManager = lazy(() => import('./components/BankingFXRateManager'))

// v2 Improvements — Tier 4: RevOps
const RevOpsPipeline = lazy(() => import('./components/RevOpsPipeline'))
const CDPProfiles = lazy(() => import('./components/CDPProfiles'))

// Operations & Security
const AuditLog = lazy(() => import('./components/AuditLog'))
const SecurityDashboard = lazy(() => import('./components/SecurityDashboard'))
const ComplianceDashboard = lazy(() => import('./components/ComplianceDashboard'))
const DocumentManager = lazy(() => import('./components/DocumentManager'))
const TaskManager = lazy(() => import('./components/TaskManager'))
const SLAMonitor = lazy(() => import('./components/SLAMonitor'))
const IncidentManager = lazy(() => import('./components/IncidentManager'))
const DataExport = lazy(() => import('./components/DataExport'))
const BulkOperations = lazy(() => import('./components/BulkOperations'))
const AdvancedSearch = lazy(() => import('./components/AdvancedSearch'))
const CalendarView = lazy(() => import('./components/CalendarView'))
const DashboardCustomization = lazy(() => import('./components/DashboardCustomization'))

// Skip Navigation for accessibility (WCAG 2.1 AA)
const SkipNav = () => {
  const { t } = useTranslation()
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none"
    >
      {t('accessibility.skipToContent', 'Skip to main content')}
    </a>
  )
}

// Layout Component with accessibility landmarks
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      <SkipNav />
      <nav aria-label="Main navigation">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </nav>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900"
          role="main"
          aria-label="Page content"
        >
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <NotificationCenter />
    </div>
  )
}

// Protected Route Component
const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth()

  if (loading) {
    return <LoadingSpinner size="lg" message="Authenticating..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]" role="alert">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400">You do not have permission to view this page.</p>
      </div>
    )
  }

  return children
}

// Route definition helper
const P = ({ children, permission }) => (
  <ProtectedRoute permission={permission}><Layout>{children}</Layout></ProtectedRoute>
)

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Unified Banking CRM</h1>
          <p className="text-xl text-blue-100">Connecting Core Banking &bull; Agent Banking &bull; Remittance</p>
        </motion.div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <TenantProvider>
              <NotificationProvider>
                <ToastProvider>
                  <Router>
                    <div className="App">
                      <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* Core CRM */}
                        <Route path="/" element={<P><UnifiedDashboard /></P>} />
                        <Route path="/hub" element={<P><UnifiedDashboard /></P>} />
                        <Route path="/dashboard" element={<P><Dashboard /></P>} />
                        <Route path="/customers" element={<P permission="customers:read"><CustomerManagement /></P>} />
                        <Route path="/customer-360" element={<P permission="customers:read"><Customer360 /></P>} />
                        <Route path="/crm" element={<P><CRMCore /></P>} />
                        <Route path="/inventory" element={<P><InventoryManagement /></P>} />
                        <Route path="/analytics" element={<P permission="analytics:read"><Analytics /></P>} />
                        <Route path="/settings" element={<P><Settings /></P>} />

                        {/* Banking */}
                        <Route path="/core-banking" element={<P permission="banking:read"><CoreBankingView /></P>} />
                        <Route path="/agent-banking" element={<P permission="banking:read"><AgentBankingView /></P>} />
                        <Route path="/remittance" element={<P permission="banking:read"><RemittanceView /></P>} />
                        {/* Telco Vertical */}
                        <Route path="/telco-subscribers" element={<P><TelcoSubscriberManagement /></P>} />
                        <Route path="/telco-field-ops" element={<P><TelcoFieldOps /></P>} />
                        <Route path="/telco-interconnect" element={<P><TelcoInterconnect /></P>} />

                        {/* Commodity Vertical */}
                        <Route path="/commodity-trading" element={<P><CommodityTradingDesk /></P>} />
                        <Route path="/commodity-broker" element={<P><CommodityBrokerPortal /></P>} />
                        <Route path="/commodity-settlement" element={<P><CommoditySettlement /></P>} />

                        {/* CPaaS Vertical */}
                        <Route path="/cpaas-channels" element={<P><CPaaSChannelDashboard /></P>} />
                        <Route path="/cpaas-developers" element={<P><CPaaSDeveloperOnboarding /></P>} />

                        <Route path="/integrations" element={<P><IntegrationHub /></P>} />
                        <Route path="/cross-analytics" element={<P permission="analytics:read"><CrossSystemAnalytics /></P>} />

                        {/* Campaign & Engagement */}
                        <Route path="/campaigns" element={<P permission="campaigns:read"><CampaignManager /></P>} />
                        <Route path="/realtime" element={<P permission="analytics:read"><RealTimeDashboard /></P>} />
                        <Route path="/journeys" element={<P permission="campaigns:read"><JourneyOrchestrator /></P>} />
                        <Route path="/churn" element={<P permission="analytics:read"><ChurnPrevention /></P>} />
                        <Route path="/conversational" element={<P permission="campaigns:read"><ConversationalFlows /></P>} />
                        <Route path="/geo-targeting" element={<P permission="campaigns:read"><GeoTargeting /></P>} />
                        <Route path="/ab-testing" element={<P permission="campaigns:read"><ABTestAutomation /></P>} />
                        <Route path="/compliance" element={<P permission="compliance:read"><ConsentCompliance /></P>} />
                        <Route path="/preferences" element={<P><NotificationPreferences /></P>} />
                        <Route path="/revenue" element={<P permission="analytics:read"><RevenueAttribution /></P>} />
                        <Route path="/gamification" element={<P permission="campaigns:read"><AgentGamification /></P>} />
                        <Route path="/tenant-admin" element={<P permission="admin:full"><TenantAdmin /></P>} />

                        {/* Developer Portal */}
                        <Route path="/api-keys" element={<P permission="admin:full"><APIKeyManager /></P>} />
                        <Route path="/usage" element={<P permission="analytics:read"><UsageMetering /></P>} />
                        <Route path="/sdk-docs" element={<P><SDKDocs /></P>} />
                        <Route path="/webhooks" element={<P permission="admin:full"><WebhookManager /></P>} />
                        <Route path="/sandbox" element={<P permission="admin:full"><SandboxManager /></P>} />

                        {/* Intelligence & AI */}
                        <Route path="/channel-value" element={<P permission="analytics:read"><ChannelValueAnalysis /></P>} />
                        <Route path="/acquisition" element={<P permission="campaigns:read"><AcquisitionEngine /></P>} />
                        <Route path="/social-media" element={<P permission="campaigns:read"><SocialMediaHub /></P>} />
                        <Route path="/mdm-360" element={<P permission="customers:read"><MDMCustomer360 /></P>} />
                        <Route path="/agentic-ai" element={<P permission="analytics:read"><AgenticAI /></P>} />

                        {/* AI/ML Stack */}
                        <Route path="/gnn-neo4j" element={<P permission="analytics:read"><GNNNeo4j /></P>} />
                        <Route path="/falkordb" element={<P permission="analytics:read"><FalkorDBGraph /></P>} />
                        <Route path="/mcmc-risk" element={<P permission="analytics:read"><MCMCRisk /></P>} />
                        <Route path="/cocoindex" element={<P permission="analytics:read"><CocoIndexPipeline /></P>} />
                        <Route path="/epr-kgqa" element={<P permission="analytics:read"><EPRKGQAChat /></P>} />
                        <Route path="/art-security" element={<P permission="security:read"><ARTSecurity /></P>} />
                        <Route path="/ollama" element={<P permission="analytics:read"><OllamaInference /></P>} />

                        {/* Operations & Security */}
                        <Route path="/audit-log" element={<P permission="audit:read"><AuditLog /></P>} />
                        <Route path="/security-dashboard" element={<P permission="security:read"><SecurityDashboard /></P>} />
                        <Route path="/compliance-dashboard" element={<P permission="compliance:read"><ComplianceDashboard /></P>} />
                        <Route path="/documents" element={<P><DocumentManager /></P>} />
                        <Route path="/tasks" element={<P><TaskManager /></P>} />
                        <Route path="/sla-monitor" element={<P permission="analytics:read"><SLAMonitor /></P>} />
                        <Route path="/incidents" element={<P permission="security:read"><IncidentManager /></P>} />
                        <Route path="/data-export" element={<P permission="admin:full"><DataExport /></P>} />
                        <Route path="/bulk-operations" element={<P permission="admin:full"><BulkOperations /></P>} />
                        <Route path="/search" element={<P><AdvancedSearch /></P>} />
                        <Route path="/calendar" element={<P><CalendarView /></P>} />
                        <Route path="/customize-dashboard" element={<P><DashboardCustomization /></P>} />

                        {/* Next-Gen CRM — Tier 1: AI-Native */}
                        <Route path="/health-scoring" element={<P><CustomerHealthScore /></P>} />
                        <Route path="/omnichannel-inbox" element={<P><OmnichannelInbox /></P>} />
                        <Route path="/conversation-intelligence" element={<P><ConversationIntelligence /></P>} />
                        <Route path="/deal-scoring" element={<P><DealScoring /></P>} />
                        <Route path="/smart-composer" element={<P><SmartComposer /></P>} />

                        {/* Next-Gen CRM — Tier 2: Relationship Intelligence */}
                        <Route path="/relationship-mapping" element={<P><RelationshipMapping /></P>} />
                        <Route path="/customer-timeline" element={<P><CustomerTimeline /></P>} />
                        <Route path="/journey-replay" element={<P><JourneyReplay /></P>} />
                        <Route path="/next-best-action" element={<P><NextBestAction /></P>} />
                        <Route path="/sentiment-analysis" element={<P><SentimentAnalysis /></P>} />

                        {/* Next-Gen CRM — Tier 3: Engagement */}
                        <Route path="/digital-sales-room" element={<P><DigitalSalesRoom /></P>} />
                        <Route path="/mutual-action-plans" element={<P><MutualActionPlan /></P>} />
                        <Route path="/knowledge-base" element={<P><KnowledgeBase /></P>} />
                        <Route path="/onboarding-tours" element={<P><OnboardingTours /></P>} />
                        <Route path="/feedback" element={<P><FeedbackLoop /></P>} />

                        {/* Next-Gen CRM — Tier 4: Automation */}
                        <Route path="/workflow-builder" element={<P><WorkflowBuilder /></P>} />
                        <Route path="/smart-tasks" element={<P><SmartTaskAutomation /></P>} />
                        <Route path="/doc-generation" element={<P><DocGeneration /></P>} />
                        <Route path="/data-enrichment" element={<P><DataEnrichment /></P>} />
                        <Route path="/duplicate-detection" element={<P><DuplicateDetection /></P>} />

                        {/* Next-Gen CRM — Tier 5: Analytics */}
                        <Route path="/revenue-intelligence" element={<P><RevenueIntelligence /></P>} />
                        <Route path="/cohort-studio" element={<P><CohortStudio /></P>} />
                        <Route path="/win-loss" element={<P><WinLossAnalysis /></P>} />
                        <Route path="/attribution" element={<P><MultiTouchAttribution /></P>} />
                        <Route path="/executive-cockpit" element={<P><ExecutiveCockpit /></P>} />

                        {/* Next-Gen CRM — Tier 6: Ecosystem */}
                        <Route path="/app-builder" element={<P permission="admin:full"><CustomerAppBuilder /></P>} />
                        <Route path="/marketplace" element={<P><PluginMarketplace /></P>} />
                        <Route path="/white-label" element={<P permission="admin:full"><WhiteLabelConfig /></P>} />
                        <Route path="/mobile-crm" element={<P><MobileCRM /></P>} />
                        <Route path="/ai-copilot" element={<P><AICoPilot /></P>} />

                        {/* v2 — Agentic AI */}
                        <Route path="/semantic-search" element={<P><SemanticSearch /></P>} />
                        <Route path="/agent-governance" element={<P permission="admin:full"><AgentGovernanceDashboard /></P>} />
                        <Route path="/sales-agent" element={<P><SalesAgentDashboard /></P>} />
                        <Route path="/cs-agent" element={<P><CustomerSuccessAgent /></P>} />
                        <Route path="/predictive-analytics" element={<P permission="analytics:read"><PredictiveAnalytics /></P>} />
                        <Route path="/workflow-runtime" element={<P><WorkflowRuntime /></P>} />
                        <Route path="/embedded-analytics" element={<P permission="admin:full"><EmbeddedAnalytics /></P>} />

                        {/* v2 — Telco Deepening */}
                        <Route path="/telco-cell-sites" element={<P><TelcoCellSiteMap /></P>} />
                        <Route path="/telco-sim-lifecycle" element={<P><TelcoSIMLifecycle /></P>} />
                        <Route path="/telco-revenue-assurance" element={<P><TelcoRevenueAssurance /></P>} />
                        <Route path="/telco-ncc-compliance" element={<P><TelcoNCCCompliance /></P>} />
                        <Route path="/telco-number-portability" element={<P><TelcoNumberPortability /></P>} />
                        <Route path="/telco-ussd-replay" element={<P><TelcoUSSDReplay /></P>} />

                        {/* v2 — Commodity Deepening */}
                        <Route path="/commodity-price-feed" element={<P><CommodityPriceFeed /></P>} />
                        <Route path="/commodity-trade-blotter" element={<P><CommodityTradeBlotter /></P>} />
                        <Route path="/commodity-counterparty-risk" element={<P><CommodityCounterpartyRisk /></P>} />
                        <Route path="/commodity-cftc-reporting" element={<P><CommodityCFTCReporting /></P>} />
                        <Route path="/commodity-mark-to-market" element={<P><CommodityMarkToMarket /></P>} />

                        {/* v2 — CPaaS Deepening */}
                        <Route path="/cpaas-api-explorer" element={<P><CPaaSAPIExplorer /></P>} />
                        <Route path="/cpaas-message-inspector" element={<P><CPaaSMessageInspector /></P>} />
                        <Route path="/cpaas-a2p-compliance" element={<P><CPaaSA2PCompliance /></P>} />
                        <Route path="/cpaas-channel-analytics" element={<P><CPaaSChannelAnalytics /></P>} />
                        <Route path="/cpaas-webhook-tester" element={<P><CPaaSWebhookTester /></P>} />

                        {/* v2 — Banking Deepening */}
                        <Route path="/banking-open-banking" element={<P permission="banking:read"><BankingOpenBankingConsent /></P>} />
                        <Route path="/banking-nip-payments" element={<P permission="banking:read"><BankingNIPPayments /></P>} />
                        <Route path="/banking-regulatory-reports" element={<P permission="compliance:read"><BankingRegulatoryReports /></P>} />
                        <Route path="/banking-fx-rates" element={<P permission="banking:read"><BankingFXRateManager /></P>} />

                        {/* v2 — RevOps */}
                        <Route path="/revops-pipeline" element={<P permission="analytics:read"><RevOpsPipeline /></P>} />
                        <Route path="/cdp-profiles" element={<P permission="analytics:read"><CDPProfiles /></P>} />
                      </Routes>
                    </div>
                  </Router>
                </ToastProvider>
              </NotificationProvider>
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}

export default App
