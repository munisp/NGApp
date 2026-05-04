const NovuService = require('../../../src/services/novuService')

// Mock the Novu SDK
jest.mock('@novu/node', () => {
  return {
    Novu: jest.fn().mockImplementation(() => ({
      subscribers: {
        identify: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
        updatePreferences: jest.fn(),
        getPreferences: jest.fn(),
        getNotificationsFeed: jest.fn(),
        getUnseenCount: jest.fn()
      },
      trigger: jest.fn(),
      bulkTrigger: jest.fn(),
      topics: {
        create: jest.fn(),
        addSubscribers: jest.fn(),
        removeSubscribers: jest.fn()
      },
      messages: {
        list: jest.fn(),
        markAs: jest.fn(),
        markAllAs: jest.fn(),
        delete: jest.fn()
      },
      notificationTemplates: {
        getAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      notifications: {
        getStats: jest.fn()
      }
    }))
  }
})

describe('NovuService', () => {
  let novuService
  let mockNovu

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the module to get a fresh instance
    jest.resetModules()
    const NovuServiceClass = require('../../../src/services/novuService')
    novuService = NovuServiceClass
    mockNovu = novuService.novu
  })

  describe('Subscriber Management', () => {
    describe('createSubscriber', () => {
      it('should create a subscriber successfully', async () => {
        const subscriberData = {
          subscriberId: 'user123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          data: { role: 'admin' }
        }

        const mockResponse = { data: { subscriberId: 'user123' } }
        mockNovu.subscribers.identify.mockResolvedValue(mockResponse)

        const result = await novuService.createSubscriber(subscriberData)

        expect(mockNovu.subscribers.identify).toHaveBeenCalledWith('user123', {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          data: {
            role: 'admin',
            createdAt: expect.any(String),
            source: 'enterprise-crm'
          }
        })
        expect(result).toEqual(mockResponse)
      })

      it('should handle subscriber creation error', async () => {
        const subscriberData = {
          subscriberId: 'user123',
          email: 'invalid-email'
        }

        const error = new Error('Invalid email format')
        mockNovu.subscribers.identify.mockRejectedValue(error)

        await expect(novuService.createSubscriber(subscriberData))
          .rejects.toThrow('Invalid email format')
      })
    })

    describe('updateSubscriber', () => {
      it('should update subscriber successfully', async () => {
        const subscriberId = 'user123'
        const updateData = { firstName: 'Jane' }
        const mockResponse = { data: { subscriberId } }

        mockNovu.subscribers.update.mockResolvedValue(mockResponse)

        const result = await novuService.updateSubscriber(subscriberId, updateData)

        expect(mockNovu.subscribers.update).toHaveBeenCalledWith(subscriberId, updateData)
        expect(result).toEqual(mockResponse)
      })
    })

    describe('deleteSubscriber', () => {
      it('should delete subscriber successfully', async () => {
        const subscriberId = 'user123'
        mockNovu.subscribers.delete.mockResolvedValue()

        await novuService.deleteSubscriber(subscriberId)

        expect(mockNovu.subscribers.delete).toHaveBeenCalledWith(subscriberId)
      })
    })

    describe('getSubscriber', () => {
      it('should get subscriber successfully', async () => {
        const subscriberId = 'user123'
        const mockResponse = { data: { subscriberId, email: 'test@example.com' } }

        mockNovu.subscribers.get.mockResolvedValue(mockResponse)

        const result = await novuService.getSubscriber(subscriberId)

        expect(mockNovu.subscribers.get).toHaveBeenCalledWith(subscriberId)
        expect(result).toEqual(mockResponse)
      })
    })
  })

  describe('Notification Triggering', () => {
    describe('triggerNotification', () => {
      it('should trigger notification successfully', async () => {
        const notificationData = {
          name: 'test-template',
          to: { subscriberId: 'user123' },
          payload: { message: 'Hello World' },
          transactionId: 'tx123'
        }

        const mockResponse = { data: { acknowledged: true } }
        mockNovu.trigger.mockResolvedValue(mockResponse)

        const result = await novuService.triggerNotification(notificationData)

        expect(mockNovu.trigger).toHaveBeenCalledWith('test-template', {
          to: { subscriberId: 'user123' },
          payload: {
            message: 'Hello World',
            timestamp: expect.any(String),
            source: 'enterprise-crm'
          },
          transactionId: 'tx123'
        })
        expect(result).toEqual(mockResponse)
      })

      it('should generate transaction ID if not provided', async () => {
        const notificationData = {
          name: 'test-template',
          to: { subscriberId: 'user123' },
          payload: { message: 'Hello World' }
        }

        mockNovu.trigger.mockResolvedValue({ data: { acknowledged: true } })

        await novuService.triggerNotification(notificationData)

        expect(mockNovu.trigger).toHaveBeenCalledWith('test-template', {
          to: { subscriberId: 'user123' },
          payload: {
            message: 'Hello World',
            timestamp: expect.any(String),
            source: 'enterprise-crm'
          },
          transactionId: expect.any(String)
        })
      })
    })

    describe('triggerBulkNotifications', () => {
      it('should trigger bulk notifications successfully', async () => {
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

        const mockResponse = { data: { acknowledged: true } }
        mockNovu.bulkTrigger.mockResolvedValue(mockResponse)

        const result = await novuService.triggerBulkNotifications(notifications)

        expect(mockNovu.bulkTrigger).toHaveBeenCalledWith([
          {
            name: 'template1',
            to: { subscriberId: 'user1' },
            payload: {
              message: 'Message 1',
              timestamp: expect.any(String),
              source: 'enterprise-crm'
            },
            transactionId: expect.any(String)
          },
          {
            name: 'template2',
            to: { subscriberId: 'user2' },
            payload: {
              message: 'Message 2',
              timestamp: expect.any(String),
              source: 'enterprise-crm'
            },
            transactionId: expect.any(String)
          }
        ])
        expect(result).toEqual(mockResponse)
      })
    })
  })

  describe('Topic Management', () => {
    describe('createTopic', () => {
      it('should create topic successfully', async () => {
        const topicData = {
          key: 'sales-team',
          name: 'Sales Team',
          description: 'Sales team notifications'
        }

        const mockResponse = { data: { key: 'sales-team' } }
        mockNovu.topics.create.mockResolvedValue(mockResponse)

        const result = await novuService.createTopic(topicData)

        expect(mockNovu.topics.create).toHaveBeenCalledWith(topicData)
        expect(result).toEqual(mockResponse)
      })
    })

    describe('addSubscriberToTopic', () => {
      it('should add subscriber to topic successfully', async () => {
        const topicKey = 'sales-team'
        const subscriberId = 'user123'

        mockNovu.topics.addSubscribers.mockResolvedValue()

        await novuService.addSubscriberToTopic(topicKey, subscriberId)

        expect(mockNovu.topics.addSubscribers).toHaveBeenCalledWith(topicKey, {
          subscribers: [subscriberId]
        })
      })
    })
  })

  describe('Message Management', () => {
    describe('getMessages', () => {
      it('should get messages successfully', async () => {
        const subscriberId = 'user123'
        const options = { page: 0, limit: 10, channel: 'email' }
        const mockResponse = { data: [{ id: 'msg1', content: 'Hello' }] }

        mockNovu.messages.list.mockResolvedValue(mockResponse)

        const result = await novuService.getMessages(subscriberId, options)

        expect(mockNovu.messages.list).toHaveBeenCalledWith({
          subscriberId,
          page: 0,
          limit: 10,
          channel: 'email'
        })
        expect(result).toEqual(mockResponse)
      })
    })

    describe('markMessageAsRead', () => {
      it('should mark message as read successfully', async () => {
        const messageId = 'msg123'
        const subscriberId = 'user123'

        mockNovu.messages.markAs.mockResolvedValue()

        await novuService.markMessageAsRead(messageId, subscriberId)

        expect(mockNovu.messages.markAs).toHaveBeenCalledWith(messageId, subscriberId, { seen: true })
      })
    })

    describe('markAllMessagesAsRead', () => {
      it('should mark all messages as read successfully', async () => {
        const subscriberId = 'user123'

        mockNovu.messages.markAllAs.mockResolvedValue()

        await novuService.markAllMessagesAsRead(subscriberId)

        expect(mockNovu.messages.markAllAs).toHaveBeenCalledWith(subscriberId, { seen: true })
      })
    })
  })

  describe('Preferences Management', () => {
    describe('updateSubscriberPreferences', () => {
      it('should update preferences successfully', async () => {
        const subscriberId = 'user123'
        const preferences = { email: true, sms: false }
        const mockResponse = { data: preferences }

        mockNovu.subscribers.updatePreferences.mockResolvedValue(mockResponse)

        const result = await novuService.updateSubscriberPreferences(subscriberId, preferences)

        expect(mockNovu.subscribers.updatePreferences).toHaveBeenCalledWith(subscriberId, preferences)
        expect(result).toEqual(mockResponse)
      })
    })

    describe('getSubscriberPreferences', () => {
      it('should get preferences successfully', async () => {
        const subscriberId = 'user123'
        const mockResponse = { data: { email: true, sms: false } }

        mockNovu.subscribers.getPreferences.mockResolvedValue(mockResponse)

        const result = await novuService.getSubscriberPreferences(subscriberId)

        expect(mockNovu.subscribers.getPreferences).toHaveBeenCalledWith(subscriberId)
        expect(result).toEqual(mockResponse)
      })
    })
  })

  describe('Analytics', () => {
    describe('getNotificationStatistics', () => {
      it('should get statistics successfully', async () => {
        const options = { from: '2023-01-01', to: '2023-12-31' }
        const mockResponse = { data: { sent: 100, delivered: 95, opened: 50 } }

        mockNovu.notifications.getStats.mockResolvedValue(mockResponse)

        const result = await novuService.getNotificationStatistics(options)

        expect(mockNovu.notifications.getStats).toHaveBeenCalledWith(options)
        expect(result).toEqual(mockResponse)
      })
    })

    describe('getUnseenCount', () => {
      it('should get unseen count successfully', async () => {
        const subscriberId = 'user123'
        const mockResponse = { data: { count: 5 } }

        mockNovu.subscribers.getUnseenCount.mockResolvedValue(mockResponse)

        const result = await novuService.getUnseenCount(subscriberId)

        expect(mockNovu.subscribers.getUnseenCount).toHaveBeenCalledWith(subscriberId)
        expect(result).toEqual(mockResponse)
      })
    })
  })

  describe('Health Check', () => {
    describe('healthCheck', () => {
      it('should return healthy status when Novu is accessible', async () => {
        mockNovu.subscribers.list.mockResolvedValue({ data: [] })

        const result = await novuService.healthCheck()

        expect(result.status).toBe('healthy')
        expect(result.timestamp).toBeDefined()
      })

      it('should return unhealthy status when Novu is not accessible', async () => {
        const error = new Error('Connection failed')
        mockNovu.subscribers.list.mockRejectedValue(error)

        const result = await novuService.healthCheck()

        expect(result.status).toBe('unhealthy')
        expect(result.error).toBe('Connection failed')
        expect(result.timestamp).toBeDefined()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout')
      mockNovu.subscribers.get.mockRejectedValue(networkError)

      await expect(novuService.getSubscriber('user123'))
        .rejects.toThrow('Network timeout')
    })

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Invalid API key')
      apiError.status = 401
      mockNovu.trigger.mockRejectedValue(apiError)

      await expect(novuService.triggerNotification({
        name: 'test',
        to: { subscriberId: 'user123' }
      })).rejects.toThrow('Invalid API key')
    })
  })
})

