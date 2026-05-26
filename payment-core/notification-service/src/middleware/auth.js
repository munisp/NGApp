const jwt = require('jsonwebtoken')
const config = require('../config')
const logger = require('../utils/logger')

class AuthMiddleware {
  // Basic JWT authentication
  authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header is required'
        })
      }

      const token = authHeader.split(' ')[1] // Bearer <token>
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token is required'
        })
      }

      const decoded = jwt.verify(token, config.jwt.secret)
      req.user = decoded
      next()
    } catch (error) {
      logger.error('Authentication error:', error)
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired'
        })
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        })
      }
      
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
      })
    }
  }

  // API Key authentication (for service-to-service communication)
  authenticateApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key']
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: 'API key is required'
        })
      }

      // Validate API key against CRM API
      if (apiKey !== config.crmApi.apiKey) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        })
      }

      req.apiAuth = true
      next()
    } catch (error) {
      logger.error('API key authentication error:', error)
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
      })
    }
  }

  // Combined authentication (JWT or API Key)
  authenticateAny(req, res, next) {
    const authHeader = req.headers.authorization
    const apiKey = req.headers['x-api-key']

    if (apiKey) {
      return this.authenticateApiKey(req, res, next)
    } else if (authHeader) {
      return this.authenticate(req, res, next)
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required (JWT token or API key)'
      })
    }
  }

  // Role-based authorization
  requireRole(roles) {
    return (req, res, next) => {
      if (req.apiAuth) {
        // API key authentication bypasses role checks
        return next()
      }

      if (!req.user || !req.user.roles) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No roles found'
        })
      }

      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles]
      const requiredRoles = Array.isArray(roles) ? roles : [roles]

      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))

      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Required roles: ${requiredRoles.join(', ')}`
        })
      }

      next()
    }
  }

  // Admin role requirement
  requireAdmin(req, res, next) {
    return this.requireRole(['admin', 'super_admin'])(req, res, next)
  }

  // Manager role requirement
  requireManager(req, res, next) {
    return this.requireRole(['manager', 'admin', 'super_admin'])(req, res, next)
  }

  // User role requirement (basic authenticated user)
  requireUser(req, res, next) {
    return this.requireRole(['user', 'manager', 'admin', 'super_admin'])(req, res, next)
  }

  // Permission-based authorization
  requirePermission(permission) {
    return (req, res, next) => {
      if (req.apiAuth) {
        // API key authentication bypasses permission checks
        return next()
      }

      if (!req.user || !req.user.permissions) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No permissions found'
        })
      }

      const userPermissions = Array.isArray(req.user.permissions) 
        ? req.user.permissions 
        : [req.user.permissions]

      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Required permission: ${permission}`
        })
      }

      next()
    }
  }

  // Resource ownership check
  requireOwnership(resourceIdParam = 'id') {
    return (req, res, next) => {
      if (req.apiAuth) {
        // API key authentication bypasses ownership checks
        return next()
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      // Admin users can access any resource
      if (req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('super_admin'))) {
        return next()
      }

      const resourceId = req.params[resourceIdParam]
      const userId = req.user.sub || req.user.id

      if (resourceId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own resources'
        })
      }

      next()
    }
  }

  // Subscriber ownership check (for notification-specific resources)
  requireSubscriberOwnership(req, res, next) {
    if (req.apiAuth) {
      // API key authentication bypasses ownership checks
      return next()
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    // Admin users can access any subscriber
    if (req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('super_admin'))) {
      return next()
    }

    const subscriberId = req.params.subscriberId
    const userId = req.user.sub || req.user.id

    if (subscriberId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own notifications'
      })
    }

    next()
  }

  // Optional authentication (doesn't fail if no auth provided)
  optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization
    const apiKey = req.headers['x-api-key']

    if (!authHeader && !apiKey) {
      return next()
    }

    if (apiKey) {
      return this.authenticateApiKey(req, res, next)
    } else {
      return this.authenticate(req, res, next)
    }
  }

  // Generate JWT token (for testing or service integration)
  generateToken(payload, expiresIn = config.jwt.expiresIn) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn })
  }

  // Verify JWT token
  verifyToken(token) {
    return jwt.verify(token, config.jwt.secret)
  }

  // Extract user info from token without verification (for debugging)
  decodeToken(token) {
    return jwt.decode(token)
  }
}

const authMiddleware = new AuthMiddleware()

// Export middleware functions
module.exports = authMiddleware.authenticateAny.bind(authMiddleware)
module.exports.authenticate = authMiddleware.authenticate.bind(authMiddleware)
module.exports.authenticateApiKey = authMiddleware.authenticateApiKey.bind(authMiddleware)
module.exports.authenticateAny = authMiddleware.authenticateAny.bind(authMiddleware)
module.exports.requireRole = authMiddleware.requireRole.bind(authMiddleware)
module.exports.requireAdmin = authMiddleware.requireAdmin.bind(authMiddleware)
module.exports.requireManager = authMiddleware.requireManager.bind(authMiddleware)
module.exports.requireUser = authMiddleware.requireUser.bind(authMiddleware)
module.exports.requirePermission = authMiddleware.requirePermission.bind(authMiddleware)
module.exports.requireOwnership = authMiddleware.requireOwnership.bind(authMiddleware)
module.exports.requireSubscriberOwnership = authMiddleware.requireSubscriberOwnership.bind(authMiddleware)
module.exports.optionalAuth = authMiddleware.optionalAuth.bind(authMiddleware)
module.exports.generateToken = authMiddleware.generateToken.bind(authMiddleware)
module.exports.verifyToken = authMiddleware.verifyToken.bind(authMiddleware)
module.exports.decodeToken = authMiddleware.decodeToken.bind(authMiddleware)

