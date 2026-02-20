import { useState, Component } from 'react'
import { Download, X, Smartphone, Monitor, Wifi, WifiOff, Bell } from 'lucide-react'
import { useInstallPrompt, useOnlineStatus, usePushNotifications } from '../hooks/usePWA'

class PWAErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    console.warn('PWA component error caught:', error.message)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const Button = ({ children, variant = 'default', size = 'default', className = '', onClick, disabled, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50',
    ghost: 'hover:bg-gray-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700'
  }
  const sizes = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10'
  }
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'border border-gray-300 text-gray-700'
  }
  
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}

function PWAInstallPromptInner() {
  const { isInstallable, isInstalled, installApp } = useInstallPrompt()
  const { isOnline, connectionType, isSlowConnection } = useOnlineStatus()
  const { isSupported: pushSupported, permission, requestPermission, subscribe } = usePushNotifications()
  const [isVisible, setIsVisible] = useState(true)
  const [isInstalling, setIsInstalling] = useState(false)

  if (isInstalled || !isInstallable || !isVisible) {
    return null
  }

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      const success = await installApp()
      if (success) {
        setIsVisible(false)
      }
    } catch (error) {
      console.error('Installation failed:', error)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleEnableNotifications = async () => {
    if (pushSupported && permission !== 'granted') {
      const granted = await requestPermission()
      if (granted) {
        await subscribe()
      }
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-6 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={() => setIsVisible(false)}
        >
          <X className="w-4 h-4" />
        </Button>

        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Install Agent Banking App
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Get the full mobile banking experience with offline capabilities, 
              push notifications, and faster access to your account.
            </p>

            {/* Features */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-sm">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-gray-600">
                  {isOnline ? 'Online' : 'Offline'} banking capabilities
                </span>
                {isSlowConnection && (
                  <Badge variant="warning">Slow connection</Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Bell className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">Real-time notifications</span>
                {permission === 'granted' ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Available</Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Monitor className="w-4 h-4 text-purple-500" />
                <span className="text-gray-600">Native app experience</span>
                <Badge variant="success">PWA</Badge>
              </div>
            </div>

            {/* Connection info */}
            {isOnline && connectionType !== 'unknown' && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  Connection: {connectionType.toUpperCase()}
                  {isSlowConnection && ' - App will work offline when needed'}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col space-y-2">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {isInstalling ? 'Installing...' : 'Install App'}
              </Button>
              
              {pushSupported && permission !== 'granted' && (
                <Button
                  variant="outline"
                  onClick={handleEnableNotifications}
                  className="w-full"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Enable Notifications
                </Button>
              )}
            </div>

            {/* Benefits */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                ✓ Works offline • ✓ Faster loading • ✓ Home screen access • ✓ Push notifications
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PWAInstallPrompt() {
  return (
    <PWAErrorBoundary>
      <PWAInstallPromptInner />
    </PWAErrorBoundary>
  )
}

function PWAStatusIndicatorInner() {
  const { isInstalled } = useInstallPrompt()
  const { isOnline, connectionType } = useOnlineStatus()
  
  if (!isInstalled) return null

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center space-x-2">
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500" />
        )}
        <span className="text-xs font-medium text-gray-700">
          {isOnline ? `Online (${connectionType})` : 'Offline Mode'}
        </span>
        <Badge variant={isOnline ? 'success' : 'warning'} className="text-xs">
          PWA
        </Badge>
      </div>
    </div>
  )
}

export function PWAStatusIndicator() {
  return (
    <PWAErrorBoundary>
      <PWAStatusIndicatorInner />
    </PWAErrorBoundary>
  )
}

function OfflineBannerInner() {
  const { isOnline } = useOnlineStatus()
  
  if (isOnline) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
      <div className="flex items-center justify-center space-x-2">
        <WifiOff className="w-5 h-5 text-yellow-600" />
        <p className="text-sm font-medium text-yellow-800">
          You're currently offline. Some features may be limited.
        </p>
        <Badge variant="warning">Offline Mode</Badge>
      </div>
    </div>
  )
}

export function OfflineBanner() {
  return (
    <PWAErrorBoundary>
      <OfflineBannerInner />
    </PWAErrorBoundary>
  )
}

export default PWAInstallPrompt

