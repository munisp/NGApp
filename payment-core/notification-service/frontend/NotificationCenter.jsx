import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  Check,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Filter,
  MoreHorizontal,
  Trash2,
  Archive,
  Star,
  Clock,
  User,
  DollarSign,
  Package,
  Target,
  TrendingUp,
  Mail,
  Phone,
  Calendar
} from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'

const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotification()
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('all') // all, unread, important, system
  const [selectedNotifications, setSelectedNotifications] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const panelRef = useRef(null)

  // Mock notifications with Novu-style structure
  const [mockNotifications, setMockNotifications] = useState([
    {
      id: '1',
      title: 'New Customer Registration',
      message: 'Acme Corporation has successfully registered for Enterprise Suite',
      type: 'success',
      category: 'customer',
      priority: 'normal',
      read: false,
      starred: false,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      actions: [
        { label: 'View Customer', action: 'view_customer', primary: true },
        { label: 'Send Welcome Email', action: 'send_email', primary: false }
      ],
      metadata: {
        customerId: 'cust_123',
        customerName: 'Acme Corporation',
        plan: 'Enterprise Suite'
      }
    },
    {
      id: '2',
      title: 'Deal Closed Successfully',
      message: '$45,000 deal with TechStart Inc. has been marked as closed won',
      type: 'success',
      category: 'sales',
      priority: 'high',
      read: false,
      starred: true,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      actions: [
        { label: 'View Deal', action: 'view_deal', primary: true },
        { label: 'Generate Invoice', action: 'generate_invoice', primary: false }
      ],
      metadata: {
        dealId: 'deal_456',
        amount: 45000,
        customer: 'TechStart Inc.'
      }
    },
    {
      id: '3',
      title: 'Low Stock Alert',
      message: 'Professional licenses are running low (8 remaining)',
      type: 'warning',
      category: 'inventory',
      priority: 'high',
      read: true,
      starred: false,
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      actions: [
        { label: 'Reorder Stock', action: 'reorder_stock', primary: true },
        { label: 'View Inventory', action: 'view_inventory', primary: false }
      ],
      metadata: {
        productId: 'prod_789',
        productName: 'Professional Licenses',
        currentStock: 8,
        minStock: 10
      }
    },
    {
      id: '4',
      title: 'System Maintenance Scheduled',
      message: 'Scheduled maintenance window: Tonight 2:00 AM - 4:00 AM EST',
      type: 'info',
      category: 'system',
      priority: 'normal',
      read: true,
      starred: false,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      actions: [
        { label: 'View Details', action: 'view_maintenance', primary: true }
      ],
      metadata: {
        maintenanceId: 'maint_101',
        startTime: '2024-01-16T02:00:00Z',
        endTime: '2024-01-16T04:00:00Z'
      }
    },
    {
      id: '5',
      title: 'Payment Failed',
      message: 'Payment for Global Corp subscription failed. Please update payment method.',
      type: 'error',
      category: 'billing',
      priority: 'high',
      read: false,
      starred: false,
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      actions: [
        { label: 'Update Payment', action: 'update_payment', primary: true },
        { label: 'Contact Customer', action: 'contact_customer', primary: false }
      ],
      metadata: {
        customerId: 'cust_456',
        customerName: 'Global Corp',
        amount: 2499.99,
        invoiceId: 'inv_789'
      }
    }
  ])

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getNotificationIcon = (type, category) => {
    if (type === 'success') return CheckCircle
    if (type === 'warning') return AlertTriangle
    if (type === 'error') return XCircle
    if (type === 'info') return Info
    
    // Category-based icons
    switch (category) {
      case 'customer': return User
      case 'sales': return DollarSign
      case 'inventory': return Package
      case 'system': return Settings
      case 'billing': return DollarSign
      default: return Bell
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
      case 'warning': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
      case 'error': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
      case 'info': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-red-500'
      case 'normal': return 'border-l-blue-500'
      case 'low': return 'border-l-gray-500'
      default: return 'border-l-gray-500'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  const filteredNotifications = mockNotifications.filter(notification => {
    switch (filter) {
      case 'unread': return !notification.read
      case 'important': return notification.starred || notification.priority === 'high'
      case 'system': return notification.category === 'system'
      default: return true
    }
  })

  const handleNotificationAction = (notification, action) => {
    console.log(`Executing action: ${action.action} for notification: ${notification.id}`)
    // In a real app, this would trigger the appropriate action
    // For now, we'll just mark the notification as read
    if (!notification.read) {
      setMockNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
    }
  }

  const handleMarkAsRead = (notificationId) => {
    setMockNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const handleToggleStar = (notificationId) => {
    setMockNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, starred: !n.starred } : n)
    )
  }

  const handleDeleteNotification = (notificationId) => {
    setMockNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const unreadNotifications = mockNotifications.filter(n => !n.read)

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6" />
        {unreadNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-16 right-4 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Notifications
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Close"
                  >
                    <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {[
                  { id: 'all', label: 'All', count: mockNotifications.length },
                  { id: 'unread', label: 'Unread', count: unreadNotifications.length },
                  { id: 'important', label: 'Important', count: mockNotifications.filter(n => n.starred || n.priority === 'high').length },
                  { id: 'system', label: 'System', count: mockNotifications.filter(n => n.category === 'system').length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`flex-1 py-1 px-2 rounded-md text-xs font-medium transition-colors ${
                      filter === tab.id
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-full px-1">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Actions */}
              {unreadNotifications.length > 0 && (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => {
                      setMockNotifications(prev => prev.map(n => ({ ...n, read: true })))
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Mark all as read
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {unreadNotifications.length} unread
                  </span>
                </div>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type, notification.category)
                    const colorClasses = getNotificationColor(notification.type)
                    const priorityClass = getPriorityColor(notification.priority)

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l-4 ${priorityClass} ${
                          !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Icon */}
                          <div className={`p-2 rounded-full ${colorClasses}`}>
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {notification.title}
                                  </h4>
                                  {notification.starred && (
                                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                  )}
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatTimestamp(notification.timestamp)}</span>
                                  <span className="capitalize">{notification.category}</span>
                                  {notification.priority === 'high' && (
                                    <span className="px-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded">
                                      High Priority
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions Menu */}
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleToggleStar(notification.id)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                  title={notification.starred ? 'Unstar' : 'Star'}
                                >
                                  <Star className={`h-3 w-3 ${
                                    notification.starred 
                                      ? 'text-yellow-500 fill-current' 
                                      : 'text-gray-400'
                                  }`} />
                                </button>
                                {!notification.read && (
                                  <button
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                    title="Mark as read"
                                  >
                                    <Check className="h-3 w-3 text-gray-400" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteNotification(notification.id)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3 text-gray-400" />
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex items-center space-x-2 mt-3">
                                {notification.actions.map((action, index) => (
                                  <button
                                    key={index}
                                    onClick={() => handleNotificationAction(notification, action)}
                                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                                      action.primary
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                                    }`}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 right-4 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Notification Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Email Notifications</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Push Notifications</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">SMS Notifications</span>
                <input type="checkbox" className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Sound Alerts</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                Save Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default NotificationCenter

