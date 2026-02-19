import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  Menu,
  X,
  Home,
  TrendingUp,
  Shield,
  Wallet,
  FileText,
  UserCheck
} from 'lucide-react'

// Import components
import Dashboard from './components/Dashboard/Dashboard'
import AgentManagement from './components/Agents/AgentManagement'
import TransactionManagement from './components/Transactions/TransactionManagement'
import Reports from './components/Reports/Reports'
import Settings from './components/Settings/Settings'
import { useAuth } from './hooks/useAuth'
import { cn } from './lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Agent Network', href: '/agents', icon: Users, badge: 12 },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Performance', href: '/performance', icon: TrendingUp },
  { name: 'Compliance', href: '/compliance', icon: Shield },
  { name: 'Float Management', href: '/float', icon: Wallet },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'KYC Management', href: '/kyc', icon: UserCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState(5)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const location = useLocation()
  const { user, isAuthenticated, isLoading, login, loginWithKeycloak, logout } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      await login(loginForm)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed')
    }
  }

  const currentPage = navigation.find(item => item.href === location.pathname)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div>
            <div className="flex justify-center">
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">AB</span>
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Agent Portal
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to your agent account
            </p>
          </div>
          
          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="agent@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign In
              </button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div>
            <button
              onClick={loginWithKeycloak}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Sign in with SSO (Keycloak)
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AB</span>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">Agent Portal</h1>
            </div>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                    )}
                  />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {item.badge}
                    </span>
                  )}
                </a>
              )
            })}
          </div>
        </nav>

        {/* Agent Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">JD</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.agentLevel}</p>
              <p className="text-xs text-gray-500">{user?.location}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center">
              <button
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6 text-gray-400" />
              </button>
              <div className="ml-4 lg:ml-0">
                <h1 className="text-xl font-semibold text-gray-900">
                  {currentPage?.name || 'Dashboard'}
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search transactions, agents..."
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-500">
                <Bell className="h-6 w-6" />
                {notifications > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">JD</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents" element={<AgentManagement />} />
                <Route path="/transactions" element={<TransactionManagement />} />
                <Route path="/performance" element={<Reports />} />
                <Route path="/compliance" element={<Reports />} />
                <Route path="/float" element={<Reports />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/kyc" element={<Reports />} />
                <Route path="/analytics" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Toaster position="top-right" />
    </div>
  )
}

export default App

