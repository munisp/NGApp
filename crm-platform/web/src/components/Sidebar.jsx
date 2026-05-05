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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useTenant } from '@/contexts/TenantContext'

const Sidebar = ({ isOpen, onToggle }) => {
  const location = useLocation()
  const { theme } = useTheme()
  const { tenant, hasProduct, hasAnyProduct, switchTenant, allTenants, enabledProducts } = useTenant()
  const [expandedSections, setExpandedSections] = useState({
    hub: true,
    retention: true,
    banking: true,
    intelligence: true,
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
      title: 'Unified CRM Hub',
      items: [
        {
          name: 'Unified Dashboard',
          href: '/hub',
          icon: Target,
          description: 'Cross-system metrics & overview'
        },
        {
          name: 'Customer 360°',
          href: '/customer-360',
          icon: Users,
          description: 'Unified customer profiles',
          badge: '91.2K'
        },
        {
          name: 'Cross-System Analytics',
          href: '/cross-analytics',
          icon: BarChart3,
          description: 'CLV, cross-sell, geographic insights'
        },
        {
          name: 'Integration Hub',
          href: '/integrations',
          icon: Wifi,
          description: 'Middleware, event bus & connectivity'
        },
        {
          name: 'Campaigns',
          href: '/campaigns',
          icon: Megaphone,
          description: 'Outbound campaigns & upsell',
          badge: '5'
        },
        {
          name: 'Real-Time Dashboard',
          href: '/realtime',
          icon: Activity,
          description: 'Live WebSocket campaign metrics'
        },
        {
          name: 'Journey Orchestrator',
          href: '/journeys',
          icon: GitBranch,
          description: 'Multi-step Temporal workflows',
          badge: '4'
        },
        {
          name: 'Conversational Flows',
          href: '/conversational',
          icon: Bot,
          description: 'WhatsApp & Telegram self-service'
        },
        {
          name: 'Geo Targeting',
          href: '/geo-targeting',
          icon: MapPin,
          description: 'Region-based campaign targeting',
          requiredProduct: 'agent_banking',
        },
        {
          name: 'A/B Testing',
          href: '/ab-testing',
          icon: FlaskConical,
          description: 'Auto split testing & promotion'
        },
      ]
    },
    {
      section: 'retention',
      title: 'Retention & Compliance',
      items: [
        {
          name: 'Churn Prevention',
          href: '/churn',
          icon: Shield,
          description: 'ML churn prediction & auto-trigger',
          badge: '842'
        },
        {
          name: 'Consent & Compliance',
          href: '/compliance',
          icon: Lock,
          description: 'NDPR compliance & suppression lists'
        },
        {
          name: 'Notification Preferences',
          href: '/preferences',
          icon: Bell,
          description: 'Channel & topic preferences'
        },
        {
          name: 'Revenue Attribution',
          href: '/revenue',
          icon: DollarSign,
          description: 'Campaign ROI & multi-touch attribution'
        },
        {
          name: 'Agent Gamification',
          href: '/gamification',
          icon: Trophy,
          description: 'Leaderboards & incentives',
          badge: 'Top 8',
          requiredProduct: 'agent_banking',
        },
      ]
    },
    {
      section: 'banking',
      title: 'Banking Channels',
      items: [
        {
          name: 'Core Banking',
          href: '/core-banking',
          icon: Landmark,
          description: 'T24/Finacle customer data',
          badge: '48.9K',
          requiredProduct: 'core_banking',
        },
        {
          name: 'Agent Banking',
          href: '/agent-banking',
          icon: MapPin,
          description: 'Field agents & registrations',
          badge: '1,538',
          requiredProduct: 'agent_banking',
        },
        {
          name: 'Remittance',
          href: '/remittance',
          icon: Globe,
          description: 'Cross-border transfers',
          badge: '8 corridors',
          requiredProduct: 'remittance',
        },
      ]
    },
    {
      section: 'intelligence',
      title: 'Intelligence & AI',
      items: [
        {
          name: 'Channel Value Analysis',
          href: '/channel-value',
          icon: BarChart3,
          description: 'Banking channel ROI & value propositions'
        },
        {
          name: 'Acquisition Engine',
          href: '/acquisition',
          icon: UserPlus,
          description: 'Lead scoring, funnel & conversion'
        },
        {
          name: 'Social Media Hub',
          href: '/social-media',
          icon: Share2,
          description: 'Campaign management & advertising'
        },
        {
          name: 'MDM Customer 360°',
          href: '/mdm-360',
          icon: Database,
          description: 'Golden records & lakehouse analytics'
        },
        {
          name: 'Agentic AI',
          href: '/agentic-ai',
          icon: Brain,
          description: 'Autonomous AI agents platform',
          badge: '7 agents'
        },
      ]
    },
    {
      section: 'tenant',
      title: 'Tenant Admin',
      items: [
        {
          name: 'Tenant Management',
          href: '/tenant-admin',
          icon: Crown,
          description: 'Manage tenants & product access'
        },
      ]
    },
    {
      section: 'developer',
      title: 'Developer Portal',
      items: [
        {
          name: 'API Keys',
          href: '/api-keys',
          icon: Key,
          description: 'Self-service API key management'
        },
        {
          name: 'Usage & Metering',
          href: '/usage',
          icon: Gauge,
          description: 'API quota, billing & analytics'
        },
        {
          name: 'SDK & Docs',
          href: '/sdk-docs',
          icon: Code2,
          description: 'SDKs, API reference & code examples'
        },
        {
          name: 'Webhooks',
          href: '/webhooks',
          icon: Webhook,
          description: 'Event subscriptions & delivery'
        },
        {
          name: 'Sandbox',
          href: '/sandbox',
          icon: FlaskConical,
          description: 'Test environment & certification'
        },
      ]
    },
    {
      section: 'operations',
      title: 'Operations & Security',
      items: [
        { name: 'Audit Log', href: '/audit-log', icon: ClipboardList, description: 'Tamper-evident audit trail' },
        { name: 'Security Dashboard', href: '/security-dashboard', icon: ShieldCheck, description: 'Threats, DDoS, WAF status' },
        { name: 'Compliance Dashboard', href: '/compliance-dashboard', icon: Shield, description: 'NDPR, CBN, PCI-DSS, AML/CFT' },
        { name: 'Documents', href: '/documents', icon: FolderOpen, description: 'KYC docs, policies, contracts' },
        { name: 'Tasks', href: '/tasks', icon: ClipboardList, description: 'Task management with SLA' },
        { name: 'SLA Monitor', href: '/sla-monitor', icon: Timer, description: 'SLA compliance tracking' },
        { name: 'Incidents', href: '/incidents', icon: AlertTriangle, description: 'Incident management' },
        { name: 'Data Export', href: '/data-export', icon: Download, description: 'Scheduled reports & exports' },
        { name: 'Bulk Operations', href: '/bulk-operations', icon: Layers, description: 'Batch import, update, notify' },
        { name: 'Advanced Search', href: '/search', icon: Search, description: 'Multi-field customer search' },
        { name: 'Calendar', href: '/calendar', icon: Calendar, description: 'Compliance deadlines & events' },
        { name: 'Customize Dashboard', href: '/customize-dashboard', icon: LayoutGrid, description: 'Widget layout & role presets' },
      ]
    },
    {
      section: 'main',
      title: 'CRM Modules',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
          description: 'Overview and key metrics'
        },
        {
          name: 'Customers',
          href: '/customers',
          icon: Users,
          description: 'Customer management and profiles',
          badge: '1,234'
        },
        {
          name: 'CRM Core',
          href: '/crm',
          icon: Building2,
          description: 'Leads, opportunities, and sales pipeline',
          badge: '56'
        },
        {
          name: 'Inventory',
          href: '/inventory',
          icon: Package,
          description: 'Product and stock management',
          badge: 'Low Stock'
        }
      ]
    },
    {
      section: 'analytics',
      title: 'Analytics & Reports',
      items: [
        {
          name: 'Analytics',
          href: '/analytics',
          icon: BarChart3,
          description: 'Business intelligence and insights'
        },
        {
          name: 'Sales Reports',
          href: '/analytics/sales',
          icon: TrendingUp,
          description: 'Sales performance and trends'
        },
        {
          name: 'Customer Insights',
          href: '/analytics/customers',
          icon: UserCheck,
          description: 'Customer behavior and segmentation'
        },
        {
          name: 'Inventory Reports',
          href: '/analytics/inventory',
          icon: Database,
          description: 'Stock levels and turnover analysis'
        }
      ]
    },
    {
      section: 'management',
      title: 'Management',
      items: [
        {
          name: 'User Management',
          href: '/management/users',
          icon: Shield,
          description: 'User roles and permissions'
        },
        {
          name: 'System Health',
          href: '/management/health',
          icon: Activity,
          description: 'System monitoring and alerts'
        },
        {
          name: 'Cost Management',
          href: '/management/costs',
          icon: DollarSign,
          description: 'Resource costs and optimization'
        },
        {
          name: 'Security Center',
          href: '/management/security',
          icon: Lock,
          description: 'Security monitoring and compliance'
        }
      ]
    },
    {
      section: 'system',
      title: 'System',
      items: [
        {
          name: 'Settings',
          href: '/settings',
          icon: Settings,
          description: 'Application configuration'
        },
        {
          name: 'API Documentation',
          href: '/docs/api',
          icon: FileText,
          description: 'API reference and guides'
        },
        {
          name: 'System Logs',
          href: '/system/logs',
          icon: Monitor,
          description: 'Application and system logs'
        },
        {
          name: 'Integrations',
          href: '/system/integrations',
          icon: Zap,
          description: 'Third-party integrations'
        }
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
        'relative flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg',
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
                  {section.title}
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
                          title={!isOpen ? item.name : undefined}
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
                                  <span className="truncate">{item.name}</span>
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
                    System Status
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    All systems operational
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Last updated: {new Date().toLocaleTimeString()}
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

