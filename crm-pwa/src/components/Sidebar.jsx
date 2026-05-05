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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

const Sidebar = ({ isOpen, onToggle }) => {
  const location = useLocation()
  const { theme } = useTheme()
  const [expandedSections, setExpandedSections] = useState({
    hub: true,
    banking: true,
    main: false,
    analytics: false,
    management: false,
    system: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

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
          badge: '48.9K'
        },
        {
          name: 'Agent Banking',
          href: '/agent-banking',
          icon: MapPin,
          description: 'Field agents & registrations',
          badge: '1,538'
        },
        {
          name: 'Remittance',
          href: '/remittance',
          icon: Globe,
          description: 'Cross-border transfers',
          badge: '8 corridors'
        },
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

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-2">
          {navigationItems.map((section) => (
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

