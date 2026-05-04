// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.PORT = '3001'
process.env.LOG_LEVEL = 'error'
process.env.NOVU_API_KEY = 'test-novu-api-key'
process.env.NOVU_APP_ID = 'test-novu-app-id'
process.env.NOVU_ENVIRONMENT = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.REDIS_URL = 'redis://localhost:6379/1'
process.env.CRM_API_BASE_URL = 'http://localhost:8080'
process.env.CRM_API_KEY = 'test-crm-api-key'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

// Mock external dependencies
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn()
  }))
}))

// Mock PostgreSQL client
jest.mock('pg', () => ({
  Client: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  })),
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  }))
}))

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    stream: {
      write: jest.fn()
    },
    request: jest.fn(),
    notification: jest.fn(),
    security: jest.fn(),
    performance: jest.fn(),
    business: jest.fn(),
    audit: jest.fn(),
    health: jest.fn(),
    integration: jest.fn(),
    webhook: jest.fn(),
    rateLimit: jest.fn(),
    database: jest.fn(),
    cache: jest.fn(),
    queue: jest.fn(),
    metrics: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}))

// Mock Novu SDK
jest.mock('@novu/node', () => ({
  Novu: jest.fn(() => ({
    subscribers: {
      identify: jest.fn().mockResolvedValue({ data: { subscriberId: 'test' } }),
      update: jest.fn().mockResolvedValue({ data: { subscriberId: 'test' } }),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({ data: { subscriberId: 'test' } }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      updatePreferences: jest.fn().mockResolvedValue({ data: {} }),
      getPreferences: jest.fn().mockResolvedValue({ data: {} }),
      getNotificationsFeed: jest.fn().mockResolvedValue({ data: [] }),
      getUnseenCount: jest.fn().mockResolvedValue({ data: { count: 0 } })
    },
    trigger: jest.fn().mockResolvedValue({ data: { acknowledged: true } }),
    bulkTrigger: jest.fn().mockResolvedValue({ data: { acknowledged: true } }),
    topics: {
      create: jest.fn().mockResolvedValue({ data: { key: 'test' } }),
      addSubscribers: jest.fn().mockResolvedValue(undefined),
      removeSubscribers: jest.fn().mockResolvedValue(undefined)
    },
    messages: {
      list: jest.fn().mockResolvedValue({ data: [] }),
      markAs: jest.fn().mockResolvedValue(undefined),
      markAllAs: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    },
    notificationTemplates: {
      getAll: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue({ data: { id: 'test' } }),
      update: jest.fn().mockResolvedValue({ data: { id: 'test' } })
    },
    notifications: {
      getStats: jest.fn().mockResolvedValue({ data: {} })
    }
  }))
}))

// Mock rate limiter
jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: jest.fn(() => ({
    consume: jest.fn().mockResolvedValue({ remainingPoints: 10, msBeforeNext: 1000 }),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({ remainingPoints: 10 })
  })),
  RateLimiterMemory: jest.fn(() => ({
    consume: jest.fn().mockResolvedValue({ remainingPoints: 10, msBeforeNext: 1000 }),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({ remainingPoints: 10 })
  }))
}))

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-9012')
}))

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt')
}))

// Mock axios for external API calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} })
  })),
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} })
}))

// Global test utilities
global.testUtils = {
  // Generate test data
  generateSubscriber: (overrides = {}) => ({
    subscriberId: `test-user-${Date.now()}`,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890',
    data: { role: 'user' },
    ...overrides
  }),

  generateNotification: (overrides = {}) => ({
    name: 'test-template',
    to: { subscriberId: 'test-user-123' },
    payload: { message: 'Test message' },
    ...overrides
  }),

  // Wait utility for async tests
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock response helper
  mockResponse: (data = {}, status = 200) => ({
    status,
    data,
    headers: {},
    config: {},
    statusText: 'OK'
  }),

  // Error helper
  mockError: (message = 'Test error', status = 500) => {
    const error = new Error(message)
    error.status = status
    error.response = {
      status,
      data: { message },
      headers: {}
    }
    return error
  }
}

// Console override for cleaner test output
const originalConsole = console
global.console = {
  ...originalConsole,
  // Suppress logs during tests unless explicitly needed
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep errors visible
  debug: jest.fn()
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

