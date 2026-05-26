/**
 * OnboardingWizard.tsx — 3-step guided setup for new users
 * Step 1: Connect first device (register RTU/PLC)
 * Step 2: Invite first team member
 * Step 3: Configure first alarm threshold
 *
 * Shows automatically when: user is authenticated AND (no devices OR no users invited)
 * Can be dismissed and re-opened via the "Setup Guide" button in the header
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MonitorSmartphone, Users, Bell, CheckCircle2, ArrowRight,
  ArrowLeft, X, Zap, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: MonitorSmartphone, label: "Connect Device", description: "Register your first field device" },
  { id: 2, icon: Users, label: "Invite Team Member", description: "Add your first operator or engineer" },
  { id: 3, icon: Bell, label: "Set Alarm Threshold", description: "Configure your first production alert" },
];

// ─── Step 1: Connect Device ───────────────────────────────────────────────────

function Step1Device({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [form, setForm] = useState({
    deviceId: "",
    name: "",
    deviceType: "RTU" as const,
    fieldLocation: "",
    wellId: "",
  });
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");

  const registerMutation = trpc.deviceManagement.registerDevice.useMutation({
    onSuccess: (data) => {
      setToken(data.provisioningToken ?? "");
      setDone(true);
      toast.success(`Device ${form.deviceId} registered successfully`);
    },
    onError: (err) => toast.error(`Registration failed: ${err.message}`),
  });

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="font-medium text-emerald-400">Device registered!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your device is now provisioned and ready to connect.</p>
          </div>
        </div>
        {token && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Provisioning Token (copy this now)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono text-amber-400 break-all">{token}</code>
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0"
                onClick={() => { navigator.clipboard.writeText(token); toast.success("Copied"); }}>
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Use this token to authenticate the device on first boot.</p>
          </div>
        )}
        <Button onClick={onComplete} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
          Continue to Next Step <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Register your first field device (RTU, PLC, or SCADA gateway) to start receiving live telemetry data.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Device ID *</Label>
          <Input value={form.deviceId} onChange={e => setForm(p => ({ ...p, deviceId: e.target.value }))}
            placeholder="e.g. RTU-WELL-001" className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Display Name *</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Well-1 RTU" className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Device Type</Label>
          <Select value={form.deviceType} onValueChange={v => setForm(p => ({ ...p, deviceType: v as any }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SMART_SENSOR", "EDGE_GATEWAY"].map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Field Location</Label>
          <Input value={form.fieldLocation} onChange={e => setForm(p => ({ ...p, fieldLocation: e.target.value }))}
            placeholder="e.g. Greater Burgan, Pad 3" className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Well ID (optional)</Label>
          <Input value={form.wellId} onChange={e => setForm(p => ({ ...p, wellId: e.target.value }))}
            placeholder="e.g. WELL-001" className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-muted-foreground h-8">
          Skip for now
        </Button>
        <Button
          onClick={() => registerMutation.mutate({
            deviceId: form.deviceId,
            name: form.name,
            deviceType: form.deviceType,
            fieldLocation: form.fieldLocation || undefined,
            wellId: form.wellId || undefined,
          })}
          disabled={!form.deviceId || !form.name || registerMutation.isPending}
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-sm"
        >
          {registerMutation.isPending ? "Registering..." : "Register Device"}
          {!registerMutation.isPending && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Invite Team Member ───────────────────────────────────────────────

function Step2Invite({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin" | "operator" | "supervisor" | "engineer">("operator");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const inviteMutation = trpc.userOnboarding.createInvitation.useMutation({
    onSuccess: (data) => {
      setInviteLink(data.inviteUrl ?? "");
      setDone(true);
      toast.success(`Invitation sent to ${email}`);
    },
    onError: (err) => toast.error(`Invitation failed: ${err.message}`),
  });

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="font-medium text-emerald-400">Invitation sent!</p>
            <p className="text-xs text-muted-foreground mt-0.5">The invite link is valid for 72 hours.</p>
          </div>
        </div>
        {inviteLink && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Invite Link</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono text-blue-400 break-all">{inviteLink}</code>
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0"
                onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied"); }}>
                Copy
              </Button>
            </div>
          </div>
        )}
        <Button onClick={onComplete} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
          Continue to Next Step <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Invite your first operator or engineer. They'll receive a secure link to join the platform.
      </p>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Email Address *</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)}
            type="email" placeholder="operator@company.com"
            className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Role</Label>
          <Select value={role} onValueChange={v => setRole(v as any)}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operator">Operator — can view and acknowledge alarms</SelectItem>
              <SelectItem value="engineer">Engineer — can configure alarm rules and workovers</SelectItem>
              <SelectItem value="supervisor">Supervisor — can approve permits and shift handovers</SelectItem>
              <SelectItem value="admin">Administrator — full access including configuration</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Welcome Message (optional)</Label>
          <Input value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Welcome to the team! Please complete your setup."
            className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-muted-foreground h-8">
          Skip for now
        </Button>
        <Button
          onClick={() => inviteMutation.mutate({ email, role, message: message || undefined, origin: window.location.origin })}
          disabled={!email || inviteMutation.isPending}
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-sm"
        >
          {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
          {!inviteMutation.isPending && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Configure Alarm Threshold ───────────────────────────────────────

function Step3Alarm({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [form, setForm] = useState({
    wellId: "",
    tag: "WELLHEAD_PRESSURE",
    sensorField: "pressure",
    condition: "GT" as "GT" | "LT" | "GTE" | "LTE",
    threshold: "500",
    severity: "3",
    description: "High wellhead pressure alert",
    unit: "psi",
  });
  const [done, setDone] = useState(false);

  const { data: wellsData } = trpc.wells.list.useQuery({ limit: 100 });
  const wells = wellsData?.wells ?? [];

  const createRuleMutation = trpc.wells.createAlarmRule.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Alarm threshold configured successfully");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="font-medium text-emerald-400">Alarm threshold configured!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You'll be alerted when {form.tag} {form.condition === "GT" ? "exceeds" : "falls below"} {form.threshold} {form.unit}.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
          <p className="text-sm font-medium text-amber-400">🎉 Setup complete!</p>
          <p className="text-xs text-muted-foreground">
            Your platform is ready. You can always add more devices, users, and alarm rules from the navigation menu.
          </p>
        </div>
        <Button onClick={onComplete} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
          Go to Dashboard <Zap className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your first production alert. You'll be notified when a sensor reading crosses this threshold.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Well *</Label>
          <Select value={form.wellId} onValueChange={v => setForm(p => ({ ...p, wellId: v }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50">
              <SelectValue placeholder="Select a well" />
            </SelectTrigger>
            <SelectContent>
              {wells.map((w: any) => (
                <SelectItem key={w.id} value={w.wellId ?? String(w.id)}>{w.name} — {w.field}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Sensor / Tag</Label>
          <Select value={form.tag} onValueChange={v => setForm(p => ({ ...p, tag: v }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[
                { value: "WELLHEAD_PRESSURE", label: "Wellhead Pressure" },
                { value: "TUBING_PRESSURE", label: "Tubing Pressure" },
                { value: "CASING_PRESSURE", label: "Casing Pressure" },
                { value: "FLOW_RATE_OIL", label: "Oil Flow Rate" },
                { value: "FLOW_RATE_GAS", label: "Gas Flow Rate" },
                { value: "BOTTOM_HOLE_TEMP", label: "Bottom-Hole Temperature" },
              ].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Condition</Label>
          <Select value={form.condition} onValueChange={v => setForm(p => ({ ...p, condition: v as any }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GT">Greater than (&gt;)</SelectItem>
              <SelectItem value="LT">Less than (&lt;)</SelectItem>
              <SelectItem value="GTE">Greater than or equal (≥)</SelectItem>
              <SelectItem value="LTE">Less than or equal (≤)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Threshold Value *</Label>
          <Input value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))}
            type="number" placeholder="500" className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Unit</Label>
          <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["psi", "bar", "°C", "°F", "bbl/d", "Mcf/d", "m³/d"].map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Severity</Label>
          <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Critical — immediate push alert</SelectItem>
              <SelectItem value="3">High — alert after 15 minutes</SelectItem>
              <SelectItem value="2">Medium — in-app only</SelectItem>
              <SelectItem value="1">Low — informational</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Alert Description</Label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="e.g. High wellhead pressure alert"
            className="mt-1 h-8 text-sm bg-background border-border/50" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-muted-foreground h-8">
          Skip for now
        </Button>
        <Button
          onClick={() => createRuleMutation.mutate({
            wellId: form.wellId,
            tag: form.tag,
            sensorField: form.sensorField,
            condition: form.condition,
            threshold: parseFloat(form.threshold),
            severity: parseInt(form.severity),
            description: form.description,
            unit: form.unit,
          })}
          disabled={!form.wellId || !form.threshold || createRuleMutation.isPending}
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-sm"
        >
          {createRuleMutation.isPending ? "Saving..." : "Create Alert"}
          {!createRuleMutation.isPending && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const progress = ((step - 1) / STEPS.length) * 100;

  const handleComplete = () => {
    if (step < STEPS.length) {
      setStep(s => s + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    if (step < STEPS.length) {
      setStep(s => s + 1);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <DialogTitle className="font-[Syne] text-base">Platform Setup Guide</DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Step {step} of {STEPS.length}
            </Badge>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <Progress value={progress + (100 / STEPS.length)} className="h-1.5" />

        {/* Step tabs */}
        <div className="flex gap-1">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <button
                key={s.id}
                onClick={() => s.id < step && setStep(s.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-colors",
                  isActive ? "bg-amber-950/40 border border-amber-700/40" : isDone ? "opacity-60 cursor-pointer hover:opacity-80" : "opacity-30 cursor-default"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  isActive ? "bg-amber-600 text-white" : isDone ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className={cn("text-[10px] font-medium leading-tight", isActive ? "text-amber-400" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="pt-1">
          <div className="mb-3">
            <h3 className="font-semibold text-sm">{STEPS[step - 1].label}</h3>
            <p className="text-xs text-muted-foreground">{STEPS[step - 1].description}</p>
          </div>
          {step === 1 && <Step1Device onComplete={handleComplete} onSkip={handleSkip} />}
          {step === 2 && <Step2Invite onComplete={handleComplete} onSkip={handleSkip} />}
          {step === 3 && <Step3Alarm onComplete={handleComplete} onSkip={handleSkip} />}
        </div>

        {/* Back navigation */}
        {step > 1 && (
          <div className="flex justify-start pt-1 border-t border-border/50">
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="text-xs gap-1.5 h-7 text-muted-foreground">
              <ArrowLeft className="w-3 h-3" /> Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Setup Guide trigger button (for use in DashboardLayout header) ───────────

export function SetupGuideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600/15 border border-amber-600/30 text-amber-400 hover:bg-amber-600/25 transition-colors"
    >
      <Zap className="w-3 h-3" />
      Setup Guide
      <ChevronRight className="w-3 h-3 opacity-60" />
    </button>
  );
}
