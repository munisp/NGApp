import { useState, useEffect, createContext, useContext, useCallback } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: 'agent' | 'super_agent' | 'master_agent' | 'admin' | 'trainee' | 'sub_agent'
  agentLevel: string
  location: string
  permissions?: string[]
  avatar?: string
  keycloakId?: string
}

interface AuthConfig {
  keycloakUrl: string
  realm: string
  clientId: string
  apiUrl: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  loginWithKeycloak: () => void
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
  hasPermission: (permission: string) => boolean
  refreshToken: () => Promise<boolean>
}

interface LoginCredentials {
  email: string
  password: string
}

interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in: number
  token_type: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const getAuthConfig = (): AuthConfig => ({
  keycloakUrl: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'agent-banking',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'agent-portal',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8111'
})

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const config = getAuthConfig()

  useEffect(() => {
    const initAuth = async () => {
      // Check for Keycloak callback (authorization code flow)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        await handleKeycloakCallback(code)
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }

      // Check for stored authentication on mount
      const storedUser = localStorage.getItem('agent_portal_user')
      const storedToken = localStorage.getItem('agent_portal_token')
      const tokenExpiry = localStorage.getItem('agent_portal_token_expiry')
      
      if (storedUser && storedToken) {
        // Check if token is expired
        if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
          const refreshed = await refreshToken()
          if (!refreshed) {
            clearAuthData()
            setIsLoading(false)
            return
          }
        }
        
        try {
          const userData = JSON.parse(storedUser)
          setUser(userData)
        } catch (error) {
          console.error('Error parsing stored user data:', error)
          clearAuthData()
        }
      }
      
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const clearAuthData = () => {
    localStorage.removeItem('agent_portal_user')
    localStorage.removeItem('agent_portal_token')
    localStorage.removeItem('agent_portal_refresh_token')
    localStorage.removeItem('agent_portal_token_expiry')
  }

  const handleKeycloakCallback = async (code: string) => {
    try {
      setIsLoading(true)
      
      // Exchange authorization code for tokens
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          code: code,
          redirect_uri: window.location.origin + window.location.pathname,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to exchange authorization code')
      }

      const tokenResponse: KeycloakTokenResponse = await response.json()
      await processTokenResponse(tokenResponse)
    } catch (error) {
      console.error('Keycloak callback error:', error)
      clearAuthData()
    } finally {
      setIsLoading(false)
    }
  }

  const processTokenResponse = async (tokenResponse: KeycloakTokenResponse) => {
    const { access_token, refresh_token, expires_in } = tokenResponse
    
    // Decode JWT to get user info
    const payload = JSON.parse(atob(access_token.split('.')[1]))
    
    // Fetch user profile from backend
    const userProfile = await fetchUserProfile(access_token, payload.sub)
    
    const userData: User = {
      id: userProfile?.id || payload.sub,
      name: payload.name || payload.preferred_username || 'Agent User',
      email: payload.email || '',
      role: userProfile?.role || mapKeycloakRoles(payload.realm_access?.roles || []),
      agentLevel: userProfile?.agentLevel || payload.agent_level || 'Agent',
      location: userProfile?.location || payload.location || '',
      permissions: userProfile?.permissions || payload.permissions || [],
      keycloakId: payload.sub,
    }

    // Store tokens and user data
    localStorage.setItem('agent_portal_token', access_token)
    localStorage.setItem('agent_portal_refresh_token', refresh_token)
    localStorage.setItem('agent_portal_token_expiry', String(Date.now() + expires_in * 1000))
    localStorage.setItem('agent_portal_user', JSON.stringify(userData))
    
    setUser(userData)
  }

  const fetchUserProfile = async (token: string, keycloakId: string) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/v1/agents/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Keycloak-ID': keycloakId,
        },
      })
      
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
    }
    return null
  }

  const mapKeycloakRoles = (roles: string[]): User['role'] => {
    if (roles.includes('master_agent')) return 'master_agent'
    if (roles.includes('super_agent')) return 'super_agent'
    if (roles.includes('admin')) return 'admin'
    if (roles.includes('sub_agent')) return 'sub_agent'
    if (roles.includes('trainee')) return 'trainee'
    return 'agent'
  }

  const loginWithKeycloak = () => {
    const authUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/auth`
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: window.location.origin + window.location.pathname,
      response_type: 'code',
      scope: 'openid profile email',
    })
    
    window.location.href = `${authUrl}?${params.toString()}`
  }

  const refreshToken = async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem('agent_portal_refresh_token')
    if (!storedRefreshToken) return false

    try {
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          refresh_token: storedRefreshToken,
        }),
      })

      if (!response.ok) return false

      const tokenResponse: KeycloakTokenResponse = await response.json()
      await processTokenResponse(tokenResponse)
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setIsLoading(true)
      
      // Direct login via Keycloak Resource Owner Password Credentials
      const tokenUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: config.clientId,
          username: credentials.email,
          password: credentials.password,
          scope: 'openid profile email',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error_description || 'Authentication failed')
      }

      const tokenResponse: KeycloakTokenResponse = await response.json()
      await processTokenResponse(tokenResponse)
      
    } catch (error) {
      console.error('Login error:', error)
      throw new Error(error instanceof Error ? error.message : 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true)
      
      // Clear stored data
      localStorage.removeItem('agent_portal_user')
      localStorage.removeItem('agent_portal_token')
      
      // Clear user state
      setUser(null)
      
      // In a real app, this would make an API call to invalidate the session
      await new Promise(resolve => setTimeout(resolve, 500))
      
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('agent_portal_user', JSON.stringify(updatedUser))
    }
  }

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false
    return user.permissions.includes(permission) || user.permissions.includes('*')
  }

  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'master_agent':
        return [
          '*', // All permissions
          'view_all_agents',
          'manage_agents',
          'view_all_transactions',
          'manage_transactions',
          'view_reports',
          'manage_float',
          'view_analytics',
          'manage_compliance',
          'view_system_health'
        ]
      case 'super_agent':
        return [
          'view_network_agents',
          'manage_sub_agents',
          'view_network_transactions',
          'manage_network_transactions',
          'view_network_reports',
          'manage_network_float',
          'view_network_analytics',
          'view_compliance'
        ]
      case 'agent':
        return [
          'view_own_profile',
          'view_own_transactions',
          'manage_own_transactions',
          'view_own_customers',
          'manage_own_customers',
          'view_own_reports',
          'manage_own_float'
        ]
      case 'admin':
        return [
          '*', // All permissions
          'system_admin',
          'user_management',
          'system_configuration',
          'audit_logs',
          'security_management'
        ]
      default:
        return ['view_own_profile']
    }
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithKeycloak,
    logout,
    updateUser,
    hasPermission,
    refreshToken
  }
}

// Export context for provider usage
export { AuthContext }

// Custom hook for API calls with authentication
export const useAuthenticatedApi = () => {
  const { user } = useAuth()
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('agent_portal_token')
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-User-ID': user?.id || '',
      'X-User-Role': user?.role || ''
    }
  }

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...getAuthHeaders(),
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (response.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('agent_portal_user')
      localStorage.removeItem('agent_portal_token')
      window.location.href = '/login'
      throw new Error('Authentication expired')
    }

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`)
    }

    return response.json()
  }

  return { apiCall, getAuthHeaders }
}

// Role-based access control helper
export const useRoleAccess = () => {
  const { user, hasPermission } = useAuth()

  const canViewAllAgents = () => hasPermission('view_all_agents') || hasPermission('view_network_agents')
  const canManageAgents = () => hasPermission('manage_agents') || hasPermission('manage_sub_agents')
  const canViewAllTransactions = () => hasPermission('view_all_transactions') || hasPermission('view_network_transactions')
  const canManageTransactions = () => hasPermission('manage_transactions') || hasPermission('manage_network_transactions')
  const canViewReports = () => hasPermission('view_reports') || hasPermission('view_network_reports') || hasPermission('view_own_reports')
  const canManageFloat = () => hasPermission('manage_float') || hasPermission('manage_network_float') || hasPermission('manage_own_float')
  const canViewAnalytics = () => hasPermission('view_analytics') || hasPermission('view_network_analytics')
  const canManageCompliance = () => hasPermission('manage_compliance')
  const canViewSystemHealth = () => hasPermission('view_system_health')
  const isAdmin = () => user?.role === 'admin' || hasPermission('system_admin')
  const isMasterAgent = () => user?.role === 'master_agent'
  const isSuperAgent = () => user?.role === 'super_agent' || user?.role === 'master_agent'

  return {
    canViewAllAgents,
    canManageAgents,
    canViewAllTransactions,
    canManageTransactions,
    canViewReports,
    canManageFloat,
    canViewAnalytics,
    canManageCompliance,
    canViewSystemHealth,
    isAdmin,
    isMasterAgent,
    isSuperAgent,
    userRole: user?.role,
    userLevel: user?.agentLevel
  }
}

export default useAuth

