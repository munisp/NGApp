import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Building,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Globe,
  Smartphone,
  Key
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

const Login = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [loginMethod, setLoginMethod] = useState('email') // email, sso, mfa
  const [step, setStep] = useState('credentials') // credentials, mfa, success
  const [mfaCode, setMfaCode] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock authentication logic
      if (formData.email === 'admin@enterprise-crm.com' && formData.password === 'password') {
        if (loginMethod === 'mfa') {
          setStep('mfa')
          showNotification('MFA code sent to your device', 'info')
        } else {
          await login({
            email: formData.email,
            name: 'Enterprise Admin',
            role: 'Administrator',
            permissions: ['read', 'write', 'admin']
          })
          setStep('success')
          showNotification('Login successful!', 'success')
          setTimeout(() => navigate('/dashboard'), 1000)
        }
      } else {
        setErrors({ general: 'Invalid email or password' })
        showNotification('Login failed. Please check your credentials.', 'error')
      }
    } catch (error) {
      setErrors({ general: 'An error occurred. Please try again.' })
      showNotification('Login failed. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e) => {
    e.preventDefault()
    
    if (!mfaCode || mfaCode.length !== 6) {
      setErrors({ mfa: 'Please enter a valid 6-digit code' })
      return
    }

    setLoading(true)
    
    try {
      // Simulate MFA verification
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (mfaCode === '123456') {
        await login({
          email: formData.email,
          name: 'Enterprise Admin',
          role: 'Administrator',
          permissions: ['read', 'write', 'admin']
        })
        setStep('success')
        showNotification('MFA verification successful!', 'success')
        setTimeout(() => navigate('/dashboard'), 1000)
      } else {
        setErrors({ mfa: 'Invalid MFA code' })
        showNotification('Invalid MFA code. Please try again.', 'error')
      }
    } catch (error) {
      setErrors({ mfa: 'MFA verification failed. Please try again.' })
      showNotification('MFA verification failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSSOLogin = async (provider) => {
    setLoading(true)
    
    try {
      // Simulate SSO redirect
      await new Promise(resolve => setTimeout(resolve, 2000))
      showNotification(`Redirecting to ${provider} for authentication...`, 'info')
      
      // Mock successful SSO login
      await login({
        email: `user@${provider.toLowerCase()}.com`,
        name: `${provider} User`,
        role: 'User',
        permissions: ['read', 'write']
      })
      
      navigate('/dashboard')
    } catch (error) {
      showNotification(`${provider} authentication failed.`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to Enterprise CRM!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have successfully logged in. Redirecting to your dashboard...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-white space-y-8 hidden lg:block"
        >
          <div>
            <h1 className="text-5xl font-bold mb-4">Enterprise CRM</h1>
            <p className="text-xl text-blue-100 mb-8">
              Comprehensive customer relationship management platform for modern businesses
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Customer Management</h3>
                <p className="text-blue-100">Manage your entire customer lifecycle</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Sales Pipeline</h3>
                <p className="text-blue-100">Track opportunities and close more deals</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Enterprise Security</h3>
                <p className="text-blue-100">Bank-level security and compliance</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {step === 'mfa' ? 'Two-Factor Authentication' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 'mfa' 
                ? 'Enter the verification code sent to your device'
                : 'Sign in to your Enterprise CRM account'
              }
            </p>
          </div>

          {/* Login Method Selector */}
          {step === 'credentials' && (
            <div className="flex space-x-2 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'email'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Mail className="h-4 w-4 inline mr-2" />
                Email
              </button>
              <button
                onClick={() => setLoginMethod('sso')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'sso'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Globe className="h-4 w-4 inline mr-2" />
                SSO
              </button>
              <button
                onClick={() => setLoginMethod('mfa')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'mfa'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Smartphone className="h-4 w-4 inline mr-2" />
                MFA
              </button>
            </div>
          )}

          {/* Error Message */}
          {errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2"
            >
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300 text-sm">{errors.general}</span>
            </motion.div>
          )}

          {/* MFA Step */}
          {step === 'mfa' && (
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className={inputClasses}
                    maxLength={6}
                  />
                </div>
                {errors.mfa && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.mfa}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
              >
                Back to login
              </button>
            </form>
          )}

          {/* Email Login */}
          {step === 'credentials' && loginMethod === 'email' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                    className={inputClasses}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter your password"
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* SSO Login */}
          {step === 'credentials' && loginMethod === 'sso' && (
            <div className="space-y-4">
              <button
                onClick={() => handleSSOLogin('KeyCloak')}
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <Globe className="h-5 w-5" />
                <span>Continue with KeyCloak</span>
              </button>

              <button
                onClick={() => handleSSOLogin('Microsoft')}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <Building className="h-5 w-5" />
                <span>Continue with Microsoft</span>
              </button>

              <button
                onClick={() => handleSSOLogin('Google')}
                disabled={loading}
                className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <Globe className="h-5 w-5" />
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Demo Credentials</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Email: admin@enterprise-crm.com<br />
              Password: password<br />
              MFA Code: 123456
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Login

