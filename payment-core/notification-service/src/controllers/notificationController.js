const novuService = require('../services/novuService')
const logger = require('../utils/logger')
const { validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')

class NotificationController {
  // Subscriber Management
  async createSubscriber(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        })
      }

      const subscriberData = {
        subscriberId: req.body.subscriberId || uuidv4(),
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        avatar: req.body.avatar,
        data: req.body.data || {}
      }

      const subscriber = await novuService.createSubscriber(subscriberData)

      res.status(201).json({
        success: true,
        message: 'Subscriber created successfully',
        data: subscriber
      })
    } catch (error) {
      logger.error('Error creating subscriber:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to create subscriber',
        error: error.message
      })
    }
  }

  async updateSubscriber(req, res) {
    try {
      const { subscriberId } = req.params
      const updateData = req.body

      const subscriber = await novuService.updateSubscriber(subscriberId, updateData)

      res.json({
        success: true,
        message: 'Subscriber updated successfully',
        data: subscriber
      })
    } catch (error) {
      logger.error('Error updating subscriber:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update subscriber',
        error: error.message
      })
    }
  }

  async deleteSubscriber(req, res) {
    try {
      const { subscriberId } = req.params

      await novuService.deleteSubscriber(subscriberId)

      res.json({
        success: true,
        message: 'Subscriber deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting subscriber:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to delete subscriber',
        error: error.message
      })
    }
  }

  async getSubscriber(req, res) {
    try {
      const { subscriberId } = req.params

      const subscriber = await novuService.getSubscriber(subscriberId)

      res.json({
        success: true,
        data: subscriber
      })
    } catch (error) {
      logger.error('Error getting subscriber:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get subscriber',
        error: error.message
      })
    }
  }

  // Notification Triggering
  async triggerNotification(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        })
      }

      const notificationData = {
        name: req.body.name,
        to: req.body.to,
        payload: req.body.payload || {},
        overrides: req.body.overrides,
        actor: req.body.actor,
        tenant: req.body.tenant,
        transactionId: req.body.transactionId || uuidv4()
      }

      const result = await novuService.triggerNotification(notificationData)

      res.status(201).json({
        success: true,
        message: 'Notification triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering notification:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger notification',
        error: error.message
      })
    }
  }

  async triggerBulkNotifications(req, res) {
    try {
      const { notifications } = req.body

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Notifications array is required and must not be empty'
        })
      }

      const result = await novuService.triggerBulkNotifications(notifications)

      res.status(201).json({
        success: true,
        message: 'Bulk notifications triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering bulk notifications:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger bulk notifications',
        error: error.message
      })
    }
  }

  // Enterprise CRM Specific Notifications
  async triggerCustomerNotification(req, res) {
    try {
      const { type, customerId, data } = req.body

      const notificationTemplates = {
        'customer_registered': 'customer-welcome',
        'customer_updated': 'customer-profile-updated',
        'customer_deleted': 'customer-account-deleted',
        'payment_received': 'payment-confirmation',
        'payment_failed': 'payment-failed',
        'subscription_renewed': 'subscription-renewal',
        'subscription_expired': 'subscription-expired'
      }

      const templateName = notificationTemplates[type]
      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: `Unknown notification type: ${type}`
        })
      }

      const notificationData = {
        name: templateName,
        to: {
          subscriberId: customerId
        },
        payload: {
          customerId,
          type,
          ...data,
          timestamp: new Date().toISOString()
        }
      }

      const result = await novuService.triggerNotification(notificationData)

      res.status(201).json({
        success: true,
        message: 'Customer notification triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering customer notification:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger customer notification',
        error: error.message
      })
    }
  }

  async triggerSalesNotification(req, res) {
    try {
      const { type, leadId, opportunityId, userId, data } = req.body

      const notificationTemplates = {
        'lead_created': 'lead-assignment',
        'lead_updated': 'lead-status-update',
        'lead_converted': 'lead-conversion',
        'opportunity_created': 'opportunity-assignment',
        'opportunity_updated': 'opportunity-progress',
        'deal_closed_won': 'deal-success',
        'deal_closed_lost': 'deal-lost',
        'quota_achieved': 'quota-celebration',
        'follow_up_reminder': 'follow-up-reminder'
      }

      const templateName = notificationTemplates[type]
      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: `Unknown sales notification type: ${type}`
        })
      }

      const notificationData = {
        name: templateName,
        to: {
          subscriberId: userId
        },
        payload: {
          leadId,
          opportunityId,
          userId,
          type,
          ...data,
          timestamp: new Date().toISOString()
        }
      }

      const result = await novuService.triggerNotification(notificationData)

      res.status(201).json({
        success: true,
        message: 'Sales notification triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering sales notification:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger sales notification',
        error: error.message
      })
    }
  }

  async triggerInventoryNotification(req, res) {
    try {
      const { type, productId, warehouseId, userId, data } = req.body

      const notificationTemplates = {
        'low_stock_alert': 'inventory-low-stock',
        'out_of_stock_alert': 'inventory-out-of-stock',
        'restock_reminder': 'inventory-restock',
        'product_added': 'inventory-product-added',
        'product_updated': 'inventory-product-updated',
        'supplier_order': 'inventory-supplier-order',
        'delivery_received': 'inventory-delivery-received',
        'quality_check_failed': 'inventory-quality-alert'
      }

      const templateName = notificationTemplates[type]
      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: `Unknown inventory notification type: ${type}`
        })
      }

      const notificationData = {
        name: templateName,
        to: {
          subscriberId: userId
        },
        payload: {
          productId,
          warehouseId,
          userId,
          type,
          ...data,
          timestamp: new Date().toISOString()
        }
      }

      const result = await novuService.triggerNotification(notificationData)

      res.status(201).json({
        success: true,
        message: 'Inventory notification triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering inventory notification:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger inventory notification',
        error: error.message
      })
    }
  }

  async triggerSystemNotification(req, res) {
    try {
      const { type, severity, message, affectedUsers, data } = req.body

      const notificationTemplates = {
        'system_maintenance': 'system-maintenance',
        'system_update': 'system-update',
        'security_alert': 'security-alert',
        'backup_completed': 'backup-status',
        'backup_failed': 'backup-failure',
        'performance_alert': 'performance-alert',
        'service_outage': 'service-outage',
        'service_restored': 'service-restored'
      }

      const templateName = notificationTemplates[type]
      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: `Unknown system notification type: ${type}`
        })
      }

      // Send to multiple users or broadcast
      const notifications = affectedUsers.map(userId => ({
        name: templateName,
        to: {
          subscriberId: userId
        },
        payload: {
          type,
          severity,
          message,
          ...data,
          timestamp: new Date().toISOString()
        }
      }))

      const result = await novuService.triggerBulkNotifications(notifications)

      res.status(201).json({
        success: true,
        message: 'System notifications triggered successfully',
        data: result
      })
    } catch (error) {
      logger.error('Error triggering system notification:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to trigger system notification',
        error: error.message
      })
    }
  }

  // Message Management
  async getMessages(req, res) {
    try {
      const { subscriberId } = req.params
      const { page = 0, limit = 10, channel } = req.query

      const messages = await novuService.getMessages(subscriberId, {
        page: parseInt(page),
        limit: parseInt(limit),
        channel
      })

      res.json({
        success: true,
        data: messages
      })
    } catch (error) {
      logger.error('Error getting messages:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get messages',
        error: error.message
      })
    }
  }

  async markMessageAsRead(req, res) {
    try {
      const { messageId } = req.params
      const { subscriberId } = req.body

      await novuService.markMessageAsRead(messageId, subscriberId)

      res.json({
        success: true,
        message: 'Message marked as read'
      })
    } catch (error) {
      logger.error('Error marking message as read:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to mark message as read',
        error: error.message
      })
    }
  }

  async markAllMessagesAsRead(req, res) {
    try {
      const { subscriberId } = req.params

      await novuService.markAllMessagesAsRead(subscriberId)

      res.json({
        success: true,
        message: 'All messages marked as read'
      })
    } catch (error) {
      logger.error('Error marking all messages as read:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to mark all messages as read',
        error: error.message
      })
    }
  }

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params

      await novuService.deleteMessage(messageId)

      res.json({
        success: true,
        message: 'Message deleted successfully'
      })
    } catch (error) {
      logger.error('Error deleting message:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to delete message',
        error: error.message
      })
    }
  }

  // Preferences Management
  async updatePreferences(req, res) {
    try {
      const { subscriberId } = req.params
      const preferences = req.body

      const updatedPreferences = await novuService.updateSubscriberPreferences(
        subscriberId,
        preferences
      )

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: updatedPreferences
      })
    } catch (error) {
      logger.error('Error updating preferences:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        error: error.message
      })
    }
  }

  async getPreferences(req, res) {
    try {
      const { subscriberId } = req.params

      const preferences = await novuService.getSubscriberPreferences(subscriberId)

      res.json({
        success: true,
        data: preferences
      })
    } catch (error) {
      logger.error('Error getting preferences:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get preferences',
        error: error.message
      })
    }
  }

  // Analytics
  async getNotificationStats(req, res) {
    try {
      const { subscriberId, from, to } = req.query

      const stats = await novuService.getNotificationStatistics({
        subscriberId,
        from,
        to
      })

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Error getting notification stats:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get notification statistics',
        error: error.message
      })
    }
  }

  async getUnseenCount(req, res) {
    try {
      const { subscriberId } = req.params

      const count = await novuService.getUnseenCount(subscriberId)

      res.json({
        success: true,
        data: count
      })
    } catch (error) {
      logger.error('Error getting unseen count:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get unseen count',
        error: error.message
      })
    }
  }

  // Health Check
  async healthCheck(req, res) {
    try {
      const health = await novuService.healthCheck()

      res.json({
        success: true,
        data: health
      })
    } catch (error) {
      logger.error('Health check failed:', error)
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message
      })
    }
  }

  // Webhook Handler
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['novu-signature']
      const body = req.body

      // Validate webhook signature
      const isValid = await novuService.validateWebhook(body, signature)
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        })
      }

      // Process webhook event
      logger.info('Webhook received:', body)

      // Handle different webhook events
      switch (body.type) {
        case 'notification.sent':
          // Handle notification sent event
          break
        case 'notification.delivered':
          // Handle notification delivered event
          break
        case 'notification.read':
          // Handle notification read event
          break
        case 'notification.clicked':
          // Handle notification clicked event
          break
        default:
          logger.warn(`Unknown webhook event type: ${body.type}`)
      }

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      })
    } catch (error) {
      logger.error('Error processing webhook:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      })
    }
  }
}

module.exports = new NotificationController()

