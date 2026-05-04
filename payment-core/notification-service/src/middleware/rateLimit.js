const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible')
const Redis = require('redis')
const config = require('../config')
const logger = require('../utils/logger')

class RateLimitMiddleware {
  constructor() {
    this.redisClient = null
    this.rateLimiters = {}
    this.init()
  }

  async init() {
    try {
      // Initialize Redis client for distributed rate limiting
      if (config.redis.url) {
        this.redisClient = Redis.createClient({
          url: config.redis.url,
          ...config.redis
        })

        this.redisClient.on('error', (err) => {
          logger.error('Redis rate limiter error:', err)
        })

        await this.redisClient.connect()
        logger.info('Redis rate limiter connected')
      }

      this.setupRateLimiters()
    } catch (error) {
      logger.error('Failed to initialize rate limiter:', error)
      // Fall back to memory-based rate limiting
      this.setupRateLimiters()
    }
  }

  setupRateLimiters() {
    const RateLimiterClass = this.redisClient ? RateLimiterRedis : RateLimiterMemory
    const baseOptions = this.redisClient ? { storeClient: this.redisClient } : {}

    // General API rate limiter
    this.rateLimiters.general = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_general',
      points: config.rateLimit.maxRequests, // Number of requests
      duration: Math.floor(config.rateLimit.windowMs / 1000), // Per duration in seconds
      blockDuration: 60, // Block for 60 seconds if limit exceeded
    })

    // Strict rate limiter for sensitive operations
    this.rateLimiters.strict = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_strict',
      points: 10, // 10 requests
      duration: 60, // Per 60 seconds
      blockDuration: 300, // Block for 5 minutes
    })

    // Notification triggering rate limiter
    this.rateLimiters.notification = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_notification',
      points: 50, // 50 notifications
      duration: 60, // Per 60 seconds
      blockDuration: 120, // Block for 2 minutes
    })

    // Bulk operations rate limiter
    this.rateLimiters.bulk = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_bulk',
      points: 5, // 5 bulk operations
      duration: 60, // Per 60 seconds
      blockDuration: 300, // Block for 5 minutes
    })

    // Webhook rate limiter
    this.rateLimiters.webhook = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_webhook',
      points: 100, // 100 webhook calls
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 1 minute
    })

    // Admin operations rate limiter
    this.rateLimiters.admin = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_admin',
      points: 20, // 20 admin operations
      duration: 60, // Per 60 seconds
      blockDuration: 180, // Block for 3 minutes
    })

    // Per-user rate limiter
    this.rateLimiters.perUser = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_user',
      points: 200, // 200 requests per user
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour
    })

    // Per-IP rate limiter
    this.rateLimiters.perIP = new RateLimiterClass({
      ...baseOptions,
      keyPrefix: 'rl_ip',
      points: 1000, // 1000 requests per IP
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour
    })
  }

  // General rate limiting middleware
  general() {
    return this.createMiddleware('general', (req) => this.getClientKey(req))
  }

  // Strict rate limiting for sensitive operations
  strict() {
    return this.createMiddleware('strict', (req) => this.getClientKey(req))
  }

  // Notification-specific rate limiting
  notification() {
    return this.createMiddleware('notification', (req) => this.getClientKey(req))
  }

  // Bulk operations rate limiting
  bulk() {
    return this.createMiddleware('bulk', (req) => this.getClientKey(req))
  }

  // Webhook rate limiting
  webhook() {
    return this.createMiddleware('webhook', (req) => this.getClientIP(req))
  }

  // Admin operations rate limiting
  admin() {
    return this.createMiddleware('admin', (req) => this.getClientKey(req))
  }

  // Per-user rate limiting
  perUser() {
    return this.createMiddleware('perUser', (req) => this.getUserKey(req))
  }

  // Per-IP rate limiting
  perIP() {
    return this.createMiddleware('perIP', (req) => this.getClientIP(req))
  }

  // Combined rate limiting (both per-user and per-IP)
  combined() {
    return async (req, res, next) => {
      try {
        const userKey = this.getUserKey(req)
        const ipKey = this.getClientIP(req)

        // Check both user and IP limits
        await Promise.all([
          this.rateLimiters.perUser.consume(userKey),
          this.rateLimiters.perIP.consume(ipKey)
        ])

        next()
      } catch (rejRes) {
        this.handleRateLimitExceeded(req, res, rejRes)
      }
    }
  }

  // Create middleware for specific rate limiter
  createMiddleware(limiterName, keyFunction) {
    return async (req, res, next) => {
      try {
        const key = keyFunction(req)
        const rateLimiter = this.rateLimiters[limiterName]

        if (!rateLimiter) {
          logger.error(`Rate limiter '${limiterName}' not found`)
          return next()
        }

        const resRateLimiter = await rateLimiter.consume(key)

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': rateLimiter.points,
          'X-RateLimit-Remaining': resRateLimiter.remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + resRateLimiter.msBeforeNext).toISOString()
        })

        next()
      } catch (rejRes) {
        this.handleRateLimitExceeded(req, res, rejRes)
      }
    }
  }

  // Handle rate limit exceeded
  handleRateLimitExceeded(req, res, rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1

    res.set({
      'Retry-After': String(secs),
      'X-RateLimit-Limit': rejRes.totalHits,
      'X-RateLimit-Remaining': rejRes.remainingPoints || 0,
      'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext).toISOString()
    })

    logger.warn(`Rate limit exceeded for ${this.getClientKey(req)}`, {
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    })

    res.status(429).json({
      success: false,
      message: 'Too many requests',
      retryAfter: secs,
      details: {
        limit: rejRes.totalHits,
        remaining: rejRes.remainingPoints || 0,
        resetTime: new Date(Date.now() + rejRes.msBeforeNext).toISOString()
      }
    })
  }

  // Get client key (user ID or IP)
  getClientKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
      return `user:${req.user.sub || req.user.id}`
    }
    if (req.apiAuth) {
      return 'api:service'
    }
    return `ip:${this.getClientIP(req)}`
  }

  // Get user key
  getUserKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
      return req.user.sub || req.user.id
    }
    return this.getClientIP(req)
  }

  // Get client IP address
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           'unknown'
  }

  // Custom rate limiter for specific use cases
  custom(options) {
    const RateLimiterClass = this.redisClient ? RateLimiterRedis : RateLimiterMemory
    const baseOptions = this.redisClient ? { storeClient: this.redisClient } : {}

    const rateLimiter = new RateLimiterClass({
      ...baseOptions,
      ...options
    })

    return this.createMiddleware('custom', (req) => {
      if (options.keyGenerator) {
        return options.keyGenerator(req)
      }
      return this.getClientKey(req)
    })
  }

  // Skip rate limiting for certain conditions
  skip(condition) {
    return (req, res, next) => {
      if (condition(req)) {
        return next()
      }
      return this.general()(req, res, next)
    }
  }

  // Reset rate limit for a specific key
  async reset(limiterName, key) {
    try {
      const rateLimiter = this.rateLimiters[limiterName]
      if (rateLimiter && rateLimiter.delete) {
        await rateLimiter.delete(key)
        logger.info(`Rate limit reset for ${limiterName}:${key}`)
      }
    } catch (error) {
      logger.error(`Failed to reset rate limit for ${limiterName}:${key}:`, error)
    }
  }

  // Get rate limit status
  async getStatus(limiterName, key) {
    try {
      const rateLimiter = this.rateLimiters[limiterName]
      if (rateLimiter && rateLimiter.get) {
        return await rateLimiter.get(key)
      }
      return null
    } catch (error) {
      logger.error(`Failed to get rate limit status for ${limiterName}:${key}:`, error)
      return null
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (this.redisClient) {
        await this.redisClient.ping()
      }
      return { status: 'healthy', type: this.redisClient ? 'redis' : 'memory' }
    } catch (error) {
      return { status: 'unhealthy', error: error.message }
    }
  }
}

const rateLimitMiddleware = new RateLimitMiddleware()

// Export default middleware (general rate limiting)
module.exports = rateLimitMiddleware.general.bind(rateLimitMiddleware)

// Export specific rate limiters
module.exports.general = rateLimitMiddleware.general.bind(rateLimitMiddleware)
module.exports.strict = rateLimitMiddleware.strict.bind(rateLimitMiddleware)
module.exports.notification = rateLimitMiddleware.notification.bind(rateLimitMiddleware)
module.exports.bulk = rateLimitMiddleware.bulk.bind(rateLimitMiddleware)
module.exports.webhook = rateLimitMiddleware.webhook.bind(rateLimitMiddleware)
module.exports.admin = rateLimitMiddleware.admin.bind(rateLimitMiddleware)
module.exports.perUser = rateLimitMiddleware.perUser.bind(rateLimitMiddleware)
module.exports.perIP = rateLimitMiddleware.perIP.bind(rateLimitMiddleware)
module.exports.combined = rateLimitMiddleware.combined.bind(rateLimitMiddleware)
module.exports.custom = rateLimitMiddleware.custom.bind(rateLimitMiddleware)
module.exports.skip = rateLimitMiddleware.skip.bind(rateLimitMiddleware)
module.exports.reset = rateLimitMiddleware.reset.bind(rateLimitMiddleware)
module.exports.getStatus = rateLimitMiddleware.getStatus.bind(rateLimitMiddleware)
module.exports.healthCheck = rateLimitMiddleware.healthCheck.bind(rateLimitMiddleware)

