import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

// Components
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import CustomerManagement from './components/CustomerManagement'
import CRMCore from './components/CRMCore'
import InventoryManagement from './components/InventoryManagement'
import Analytics from './components/Analytics'
import Settings from './components/Settings'
import Login from './components/Login'
import NotificationCenter from './components/NotificationCenter'

// Unified CRM Hub Components
import UnifiedDashboard from './components/UnifiedDashboard'
import Customer360 from './components/Customer360'
import CoreBankingView from './components/CoreBankingView'
import AgentBankingView from './components/AgentBankingView'
import RemittanceView from './components/RemittanceView'
import IntegrationHub from './components/IntegrationHub'
import CrossSystemAnalytics from './components/CrossSystemAnalytics'
import CampaignManager from './components/CampaignManager'

// Enhancement Components
import RealTimeDashboard from './components/RealTimeDashboard'
import JourneyOrchestrator from './components/JourneyOrchestrator'
import ChurnPrevention from './components/ChurnPrevention'
import ConversationalFlows from './components/ConversationalFlows'
import GeoTargeting from './components/GeoTargeting'
import ABTestAutomation from './components/ABTestAutomation'
import ConsentCompliance from './components/ConsentCompliance'
import NotificationPreferences from './components/NotificationPreferences'
import RevenueAttribution from './components/RevenueAttribution'
import AgentGamification from './components/AgentGamification'
import TenantAdmin from './components/TenantAdmin'

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { TenantProvider } from './contexts/TenantContext'

// Layout Component
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
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
          </div>
        </main>
      </div>
      <NotificationCenter />
    </div>
  )
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />
}

// Main App Component
function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

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
          <p className="text-xl text-blue-100">Connecting Core Banking • Agent Banking • Remittance</p>
        </motion.div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
        <NotificationProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UnifiedDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hub"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UnifiedDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer-360"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Customer360 />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/core-banking"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CoreBankingView />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agent-banking"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AgentBankingView />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/remittance"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RemittanceView />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/integrations"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <IntegrationHub />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cross-analytics"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CrossSystemAnalytics />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CustomerManagement />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CRMCore />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <InventoryManagement />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Analytics />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campaigns"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CampaignManager />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Settings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/realtime"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RealTimeDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/journeys"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <JourneyOrchestrator />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/churn"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ChurnPrevention />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/conversational"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ConversationalFlows />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/geo-targeting"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <GeoTargeting />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ab-testing"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ABTestAutomation />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compliance"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ConsentCompliance />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/preferences"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <NotificationPreferences />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/revenue"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RevenueAttribution />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gamification"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AgentGamification />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tenant-admin"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <TenantAdmin />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </Router>
        </NotificationProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

