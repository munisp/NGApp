import React, { useState, useEffect, useRef } from 'react'
import { Bell, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, TrendingUp, Users, DollarSign, Shield } from 'lucide-react'

// Real-time WebSocket hook
export function useWebSocket(url, options = {}) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Disconnected')
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = options.maxReconnectAttempts || 5

  useEffect(() => {
    if (!url) return

    const connect = () => {
      try {
        const ws = new WebSocket(url)
        
        ws.onopen = () => {
          console.log('WebSocket connected')
          setIsConnected(true)
          setConnectionStatus('Connected')
          setSocket(ws)
          reconnectAttempts.current = 0
          
          // Send authentication if provided
          if (options.auth) {
            ws.send(JSON.stringify({ type: 'auth', token: options.auth }))
          }
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setLastMessage(data)
            
            // Call message handler if provided
            if (options.onMessage) {
              options.onMessage(data)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          setIsConnected(false)
          setSocket(null)
          
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            setConnectionStatus(`Reconnecting... (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)
            reconnectAttempts.current++
            
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            reconnectTimeoutRef.current = setTimeout(connect, delay)
          } else {
            setConnectionStatus('Disconnected')
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setConnectionStatus('Error')
        }

        setSocket(ws)
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        setConnectionStatus('Failed to connect')
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socket) {
        socket.close(1000, 'Component unmounting')
      }
    }
  }, [url])

  const sendMessage = (message) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message))
      return true
    }
    return false
  }

  return {
    socket,
    isConnected,
    lastMessage,
    connectionStatus,
    sendMessage
  }
}

// Real-time notifications component
export function RealTimeNotifications({ userRole }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Simulate WebSocket connection for demo
  const { isConnected, lastMessage } = useWebSocket(null, {
    onMessage: (data) => {
      if (data.type === 'notification') {
        addNotification(data.notification)
      }
    }
  })

  // Add notification
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      read: false,
      ...notification
    }
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]) // Keep last 10
    setUnreadCount(prev => prev + 1)
    
    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png'
      })
    }
  }

  // Simulate real-time notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const notificationTypes = {
        customer: [
          { title: 'Transaction Complete', message: 'Your deposit of ₦50,000 has been processed', type: 'success', icon: CheckCircle },
          { title: 'Security Alert', message: 'New device login detected', type: 'warning', icon: Shield },
          { title: 'Account Update', message: 'Your KYC verification is complete', type: 'info', icon: CheckCircle }
        ],
        agent: [
          { title: 'New Customer', message: 'Customer registration pending approval', type: 'info', icon: Users },
          { title: 'Cash Low', message: 'Agent cash balance below threshold', type: 'warning', icon: DollarSign },
          { title: 'Commission Earned', message: 'You earned ₦2,500 in commissions today', type: 'success', icon: TrendingUp }
        ],
        admin: [
          { title: 'System Alert', message: 'Fraud detection service degraded', type: 'error', icon: AlertTriangle },
          { title: 'High-Risk Transaction', message: 'Transaction of ₦500,000 flagged for review', type: 'warning', icon: Shield },
          { title: 'System Update', message: 'Daily reconciliation completed successfully', type: 'success', icon: CheckCircle }
        ]
      }

      const roleNotifications = notificationTypes[userRole] || notificationTypes.customer
      const randomNotification = roleNotifications[Math.floor(Math.random() * roleNotifications.length)]
      
      if (Math.random() < 0.3) { // 30% chance every 10 seconds
        addNotification(randomNotification)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [userRole])

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })))
    setUnreadCount(0)
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return CheckCircle
      case 'warning': return AlertTriangle
      case 'error': return AlertTriangle
      default: return Bell
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Connection Status */}
      <div className="absolute top-0 right-0 w-3 h-3">
        {isConnected ? (
          <div className="w-full h-full bg-green-500 rounded-full animate-pulse"></div>
        ) : (
          <div className="w-full h-full bg-red-500 rounded-full"></div>
        )}
      </div>

      {/* Notifications Panel */}
      {isVisible && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification.type)
                return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-100">
              <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Real-time metrics component
export function RealTimeMetrics({ userRole }) {
  const [metrics, setMetrics] = useState({
    transactions: 0,
    amount: 0,
    agents: 0,
    alerts: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  // Simulate real-time metrics updates
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(prev => ({
        transactions: prev.transactions + Math.floor(Math.random() * 5),
        amount: prev.amount + Math.floor(Math.random() * 100000),
        agents: prev.agents + (Math.random() > 0.8 ? 1 : 0),
        alerts: prev.alerts + (Math.random() > 0.9 ? 1 : 0)
      }))
    }

    // Initial load
    setTimeout(() => {
      setMetrics({
        transactions: 234567,
        amount: 15750000,
        agents: 1247,
        alerts: 12
      })
      setIsLoading(false)
    }, 1000)

    // Update every 5 seconds
    const interval = setInterval(updateMetrics, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-NG').format(num)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-4 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  const getMetricsForRole = () => {
    switch (userRole) {
      case 'customer':
        return [
          { label: 'Account Balance', value: formatCurrency(125000), icon: DollarSign, color: 'text-green-600' },
          { label: 'Transactions', value: formatNumber(47), icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Rewards Points', value: formatNumber(2340), icon: CheckCircle, color: 'text-purple-600' },
          { label: 'Notifications', value: formatNumber(3), icon: Bell, color: 'text-orange-600' }
        ]
      case 'agent':
        return [
          { label: 'Cash Balance', value: formatCurrency(500000), icon: DollarSign, color: 'text-green-600' },
          { label: 'Commission', value: formatCurrency(15750), icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Customers', value: formatNumber(47), icon: Users, color: 'text-purple-600' },
          { label: 'Rating', value: '4.8/5', icon: CheckCircle, color: 'text-orange-600' }
        ]
      default: // admin
        return [
          { label: 'Total Transactions', value: formatNumber(metrics.transactions), icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Total Amount', value: formatCurrency(metrics.amount), icon: DollarSign, color: 'text-green-600' },
          { label: 'Active Agents', value: formatNumber(metrics.agents), icon: Users, color: 'text-purple-600' },
          { label: 'Security Alerts', value: formatNumber(metrics.alerts), icon: AlertTriangle, color: 'text-red-600' }
        ]
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {getMetricsForRole().map((metric, index) => {
        const IconComponent = metric.icon
        return (
          <div key={index} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                <p className={`text-2xl font-bold ${metric.color} transition-all duration-500`}>
                  {metric.value}
                </p>
              </div>
              <div className={`p-3 rounded-full bg-gray-50 ${metric.color}`}>
                <IconComponent className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Real-time transaction feed
export function RealTimeTransactionFeed({ userRole }) {
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initial load
    setTimeout(() => {
      setTransactions([
        {
          id: 'TXN001',
          type: 'deposit',
          amount: 50000,
          customer: 'John Doe',
          agent: 'AG001',
          timestamp: new Date(),
          status: 'completed'
        },
        {
          id: 'TXN002',
          type: 'withdrawal',
          amount: 25000,
          customer: 'Jane Smith',
          agent: 'AG002',
          timestamp: new Date(Date.now() - 300000),
          status: 'processing'
        }
      ])
      setIsLoading(false)
    }, 1500)

    // Add new transactions periodically
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance
        const newTransaction = {
          id: `TXN${Date.now()}`,
          type: Math.random() > 0.5 ? 'deposit' : 'withdrawal',
          amount: Math.floor(Math.random() * 100000) + 10000,
          customer: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson'][Math.floor(Math.random() * 4)],
          agent: ['AG001', 'AG002', 'AG003', 'AG004'][Math.floor(Math.random() * 4)],
          timestamp: new Date(),
          status: Math.random() > 0.8 ? 'processing' : 'completed'
        }
        
        setTransactions(prev => [newTransaction, ...prev.slice(0, 9)]) // Keep last 10
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getTransactionIcon = (type) => {
    return type === 'deposit' ? TrendingUp : DollarSign
  }

  const getTransactionColor = (type) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
        <div className="flex items-center text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          Live Feed
        </div>
      </div>
      
      <div className="space-y-4">
        {transactions.map((transaction) => {
          const IconComponent = getTransactionIcon(transaction.type)
          return (
            <div key={transaction.id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className={`p-2 rounded-full bg-gray-50 ${getTransactionColor(transaction.type)}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {transaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'} - {transaction.customer}
                </p>
                <p className="text-sm text-gray-500">
                  Agent: {transaction.agent} • {transaction.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${getTransactionColor(transaction.type)}`}>
                  {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                  {transaction.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      
      {transactions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No recent transactions</p>
        </div>
      )}
    </div>
  )
}

export default {
  RealTimeNotifications,
  RealTimeMetrics,
  RealTimeTransactionFeed,
  useWebSocket
}

