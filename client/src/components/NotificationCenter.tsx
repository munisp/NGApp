/**
 * OG-RMM Platform — Notification Center
 *
 * Features:
 * - Real-time alarm notifications via polling
 * - Mark as read / dismiss
 * - Notification categories: alarms, system, maintenance, compliance
 * - Bell icon with unread count badge
 * - Popover panel with notification list
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellOff,
  AlertTriangle,
  Info,
  CheckCircle2,
  Wrench,
  Shield,
  X,
  Check,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: "alarm" | "system" | "maintenance" | "compliance" | "info";
  severity?: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: Date | string;
  read: boolean;
  link?: string;
  wellId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIcon(type: Notification["type"], severity?: Notification["severity"]) {
  switch (type) {
    case "alarm":
      return severity === "critical" || severity === "high"
        ? <AlertTriangle className="h-4 w-4 text-red-400" />
        : <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case "maintenance":
      return <Wrench className="h-4 w-4 text-blue-400" />;
    case "compliance":
      return <Shield className="h-4 w-4 text-purple-400" />;
    case "system":
      return <Info className="h-4 w-4 text-cyan-400" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  }
}

function getSeverityColor(severity?: Notification["severity"]) {
  switch (severity) {
    case "critical": return "bg-red-950/50 border-l-2 border-l-red-500";
    case "high": return "bg-orange-950/30 border-l-2 border-l-orange-500";
    case "medium": return "bg-yellow-950/20 border-l-2 border-l-yellow-500";
    default: return "bg-muted/30";
  }
}

function formatRelativeTime(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  // Fetch active alarms as notifications
  const { data: alarmsData, refetch: refetchAlarms } = trpc.alarms.list.useQuery(
    { state: "UNACKNOWLEDGED", limit: 20 },
    { refetchInterval: 30000 } // Poll every 30 seconds
  );

  // No system.getNotifications procedure — use empty array
  const systemNotifs: unknown[] = [];
  const refetchSystem = () => {};

  // Build unified notification list
  const notifications: Notification[] = [
    // Convert alarms to notifications
    ...(alarmsData ?? []).slice(0, 20).map((alarm) => ({
      id: `alarm-${alarm.alarmId}`,
      type: "alarm" as const,
      severity: alarm.severity >= 4 ? "critical" : alarm.severity >= 3 ? "high" : alarm.severity >= 2 ? "medium" : "low" as Notification["severity"],
      title: `Severity ${alarm.severity} Alarm — ${alarm.wellId}`,
      message: alarm.description ?? alarm.tag ?? "Alarm triggered",
      timestamp: alarm.createdAt ?? new Date(),
      read: localRead.has(`alarm-${alarm.alarmId}`) || alarm.state !== "UNACKNOWLEDGED",
      link: `/alarms`,
      wellId: alarm.wellId,
    })),
    // System notifications
    ...(systemNotifs as Record<string, unknown>[]).slice(0, 10).map((n, i) => ({
      id: `sys-${i}`,
      type: "system" as const,
      title: String(n.title ?? "System Notification"),
      message: String(n.content ?? n.message ?? ""),
      timestamp: n.createdAt ? new Date(n.createdAt as string) : new Date(),
      read: localRead.has(`sys-${i}`),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set<string>(notifications.map(n => n.id));
    setLocalRead(allIds);
  };

  const markRead = (id: string) => {
    setLocalRead(prev => { const next = new Set<string>(prev); next.add(id); return next; });
  };

  const dismissAll = () => {
    markAllRead();
    setOpen(false);
  };

  // Auto-refetch when popover opens
  useEffect(() => {
    if (open) {
      refetchAlarms();
      refetchSystem?.();
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          {unreadCount > 0 ? (
            <Bell className="h-4 w-4 text-yellow-400 animate-pulse" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-96 p-0 bg-card border-border shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm text-white">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="bg-red-900 text-red-300 text-xs h-5">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-white"
                onClick={markAllRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <BellOff className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`relative px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors ${
                    getSeverityColor(notif.severity)
                  } ${notif.read ? "opacity-60" : ""}`}
                  onClick={() => markRead(notif.id)}
                >
                  {!notif.read && (
                    <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-400" />
                  )}
                  <div className="flex items-start gap-3 pr-4">
                    <div className="mt-0.5 shrink-0">
                      {getIcon(notif.type, notif.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(notif.timestamp)}
                        </span>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => { markRead(notif.id); setOpen(false); }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                          >
                            View <ChevronRight className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between px-4 py-2">
          <Link
            href="/alarms"
            onClick={() => setOpen(false)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View all alarms
          </Link>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={dismissAll}
            >
              Dismiss all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;
