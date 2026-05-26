const dotenv = require('dotenv')
const Joi = require('joi')

// Load environment variables
dotenv.config()

// Configuration schema validation
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  
  // Novu Configuration
  NOVU_API_KEY: Joi.string().required().description('Novu API Key'),
  NOVU_APP_ID: Joi.string().required().description('Novu Application ID'),
  NOVU_ENVIRONMENT: Joi.string().default('development').description('Novu Environment'),
  NOVU_WEBHOOK_SECRET: Joi.string().description('Novu Webhook Secret'),
  
  // Database Configuration
  DATABASE_URL: Joi.string().required().description('PostgreSQL Database URL'),
  REDIS_URL: Joi.string().required().description('Redis URL'),
  
  // Enterprise CRM API Configuration
  CRM_API_BASE_URL: Joi.string().uri().required().description('Enterprise CRM API Base URL'),
  CRM_API_KEY: Joi.string().required().description('Enterprise CRM API Key'),
  
  // Security Configuration
  JWT_SECRET: Joi.string().required().description('JWT Secret Key'),
  JWT_EXPIRES_IN: Joi.string().default('24h').description('JWT Expiration Time'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000).description('Rate limit window in milliseconds'),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100).description('Max requests per window'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Health Check
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000).description('Health check interval in milliseconds'),
  
  // Notification Templates
  DEFAULT_EMAIL_TEMPLATE: Joi.string().default('enterprise-crm-email'),
  DEFAULT_SMS_TEMPLATE: Joi.string().default('enterprise-crm-sms'),
  DEFAULT_PUSH_TEMPLATE: Joi.string().default('enterprise-crm-push'),
  DEFAULT_IN_APP_TEMPLATE: Joi.string().default('enterprise-crm-in-app'),
  
  // Feature Flags
  ENABLE_EMAIL_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_SMS_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_PUSH_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_IN_APP_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_WEBHOOK_NOTIFICATIONS: Joi.boolean().default(true),
  
  // Performance Settings
  MAX_CONCURRENT_NOTIFICATIONS: Joi.number().default(100),
  NOTIFICATION_BATCH_SIZE: Joi.number().default(50),
  RETRY_ATTEMPTS: Joi.number().default(3),
  RETRY_DELAY_MS: Joi.number().default(1000),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().default(9090),
  
  // External Integrations
  SLACK_WEBHOOK_URL: Joi.string().uri().description('Slack Webhook URL for alerts'),
  TEAMS_WEBHOOK_URL: Joi.string().uri().description('Microsoft Teams Webhook URL'),
  DISCORD_WEBHOOK_URL: Joi.string().uri().description('Discord Webhook URL'),
  
  // Email Provider Configuration (Fallback)
  SMTP_HOST: Joi.string().description('SMTP Host'),
  SMTP_PORT: Joi.number().description('SMTP Port'),
  SMTP_USER: Joi.string().description('SMTP Username'),
  SMTP_PASS: Joi.string().description('SMTP Password'),
  SMTP_FROM: Joi.string().email().description('Default From Email'),
  
  // SMS Provider Configuration (Fallback)
  TWILIO_ACCOUNT_SID: Joi.string().description('Twilio Account SID'),
  TWILIO_AUTH_TOKEN: Joi.string().description('Twilio Auth Token'),
  TWILIO_PHONE_NUMBER: Joi.string().description('Twilio Phone Number'),
  
  // Push Notification Configuration
  FCM_SERVER_KEY: Joi.string().description('Firebase Cloud Messaging Server Key'),
  APNS_KEY_ID: Joi.string().description('Apple Push Notification Service Key ID'),
  APNS_TEAM_ID: Joi.string().description('Apple Push Notification Service Team ID'),
  APNS_BUNDLE_ID: Joi.string().description('Apple Push Notification Service Bundle ID')
}).unknown()

const { error, value: envVars } = envVarsSchema.validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  // Novu Configuration
  novu: {
    apiKey: envVars.NOVU_API_KEY,
    appId: envVars.NOVU_APP_ID,
    environment: envVars.NOVU_ENVIRONMENT,
    webhookSecret: envVars.NOVU_WEBHOOK_SECRET,
    baseUrl: envVars.NOVU_BASE_URL || 'https://api.novu.co'
  },
  
  // Database Configuration
  database: {
    url: envVars.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000
    }
  },
  
  // Redis Configuration
  redis: {
    url: envVars.REDIS_URL,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null
  },
  
  // Enterprise CRM API Configuration
  crmApi: {
    baseUrl: envVars.CRM_API_BASE_URL,
    apiKey: envVars.CRM_API_KEY,
    timeout: 10000,
    retries: 3
  },
  
  // Security Configuration
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN
  },
  
  // Rate Limiting Configuration
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS
  },
  
  // Logging Configuration
  logging: {
    level: envVars.LOG_LEVEL,
    format: envVars.LOG_FORMAT
  },
  
  // Health Check Configuration
  healthCheck: {
    interval: envVars.HEALTH_CHECK_INTERVAL
  },
  
  // Notification Templates
  templates: {
    email: envVars.DEFAULT_EMAIL_TEMPLATE,
    sms: envVars.DEFAULT_SMS_TEMPLATE,
    push: envVars.DEFAULT_PUSH_TEMPLATE,
    inApp: envVars.DEFAULT_IN_APP_TEMPLATE
  },
  
  // Feature Flags
  features: {
    emailNotifications: envVars.ENABLE_EMAIL_NOTIFICATIONS,
    smsNotifications: envVars.ENABLE_SMS_NOTIFICATIONS,
    pushNotifications: envVars.ENABLE_PUSH_NOTIFICATIONS,
    inAppNotifications: envVars.ENABLE_IN_APP_NOTIFICATIONS,
    webhookNotifications: envVars.ENABLE_WEBHOOK_NOTIFICATIONS
  },
  
  // Performance Settings
  performance: {
    maxConcurrentNotifications: envVars.MAX_CONCURRENT_NOTIFICATIONS,
    batchSize: envVars.NOTIFICATION_BATCH_SIZE,
    retryAttempts: envVars.RETRY_ATTEMPTS,
    retryDelayMs: envVars.RETRY_DELAY_MS
  },
  
  // Monitoring Configuration
  monitoring: {
    enabled: envVars.ENABLE_METRICS,
    port: envVars.METRICS_PORT
  },
  
  // External Integrations
  integrations: {
    slack: {
      webhookUrl: envVars.SLACK_WEBHOOK_URL
    },
    teams: {
      webhookUrl: envVars.TEAMS_WEBHOOK_URL
    },
    discord: {
      webhookUrl: envVars.DISCORD_WEBHOOK_URL
    }
  },
  
  // Email Provider Configuration (Fallback)
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS
      },
      from: envVars.SMTP_FROM
    }
  },
  
  // SMS Provider Configuration (Fallback)
  sms: {
    twilio: {
      accountSid: envVars.TWILIO_ACCOUNT_SID,
      authToken: envVars.TWILIO_AUTH_TOKEN,
      phoneNumber: envVars.TWILIO_PHONE_NUMBER
    }
  },
  
  // Push Notification Configuration
  push: {
    fcm: {
      serverKey: envVars.FCM_SERVER_KEY
    },
    apns: {
      keyId: envVars.APNS_KEY_ID,
      teamId: envVars.APNS_TEAM_ID,
      bundleId: envVars.APNS_BUNDLE_ID
    }
  }
}

module.exports = config

