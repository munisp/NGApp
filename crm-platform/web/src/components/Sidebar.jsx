import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Home,
  UserCheck,
  TrendingUp,
  Database,
  Shield,
  Zap,
  Activity,
  DollarSign,
  FileText,
  Monitor,
  Lock,
  Globe,
  Landmark,
  Wifi,
  Target,
  Send,
  MapPin,
  Megaphone,
  GitBranch,
  Bot,
  FlaskConical,
  Trophy,
  Phone,
  MessageSquare,
  ChevronDown,
  Check,
  Crown,
  Key,
  Code2,
  Webhook,
  Gauge,
  ClipboardList,
  Calendar,
  Download,
  Layers,
  AlertTriangle,
  LayoutGrid,
  ShieldCheck,
  Timer,
  FolderOpen,
  Share2,
  UserPlus,
  Brain,
  Cpu,
  Clock,
  Signal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'

const Sidebar = ({ isOpen, onToggle }) => {
  const location = useLocation()
  const { theme } = useTheme()
  const { tenant, hasProduct, hasAnyProduct, switchTenant, allTenants, enabledProducts } = useTenant()
  const { t, locale, changeLocale, languages } = useTranslation()
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    hub: true,
    retention: true,
    banking: true,
    telco: true,
    commodity: true,
    cpaas: true,
    intelligence: true,
    crmAiNative: true,
    crmRelationship: false,
    crmEngagement: false,
    crmAutomation: false,
    crmAnalytics: false,
    crmEcosystem: false,
    agenticAi: true,
    telcoDeep: false,
    commodityDeep: false,
    cpaasDeep: false,
    bankingDeep: false,
    revops: true,
    developer: true,
    operations: true,
    tenant: true,
    main: false,
    analytics: false,
    management: false,
    system: false
  })
  const [showTenantSwitcher, setShowTenantSwitcher] = useState(false)

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Product-gated navigation: items only show if tenant has the required product
  const navigationItems = [
    {
      section: 'hub',
      titleKey: 'sections.hub',
      items: [
        { i18nKey: 'nav.unifiedDashboard', href: '/hub', icon: Target, description: 'Cross-system metrics & overview' },
        { i18nKey: 'nav.customer360', href: '/customer-360', icon: Users, description: 'Unified customer profiles', badge: '91.2K' },
        { i18nKey: 'nav.crossAnalytics', href: '/cross-analytics', icon: BarChart3, description: 'CLV, cross-sell, geographic insights' },
        { i18nKey: 'nav.integrationHub', href: '/integrations', icon: Wifi, description: 'Middleware, event bus & connectivity' },
        { i18nKey: 'nav.campaigns', href: '/campaigns', icon: Megaphone, description: 'Outbound campaigns & upsell', badge: '5' },
        { i18nKey: 'nav.realtime', href: '/realtime', icon: Activity, description: 'Live WebSocket campaign metrics' },
        { i18nKey: 'nav.journeys', href: '/journeys', icon: GitBranch, description: 'Multi-step Temporal workflows', badge: '4' },
        { i18nKey: 'nav.conversational', href: '/conversational', icon: Bot, description: 'WhatsApp & Telegram self-service' },
        { i18nKey: 'nav.geoTargeting', href: '/geo-targeting', icon: MapPin, description: 'Region-based campaign targeting', requiredProduct: 'agent_banking' },
        { i18nKey: 'nav.abTesting', href: '/ab-testing', icon: FlaskConical, description: 'Auto split testing & promotion' },
      ]
    },
    {
      section: 'retention',
      titleKey: 'sections.retention',
      items: [
        { i18nKey: 'nav.churn', href: '/churn', icon: Shield, description: 'ML churn prediction & auto-trigger', badge: '842' },
        { i18nKey: 'nav.consent', href: '/compliance', icon: Lock, description: 'NDPR compliance & suppression lists' },
        { i18nKey: 'nav.preferences', href: '/preferences', icon: Bell, description: 'Channel & topic preferences' },
        { i18nKey: 'nav.revenue', href: '/revenue', icon: DollarSign, description: 'Campaign ROI & multi-touch attribution' },
        { i18nKey: 'nav.gamification', href: '/gamification', icon: Trophy, description: 'Leaderboards & incentives', badge: 'Top 8', requiredProduct: 'agent_banking' },
      ]
    },
    {
      section: 'banking',
      titleKey: 'sections.banking',
      items: [
        { i18nKey: 'nav.coreBanking', href: '/core-banking', icon: Landmark, description: 'T24/Finacle customer data', badge: '48.9K', requiredProduct: 'core_banking' },
        { i18nKey: 'nav.agentBanking', href: '/agent-banking', icon: MapPin, description: 'Field agents & registrations', badge: '1,538', requiredProduct: 'agent_banking' },
        { i18nKey: 'nav.remittance', href: '/remittance', icon: Globe, description: 'Cross-border transfers', badge: '8 corridors', requiredProduct: 'remittance' },
      ]
    },
    {
      section: 'telco',
      titleKey: 'sections.telco',
      items: [
        { i18nKey: 'nav.telcoSubscribers', href: '/telco-subscribers', icon: Users, description: 'Subscriber lifecycle & plans', requiredProduct: 'subscriber_mgmt' },
        { i18nKey: 'nav.telcoFieldOps', href: '/telco-field-ops', icon: MapPin, description: 'Network maintenance & dispatch', requiredProduct: 'field_ops' },
        { i18nKey: 'nav.telcoInterconnect', href: '/telco-interconnect', icon: Globe, description: 'Carrier settlements & roaming', requiredProduct: 'interconnect' },
      ]
    },
    {
      section: 'commodity',
      titleKey: 'sections.commodity',
      items: [
        { i18nKey: 'nav.commodityTrading', href: '/commodity-trading', icon: TrendingUp, description: 'Positions, P&L & risk', requiredProduct: 'trading' },
        { i18nKey: 'nav.commodityBroker', href: '/commodity-broker', icon: Users, description: 'Counterparty management', requiredProduct: 'broker_portal' },
        { i18nKey: 'nav.commoditySettlement', href: '/commodity-settlement', icon: DollarSign, description: 'Trade settlements & clearing', requiredProduct: 'settlement' },
      ]
    },
    {
      section: 'cpaas',
      titleKey: 'sections.cpaas',
      items: [
        { i18nKey: 'nav.cpaasChannels', href: '/cpaas-channels', icon: MessageSquare, description: 'SMS/Voice/Video analytics', requiredProduct: 'messaging' },
        { i18nKey: 'nav.cpaasDeveloperOnboarding', href: '/cpaas-developers', icon: Code2, description: 'Developer acquisition & activation', requiredProduct: 'developer_portal' },
      ]
    },
    {
      section: 'intelligence',
      titleKey: 'sections.intelligence',
      items: [
        { i18nKey: 'nav.channelValue', href: '/channel-value', icon: BarChart3, description: 'Banking channel ROI & value propositions' },
        { i18nKey: 'nav.acquisition', href: '/acquisition', icon: UserPlus, description: 'Lead scoring, funnel & conversion' },
        { i18nKey: 'nav.socialMedia', href: '/social-media', icon: Share2, description: 'Campaign management & advertising' },
        { i18nKey: 'nav.mdm360', href: '/mdm-360', icon: Database, description: 'Golden records & lakehouse analytics' },
        { i18nKey: 'nav.agenticAi', href: '/agentic-ai', icon: Brain, description: 'Autonomous AI agents platform', badge: '7 agents' },
        { i18nKey: 'nav.gnn', href: '/gnn-neo4j', icon: GitBranch, description: 'Graph neural network fraud & influence' },
        { i18nKey: 'nav.falkordb', href: '/falkordb', icon: Database, description: 'Graph queries & GraphRAG chatbot' },
        { i18nKey: 'nav.mcmc', href: '/mcmc-risk', icon: Activity, description: 'Bayesian credit risk & stress testing' },
        { i18nKey: 'nav.cocoindex', href: '/cocoindex', icon: Layers, description: 'Incremental data indexing for KG' },
        { i18nKey: 'nav.kgqa', href: '/epr-kgqa', icon: MessageSquare, description: 'Knowledge graph question answering' },
        { i18nKey: 'nav.artSecurity', href: '/art-security', icon: ShieldCheck, description: 'Adversarial robustness testing' },
        { i18nKey: 'nav.ollama', href: '/ollama', icon: Cpu, description: 'Local LLM inference engine' },
      ]
    },
    {
      section: 'crmAiNative',
      titleKey: 'sections.crmAiNative',
      items: [
        { i18nKey: 'nav.healthScoring', href: '/health-scoring', icon: Activity, description: 'Real-time customer health scores' },
        { i18nKey: 'nav.omnichannelInbox', href: '/omnichannel-inbox', icon: MessageSquare, description: 'Unified inbox across all channels' },
        { i18nKey: 'nav.conversationIntel', href: '/conversation-intelligence', icon: Phone, description: 'Call transcription & sentiment' },
        { i18nKey: 'nav.dealScoring', href: '/deal-scoring', icon: Target, description: 'AI deal win probability' },
        { i18nKey: 'nav.smartComposer', href: '/smart-composer', icon: Send, description: 'AI-powered email & message drafting' },
      ]
    },
    {
      section: 'crmRelationship',
      titleKey: 'sections.crmRelationship',
      items: [
        { i18nKey: 'nav.relationshipMapping', href: '/relationship-mapping', icon: Users, description: 'Stakeholder maps & influence' },
        { i18nKey: 'nav.customerTimeline', href: '/customer-timeline', icon: Clock, description: 'Unified chronological feed' },
        { i18nKey: 'nav.journeyReplay', href: '/journey-replay', icon: Monitor, description: 'Visual journey replay & bottlenecks' },
        { i18nKey: 'nav.nextBestAction', href: '/next-best-action', icon: Zap, description: 'Predictive action recommendations' },
        { i18nKey: 'nav.sentimentAi', href: '/sentiment-analysis', icon: Activity, description: 'Emotion & sentiment tracking' },
      ]
    },
    {
      section: 'crmEngagement',
      titleKey: 'sections.crmEngagement',
      items: [
        { i18nKey: 'nav.digitalSalesRoom', href: '/digital-sales-room', icon: Monitor, description: 'Deal rooms with engagement tracking' },
        { i18nKey: 'nav.mutualActionPlan', href: '/mutual-action-plans', icon: ClipboardList, description: 'Collaborative deal plans' },
        { i18nKey: 'nav.knowledgeBase', href: '/knowledge-base', icon: FileText, description: 'Self-service articles & FAQ' },
        { i18nKey: 'nav.onboardingTours', href: '/onboarding-tours', icon: MapPin, description: 'Guided product tours' },
        { i18nKey: 'nav.feedbackLoop', href: '/feedback', icon: MessageSquare, description: 'NPS, CSAT & CES surveys' },
      ]
    },
    {
      section: 'crmAutomation',
      titleKey: 'sections.crmAutomation',
      items: [
        { i18nKey: 'nav.workflowBuilder', href: '/workflow-builder', icon: GitBranch, description: 'Visual workflow automation' },
        { i18nKey: 'nav.smartTasks', href: '/smart-tasks', icon: ClipboardList, description: 'AI task creation & routing' },
        { i18nKey: 'nav.docGeneration', href: '/doc-generation', icon: FileText, description: 'Document generation & e-sign' },
        { i18nKey: 'nav.dataEnrichment', href: '/data-enrichment', icon: Database, description: 'Auto data enrichment' },
        { i18nKey: 'nav.duplicateDetection', href: '/duplicate-detection', icon: Shield, description: 'ML duplicate detection & merge' },
      ]
    },
    {
      section: 'crmAnalytics',
      titleKey: 'sections.crmAnalytics',
      items: [
        { i18nKey: 'nav.revenueIntelligence', href: '/revenue-intelligence', icon: DollarSign, description: 'Pipeline analytics & forecast' },
        { i18nKey: 'nav.cohortStudio', href: '/cohort-studio', icon: Users, description: 'Dynamic customer segmentation' },
        { i18nKey: 'nav.winLoss', href: '/win-loss', icon: Target, description: 'Deal outcome analysis' },
        { i18nKey: 'nav.attribution', href: '/attribution', icon: BarChart3, description: 'Multi-touch attribution modeling' },
        { i18nKey: 'nav.executiveCockpit', href: '/executive-cockpit', icon: Monitor, description: 'C-suite real-time dashboard' },
      ]
    },
    {
      section: 'crmEcosystem',
      titleKey: 'sections.crmEcosystem',
      items: [
        { i18nKey: 'nav.appBuilder', href: '/app-builder', icon: LayoutGrid, description: 'Customer mini-app builder' },
        { i18nKey: 'nav.marketplace', href: '/marketplace', icon: Layers, description: 'Plugin marketplace' },
        { i18nKey: 'nav.whiteLabel', href: '/white-label', icon: Monitor, description: 'White-label CRM configuration' },
        { i18nKey: 'nav.mobileCrm', href: '/mobile-crm', icon: Phone, description: 'Native mobile CRM with offline' },
        { i18nKey: 'nav.aiCopilot', href: '/ai-copilot', icon: Brain, description: 'AI assistant across all pages' },
      ]
    },
    {
      section: 'agenticAi',
      titleKey: 'sections.agenticAi',
      items: [
        { i18nKey: 'nav.salesAgent', href: '/sales-agent', icon: Brain, description: 'Autonomous prospect research & outreach' },
        { i18nKey: 'nav.csAgent', href: '/cs-agent', icon: Shield, description: 'Health monitoring & retention playbooks' },
        { i18nKey: 'nav.agentGovernance', href: '/agent-governance', icon: Lock, description: 'Permission tiers, audit & kill switch' },
        { i18nKey: 'nav.semanticSearch', href: '/semantic-search', icon: Search, description: 'Natural language cross-vertical search' },
        { i18nKey: 'nav.predictiveAnalytics', href: '/predictive-analytics', icon: TrendingUp, description: 'Win/churn/LTV predictions' },
        { i18nKey: 'nav.workflowRuntime', href: '/workflow-runtime', icon: Zap, description: 'Workflow execution engine' },
        { i18nKey: 'nav.embeddedAnalytics', href: '/embedded-analytics', icon: BarChart3, description: 'Customer-facing embeddable dashboards' },
      ]
    },
    {
      section: 'telcoDeep',
      titleKey: 'sections.telcoDeep',
      items: [
        { i18nKey: 'nav.cellSiteMap', href: '/telco-cell-sites', icon: Signal, description: 'Tower health & coverage', requiredProduct: 'network_ops' },
        { i18nKey: 'nav.simLifecycle', href: '/telco-sim-lifecycle', icon: Wifi, description: 'Activation, swap & porting', requiredProduct: 'subscriber_mgmt' },
        { i18nKey: 'nav.revenueAssurance', href: '/telco-revenue-assurance', icon: DollarSign, description: 'CDR reconciliation & billing', requiredProduct: 'subscriber_mgmt' },
        { i18nKey: 'nav.nccCompliance', href: '/telco-ncc-compliance', icon: Shield, description: 'NCC regulatory compliance', requiredProduct: 'subscriber_mgmt' },
        { i18nKey: 'nav.numberPortability', href: '/telco-number-portability', icon: Phone, description: 'Number porting workflow', requiredProduct: 'subscriber_mgmt' },
        { i18nKey: 'nav.ussdReplay', href: '/telco-ussd-replay', icon: MessageSquare, description: 'USSD session replay', requiredProduct: 'subscriber_mgmt' },
      ]
    },
    {
      section: 'commodityDeep',
      titleKey: 'sections.commodityDeep',
      items: [
        { i18nKey: 'nav.priceFeed', href: '/commodity-price-feed', icon: Activity, description: 'Live price streaming', requiredProduct: 'trading' },
        { i18nKey: 'nav.tradeBlotter', href: '/commodity-trade-blotter', icon: ClipboardList, description: 'Order book & fills', requiredProduct: 'trading' },
        { i18nKey: 'nav.counterpartyRisk', href: '/commodity-counterparty-risk', icon: Shield, description: 'MCMC credit risk', requiredProduct: 'risk_mgmt' },
        { i18nKey: 'nav.cftcReporting', href: '/commodity-cftc-reporting', icon: FileText, description: 'CFTC/EMIR reporting', requiredProduct: 'trading' },
        { i18nKey: 'nav.markToMarket', href: '/commodity-mark-to-market', icon: DollarSign, description: 'End-of-day P&L', requiredProduct: 'trading' },
      ]
    },
    {
      section: 'cpaasDeep',
      titleKey: 'sections.cpaasDeep',
      items: [
        { i18nKey: 'nav.apiExplorer', href: '/cpaas-api-explorer', icon: Code2, description: 'Interactive API docs', requiredProduct: 'api_platform' },
        { i18nKey: 'nav.messageInspector', href: '/cpaas-message-inspector', icon: MessageSquare, description: 'Real-time message monitoring', requiredProduct: 'messaging' },
        { i18nKey: 'nav.a2pCompliance', href: '/cpaas-a2p-compliance', icon: Shield, description: '10DLC & sender ID mgmt', requiredProduct: 'messaging' },
        { i18nKey: 'nav.channelAnalytics', href: '/cpaas-channel-analytics', icon: BarChart3, description: 'Per-channel delivery funnel', requiredProduct: 'messaging' },
        { i18nKey: 'nav.webhookTester', href: '/cpaas-webhook-tester', icon: Webhook, description: 'Test webhook events', requiredProduct: 'api_platform' },
      ]
    },
    {
      section: 'bankingDeep',
      titleKey: 'sections.bankingDeep',
      items: [
        { i18nKey: 'nav.openBanking', href: '/banking-open-banking', icon: Globe, description: 'CBN Open Banking consents', requiredProduct: 'core_banking' },
        { i18nKey: 'nav.nipPayments', href: '/banking-nip-payments', icon: Zap, description: 'NIBSS NIP 3.0 instant payments', requiredProduct: 'payments' },
        { i18nKey: 'nav.regulatoryReports', href: '/banking-regulatory-reports', icon: FileText, description: 'CBN/NDIC auto-returns', requiredProduct: 'core_banking' },
        { i18nKey: 'nav.fxRates', href: '/banking-fx-rates', icon: DollarSign, description: 'Multi-currency & CBN rates', requiredProduct: 'core_banking' },
      ]
    },
    {
      section: 'revops',
      titleKey: 'sections.revops',
      items: [
        { i18nKey: 'nav.revopsPipeline', href: '/revops-pipeline', icon: Target, description: 'Cross-vertical revenue pipeline' },
        { i18nKey: 'nav.cdpProfiles', href: '/cdp-profiles', icon: Users, description: 'Unified customer data platform' },
      ]
    },
    {
      section: 'tenant',
      titleKey: 'sections.tenant',
      items: [
        { i18nKey: 'nav.tenantAdmin', href: '/tenant-admin', icon: Crown, description: 'Manage tenants & product access' },
      ]
    },
    {
      section: 'developer',
      titleKey: 'sections.developer',
      items: [
        { i18nKey: 'nav.apiKeys', href: '/api-keys', icon: Key, description: 'Self-service API key management' },
        { i18nKey: 'nav.usageMetering', href: '/usage', icon: Gauge, description: 'API quota, billing & analytics' },
        { i18nKey: 'nav.sdkDocs', href: '/sdk-docs', icon: Code2, description: 'SDKs, API reference & code examples' },
        { i18nKey: 'nav.webhooks', href: '/webhooks', icon: Webhook, description: 'Event subscriptions & delivery' },
        { i18nKey: 'nav.sandbox', href: '/sandbox', icon: FlaskConical, description: 'Test environment & certification' },
      ]
    },
    {
      section: 'operations',
      titleKey: 'sections.operations',
      items: [
        { i18nKey: 'nav.audit', href: '/audit-log', icon: ClipboardList, description: 'Tamper-evident audit trail' },
        { i18nKey: 'nav.securityDashboard', href: '/security-dashboard', icon: ShieldCheck, description: 'Threats, DDoS, WAF status' },
        { i18nKey: 'nav.complianceDashboard', href: '/compliance-dashboard', icon: Shield, description: 'NDPR, CBN, PCI-DSS, AML/CFT' },
        { i18nKey: 'nav.documents', href: '/documents', icon: FolderOpen, description: 'KYC docs, policies, contracts' },
        { i18nKey: 'nav.tasks', href: '/tasks', icon: ClipboardList, description: 'Task management with SLA' },
        { i18nKey: 'nav.slaMonitor', href: '/sla-monitor', icon: Timer, description: 'SLA compliance tracking' },
        { i18nKey: 'nav.incidents', href: '/incidents', icon: AlertTriangle, description: 'Incident management' },
        { i18nKey: 'nav.dataExport', href: '/data-export', icon: Download, description: 'Scheduled reports & exports' },
        { i18nKey: 'nav.bulkOperations', href: '/bulk-operations', icon: Layers, description: 'Batch import, update, notify' },
        { i18nKey: 'nav.advancedSearch', href: '/search', icon: Search, description: 'Multi-field customer search' },
        { i18nKey: 'nav.calendar', href: '/calendar', icon: Calendar, description: 'Compliance deadlines & events' },
        { i18nKey: 'nav.customizeDashboard', href: '/customize-dashboard', icon: LayoutGrid, description: 'Widget layout & role presets' },
      ]
    },
    {
      section: 'main',
      titleKey: 'sections.main',
      items: [
        { i18nKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Overview and key metrics' },
        { i18nKey: 'nav.customers', href: '/customers', icon: Users, description: 'Customer management and profiles', badge: '1,234' },
        { name: 'CRM Core', href: '/crm', icon: Building2, description: 'Leads, opportunities, and sales pipeline', badge: '56' },
        { i18nKey: 'nav.inventory', href: '/inventory', icon: Package, description: 'Product and stock management', badge: 'Low Stock' },
      ]
    },
    {
      section: 'analytics',
      titleKey: 'sections.analytics',
      items: [
        { i18nKey: 'nav.analytics', href: '/analytics', icon: BarChart3, description: 'Business intelligence and insights' },
        { name: 'Sales Reports', href: '/analytics/sales', icon: TrendingUp, description: 'Sales performance and trends' },
        { name: 'Customer Insights', href: '/analytics/customers', icon: UserCheck, description: 'Customer behavior and segmentation' },
        { name: 'Inventory Reports', href: '/analytics/inventory', icon: Database, description: 'Stock levels and turnover analysis' },
      ]
    },
    {
      section: 'management',
      titleKey: 'sections.management',
      items: [
        { name: 'User Management', href: '/management/users', icon: Shield, description: 'User roles and permissions' },
        { name: 'System Health', href: '/management/health', icon: Activity, description: 'System monitoring and alerts' },
        { name: 'Cost Management', href: '/management/costs', icon: DollarSign, description: 'Resource costs and optimization' },
        { i18nKey: 'nav.security', href: '/management/security', icon: Lock, description: 'Security monitoring and compliance' },
      ]
    },
    {
      section: 'system',
      titleKey: 'sections.system',
      items: [
        { i18nKey: 'nav.settings', href: '/settings', icon: Settings, description: 'Application configuration' },
        { name: 'API Documentation', href: '/docs/api', icon: FileText, description: 'API reference and guides' },
        { name: 'System Logs', href: '/system/logs', icon: Monitor, description: 'Application and system logs' },
        { i18nKey: 'nav.integrations', href: '/system/integrations', icon: Zap, description: 'Third-party integrations' },
      ]
    }
  ]

  const isActive = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  // Filter nav items based on tenant product access
  const filteredNavItems = navigationItems.map(section => {
    // Filter out sections that have no visible items after product gating
    const visibleItems = section.items.filter(item => {
      if (!item.requiredProduct) return true
      return hasProduct(item.requiredProduct)
    })
    // Hide Banking Channels section entirely if no banking products are enabled
    if (section.section === 'banking' && visibleItems.length === 0) return null
    return { ...section, items: visibleItems }
  }).filter(Boolean)

  const tierColors = {
    enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    growth: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }

  return (
    <motion.div
      initial={false}
      animate={{
        width: isOpen ? 280 : 80,
        transition: { duration: 0.3, ease: 'easeInOut' }
      }}
      className={cn(
        'sidebar relative flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg',
        'h-full overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  Enterprise CRM
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  v2.0.0
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mx-auto"
            >
              <Building2 className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggle}
          className={cn(
            'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
            'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Tenant Switcher */}
      {isOpen && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <button
              onClick={() => setShowTenantSwitcher(!showTenantSwitcher)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: tenant?.branding?.primaryColor || '#1E40AF' }}
                >
                  {tenant?.name?.charAt(0) || 'T'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tenant?.name || 'Select Tenant'}</p>
                  <div className="flex items-center gap-1">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', tierColors[tenant?.subscriptionTier] || tierColors.trial)}>
                      {tenant?.subscriptionTier || 'trial'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{enabledProducts.length} products</span>
                  </div>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showTenantSwitcher && 'rotate-180')} />
            </button>

            {showTenantSwitcher && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
              >
                {allTenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { switchTenant(t.id); setShowTenantSwitcher(false) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left',
                      t.id === tenant?.id && 'bg-blue-50 dark:bg-blue-900/20'
                    )}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: t.branding?.primaryColor || '#666' }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {Object.values(t.products).filter(Boolean).length} products · {t.subscriptionTier}
                        </p>
                      </div>
                    </div>
                    {t.id === tenant?.id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-2">
          {filteredNavItems.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No results found</div>}
          {filteredNavItems.map((section) => (
            <div key={section.section} className="px-3">
              {isOpen && (
                <button
                  onClick={() => toggleSection(section.section)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400',
                    'hover:text-gray-700 dark:hover:text-gray-200 transition-colors uppercase tracking-wider'
                  )}
                >
                  {t(section.titleKey, section.title)}
                  <motion.div
                    animate={{ rotate: expandedSections[section.section] ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </motion.div>
                </button>
              )}

              <AnimatePresence>
                {(isOpen ? expandedSections[section.section] : true) && (
                  <motion.div
                    initial={isOpen ? { opacity: 0, height: 0 } : false}
                    animate={isOpen ? { opacity: 1, height: 'auto' } : false}
                    exit={isOpen ? { opacity: 0, height: 0 } : false}
                    transition={{ duration: 0.2 }}
                    className="space-y-1"
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.href)

                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                            'hover:bg-gray-100 dark:hover:bg-gray-800',
                            active
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                              : 'text-gray-700 dark:text-gray-300'
                          )}
                          title={!isOpen ? (item.i18nKey ? t(item.i18nKey, item.name) : item.name) : undefined}
                        >
                          <Icon
                            className={cn(
                              'w-5 h-5 transition-colors',
                              active
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                            )}
                          />

                          <AnimatePresence mode="wait">
                            {isOpen && (
                              <motion.div
                                key="expanded-content"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="ml-3 flex-1 min-w-0"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate">{item.i18nKey ? t(item.i18nKey, item.name) : item.name}</span>
                                  {item.badge && (
                                    <span
                                      className={cn(
                                        'ml-2 px-2 py-0.5 text-xs font-medium rounded-full',
                                        item.badge === 'Low Stock'
                                          ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                      )}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="expanded-footer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('footer.systemStatus', 'System Status')}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {t('footer.allOperational', 'All systems operational')}
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Last updated: {new Date().toLocaleTimeString()}
              </div>

              {/* Language Switcher */}
              <div className="relative mt-2">
                <button
                  onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs"
                  aria-label={t('accessibility.selectLanguage', 'Select language')}
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">{t('footer.language', 'Language')}</span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{languages.find(l => l.code === locale)?.name || locale}</span>
                </button>
                {showLanguagePicker && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { changeLocale(lang.code); setShowLanguagePicker(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                          lang.code === locale && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        )}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed-footer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default Sidebar

