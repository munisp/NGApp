const { Novu } = require('@novu/node')
const config = require('../config')
const logger = require('../utils/logger')
const { v4: uuidv4 } = require('uuid')

class NovuService {
  constructor() {
    this.novu = new Novu(config.novu.apiKey, {
      backendUrl: config.novu.baseUrl
    })
    this.initialized = false
    this.init()
  }

  async init() {
    try {
      // Test connection to Novu
      await this.novu.subscribers.list({ page: 0, limit: 1 })
      this.initialized = true
      logger.info('Novu service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Novu service:', error)
      throw error
    }
  }

  // Subscriber Management
  async createSubscriber(subscriberData) {
    try {
      const { subscriberId, email, firstName, lastName, phone, avatar, data } = subscriberData
      
      const subscriber = await this.novu.subscribers.identify(subscriberId, {
        email,
        firstName,
        lastName,
        phone,
        avatar,
        data: {
          ...data,
          createdAt: new Date().toISOString(),
          source: 'enterprise-crm'
        }
      })

      logger.info(`Subscriber created/updated: ${subscriberId}`)
      return subscriber
    } catch (error) {
      logger.error(`Failed to create subscriber ${subscriberData.subscriberId}:`, error)
      throw error
    }
  }

  async updateSubscriber(subscriberId, updateData) {
    try {
      const subscriber = await this.novu.subscribers.update(subscriberId, updateData)
      logger.info(`Subscriber updated: ${subscriberId}`)
      return subscriber
    } catch (error) {
      logger.error(`Failed to update subscriber ${subscriberId}:`, error)
      throw error
    }
  }

  async deleteSubscriber(subscriberId) {
    try {
      await this.novu.subscribers.delete(subscriberId)
      logger.info(`Subscriber deleted: ${subscriberId}`)
    } catch (error) {
      logger.error(`Failed to delete subscriber ${subscriberId}:`, error)
      throw error
    }
  }

  async getSubscriber(subscriberId) {
    try {
      const subscriber = await this.novu.subscribers.get(subscriberId)
      return subscriber
    } catch (error) {
      logger.error(`Failed to get subscriber ${subscriberId}:`, error)
      throw error
    }
  }

  // Preference Management
  async updateSubscriberPreferences(subscriberId, preferences) {
    try {
      const updatedPreferences = await this.novu.subscribers.updatePreferences(
        subscriberId,
        preferences
      )
      logger.info(`Preferences updated for subscriber: ${subscriberId}`)
      return updatedPreferences
    } catch (error) {
      logger.error(`Failed to update preferences for ${subscriberId}:`, error)
      throw error
    }
  }

  async getSubscriberPreferences(subscriberId) {
    try {
      const preferences = await this.novu.subscribers.getPreferences(subscriberId)
      return preferences
    } catch (error) {
      logger.error(`Failed to get preferences for ${subscriberId}:`, error)
      throw error
    }
  }

  // Notification Triggering
  async triggerNotification(notificationData) {
    try {
      const {
        name,
        to,
        payload,
        overrides,
        actor,
        tenant,
        transactionId = uuidv4()
      } = notificationData

      const result = await this.novu.trigger(name, {
        to,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          source: 'enterprise-crm'
        },
        overrides,
        actor,
        tenant,
        transactionId
      })

      logger.info(`Notification triggered: ${name} for ${to.subscriberId || to}`)
      return result
    } catch (error) {
      logger.error(`Failed to trigger notification ${notificationData.name}:`, error)
      throw error
    }
  }

  // Bulk Notification Triggering
  async triggerBulkNotifications(notifications) {
    try {
      const events = notifications.map(notification => ({
        name: notification.name,
        to: notification.to,
        payload: {
          ...notification.payload,
          timestamp: new Date().toISOString(),
          source: 'enterprise-crm'
        },
        overrides: notification.overrides,
        actor: notification.actor,
        tenant: notification.tenant,
        transactionId: notification.transactionId || uuidv4()
      }))

      const result = await this.novu.bulkTrigger(events)
      logger.info(`Bulk notifications triggered: ${notifications.length} events`)
      return result
    } catch (error) {
      logger.error('Failed to trigger bulk notifications:', error)
      throw error
    }
  }

  // Topic Management
  async createTopic(topicData) {
    try {
      const { key, name, description } = topicData
      const topic = await this.novu.topics.create({
        key,
        name,
        description
      })
      logger.info(`Topic created: ${key}`)
      return topic
    } catch (error) {
      logger.error(`Failed to create topic ${topicData.key}:`, error)
      throw error
    }
  }

  async addSubscriberToTopic(topicKey, subscriberId) {
    try {
      await this.novu.topics.addSubscribers(topicKey, {
        subscribers: [subscriberId]
      })
      logger.info(`Subscriber ${subscriberId} added to topic ${topicKey}`)
    } catch (error) {
      logger.error(`Failed to add subscriber to topic:`, error)
      throw error
    }
  }

  async removeSubscriberFromTopic(topicKey, subscriberId) {
    try {
      await this.novu.topics.removeSubscribers(topicKey, {
        subscribers: [subscriberId]
      })
      logger.info(`Subscriber ${subscriberId} removed from topic ${topicKey}`)
    } catch (error) {
      logger.error(`Failed to remove subscriber from topic:`, error)
      throw error
    }
  }

  // Message Management
  async getMessages(subscriberId, options = {}) {
    try {
      const { page = 0, limit = 10, channel } = options
      const messages = await this.novu.messages.list({
        subscriberId,
        page,
        limit,
        channel
      })
      return messages
    } catch (error) {
      logger.error(`Failed to get messages for ${subscriberId}:`, error)
      throw error
    }
  }

  async markMessageAsRead(messageId, subscriberId) {
    try {
      await this.novu.messages.markAs(messageId, subscriberId, { seen: true })
      logger.info(`Message ${messageId} marked as read for ${subscriberId}`)
    } catch (error) {
      logger.error(`Failed to mark message as read:`, error)
      throw error
    }
  }

  async markMessageAsUnread(messageId, subscriberId) {
    try {
      await this.novu.messages.markAs(messageId, subscriberId, { seen: false })
      logger.info(`Message ${messageId} marked as unread for ${subscriberId}`)
    } catch (error) {
      logger.error(`Failed to mark message as unread:`, error)
      throw error
    }
  }

  async markAllMessagesAsRead(subscriberId) {
    try {
      await this.novu.messages.markAllAs(subscriberId, { seen: true })
      logger.info(`All messages marked as read for ${subscriberId}`)
    } catch (error) {
      logger.error(`Failed to mark all messages as read:`, error)
      throw error
    }
  }

  async deleteMessage(messageId) {
    try {
      await this.novu.messages.delete(messageId)
      logger.info(`Message deleted: ${messageId}`)
    } catch (error) {
      logger.error(`Failed to delete message ${messageId}:`, error)
      throw error
    }
  }

  // Notification Templates
  async getNotificationTemplates() {
    try {
      const templates = await this.novu.notificationTemplates.getAll()
      return templates
    } catch (error) {
      logger.error('Failed to get notification templates:', error)
      throw error
    }
  }

  async createNotificationTemplate(templateData) {
    try {
      const template = await this.novu.notificationTemplates.create(templateData)
      logger.info(`Notification template created: ${template.name}`)
      return template
    } catch (error) {
      logger.error('Failed to create notification template:', error)
      throw error
    }
  }

  async updateNotificationTemplate(templateId, updateData) {
    try {
      const template = await this.novu.notificationTemplates.update(templateId, updateData)
      logger.info(`Notification template updated: ${templateId}`)
      return template
    } catch (error) {
      logger.error(`Failed to update notification template ${templateId}:`, error)
      throw error
    }
  }

  // Analytics and Statistics
  async getNotificationStatistics(options = {}) {
    try {
      const stats = await this.novu.notifications.getStats(options)
      return stats
    } catch (error) {
      logger.error('Failed to get notification statistics:', error)
      throw error
    }
  }

  async getSubscriberNotificationFeed(subscriberId, options = {}) {
    try {
      const feed = await this.novu.subscribers.getNotificationsFeed(subscriberId, options)
      return feed
    } catch (error) {
      logger.error(`Failed to get notification feed for ${subscriberId}:`, error)
      throw error
    }
  }

  async getUnseenCount(subscriberId) {
    try {
      const count = await this.novu.subscribers.getUnseenCount(subscriberId)
      return count
    } catch (error) {
      logger.error(`Failed to get unseen count for ${subscriberId}:`, error)
      throw error
    }
  }

  // Workflow Management
  async triggerWorkflow(workflowData) {
    try {
      const {
        name,
        to,
        payload,
        overrides,
        actor,
        tenant
      } = workflowData

      const result = await this.novu.trigger(name, {
        to,
        payload,
        overrides,
        actor,
        tenant
      })

      logger.info(`Workflow triggered: ${name}`)
      return result
    } catch (error) {
      logger.error(`Failed to trigger workflow ${workflowData.name}:`, error)
      throw error
    }
  }

  // Health Check
  async healthCheck() {
    try {
      await this.novu.subscribers.list({ page: 0, limit: 1 })
      return { status: 'healthy', timestamp: new Date().toISOString() }
    } catch (error) {
      logger.error('Novu health check failed:', error)
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }
    }
  }

  // Utility Methods
  isInitialized() {
    return this.initialized
  }

  async validateWebhook(body, signature) {
    try {
      // Implement webhook signature validation
      // This would typically use the webhook secret to verify the signature
      return true
    } catch (error) {
      logger.error('Webhook validation failed:', error)
      return false
    }
  }
}

module.exports = new NovuService()

