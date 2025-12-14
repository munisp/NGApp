import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Fetch notifications
  const { data: notificationsData, refetch } = trpc.notifications.getNotifications.useQuery(
    { unreadOnly: false, limit: 10 },
    { enabled: true }
  );

  // Fetch unread count
  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
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

  // Listen for WebSocket notifications
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    const handleSystemNotification = (data: any) => {
      // Refetch notifications
      refetch();
      utils.notifications.getUnreadCount.invalidate();

      // Show toast
      const notification = data.notification;
      if (notification) {
        const toastFn = getToastFunction(notification.type);
        toastFn(notification.title, {
          description: notification.message,
        });
      }
    };

    socket.on('system:notification', handleSystemNotification);

    return () => {
      socket.off('system:notification', handleSystemNotification);
    };
  }, [socket, refetch, utils]);

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate({ notificationId });
  };

  const getToastFunction = (type: string) => {
    switch (type) {
      case 'success':
        return toast.success;
      case 'warning':
        return toast.warning;
      case 'error':
      case 'critical':
        return toast.error;
      default:
        return toast.info;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-700" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 border-red-300';
      case 'high':
        return 'bg-orange-100 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadData?.count || 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[500px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-6 text-xs"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={`p-3 border-l-2 ${
                  notification.isRead === 0 ? 'bg-blue-50' : 'bg-white'
                } ${getPriorityColor(notification.priority)} hover:bg-muted/50 transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{notification.title}</p>
                      {notification.isRead === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        {notification.actionUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.location.href = notification.actionUrl!;
                              handleMarkAsRead(notification.id);
                            }}
                            className="h-6 text-xs px-2"
                          >
                            View
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-xs text-muted-foreground cursor-pointer"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
            >
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
