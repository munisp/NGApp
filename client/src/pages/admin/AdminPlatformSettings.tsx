/**
 * Admin Platform Settings
 * ========================
 * Unified settings page for NDPC admins covering:
 *  - Email transport status (SMTP / Resend / Forge relay)
 *  - SMTP connection test + send test email
 *  - Stripe payment configuration status + go-live guide
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Mail, CheckCircle2, XCircle, AlertTriangle, Send,
  CreditCard, Zap, Shield, ExternalLink, Copy, RefreshCw,
  Server, Globe, Lock, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Status Indicator ────────────────────────────────────────────────────────

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        : <XCircle className="h-4 w-4 text-red-400" />}
      <span className={ok ? "text-emerald-300" : "text-red-300"}>{label}</span>
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-slate-200 text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Email Settings Tab ───────────────────────────────────────────────────────

function EmailSettingsTab() {
  const { data: emailStatus, isLoading, refetch } = trpc.adminSettings.emailStatus.useQuery();
  const testEmailMutation = trpc.adminSettings.testEmail.useMutation();
  const [testTo, setTestTo] = useState("");

  const handleTestEmail = async () => {
    if (!testTo || !testTo.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    try {
      const result = await testEmailMutation.mutateAsync({ toEmail: testTo });
      if (result.success) {
        toast.success(`Test email sent via ${result.transport}`);
      } else {
        toast.error(`Send failed: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send test email");
    }
  };

  const transportLabel = {
    smtp: "SMTP (Custom Mail Server)",
    resend: "Resend (Transactional Email SaaS)",
    forge: "Manus Forge Relay (Default)",
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading email configuration...
      </div>
    );
  }

  const transport = emailStatus?.activeTransport ?? "forge";

  return (
    <div className="space-y-6">
      {/* Active Transport Banner */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Mail className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Active Transport</p>
              <p className="text-xs text-slate-400">{transportLabel[transport]}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              transport === "smtp"
                ? "border-emerald-500 text-emerald-400"
                : transport === "resend"
                ? "border-blue-500 text-blue-400"
                : "border-slate-500 text-slate-400"
            }
          >
            {transport.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Transport Priority Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SMTP */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-200">Priority 1 — SMTP</CardTitle>
              <StatusDot ok={!!emailStatus?.smtp.configured} label={emailStatus?.smtp.configured ? "Configured" : "Not set"} />
            </div>
            <CardDescription className="text-xs">Custom mail server (nitda.gov.ng)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Host" value={emailStatus?.smtp.host ?? "Not configured"} mono />
            <InfoRow label="Port" value={emailStatus?.smtp.port?.toString()} mono />
            <InfoRow label="TLS" value={emailStatus?.smtp.secure ? "SSL/TLS (465)" : "STARTTLS (587)"} />
            <InfoRow label="From" value={emailStatus?.smtp.from} />
            {emailStatus?.smtp.testResult && (
              <div className="mt-2 pt-2 border-t border-slate-800">
                <StatusDot
                  ok={emailStatus.smtp.testResult.ok}
                  label={emailStatus.smtp.testResult.ok ? "Connection verified" : emailStatus.smtp.testResult.error ?? "Connection failed"}
                />
              </div>
            )}
            {!emailStatus?.smtp.configured && (
              <p className="text-xs text-slate-500 mt-2">
                Set <code className="text-cyan-400">SMTP_HOST</code>, <code className="text-cyan-400">SMTP_USER</code>, and <code className="text-cyan-400">SMTP_PASS</code> in Settings → Secrets to activate.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resend */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-200">Priority 2 — Resend</CardTitle>
              <StatusDot ok={!!emailStatus?.resend.configured} label={emailStatus?.resend.configured ? "Configured" : "Not set"} />
            </div>
            <CardDescription className="text-xs">Transactional email SaaS (resend.com)</CardDescription>
          </CardHeader>
          <CardContent>
            {emailStatus?.resend.configured
              ? <p className="text-xs text-emerald-400">API key is configured and active.</p>
              : (
                <p className="text-xs text-slate-500">
                  Set <code className="text-cyan-400">RESEND_API_KEY</code> in Settings → Secrets to activate.
                  Get a free key at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">resend.com</a>.
                </p>
              )
            }
          </CardContent>
        </Card>

        {/* Forge Relay */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-200">Priority 3 — Forge Relay</CardTitle>
              <StatusDot ok label="Always available" />
            </div>
            <CardDescription className="text-xs">Manus built-in notification relay</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">
              Zero-config fallback. Always available. Sends to the platform owner's notification feed.
              Suitable for development and staging environments.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-slate-800" />

      {/* Test Email */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Send Test Email</h3>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="admin@nitda.gov.ng"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 flex-1"
          />
          <Button
            onClick={handleTestEmail}
            disabled={testEmailMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {testEmailMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Test
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="border-slate-700 text-slate-300">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Sends a test message via the active transport ({transport}). Check your inbox to confirm delivery.
        </p>
      </div>

      {/* SMTP Configuration Guide */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-cyan-400" />
          SMTP Configuration Reference
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <p className="font-medium text-slate-300 mb-1">NITDA / Government SMTP</p>
            <code className="block bg-slate-800 rounded p-2 text-cyan-300">
              SMTP_HOST=smtp.nitda.gov.ng<br />
              SMTP_PORT=587<br />
              SMTP_SECURE=false<br />
              SMTP_USER=noreply@ndsep.nitda.gov.ng<br />
              SMTP_PASS=&lt;your-password&gt;<br />
              SMTP_FROM=NDSEP Platform &lt;noreply@ndsep.nitda.gov.ng&gt;
            </code>
          </div>
          <div>
            <p className="font-medium text-slate-300 mb-1">Gmail / Google Workspace</p>
            <code className="block bg-slate-800 rounded p-2 text-cyan-300">
              SMTP_HOST=smtp.gmail.com<br />
              SMTP_PORT=465<br />
              SMTP_SECURE=true<br />
              SMTP_USER=noreply@yourdomain.gov.ng<br />
              SMTP_PASS=&lt;app-password&gt;<br />
              SMTP_FROM=NDSEP &lt;noreply@yourdomain.gov.ng&gt;
            </code>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Add these as secrets in Settings → Secrets. Changes take effect on next server restart.
        </p>
      </div>
    </div>
  );
}

// ─── Stripe Settings Tab ──────────────────────────────────────────────────────

function StripeSettingsTab() {
  const { data: stripeStatus, isLoading, refetch } = trpc.adminSettings.stripeStatus.useQuery();
  const [copied, setCopied] = useState(false);

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/stripe/webhook`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading Stripe configuration...
      </div>
    );
  }

  const modeColor: Record<string, string> = {
    live: "border-emerald-500 text-emerald-400",
    test: "border-amber-500 text-amber-400",
    unconfigured: "border-red-500 text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Mode Banner */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <CreditCard className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Stripe Payment Mode</p>
              <p className="text-xs text-slate-400">
                {stripeStatus?.mode === "live"
                  ? "Processing real payments — live keys active"
                  : stripeStatus?.mode === "test"
                  ? "Test mode — use card 4242 4242 4242 4242"
                  : "Stripe not configured — payments disabled"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={modeColor[stripeStatus?.mode ?? "unconfigured"]}>
            {(stripeStatus?.mode ?? "UNCONFIGURED").toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Lock className="h-4 w-4 text-violet-400" />
              Secret Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDot ok={!!stripeStatus?.configured} label={stripeStatus?.configured ? "Configured" : "Not set"} />
            {!stripeStatus?.configured && (
              <p className="text-xs text-slate-500 mt-2">
                Set <code className="text-cyan-400">STRIPE_SECRET_KEY</code> in Settings → Payment.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Globe className="h-4 w-4 text-violet-400" />
              Publishable Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDot ok={!!stripeStatus?.publishableKeyConfigured} label={stripeStatus?.publishableKeyConfigured ? "Configured" : "Not set"} />
            {!stripeStatus?.publishableKeyConfigured && (
              <p className="text-xs text-slate-500 mt-2">
                Set <code className="text-cyan-400">VITE_STRIPE_PUBLISHABLE_KEY</code> in Settings → Payment.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" />
              Webhook Secret
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDot ok={!!stripeStatus?.webhookConfigured} label={stripeStatus?.webhookConfigured ? "Configured" : "Not set"} />
            {!stripeStatus?.webhookConfigured && (
              <p className="text-xs text-slate-500 mt-2">
                Set <code className="text-cyan-400">STRIPE_WEBHOOK_SECRET</code> in Settings → Payment.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Endpoint */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-400" />
          Webhook Endpoint
        </h4>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-800 rounded px-3 py-2 text-sm text-cyan-300 font-mono">
            {window.location.origin}/api/stripe/webhook
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={copyWebhookUrl}
            className="border-slate-700 text-slate-300"
          >
            <Copy className="h-4 w-4 mr-1" />
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Register this URL in your Stripe Dashboard → Developers → Webhooks.
          Events to listen for: <code className="text-cyan-400">checkout.session.completed</code>, <code className="text-cyan-400">invoice.paid</code>, <code className="text-cyan-400">customer.subscription.updated</code>.
        </p>
      </div>

      {/* Go-Live Checklist */}
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
        <h4 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Stripe Go-Live Checklist
        </h4>
        <ol className="space-y-2 text-sm text-slate-300">
          {[
            { done: stripeStatus?.mode === "test" || stripeStatus?.mode === "live", text: "Claim your Stripe sandbox (expires 2026-06-02)" },
            { done: stripeStatus?.mode === "live", text: "Complete Stripe KYC / business verification" },
            { done: stripeStatus?.mode === "live", text: "Replace test keys with live keys in Settings → Payment" },
            { done: stripeStatus?.webhookConfigured, text: "Register webhook endpoint in Stripe Dashboard" },
            { done: stripeStatus?.mode === "live", text: "Test with a real card using the 99% discount promo code" },
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              {item.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                : <div className="h-4 w-4 rounded-full border border-slate-600 mt-0.5 shrink-0" />}
              <span className={item.done ? "text-slate-400 line-through" : ""}>{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => window.open(stripeStatus?.stripeClaimUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Claim Stripe Sandbox
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-300"
            onClick={() => window.open("https://dashboard.stripe.com/developers/webhooks", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Stripe Dashboard
          </Button>
        </div>
      </div>

      {/* Test Card */}
      {stripeStatus?.mode === "test" && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            Test Card Numbers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { card: "4242 4242 4242 4242", label: "Visa — succeeds" },
              { card: "4000 0000 0000 0002", label: "Visa — always declined" },
              { card: "4000 0025 0000 3155", label: "Visa — requires 3DS auth" },
              { card: "5555 5555 5555 4444", label: "Mastercard — succeeds" },
            ].map((c) => (
              <div key={c.card} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                <code className="text-cyan-300 font-mono">{c.card}</code>
                <span className="text-slate-400 ml-2">{c.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Use any future expiry date, any 3-digit CVC, and any postal code.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPlatformSettings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-300">Platform Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Shield className="h-6 w-6 text-cyan-400" />
            Platform Settings
          </h1>
          <p className="text-slate-400 mt-1">
            Configure email delivery, payment processing, and integration credentials for the NDSEP platform.
          </p>
        </div>

        <Tabs defaultValue="email" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-700">
            <TabsTrigger value="email" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Mail className="h-4 w-4 mr-2" />
              Email Delivery
            </TabsTrigger>
            <TabsTrigger value="stripe" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <CreditCard className="h-4 w-4 mr-2" />
              Stripe Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <EmailSettingsTab />
          </TabsContent>

          <TabsContent value="stripe">
            <StripeSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
