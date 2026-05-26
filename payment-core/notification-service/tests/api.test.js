const request = require('supertest')
const app = require('../../src/index')
const { generateToken } = require('../../src/middleware/auth')

describe('Novu Integration API', () => {
  let authToken
  let apiKey

  beforeAll(() => {
    // Generate test authentication token
    authToken = generateToken({
      sub: 'test-user-123',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['notifications:read', 'notifications:write']
    })

    apiKey = 'test-api-key-123'
  })

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200)

        expect(response.body).toHaveProperty('status')
        expect(response.body).toHaveProperty('timestamp')
        expect(response.body).toHaveProperty('services')
      })
    })

    describe('GET /ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app)
          .get('/ready')
          .expect(200)

        expect(response.body.status).toBe('ready')
        expect(response.body).toHaveProperty('timestamp')
      })
    })

    describe('GET /live', () => {
      it('should return liveness status', async () => {
        const response = await request(app)
          .get('/live')
          .expect(200)

        expect(response.body.status).toBe('alive')
        expect(response.body).toHaveProperty('pid')
        expect(response.body).toHaveProperty('uptime')
      })
    })
  })

  describe('Subscriber Management', () => {
    describe('POST /api/notifications/subscribers', () => {
      it('should create subscriber with valid data', async () => {
        const subscriberData = {
          subscriberId: 'test-user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          data: { role: 'admin' }
        }

        const response = await request(app)
          .post('/api/notifications/subscribers')
          .set('Authorization', `Bearer ${authToken}`)
          .send(subscriberData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Subscriber created successfully')
        expect(response.body).toHaveProperty('data')
      })

      it('should reject invalid email', async () => {
        const subscriberData = {
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe'
        }

        const response = await request(app)
          .post('/api/notifications/subscribers')
          .set('Authorization', `Bearer ${authToken}`)
          .send(subscriberData)
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toBe('Validation errors')
        expect(response.body.errors).toBeDefined()
      })

      it('should require authentication', async () => {
        const subscriberData = {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }

        await request(app)
          .post('/api/notifications/subscribers')
          .send(subscriberData)
          .expect(401)
      })
    })

    describe('PUT /api/notifications/subscribers/:subscriberId', () => {
      it('should update subscriber with valid data', async () => {
        const subscriberId = 'test-user-123'
        const updateData = {
          firstName: 'Jane',
          lastName: 'Smith'
        }

        const response = await request(app)
          .put(`/api/notifications/subscribers/${subscriberId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Subscriber updated successfully')
      })

      it('should validate subscriber ID', async () => {
        const response = await request(app)
          .put('/api/notifications/subscribers/')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ firstName: 'Jane' })
          .expect(404)
      })
    })

    describe('GET /api/notifications/subscribers/:subscriberId', () => {
      it('should get subscriber data', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('data')
      })
    })

    describe('DELETE /api/notifications/subscribers/:subscriberId', () => {
      it('should delete subscriber', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .delete(`/api/notifications/subscribers/${subscriberId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Subscriber deleted successfully')
      })
    })
  })

  describe('Notification Triggering', () => {
    describe('POST /api/notifications/trigger', () => {
      it('should trigger notification with valid data', async () => {
        const notificationData = {
          name: 'test-template',
          to: { subscriberId: 'test-user-123' },
          payload: { message: 'Hello World', userId: '123' }
        }

        const response = await request(app)
          .post('/api/notifications/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Notification triggered successfully')
        expect(response.body).toHaveProperty('data')
      })

      it('should validate required fields', async () => {
        const notificationData = {
          to: { subscriberId: 'test-user-123' }
          // Missing 'name' field
        }

        const response = await request(app)
          .post('/api/notifications/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toBe('Validation errors')
      })
    })

    describe('POST /api/notifications/trigger/bulk', () => {
      it('should trigger bulk notifications', async () => {
        const notifications = [
          {
            name: 'template1',
            to: { subscriberId: 'user1' },
            payload: { message: 'Message 1' }
          },
          {
            name: 'template2',
            to: { subscriberId: 'user2' },
            payload: { message: 'Message 2' }
          }
        ]

        const response = await request(app)
          .post('/api/notifications/trigger/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ notifications })
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Bulk notifications triggered successfully')
      })

      it('should validate notifications array', async () => {
        const response = await request(app)
          .post('/api/notifications/trigger/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ notifications: [] })
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toBe('Notifications array is required and must not be empty')
      })
    })

    describe('POST /api/notifications/trigger/customer', () => {
      it('should trigger customer notification', async () => {
        const notificationData = {
          type: 'customer_registered',
          customerId: 'customer-123',
          data: { customerName: 'John Doe' }
        }

        const response = await request(app)
          .post('/api/notifications/trigger/customer')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Customer notification triggered successfully')
      })

      it('should validate notification type', async () => {
        const notificationData = {
          type: 'invalid_type',
          customerId: 'customer-123'
        }

        const response = await request(app)
          .post('/api/notifications/trigger/customer')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('Invalid customer notification type')
      })
    })

    describe('POST /api/notifications/trigger/sales', () => {
      it('should trigger sales notification', async () => {
        const notificationData = {
          type: 'lead_created',
          userId: 'user-123',
          leadId: 'lead-456',
          data: { leadName: 'Potential Customer' }
        }

        const response = await request(app)
          .post('/api/notifications/trigger/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Sales notification triggered successfully')
      })
    })

    describe('POST /api/notifications/trigger/inventory', () => {
      it('should trigger inventory notification', async () => {
        const notificationData = {
          type: 'low_stock_alert',
          userId: 'user-123',
          productId: 'product-456',
          data: { productName: 'Widget A', currentStock: 5 }
        }

        const response = await request(app)
          .post('/api/notifications/trigger/inventory')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Inventory notification triggered successfully')
      })
    })

    describe('POST /api/notifications/trigger/system', () => {
      it('should trigger system notification', async () => {
        const notificationData = {
          type: 'system_maintenance',
          severity: 'medium',
          message: 'Scheduled maintenance tonight',
          affectedUsers: ['user1', 'user2'],
          data: { maintenanceWindow: '2023-12-01 02:00-04:00' }
        }

        const response = await request(app)
          .post('/api/notifications/trigger/system')
          .set('Authorization', `Bearer ${authToken}`)
          .send(notificationData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('System notifications triggered successfully')
      })
    })
  })

  describe('Message Management', () => {
    describe('GET /api/notifications/subscribers/:subscriberId/messages', () => {
      it('should get messages for subscriber', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('data')
      })

      it('should support pagination', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}/messages`)
          .query({ page: 1, limit: 5 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
      })

      it('should support channel filtering', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}/messages`)
          .query({ channel: 'email' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
      })
    })

    describe('PATCH /api/notifications/messages/:messageId/read', () => {
      it('should mark message as read', async () => {
        const messageId = 'msg-123'

        const response = await request(app)
          .patch(`/api/notifications/messages/${messageId}/read`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ subscriberId: 'test-user-123' })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Message marked as read')
      })
    })

    describe('PATCH /api/notifications/subscribers/:subscriberId/messages/read-all', () => {
      it('should mark all messages as read', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .patch(`/api/notifications/subscribers/${subscriberId}/messages/read-all`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('All messages marked as read')
      })
    })

    describe('DELETE /api/notifications/messages/:messageId', () => {
      it('should delete message', async () => {
        const messageId = 'msg-123'

        const response = await request(app)
          .delete(`/api/notifications/messages/${messageId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Message deleted successfully')
      })
    })
  })

  describe('Preferences Management', () => {
    describe('PUT /api/notifications/subscribers/:subscriberId/preferences', () => {
      it('should update preferences', async () => {
        const subscriberId = 'test-user-123'
        const preferences = {
          email: true,
          sms: false,
          push: true,
          in_app: true
        }

        const response = await request(app)
          .put(`/api/notifications/subscribers/${subscriberId}/preferences`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(preferences)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Preferences updated successfully')
      })
    })

    describe('GET /api/notifications/subscribers/:subscriberId/preferences', () => {
      it('should get preferences', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}/preferences`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('data')
      })
    })
  })

  describe('Analytics', () => {
    describe('GET /api/notifications/stats', () => {
      it('should get notification statistics', async () => {
        const response = await request(app)
          .get('/api/notifications/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('data')
      })

      it('should support date filtering', async () => {
        const response = await request(app)
          .get('/api/notifications/stats')
          .query({
            from: '2023-01-01T00:00:00Z',
            to: '2023-12-31T23:59:59Z'
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
      })
    })

    describe('GET /api/notifications/subscribers/:subscriberId/unseen-count', () => {
      it('should get unseen count', async () => {
        const subscriberId = 'test-user-123'

        const response = await request(app)
          .get(`/api/notifications/subscribers/${subscriberId}/unseen-count`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body).toHaveProperty('data')
      })
    })
  })

  describe('Authentication & Authorization', () => {
    describe('JWT Authentication', () => {
      it('should accept valid JWT token', async () => {
        const response = await request(app)
          .get('/api/notifications/subscribers/test-user-123')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      })

      it('should reject invalid JWT token', async () => {
        const response = await request(app)
          .get('/api/notifications/subscribers/test-user-123')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('Invalid token')
      })

      it('should reject expired JWT token', async () => {
        const expiredToken = generateToken({
          sub: 'test-user-123',
          email: 'test@example.com'
        }, '1ms') // Expired immediately

        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 10))

        const response = await request(app)
          .get('/api/notifications/subscribers/test-user-123')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('expired')
      })
    })

    describe('API Key Authentication', () => {
      it('should accept valid API key', async () => {
        const response = await request(app)
          .get('/api/notifications/subscribers/test-user-123')
          .set('X-API-Key', process.env.CRM_API_KEY || 'test-api-key')
          .expect(200)
      })

      it('should reject invalid API key', async () => {
        const response = await request(app)
          .get('/api/notifications/subscribers/test-user-123')
          .set('X-API-Key', 'invalid-api-key')
          .expect(401)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('Invalid API key')
      })
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/subscribers/test-user-123')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Authentication required')
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = []
      
      // Make multiple requests quickly to trigger rate limit
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app)
            .get('/api/notifications/health')
            .set('Authorization', `Bearer ${authToken}`)
        )
      }

      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)

      // Rate limited responses should have proper headers
      const rateLimitedResponse = rateLimitedResponses[0]
      expect(rateLimitedResponse.headers).toHaveProperty('retry-after')
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit')
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining')
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/notifications/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Endpoint not found')
    })

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/notifications/subscribers')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)
    })

    it('should include request ID in responses', async () => {
      const response = await request(app)
        .get('/api/notifications/health')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.headers).toHaveProperty('x-request-id')
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('Webhook Handling', () => {
    describe('POST /api/notifications/webhook', () => {
      it('should process valid webhook', async () => {
        const webhookPayload = {
          type: 'notification.sent',
          data: {
            subscriberId: 'test-user-123',
            messageId: 'msg-123',
            channel: 'email'
          }
        }

        const response = await request(app)
          .post('/api/notifications/webhook')
          .set('Content-Type', 'application/json')
          .set('novu-signature', 'valid-signature')
          .send(webhookPayload)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.message).toBe('Webhook processed successfully')
      })

      it('should reject webhook with invalid signature', async () => {
        const webhookPayload = {
          type: 'notification.sent',
          data: { subscriberId: 'test-user-123' }
        }

        const response = await request(app)
          .post('/api/notifications/webhook')
          .set('Content-Type', 'application/json')
          .set('novu-signature', 'invalid-signature')
          .send(webhookPayload)
          .expect(401)

        expect(response.body.success).toBe(false)
        expect(response.body.message).toBe('Invalid webhook signature')
      })
    })
  })
})

