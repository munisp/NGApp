import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Key,
  Mail,
  Phone,
  Building,
  CreditCard,
  Users,
  Lock,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Laptop,
  Server,
  Cloud,
  HardDrive,
  Wifi,
  Bluetooth,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNotification } from '../contexts/NotificationContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const Settings = () => {
  const { currentUser, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const { showNotification } = useNotification()
  
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Profile Settings
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@enterprise-crm.com',
    phone: '+1 (555) 123-4567',
    title: 'Sales Manager',
    department: 'Sales',
    company: 'Enterprise CRM Inc.',
    timezone: 'America/New_York',
    language: 'en',
    avatar: null
  })

  // Security Settings
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: true,
    sessionTimeout: 30,
    loginNotifications: true,
    deviceTrust: true
  })

  // Notification Settings
  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    soundAlerts: true,
    desktopNotifications: true,
    marketingEmails: false,
    weeklyReports: true,
    systemAlerts: true,
    leadNotifications: true,
    dealNotifications: true,
    taskReminders: true
  })

  // Appearance Settings
  const [appearanceData, setAppearanceData] = useState({
    theme: 'system',
    fontSize: 'medium',
    density: 'comfortable',
    sidebarCollapsed: false,
    animations: true,
    colorScheme: 'blue'
  })

  // Integration Settings
  const [integrationData, setIntegrationData] = useState({
    emailProvider: 'outlook',
    calendarSync: true,
    crmSync: true,
    slackIntegration: false,
    teamsIntegration: true,
    zapierWebhooks: false,
    apiAccess: true
  })

  // System Settings
  const [systemData, setSystemData] = useState({
    dataRetention: 365,
    backupFrequency: 'daily',
    auditLogging: true,
    performanceMode: 'balanced',
    cacheEnabled: true,
    compressionEnabled: true,
    debugMode: false
  })

  useEffect(() => {
    // Load user settings from API
    const loadSettings = async () => {
      setLoading(true)
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Settings would be loaded here
      } catch (error) {
        showNotification('Failed to load settings', 'error')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSaveSettings = async (section) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      switch (section) {
        case 'profile':
          await updateProfile(profileData)
          break
        case 'security':
          // Handle security updates
          break
        case 'notifications':
          // Handle notification preferences
          break
        case 'appearance':
          // Handle appearance settings
          if (appearanceData.theme !== theme) {
            setTheme(appearanceData.theme)
          }
          break
        case 'integrations':
          // Handle integration settings
          break
        case 'system':
          // Handle system settings
          break
      }
      
      setUnsavedChanges(false)
      showNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`, 'success')
    } catch (error) {
      showNotification(`Failed to save ${section} settings`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const SettingCard = ({ title, description, children, action }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {action && action}
      </div>
      {children}
    </div>
  )

  const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false, icon: Icon }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
            Icon ? 'pl-12' : ''
          }`}
        />
      </div>
    </div>
  )

  const ToggleSwitch = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'system', label: 'System', icon: Server }
  ]

  return (
    <div role="region" aria-label="Settings"  className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account preferences and system configuration
          </p>
        </div>
        {unsavedChanges && (
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">You have unsaved changes</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="Personal Information"
                description="Update your personal details and contact information"
                action={
                  <button
                    onClick={() => handleSaveSettings('profile')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="First Name"
                    value={profileData.firstName}
                    onChange={(e) => {
                      setProfileData({ ...profileData, firstName: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    required
                    icon={User}
                  />
                  <InputField
                    label="Last Name"
                    value={profileData.lastName}
                    onChange={(e) => {
                      setProfileData({ ...profileData, lastName: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    required
                    icon={User}
                  />
                  <InputField
                    label="Email Address"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => {
                      setProfileData({ ...profileData, email: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    required
                    icon={Mail}
                  />
                  <InputField
                    label="Phone Number"
                    value={profileData.phone}
                    onChange={(e) => {
                      setProfileData({ ...profileData, phone: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    icon={Phone}
                  />
                  <InputField
                    label="Job Title"
                    value={profileData.title}
                    onChange={(e) => {
                      setProfileData({ ...profileData, title: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    icon={Building}
                  />
                  <InputField
                    label="Department"
                    value={profileData.department}
                    onChange={(e) => {
                      setProfileData({ ...profileData, department: e.target.value })
                      setUnsavedChanges(true)
                    }}
                    icon={Building}
                  />
                </div>
              </SettingCard>

              <SettingCard
                title="Preferences"
                description="Configure your regional and language preferences"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={profileData.timezone}
                      onChange={(e) => {
                        setProfileData({ ...profileData, timezone: e.target.value })
                        setUnsavedChanges(true)
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      value={profileData.language}
                      onChange={(e) => {
                        setProfileData({ ...profileData, language: e.target.value })
                        setUnsavedChanges(true)
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="Password & Authentication"
                description="Manage your password and two-factor authentication"
                action={
                  <button
                    onClick={() => handleSaveSettings('security')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={securityData.currentPassword}
                          onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <InputField
                      label="New Password"
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      icon={Key}
                    />
                    <InputField
                      label="Confirm Password"
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      icon={Key}
                    />
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <ToggleSwitch
                      label="Two-Factor Authentication"
                      description="Add an extra layer of security to your account"
                      checked={securityData.twoFactorEnabled}
                      onChange={(checked) => setSecurityData({ ...securityData, twoFactorEnabled: checked })}
                    />
                    <ToggleSwitch
                      label="Login Notifications"
                      description="Get notified when someone logs into your account"
                      checked={securityData.loginNotifications}
                      onChange={(checked) => setSecurityData({ ...securityData, loginNotifications: checked })}
                    />
                    <ToggleSwitch
                      label="Device Trust"
                      description="Remember trusted devices for faster login"
                      checked={securityData.deviceTrust}
                      onChange={(checked) => setSecurityData({ ...securityData, deviceTrust: checked })}
                    />
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                title="Session Management"
                description="Control how long you stay logged in"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <select
                    value={securityData.sessionTimeout}
                    onChange={(e) => setSecurityData({ ...securityData, sessionTimeout: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={480}>8 hours</option>
                  </select>
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="Notification Preferences"
                description="Choose how you want to be notified about important events"
                action={
                  <button
                    onClick={() => handleSaveSettings('notifications')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Delivery Methods</h4>
                    <div className="space-y-3">
                      <ToggleSwitch
                        label="Email Notifications"
                        description="Receive notifications via email"
                        checked={notificationData.emailNotifications}
                        onChange={(checked) => setNotificationData({ ...notificationData, emailNotifications: checked })}
                      />
                      <ToggleSwitch
                        label="Push Notifications"
                        description="Receive push notifications in your browser"
                        checked={notificationData.pushNotifications}
                        onChange={(checked) => setNotificationData({ ...notificationData, pushNotifications: checked })}
                      />
                      <ToggleSwitch
                        label="SMS Notifications"
                        description="Receive important alerts via SMS"
                        checked={notificationData.smsNotifications}
                        onChange={(checked) => setNotificationData({ ...notificationData, smsNotifications: checked })}
                      />
                      <ToggleSwitch
                        label="Sound Alerts"
                        description="Play sound for new notifications"
                        checked={notificationData.soundAlerts}
                        onChange={(checked) => setNotificationData({ ...notificationData, soundAlerts: checked })}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Notification Types</h4>
                    <div className="space-y-3">
                      <ToggleSwitch
                        label="Lead Notifications"
                        description="New leads and lead updates"
                        checked={notificationData.leadNotifications}
                        onChange={(checked) => setNotificationData({ ...notificationData, leadNotifications: checked })}
                      />
                      <ToggleSwitch
                        label="Deal Notifications"
                        description="Deal progress and closures"
                        checked={notificationData.dealNotifications}
                        onChange={(checked) => setNotificationData({ ...notificationData, dealNotifications: checked })}
                      />
                      <ToggleSwitch
                        label="Task Reminders"
                        description="Upcoming tasks and deadlines"
                        checked={notificationData.taskReminders}
                        onChange={(checked) => setNotificationData({ ...notificationData, taskReminders: checked })}
                      />
                      <ToggleSwitch
                        label="System Alerts"
                        description="System maintenance and updates"
                        checked={notificationData.systemAlerts}
                        onChange={(checked) => setNotificationData({ ...notificationData, systemAlerts: checked })}
                      />
                      <ToggleSwitch
                        label="Weekly Reports"
                        description="Weekly performance summaries"
                        checked={notificationData.weeklyReports}
                        onChange={(checked) => setNotificationData({ ...notificationData, weeklyReports: checked })}
                      />
                    </div>
                  </div>
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="Theme & Display"
                description="Customize the look and feel of your interface"
                action={
                  <button
                    onClick={() => handleSaveSettings('appearance')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'system', label: 'System', icon: Monitor }
                      ].map(themeOption => {
                        const Icon = themeOption.icon
                        return (
                          <button
                            key={themeOption.id}
                            onClick={() => {
                              setAppearanceData({ ...appearanceData, theme: themeOption.id })
                              setUnsavedChanges(true)
                            }}
                            className={`p-4 border-2 rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                              appearanceData.theme === themeOption.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {themeOption.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Size
                      </label>
                      <select
                        value={appearanceData.fontSize}
                        onChange={(e) => {
                          setAppearanceData({ ...appearanceData, fontSize: e.target.value })
                          setUnsavedChanges(true)
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Density
                      </label>
                      <select
                        value={appearanceData.density}
                        onChange={(e) => {
                          setAppearanceData({ ...appearanceData, density: e.target.value })
                          setUnsavedChanges(true)
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <ToggleSwitch
                      label="Sidebar Collapsed"
                      description="Start with sidebar collapsed by default"
                      checked={appearanceData.sidebarCollapsed}
                      onChange={(checked) => {
                        setAppearanceData({ ...appearanceData, sidebarCollapsed: checked })
                        setUnsavedChanges(true)
                      }}
                    />
                    <ToggleSwitch
                      label="Animations"
                      description="Enable smooth animations and transitions"
                      checked={appearanceData.animations}
                      onChange={(checked) => {
                        setAppearanceData({ ...appearanceData, animations: checked })
                        setUnsavedChanges(true)
                      }}
                    />
                  </div>
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Integration Settings */}
          {activeTab === 'integrations' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="Third-Party Integrations"
                description="Connect with external services and applications"
                action={
                  <button
                    onClick={() => handleSaveSettings('integrations')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="space-y-4">
                  <ToggleSwitch
                    label="Calendar Sync"
                    description="Sync meetings and events with your calendar"
                    checked={integrationData.calendarSync}
                    onChange={(checked) => setIntegrationData({ ...integrationData, calendarSync: checked })}
                  />
                  <ToggleSwitch
                    label="CRM Sync"
                    description="Synchronize data with external CRM systems"
                    checked={integrationData.crmSync}
                    onChange={(checked) => setIntegrationData({ ...integrationData, crmSync: checked })}
                  />
                  <ToggleSwitch
                    label="Slack Integration"
                    description="Receive notifications in Slack"
                    checked={integrationData.slackIntegration}
                    onChange={(checked) => setIntegrationData({ ...integrationData, slackIntegration: checked })}
                  />
                  <ToggleSwitch
                    label="Microsoft Teams"
                    description="Connect with Microsoft Teams"
                    checked={integrationData.teamsIntegration}
                    onChange={(checked) => setIntegrationData({ ...integrationData, teamsIntegration: checked })}
                  />
                  <ToggleSwitch
                    label="Zapier Webhooks"
                    description="Enable webhooks for Zapier automation"
                    checked={integrationData.zapierWebhooks}
                    onChange={(checked) => setIntegrationData({ ...integrationData, zapierWebhooks: checked })}
                  />
                  <ToggleSwitch
                    label="API Access"
                    description="Allow API access for custom integrations"
                    checked={integrationData.apiAccess}
                    onChange={(checked) => setIntegrationData({ ...integrationData, apiAccess: checked })}
                  />
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SettingCard
                title="System Configuration"
                description="Advanced system settings and performance options"
                action={
                  <button
                    onClick={() => handleSaveSettings('system')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                }
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data Retention (days)
                      </label>
                      <select
                        value={systemData.dataRetention}
                        onChange={(e) => setSystemData({ ...systemData, dataRetention: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value={90}>90 days</option>
                        <option value={180}>180 days</option>
                        <option value={365}>1 year</option>
                        <option value={730}>2 years</option>
                        <option value={-1}>Forever</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Backup Frequency
                      </label>
                      <select
                        value={systemData.backupFrequency}
                        onChange={(e) => setSystemData({ ...systemData, backupFrequency: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <ToggleSwitch
                      label="Audit Logging"
                      description="Log all user actions for security auditing"
                      checked={systemData.auditLogging}
                      onChange={(checked) => setSystemData({ ...systemData, auditLogging: checked })}
                    />
                    <ToggleSwitch
                      label="Cache Enabled"
                      description="Enable caching for better performance"
                      checked={systemData.cacheEnabled}
                      onChange={(checked) => setSystemData({ ...systemData, cacheEnabled: checked })}
                    />
                    <ToggleSwitch
                      label="Compression"
                      description="Enable data compression to save bandwidth"
                      checked={systemData.compressionEnabled}
                      onChange={(checked) => setSystemData({ ...systemData, compressionEnabled: checked })}
                    />
                    <ToggleSwitch
                      label="Debug Mode"
                      description="Enable debug mode for troubleshooting"
                      checked={systemData.debugMode}
                      onChange={(checked) => setSystemData({ ...systemData, debugMode: checked })}
                    />
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                title="Data Management"
                description="Import, export, and manage your data"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Import Data</span>
                  </button>
                  <button className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">Export Data</span>
                  </button>
                  <button className="flex items-center justify-center space-x-2 px-4 py-3 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="h-5 w-5" />
                    <span>Clear Data</span>
                  </button>
                </div>
              </SettingCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings

