// Notification routes: send, preferences, history
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const notificationRouter = Router();

type Channel = 'email' | 'sms' | 'push' | 'websocket' | 'ussd';
type NotificationType = 'trade_executed' | 'order_filled' | 'margin_call' | 'price_alert' |
  'kyc_update' | 'settlement_complete' | 'security_alert' | 'system_announcement';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: Channel;
  title: string;
  body: string;
  metadata: Record<string, string>;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  createdAt: Date;
  sentAt?: Date;
}

const notifications: Notification[] = [];

// Send a notification
notificationRouter.post('/send', async (req: Request, res: Response) => {
  const { userId, type, channels, title, body, metadata } = req.body;

  if (!userId || !type || !title || !body) {
    res.status(400).json({ error: 'userId, type, title, and body are required' });
    return;
  }

  const targetChannels: Channel[] = channels || ['push', 'email'];
  const results: Notification[] = [];

  for (const channel of targetChannels) {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      type,
      channel,
      title,
      body,
      metadata: metadata || {},
      status: 'queued',
      createdAt: new Date(),
    };

    notifications.push(notification);
    results.push(notification);

    // In production: Route to appropriate sender
    // email -> Nodemailer/SES
    // sms -> Twilio/Africa's Talking
    // push -> FCM/APNs
    // websocket -> Direct WebSocket connection
    // ussd -> USSD gateway
  }

  res.status(201).json({ notifications: results });
});

// Get notification history for a user
notificationRouter.get('/history/:userId', async (req: Request, res: Response) => {
  const userNotifications = notifications
    .filter(n => n.userId === req.params.userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

  res.json({ notifications: userNotifications, total: userNotifications.length });
});

// Get/update notification preferences
notificationRouter.get('/preferences/:userId', async (req: Request, res: Response) => {
  // In production: fetch from PostgreSQL
  res.json({
    userId: req.params.userId,
    channels: {
      email: { enabled: true, types: ['trade_executed', 'margin_call', 'settlement_complete'] },
      sms: { enabled: true, types: ['margin_call', 'security_alert'] },
      push: { enabled: true, types: ['trade_executed', 'order_filled', 'price_alert'] },
      websocket: { enabled: true, types: ['trade_executed', 'order_filled', 'price_alert'] },
      ussd: { enabled: false, types: ['price_alert'] },
    },
    quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'Africa/Lagos' },
  });
});

notificationRouter.put('/preferences/:userId', async (req: Request, res: Response) => {
  // In production: update in PostgreSQL
  res.json({ status: 'updated', userId: req.params.userId });
});

// Send price alert
notificationRouter.post('/price-alert', async (req: Request, res: Response) => {
  const { userId, symbol, targetPrice, direction } = req.body;
  // In production: create alert in Redis, monitor via market data service
  res.status(201).json({
    alertId: uuidv4(),
    userId,
    symbol,
    targetPrice,
    direction,
    status: 'active',
  });
});
