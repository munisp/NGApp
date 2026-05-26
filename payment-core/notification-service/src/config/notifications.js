const express = require('express')
const { body, param, query } = require('express-validator')
const notificationController = require('../controllers/notificationController')
const authMiddleware = require('../middleware/auth')
const rateLimitMiddleware = require('../middleware/rateLimit')

const router = express.Router()

// Apply authentication and rate limiting to all routes
router.use(authMiddleware)
router.use(rateLimitMiddleware)

// Subscriber Management Routes
router.post('/subscribers',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('subscriberId').optional().isString(),
    body('phone').optional().isMobilePhone(),
    body('avatar').optional().isURL(),
    body('data').optional().isObject()
  ],
  notificationController.createSubscriber
)

router.put('/subscribers/:subscriberId',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required'),
    body('email').optional().isEmail(),
    body('firstName').optional().notEmpty(),
    body('lastName').optional().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('avatar').optional().isURL(),
    body('data').optional().isObject()
  ],
  notificationController.updateSubscriber
)

router.delete('/subscribers/:subscriberId',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.deleteSubscriber
)

router.get('/subscribers/:subscriberId',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.getSubscriber
)

// Notification Triggering Routes
router.post('/trigger',
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('to').isObject().withMessage('Recipient information is required'),
    body('to.subscriberId').notEmpty().withMessage('Subscriber ID is required'),
    body('payload').optional().isObject(),
    body('overrides').optional().isObject(),
    body('actor').optional().isObject(),
    body('tenant').optional().isString(),
    body('transactionId').optional().isString()
  ],
  notificationController.triggerNotification
)

router.post('/trigger/bulk',
  [
    body('notifications').isArray({ min: 1 }).withMessage('Notifications array is required and must not be empty'),
    body('notifications.*.name').notEmpty().withMessage('Template name is required for each notification'),
    body('notifications.*.to').isObject().withMessage('Recipient information is required for each notification'),
    body('notifications.*.to.subscriberId').notEmpty().withMessage('Subscriber ID is required for each notification')
  ],
  notificationController.triggerBulkNotifications
)

// Enterprise CRM Specific Notification Routes
router.post('/trigger/customer',
  [
    body('type').isIn([
      'customer_registered',
      'customer_updated',
      'customer_deleted',
      'payment_received',
      'payment_failed',
      'subscription_renewed',
      'subscription_expired'
    ]).withMessage('Invalid customer notification type'),
    body('customerId').notEmpty().withMessage('Customer ID is required'),
    body('data').optional().isObject()
  ],
  notificationController.triggerCustomerNotification
)

router.post('/trigger/sales',
  [
    body('type').isIn([
      'lead_created',
      'lead_updated',
      'lead_converted',
      'opportunity_created',
      'opportunity_updated',
      'deal_closed_won',
      'deal_closed_lost',
      'quota_achieved',
      'follow_up_reminder'
    ]).withMessage('Invalid sales notification type'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('leadId').optional().isString(),
    body('opportunityId').optional().isString(),
    body('data').optional().isObject()
  ],
  notificationController.triggerSalesNotification
)

router.post('/trigger/inventory',
  [
    body('type').isIn([
      'low_stock_alert',
      'out_of_stock_alert',
      'restock_reminder',
      'product_added',
      'product_updated',
      'supplier_order',
      'delivery_received',
      'quality_check_failed'
    ]).withMessage('Invalid inventory notification type'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('productId').optional().isString(),
    body('warehouseId').optional().isString(),
    body('data').optional().isObject()
  ],
  notificationController.triggerInventoryNotification
)

router.post('/trigger/system',
  [
    body('type').isIn([
      'system_maintenance',
      'system_update',
      'security_alert',
      'backup_completed',
      'backup_failed',
      'performance_alert',
      'service_outage',
      'service_restored'
    ]).withMessage('Invalid system notification type'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
    body('message').notEmpty().withMessage('Message is required'),
    body('affectedUsers').isArray({ min: 1 }).withMessage('Affected users array is required'),
    body('data').optional().isObject()
  ],
  notificationController.triggerSystemNotification
)

// Message Management Routes
router.get('/subscribers/:subscriberId/messages',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required'),
    query('page').optional().isInt({ min: 0 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('channel').optional().isIn(['email', 'sms', 'push', 'in_app', 'chat'])
  ],
  notificationController.getMessages
)

router.patch('/messages/:messageId/read',
  [
    param('messageId').notEmpty().withMessage('Message ID is required'),
    body('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.markMessageAsRead
)

router.patch('/subscribers/:subscriberId/messages/read-all',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.markAllMessagesAsRead
)

router.delete('/messages/:messageId',
  [
    param('messageId').notEmpty().withMessage('Message ID is required')
  ],
  notificationController.deleteMessage
)

// Preferences Management Routes
router.put('/subscribers/:subscriberId/preferences',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required'),
    body().isObject().withMessage('Preferences object is required')
  ],
  notificationController.updatePreferences
)

router.get('/subscribers/:subscriberId/preferences',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.getPreferences
)

// Analytics Routes
router.get('/stats',
  [
    query('subscriberId').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ],
  notificationController.getNotificationStats
)

router.get('/subscribers/:subscriberId/unseen-count',
  [
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  notificationController.getUnseenCount
)

// Health Check Route
router.get('/health', notificationController.healthCheck)

// Webhook Route (no auth required)
router.post('/webhook', 
  express.raw({ type: 'application/json' }),
  notificationController.handleWebhook
)

// Template Management Routes (Admin only)
router.get('/templates', 
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const templates = await require('../services/novuService').getNotificationTemplates()
      res.json({
        success: true,
        data: templates
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get templates',
        error: error.message
      })
    }
  }
)

router.post('/templates',
  authMiddleware.requireAdmin,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('description').optional().isString(),
    body('steps').isArray({ min: 1 }).withMessage('Template steps are required'),
    body('tags').optional().isArray(),
    body('critical').optional().isBoolean(),
    body('draft').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const template = await require('../services/novuService').createNotificationTemplate(req.body)
      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create template',
        error: error.message
      })
    }
  }
)

// Topic Management Routes
router.post('/topics',
  [
    body('key').notEmpty().withMessage('Topic key is required'),
    body('name').notEmpty().withMessage('Topic name is required'),
    body('description').optional().isString()
  ],
  async (req, res) => {
    try {
      const topic = await require('../services/novuService').createTopic(req.body)
      res.status(201).json({
        success: true,
        message: 'Topic created successfully',
        data: topic
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create topic',
        error: error.message
      })
    }
  }
)

router.post('/topics/:topicKey/subscribers',
  [
    param('topicKey').notEmpty().withMessage('Topic key is required'),
    body('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  async (req, res) => {
    try {
      await require('../services/novuService').addSubscriberToTopic(
        req.params.topicKey,
        req.body.subscriberId
      )
      res.json({
        success: true,
        message: 'Subscriber added to topic successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to add subscriber to topic',
        error: error.message
      })
    }
  }
)

router.delete('/topics/:topicKey/subscribers/:subscriberId',
  [
    param('topicKey').notEmpty().withMessage('Topic key is required'),
    param('subscriberId').notEmpty().withMessage('Subscriber ID is required')
  ],
  async (req, res) => {
    try {
      await require('../services/novuService').removeSubscriberFromTopic(
        req.params.topicKey,
        req.params.subscriberId
      )
      res.json({
        success: true,
        message: 'Subscriber removed from topic successfully'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to remove subscriber from topic',
        error: error.message
      })
    }
  }
)

module.exports = router

