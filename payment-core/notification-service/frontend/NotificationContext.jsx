import { createContext, useContext, useState, useEffect } from 'react'
import { NovuProvider, PopoverNotificationCenter, NotificationBell } from '@novu/notification-center'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  // Novu configuration
  const novuConfig = {
    applicationIdentifier: process.env.REACT_APP_NOVU_APP_ID || 'enterprise-crm-notifications',
    subscriberId: 'user-123', // This should come from auth context
    apiUrl: process.env.REACT_APP_NOVU_API_URL || 'https://api.novu.co',
  }

  useEffect(() => {
    // Initialize notification system
    initializeNotifications()
  }, [])

  const initializeNotifications = () => {
    // Mock notifications for demo
    const mockNotifications = [
      {
        id: '1',
        title: 'New Customer Registration',
        message: 'John Doe has registered as a new customer',
        type: 'customer',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        read: false,
        priority: 'medium',
        actions: [
          { label: 'View Customer', action: 'view_customer', data: { customerId: '123' } },
          { label: 'Send Welcome Email', action: 'send_welcome', data: { customerId: '123' } }
        ]
      },
      {
        id: '2',
        title: 'High-Value Opportunity',
        message: 'New opportunity worth $50,000 created by Sarah Johnson',
        type: 'opportunity',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        read: false,
        priority: 'high',
        actions: [
          { label: 'View Opportunity', action: 'view_opportunity', data: { opportunityId: '456' } }
        ]
      },
      {
        id: '3',
        title: 'Low Stock Alert',
        message: 'Product "Premium Widget" is running low (5 units remaining)',
        type: 'inventory',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        read: true,
        priority: 'high',
        actions: [
          { label: 'Reorder Stock', action: 'reorder_stock', data: { productId: '789' } },
          { label: 'View Inventory', action: 'view_inventory', data: { productId: '789' } }
        ]
      },
      {
        id: '4',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will begin at 2:00 AM UTC',
        type: 'system',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        read: false,
        priority: 'low',
        actions: []
      },
      {
        id: '5',
        title: 'Monthly Report Ready',
        message: 'Your monthly sales report is ready for review',
        type: 'report',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        read: false,
        priority: 'medium',
        actions: [
          { label: 'View Report', action: 'view_report', data: { reportId: 'monthly-sales-2024-01' } }
        ]
      }
    ]

    setNotifications(mockNotifications)
    setUnreadCount(mockNotifications.filter(n => !n.read).length)
  }

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
      priority: 'medium',
      actions: [],
      ...notification,
    }

    setNotifications(prev => [newNotification, ...prev])
    setUnreadCount(prev => prev + 1)

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: newNotification.id,
      })
    }
  }

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    )
    setUnreadCount(0)
  }

  const removeNotification = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleAction = (action, data) => {
    switch (action) {
      case 'view_customer':
        window.location.href = `/customers/${data.customerId}`
        break
      case 'view_opportunity':
        window.location.href = `/crm/opportunities/${data.opportunityId}`
        break
      case 'view_inventory':
        window.location.href = `/inventory/products/${data.productId}`
        break
      case 'view_report':
        window.location.href = `/analytics/reports/${data.reportId}`
        break
      case 'send_welcome':
        // Trigger welcome email workflow
        console.log('Sending welcome email to customer:', data.customerId)
        break
      case 'reorder_stock':
        // Trigger reorder workflow
        console.log('Reordering stock for product:', data.productId)
        break
      default:
        console.log('Unknown action:', action, data)
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return false
  }

  const value = {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    handleAction,
    requestNotificationPermission,
    novuConfig,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Novu Notification Center Component
export const NovuNotificationCenter = () => {
  const { novuConfig } = useNotifications()

  return (
    <NovuProvider
      subscriberId={novuConfig.subscriberId}
      applicationIdentifier={novuConfig.applicationIdentifier}
      initialFetchingStrategy={{
        fetchNotifications: true,
        fetchUserPreferences: true,
      }}
    >
      <PopoverNotificationCenter colorScheme="light">
        {({ unseenCount }) => (
          <NotificationBell unseenCount={unseenCount} />
        )}
      </PopoverNotificationCenter>
    </NovuProvider>
  )
}

