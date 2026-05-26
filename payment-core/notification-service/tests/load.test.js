const request = require('supertest')
const app = require('../../src/index')
const { generateToken } = require('../../src/middleware/auth')
const { performance } = require('perf_hooks')

describe('Novu Integration Performance Tests', () => {
  let authToken

  beforeAll(() => {
    authToken = generateToken({
      sub: 'perf-test-user',
      email: 'perf@example.com',
      roles: ['user']
    })
  })

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = performance.now()
      
      await request(app)
        .get('/health')
        .expect(200)
      
      const end = performance.now()
      const responseTime = end - start
      
      expect(responseTime).toBeLessThan(100)
    })

    it('should create subscriber within 500ms', async () => {
      const subscriberData = {
        subscriberId: `perf-user-${Date.now()}`,
        email: 'perf@example.com',
        firstName: 'Performance',
        lastName: 'Test'
      }

      const start = performance.now()
      
      await request(app)
        .post('/api/notifications/subscribers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriberData)
        .expect(201)
      
      const end = performance.now()
      const responseTime = end - start
      
      expect(responseTime).toBeLessThan(500)
    })

    it('should trigger notification within 300ms', async () => {
      const notificationData = {
        name: 'perf-test-template',
        to: { subscriberId: 'perf-user-123' },
        payload: { message: 'Performance test message' }
      }

      const start = performance.now()
      
      await request(app)
        .post('/api/notifications/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201)
      
      const end = performance.now()
      const responseTime = end - start
      
      expect(responseTime).toBeLessThan(300)
    })
  })

  describe('Concurrent Request Tests', () => {
    it('should handle 50 concurrent health checks', async () => {
      const concurrentRequests = 50
      const requests = []

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .get('/health')
            .expect(200)
        )
      }

      const start = performance.now()
      const responses = await Promise.all(requests)
      const end = performance.now()

      expect(responses).toHaveLength(concurrentRequests)
      expect(end - start).toBeLessThan(2000) // All requests within 2 seconds
    })

    it('should handle 20 concurrent subscriber creations', async () => {
      const concurrentRequests = 20
      const requests = []

      for (let i = 0; i < concurrentRequests; i++) {
        const subscriberData = {
          subscriberId: `concurrent-user-${i}-${Date.now()}`,
          email: `concurrent${i}@example.com`,
          firstName: 'Concurrent',
          lastName: `Test${i}`
        }

        requests.push(
          request(app)
            .post('/api/notifications/subscribers')
            .set('Authorization', `Bearer ${authToken}`)
            .send(subscriberData)
            .expect(201)
        )
      }

      const start = performance.now()
      const responses = await Promise.all(requests)
      const end = performance.now()

      expect(responses).toHaveLength(concurrentRequests)
      expect(end - start).toBeLessThan(5000) // All requests within 5 seconds
    })

    it('should handle 30 concurrent notification triggers', async () => {
      const concurrentRequests = 30
      const requests = []

      for (let i = 0; i < concurrentRequests; i++) {
        const notificationData = {
          name: 'concurrent-test-template',
          to: { subscriberId: `concurrent-user-${i}` },
          payload: { 
            message: `Concurrent test message ${i}`,
            timestamp: Date.now()
          }
        }

        requests.push(
          request(app)
            .post('/api/notifications/trigger')
            .set('Authorization', `Bearer ${authToken}`)
            .send(notificationData)
            .expect(201)
        )
      }

      const start = performance.now()
      const responses = await Promise.all(requests)
      const end = performance.now()

      expect(responses).toHaveLength(concurrentRequests)
      expect(end - start).toBeLessThan(8000) // All requests within 8 seconds
    })
  })

  describe('Bulk Operation Performance', () => {
    it('should handle bulk notification with 100 recipients efficiently', async () => {
      const notifications = []
      
      for (let i = 0; i < 100; i++) {
        notifications.push({
          name: 'bulk-test-template',
          to: { subscriberId: `bulk-user-${i}` },
          payload: { 
            message: `Bulk message ${i}`,
            batchId: 'perf-test-batch'
          }
        })
      }

      const start = performance.now()
      
      const response = await request(app)
        .post('/api/notifications/trigger/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notifications })
        .expect(201)
      
      const end = performance.now()
      const responseTime = end - start

      expect(response.body.success).toBe(true)
      expect(responseTime).toBeLessThan(2000) // Bulk operation within 2 seconds
    })

    it('should handle system notification to 50 users efficiently', async () => {
      const affectedUsers = []
      
      for (let i = 0; i < 50; i++) {
        affectedUsers.push(`system-user-${i}`)
      }

      const notificationData = {
        type: 'system_maintenance',
        severity: 'medium',
        message: 'Performance test system notification',
        affectedUsers,
        data: { testBatch: 'performance-test' }
      }

      const start = performance.now()
      
      const response = await request(app)
        .post('/api/notifications/trigger/system')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201)
      
      const end = performance.now()
      const responseTime = end - start

      expect(response.body.success).toBe(true)
      expect(responseTime).toBeLessThan(3000) // System notification within 3 seconds
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/health')
          .expect(200)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it('should handle sustained load without degradation', async () => {
      const duration = 10000 // 10 seconds
      const interval = 100 // 100ms between requests
      const startTime = Date.now()
      const responseTimes = []

      while (Date.now() - startTime < duration) {
        const requestStart = performance.now()
        
        await request(app)
          .get('/health')
          .expect(200)
        
        const requestEnd = performance.now()
        responseTimes.push(requestEnd - requestStart)

        await new Promise(resolve => setTimeout(resolve, interval))
      }

      // Calculate performance metrics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      const maxResponseTime = Math.max(...responseTimes)
      const minResponseTime = Math.min(...responseTimes)

      expect(avgResponseTime).toBeLessThan(50) // Average under 50ms
      expect(maxResponseTime).toBeLessThan(200) // Max under 200ms
      expect(responseTimes.length).toBeGreaterThan(50) // At least 50 requests processed
    })
  })

  describe('Rate Limiting Performance', () => {
    it('should efficiently handle rate limiting', async () => {
      const requests = []
      const requestCount = 200

      // Generate requests that will trigger rate limiting
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/notifications/health')
            .set('Authorization', `Bearer ${authToken}`)
        )
      }

      const start = performance.now()
      const responses = await Promise.allSettled(requests)
      const end = performance.now()

      const successfulResponses = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200)
      const rateLimitedResponses = responses.filter(r => r.status === 'fulfilled' && r.value.status === 429)

      expect(successfulResponses.length).toBeGreaterThan(0)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
      expect(end - start).toBeLessThan(10000) // All requests processed within 10 seconds
    })
  })

  describe('Database Performance', () => {
    it('should handle database operations efficiently', async () => {
      const operations = []

      // Mix of read and write operations
      for (let i = 0; i < 20; i++) {
        // Create subscriber (write)
        operations.push(
          request(app)
            .post('/api/notifications/subscribers')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              subscriberId: `db-perf-user-${i}`,
              email: `dbperf${i}@example.com`,
              firstName: 'DB',
              lastName: `Perf${i}`
            })
        )

        // Get subscriber (read)
        operations.push(
          request(app)
            .get(`/api/notifications/subscribers/db-perf-user-${i}`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      }

      const start = performance.now()
      const responses = await Promise.allSettled(operations)
      const end = performance.now()

      const successfulOperations = responses.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.status === 200 || r.value.status === 201)
      )

      expect(successfulOperations.length).toBeGreaterThan(30) // Most operations should succeed
      expect(end - start).toBeLessThan(15000) // All operations within 15 seconds
    })
  })

  describe('Error Handling Performance', () => {
    it('should handle errors efficiently without blocking', async () => {
      const validRequests = []
      const invalidRequests = []

      // Generate mix of valid and invalid requests
      for (let i = 0; i < 25; i++) {
        // Valid request
        validRequests.push(
          request(app)
            .get('/health')
            .expect(200)
        )

        // Invalid request (should return 404)
        invalidRequests.push(
          request(app)
            .get(`/api/notifications/invalid-endpoint-${i}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404)
        )
      }

      const allRequests = [...validRequests, ...invalidRequests]

      const start = performance.now()
      const responses = await Promise.all(allRequests)
      const end = performance.now()

      expect(responses).toHaveLength(50)
      expect(end - start).toBeLessThan(5000) // All requests within 5 seconds
    })
  })

  describe('Webhook Performance', () => {
    it('should process webhooks efficiently', async () => {
      const webhooks = []

      for (let i = 0; i < 30; i++) {
        webhooks.push(
          request(app)
            .post('/api/notifications/webhook')
            .set('Content-Type', 'application/json')
            .set('novu-signature', 'test-signature')
            .send({
              type: 'notification.delivered',
              data: {
                subscriberId: `webhook-user-${i}`,
                messageId: `msg-${i}`,
                channel: 'email'
              }
            })
        )
      }

      const start = performance.now()
      const responses = await Promise.allSettled(webhooks)
      const end = performance.now()

      const processedWebhooks = responses.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.status === 200 || r.value.status === 401) // 401 for invalid signature is expected
      )

      expect(processedWebhooks.length).toBe(30)
      expect(end - start).toBeLessThan(3000) // All webhooks processed within 3 seconds
    })
  })
})

