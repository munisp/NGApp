import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  type: 'transaction' | 'security' | 'promotion' | 'system' | 'kyc';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  transactionAlerts: boolean;
  securityAlerts: boolean;
  promotions: boolean;
  systemUpdates: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'settings'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    transactionAlerts: true,
    securityAlerts: true,
    promotions: false,
    systemUpdates: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        setNotifications(await response.json());
      } else {
        // Mock data
        setNotifications([
          {
            id: '1',
            type: 'transaction',
            title: 'Transfer Successful',
            message: 'Your transfer of NGN 50,000 to Chioma Adeyemi has been completed.',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            isRead: false,
            actionUrl: '/transactions',
            actionLabel: 'View Details',
          },
          {
            id: '2',
            type: 'security',
            title: 'New Login Detected',
            message: 'A new login was detected from Chrome on Windows in Lagos, Nigeria.',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            isRead: false,
            actionUrl: '/security',
            actionLabel: 'Review Activity',
          },
          {
            id: '3',
            type: 'kyc',
            title: 'KYC Verification Complete',
            message: 'Your identity verification has been approved. You now have full access.',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            isRead: true,
          },
          {
            id: '4',
            type: 'promotion',
            title: 'Special Offer',
            message: 'Send money to Ghana with 0% fees this weekend! Limited time offer.',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            isRead: true,
            actionUrl: '/send',
            actionLabel: 'Send Now',
          },
          {
            id: '5',
            type: 'system',
            title: 'Scheduled Maintenance',
            message: 'We will be performing maintenance on Dec 15, 2025 from 2:00 AM - 4:00 AM WAT.',
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            isRead: true,
          },
          {
            id: '6',
            type: 'transaction',
            title: 'Money Received',
            message: 'You received NGN 25,000 from Emeka Okafor.',
            timestamp: new Date(Date.now() - 345600000).toISOString(),
            isRead: true,
            actionUrl: '/transactions',
            actionLabel: 'View Details',
          },
        ]);
      }
    } catch {
      // Use mock data on error
      setNotifications([
        {
          id: '1',
          type: 'transaction',
          title: 'Transfer Successful',
          message: 'Your transfer of NGN 50,000 to Chioma Adeyemi has been completed.',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          isRead: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
    } catch {
      // Keep optimistic update
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
    } catch {
      // Keep optimistic update
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
    } catch {
      // Keep optimistic update
    }
  };

  const updateSettings = async (key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await fetch(`${API_BASE_URL}/api/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // Keep optimistic update
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'transaction':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'security':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'promotion':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        );
      case 'kyc':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'transaction':
        return 'bg-green-100 text-green-600';
      case 'security':
        return 'bg-red-100 text-red-600';
      case 'promotion':
        return 'bg-purple-100 text-purple-600';
      case 'kyc':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-gray-500">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && activeTab !== 'settings' && (
          <button
            onClick={markAllAsRead}
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {(['all', 'unread', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors relative ${
              activeTab === tab
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {activeTab !== 'settings' && (
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-gray-500">
                {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl p-4 shadow-sm transition-colors ${
                  !notification.isRead ? 'border-l-4 border-primary-500' : ''
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                    {getTypeIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      {notification.actionUrl && (
                        <a
                          href={notification.actionUrl}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {notification.actionLabel || 'View'}
                        </a>
                      )}
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-sm text-gray-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl shadow-sm divide-y">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Channels</h2>
            <div className="space-y-4">
              <SettingToggle
                label="Push Notifications"
                description="Receive notifications on your device"
                enabled={settings.pushEnabled}
                onChange={(v) => updateSettings('pushEnabled', v)}
              />
              <SettingToggle
                label="Email Notifications"
                description="Receive notifications via email"
                enabled={settings.emailEnabled}
                onChange={(v) => updateSettings('emailEnabled', v)}
              />
              <SettingToggle
                label="SMS Notifications"
                description="Receive notifications via SMS"
                enabled={settings.smsEnabled}
                onChange={(v) => updateSettings('smsEnabled', v)}
              />
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Types</h2>
            <div className="space-y-4">
              <SettingToggle
                label="Transaction Alerts"
                description="Get notified about transfers, payments, and receipts"
                enabled={settings.transactionAlerts}
                onChange={(v) => updateSettings('transactionAlerts', v)}
              />
              <SettingToggle
                label="Security Alerts"
                description="Get notified about login attempts and security events"
                enabled={settings.securityAlerts}
                onChange={(v) => updateSettings('securityAlerts', v)}
              />
              <SettingToggle
                label="Promotions & Offers"
                description="Receive special offers and promotional content"
                enabled={settings.promotions}
                onChange={(v) => updateSettings('promotions', v)}
              />
              <SettingToggle
                label="System Updates"
                description="Get notified about maintenance and system updates"
                enabled={settings.systemUpdates}
                onChange={(v) => updateSettings('systemUpdates', v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-primary-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            enabled ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
