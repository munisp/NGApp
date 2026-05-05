/**
 * AuthContext — Keycloak OIDC authentication with fallback to dev mode
 * Handles login, logout, token refresh, session expiry, and CSRF
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext()

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180'
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'banking-crm'
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'crm-pwa'
const DEV_MODE = import.meta.env.VITE_AUTH_DEV_MODE !== 'false'
const TOKEN_REFRESH_INTERVAL = 240_000 // 4 minutes (tokens last 5 min)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState([])
  const [csrfToken, setCsrfToken] = useState('')
  const refreshTimerRef = useRef(null)

  const generateCsrfToken = () => {
    const token = crypto.randomUUID()
    setCsrfToken(token)
    sessionStorage.setItem('csrf_token', token)
    return token
  }

  const clearAuth = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
    sessionStorage.removeItem('csrf_token')
    setUser(null)
    setIsAuthenticated(false)
    setPermissions([])
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
  }, [])

  const setAuthData = useCallback((userData, token, refreshToken, perms = []) => {
    localStorage.setItem('auth_token', token)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user_data', JSON.stringify(userData))
    setUser(userData)
    setIsAuthenticated(true)
    setPermissions(perms)
    generateCsrfToken()
  }, [])

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken || DEV_MODE) return

    try {
      const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: KEYCLOAK_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('auth_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
      } else {
        clearAuth()
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    } catch {
      // Silently fail — next API call will trigger re-auth
    }
  }, [clearAuth])

  useEffect(() => {
    const initAuth = async () => {
      if (DEV_MODE) {
        const devUser = {
          id: 'usr-dev-001',
          name: 'Admin User',
          email: 'admin@enterprise-crm.dev',
          role: 'admin',
          roles: ['admin', 'tenant.admin', 'core_banking.manager', 'agent_banking.admin'],
          avatar: null,
          department: 'Management',
          tenantId: 'tenant-acme-bank',
        }
        setAuthData(devUser, 'dev-token-' + Date.now(), null, [
          'customers:read', 'customers:write', 'customers:delete',
          'campaigns:read', 'campaigns:write',
          'banking:read', 'banking:write',
          'analytics:read',
          'admin:full',
          'security:read', 'security:write',
          'audit:read',
        ])
        setLoading(false)
        return
      }

      const token = localStorage.getItem('auth_token')
      const savedUser = localStorage.getItem('user_data')
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser)
          setUser(userData)
          setIsAuthenticated(true)
          generateCsrfToken()

          refreshTimerRef.current = setInterval(refreshAccessToken, TOKEN_REFRESH_INTERVAL)
        } catch {
          clearAuth()
        }
      }
      setLoading(false)
    }

    initAuth()

    const handleExpiry = () => clearAuth()
    window.addEventListener('auth:expired', handleExpiry)
    return () => {
      window.removeEventListener('auth:expired', handleExpiry)
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [setAuthData, clearAuth, refreshAccessToken])

  const login = async (credentials) => {
    try {
      setLoading(true)

      if (DEV_MODE) {
        const devUser = {
          id: 'usr-dev-001',
          name: credentials.email === 'admin@enterprise-crm.dev' ? 'Admin User' : credentials.email,
          email: credentials.email,
          role: 'admin',
          roles: ['admin'],
          tenantId: 'tenant-acme-bank',
        }
        setAuthData(devUser, 'dev-token-' + Date.now())
        return { success: true }
      }

      const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: KEYCLOAK_CLIENT_ID,
          username: credentials.email,
          password: credentials.password,
          scope: 'openid profile email',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const payload = JSON.parse(atob(data.access_token.split('.')[1]))
        const userData = {
          id: payload.sub,
          name: payload.name || payload.preferred_username,
          email: payload.email,
          role: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'user',
          roles: payload.realm_access?.roles || [],
          tenantId: payload.tenant_id || 'tenant-acme-bank',
        }
        setAuthData(userData, data.access_token, data.refresh_token)
        refreshTimerRef.current = setInterval(refreshAccessToken, TOKEN_REFRESH_INTERVAL)
        return { success: true }
      } else {
        const error = await response.json()
        return { success: false, error: error.error_description || 'Authentication failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error — check your connection' }
    } finally {
      setLoading(false)
    }
  }

  const logout = useCallback(async () => {
    if (!DEV_MODE) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: KEYCLOAK_CLIENT_ID,
              refresh_token: refreshToken,
            }),
          })
        } catch {
          // Proceed with local logout
        }
      }
    }
    clearAuth()
  }, [clearAuth])

  const hasPermission = useCallback((permission) => {
    if (permissions.includes('admin:full')) return true
    return permissions.includes(permission)
  }, [permissions])

  const hasRole = useCallback((role) => {
    return user?.roles?.includes(role) || user?.role === role
  }, [user])

  const updateUser = (userData) => {
    setUser(userData)
    localStorage.setItem('user_data', JSON.stringify(userData))
  }

  const value = {
    user,
    isAuthenticated,
    loading,
    permissions,
    csrfToken,
    login,
    logout,
    updateUser,
    hasPermission,
    hasRole,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
