/**
 * Settings.tsx
 * User settings page — push notifications, preferences, account info.
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell, BellOff, BellRing, Shield, User, Smartphone, CheckCircle2,
  AlertTriangle, XCircle, Loader2, Info, Send, History,
} from "lucide-react";

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const {
    isSupported,
    vapidConfigured,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const testPushMutation = trpc.push.testPush.useMutation({
    onSuccess: (data) => {
      toast.success("Test notification sent!", {
        description: data.message ?? "Check your browser notifications.",
        duration: 5000,
      });
    },
    onError: (err) => {
      toast.error("Failed to send test notification", {
        description: err.message,
      });
    },
  });

  const permissionBadge = () => {
    if (!isSupported) return <Badge variant="secondary">Not supported</Badge>;
    if (permission === "granted") return <Badge className="bg-emerald-600 text-white">Granted</Badge>;
    if (permission === "denied") return <Badge variant="destructive">Denied</Badge>;
    return <Badge variant="outline">Not requested</Badge>;
  };

  const permissionIcon = () => {
    if (!isSupported) return <Info className="w-4 h-4 text-muted-foreground" />;
    if (permission === "granted") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (permission === "denied") return <XCircle className="w-4 h-4 text-rose-500" />;
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account preferences and notification settings.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-amber-500" />
            Account
          </CardTitle>
          <CardDescription>Your profile information from Manus OAuth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAuthenticated && user ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Name</p>
                <p className="font-medium">{user.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Role</p>
                <Badge variant="outline" className="capitalize text-xs">{user.role}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Email</p>
                <p className="font-medium">{user.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Open ID</p>
                <p className="font-mono text-xs text-muted-foreground truncate">{user.openId}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not signed in.</p>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="w-4 h-4 text-amber-500" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive critical alarm alerts on this device even when the app is in the background.
            Requires browser permission and a service worker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status row */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
            <div className="flex items-center gap-3">
              {permissionIcon()}
              <div>
                <p className="text-sm font-medium">Browser Permission</p>
                <p className="text-xs text-muted-foreground">
                  {permission === "granted"
                    ? "Notifications are allowed in this browser"
                    : permission === "denied"
                    ? "Notifications are blocked — update in browser settings"
                    : !isSupported
                    ? "This browser does not support push notifications"
                    : "Permission has not been requested yet"}
                </p>
              </div>
            </div>
            {permissionBadge()}
          </div>

          {/* VAPID status */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Server Configuration</p>
                <p className="text-xs text-muted-foreground">
                  {vapidConfigured
                    ? "Push notification service is configured and active"
                    : "Push notification service is not configured — contact your administrator"}
                </p>
              </div>
            </div>
            {vapidConfigured
              ? <Badge className="bg-emerald-600 text-white">Configured</Badge>
              : <Badge variant="destructive">Not configured</Badge>}
          </div>

          {/* Device subscription toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-amber-500" />
              <div>
                <Label className="text-sm font-medium cursor-pointer">
                  This Device
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSubscribed
                    ? "Critical alarms will be pushed to this device"
                    : "Enable to receive critical alarm push alerts"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isSubscribed && <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">Active</Badge>}
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={(checked) => {
                    if (!isAuthenticated) return;
                    if (checked) subscribe();
                    else unsubscribe();
                  }}
                  disabled={!isSupported || !vapidConfigured || !isAuthenticated || permission === "denied"}
                />
              )}
            </div>
          </div>

          {permission === "denied" && (
            <div className="flex items-start gap-2 rounded-md bg-rose-950/30 border border-rose-800/40 p-3 text-xs text-rose-300">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Notifications are blocked in your browser. To re-enable, click the lock icon in the
                address bar and set Notifications to "Allow", then reload this page.
              </span>
            </div>
          )}

          {!isAuthenticated && (
            <div className="flex items-start gap-2 rounded-md bg-amber-950/30 border border-amber-800/40 p-3 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>You must be signed in to enable push notifications.</span>
            </div>
          )}

          {/* Test notification button */}
          {isSubscribed && vapidConfigured && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/10">
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">Test Notification</p>
                  <p className="text-xs text-muted-foreground">
                    Send a test push to verify your subscription is working.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => testPushMutation.mutate({})}
                disabled={testPushMutation.isPending}
              >
                {testPushMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                {testPushMutation.isPending ? "Sending…" : "Send Test"}
              </Button>
            </div>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">What triggers a push notification?</p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Severity-4 (Critical) alarms unacknowledged for more than 5 minutes</li>
              <li>Severity-3 (High) alarms unacknowledged for more than 15 minutes</li>
              <li>Alarms that remain unacknowledged beyond their standing threshold</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Alarm notification preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-amber-500" />
            Alarm Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure which alarm severities trigger browser push alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Severity 4 — Critical", description: "Immediate push + email escalation", enabled: true, locked: true },
            { label: "Severity 3 — High", description: "Push after 15-minute delay", enabled: true, locked: false },
            { label: "Severity 2 — Medium", description: "In-app only (no push)", enabled: false, locked: false },
            { label: "Severity 1 — Low", description: "In-app only (no push)", enabled: false, locked: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={item.enabled}
                disabled={item.locked}
                onCheckedChange={() => {}}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            Critical alarm push notifications are always enabled and cannot be disabled.
          </p>
        </CardContent>
      </Card>

      {/* Recent Notification History */}
      {isAuthenticated && <NotificationHistory />}
    </div>
  );
}

function NotificationHistory() {
  const { data: history, isLoading } = trpc.push.myNotificationHistory.useQuery();
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-amber-500" />
          Recent Notifications
        </CardTitle>
        <CardDescription>Last 20 push/email/SMS alerts sent to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!history || history.length === 0) && (
          <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
        )}
        {history && history.length > 0 && (
          <div className="space-y-2">
            {history.map((n: any) => (
              <div key={n.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {n.tag && <Badge variant="outline" className="text-xs h-5">{n.tag}</Badge>}
                  <span className="text-xs text-muted-foreground">{new Date(n.sent_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
