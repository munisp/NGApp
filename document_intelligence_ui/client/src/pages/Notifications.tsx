import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error' | 'critical';
  category: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string | null;
  isRead: number;
  createdAt: Date | string;
}

export default function Notifications() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const utils = trpc.useUtils();

  // Fetch notifications
  const { data: notificationsData, isLoading } = trpc.notifications.getNotifications.useQuery({
    unreadOnly: showUnreadOnly,
    category: filterCategory !== 'all' ? filterCategory : undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
      toast.success('All notifications marked as read');
    },
  });

  const deleteNotificationMutation = trpc.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      utils.notifications.getNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
      toast.success('Notification deleted');
    },
  });

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate({ notificationId });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-700" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      urgent: { label: 'Urgent', className: 'bg-red-600 text-white' },
      high: { label: 'High', className: 'bg-orange-600 text-white' },
      medium: { label: 'Medium', className: 'bg-yellow-600 text-white' },
      low: { label: 'Low', className: 'bg-gray-600 text-white' },
    };
    const config = variants[priority] || variants.medium;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const notifications = notificationsData?.notifications || [];
  const total = notificationsData?.total || 0;
  const unreadCount = notifications.filter((n: Notification) => n.isRead === 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Notifications</h1>
            <p className="text-muted-foreground">
              {total} total notifications, {unreadCount} unread
            </p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} variant="outline">
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="ocr_processing">OCR Processing</SelectItem>
                    <SelectItem value="batch_processing">Batch Processing</SelectItem>
                    <SelectItem value="lakehouse">Lakehouse</SelectItem>
                    <SelectItem value="ingestion">Ingestion</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Button
                  variant={showUnreadOnly ? 'default' : 'outline'}
                  onClick={() => {
                    setShowUnreadOnly(!showUnreadOnly);
                    setPage(1);
                  }}
                  className="w-full"
                >
                  {showUnreadOnly ? 'Unread Only' : 'All Notifications'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  {showUnreadOnly
                    ? 'You have no unread notifications'
                    : 'You have no notifications yet'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {notifications.map((notification: Notification) => (
                <Card
                  key={notification.id}
                  className={`${
                    notification.isRead === 0 ? 'border-l-4 border-l-blue-600 bg-blue-50/50' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">{notification.title}</h3>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{notification.category}</Badge>
                              {getPriorityBadge(notification.priority)}
                              {notification.isRead === 0 && (
                                <Badge className="bg-blue-600 text-white">Unread</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {notification.isRead === 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Mark Read
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(notification.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-muted-foreground mb-3">{notification.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {notification.actionUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => {
                                window.location.href = notification.actionUrl!;
                                handleMarkAsRead(notification.id);
                              }}
                            >
                              View Details →
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {total > pageSize && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
                  {total} notifications
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
