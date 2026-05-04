const winston = require('winston')
const config = require('../config')

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Simple format for development
const simpleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }
    return msg
  })
)

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? logFormat : simpleFormat,
  defaultMeta: {
    service: 'enterprise-crm-novu-integration',
    environment: config.env
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
})

// Add file transports in production
if (config.env === 'production') {
  // Error log file
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: logFormat
  }))

  // Combined log file
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: logFormat
  }))

  // Access log file
  logger.add(new winston.transports.File({
    filename: 'logs/access.log',
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: logFormat
  }))
}

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim())
  }
}

// Custom logging methods for different contexts
logger.request = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? (req.user.sub || req.user.id) : null,
    apiAuth: req.apiAuth || false
  }

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData)
  } else {
    logger.info('HTTP Request', logData)
  }
}

logger.notification = (action, data) => {
  logger.info('Notification Event', {
    action,
    ...data,
    timestamp: new Date().toISOString()
  })
}

logger.security = (event, data) => {
  logger.warn('Security Event', {
    event,
    ...data,
    timestamp: new Date().toISOString()
  })
}

logger.performance = (metric, value, unit = 'ms') => {
  logger.info('Performance Metric', {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString()
  })
}

logger.business = (event, data) => {
  logger.info('Business Event', {
    event,
    ...data,
    timestamp: new Date().toISOString()
  })
}

logger.audit = (action, userId, resource, details) => {
  logger.info('Audit Log', {
    action,
    userId,
    resource,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.health = (service, status, details) => {
  const logLevel = status === 'healthy' ? 'info' : 'error'
  logger[logLevel]('Health Check', {
    service,
    status,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.integration = (service, action, status, details) => {
  const logLevel = status === 'success' ? 'info' : 'error'
  logger[logLevel]('Integration Event', {
    service,
    action,
    status,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.webhook = (source, event, status, details) => {
  logger.info('Webhook Event', {
    source,
    event,
    status,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.rateLimit = (key, action, details) => {
  logger.warn('Rate Limit Event', {
    key,
    action,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.database = (operation, table, duration, details) => {
  logger.debug('Database Operation', {
    operation,
    table,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.cache = (operation, key, hit, duration) => {
  logger.debug('Cache Operation', {
    operation,
    key,
    hit,
    duration: duration ? `${duration}ms` : null,
    timestamp: new Date().toISOString()
  })
}

logger.queue = (queue, job, status, details) => {
  logger.info('Queue Event', {
    queue,
    job,
    status,
    details,
    timestamp: new Date().toISOString()
  })
}

logger.metrics = (name, value, tags) => {
  logger.info('Metric', {
    name,
    value,
    tags,
    timestamp: new Date().toISOString()
  })
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  })
})

module.exports = logger

