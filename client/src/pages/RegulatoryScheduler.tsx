/**
 * RegulatoryScheduler.tsx — Automated regulatory export configuration and history
 *
 * Allows operators to:
 *   - Configure the monthly export schedule (cron, standards, recipients)
 *   - Trigger an immediate export run
 *   - View export history with download links
 *   - Monitor scheduler health
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Download,
  FileText,
  Mail,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const ALL_STANDARDS = [
  { id: "IEC_61511", label: "IEC 61511", description: "SIL Compliance Report" },
  { id: "HSE_OSD", label: "HSE OSD", description: "UK Health & Safety Safety Case" },
  { id: "ADNOC", label: "ADNOC", description: "Abu Dhabi Production Report" },
  { id: "KOC", label: "KOC", description: "Kuwait Environmental Report" },
  { id: "ARAMCO", label: "Saudi Aramco", description: "Well Integrity Report" },
  { id: "BSEE", label: "BSEE", description: "US Bureau of Safety Production Report" },
  { id: "EPA", label: "EPA", description: "Environmental Compliance Report" },
] as const;

type Standard = (typeof ALL_STANDARDS)[number]["id"];

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    success: { color: "text-green-500 border-green-500", icon: <CheckCircle2 className="h-3 w-3" /> },
    partial: { color: "text-amber-500 border-amber-500", icon: <AlertTriangle className="h-3 w-3" /> },
    failed: { color: "text-red-500 border-red-500", icon: <XCircle className="h-3 w-3" /> },
    running: { color: "text-blue-500 border-blue-500", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  };
  const v = variants[status] ?? variants.failed;
  return (
    <Badge variant="outline" className={`gap-1 ${v.color}`}>
      {v.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function RegulatoryScheduler() {
  const [newRecipient, setNewRecipient] = useState("");
  const [isTriggeringNow, setIsTriggeringNow] = useState(false);

  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.regulatoryScheduler.status.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const { data: history, isLoading: historyLoading } = trpc.regulatoryScheduler.history.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000 }
  );

  const updateConfig = trpc.regulatoryScheduler.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Scheduler configuration updated");
      utils.regulatoryScheduler.status.invalidate();
    },
    onError: (err) => toast.error(`Failed to update config: ${err.message}`),
  });

  const triggerNow = trpc.regulatoryScheduler.triggerNow.useMutation({
    onMutate: () => setIsTriggeringNow(true),
    onSuccess: (run) => {
      setIsTriggeringNow(false);
      const successCount = run.reports.filter((r) => r.status === "success").length;
      toast.success(`Export complete — ${successCount}/${run.reports.length} reports generated`, {
        description: `Run ID: ${run.id} | Duration: ${run.durationMs}ms`,
      });
      utils.regulatoryScheduler.history.invalidate();
      utils.regulatoryScheduler.status.invalidate();
    },
    onError: (err) => {
      setIsTriggeringNow(false);
      toast.error(`Export failed: ${err.message}`);
    },
  });

  const handleToggleStandard = (standard: Standard) => {
    if (!status) return;
    const current = status.config.standards;
    const updated = current.includes(standard)
      ? current.filter((s) => s !== standard)
      : [...current, standard];
    updateConfig.mutate({ standards: updated });
  };

  const handleToggleEnabled = (enabled: boolean) => {
    updateConfig.mutate({ enabled });
  };

  const handleAddRecipient = () => {
    if (!newRecipient || !status) return;
    const updated = [...status.config.recipients, newRecipient];
    updateConfig.mutate({ recipients: updated });
    setNewRecipient("");
  };

  const handleRemoveRecipient = (email: string) => {
    if (!status) return;
    updateConfig.mutate({ recipients: status.config.recipients.filter((r) => r !== email) });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  const config = status?.config;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regulatory Export Scheduler</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated monthly PDF exports for IEC 61511, HSE, ADNOC, KOC, Aramco, BSEE, and EPA standards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Total runs</p>
            <p className="font-semibold">{status?.totalRuns ?? 0}</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Successful</p>
            <p className="font-semibold text-green-500">{status?.successfulRuns ?? 0}</p>
          </div>
          <Button
            onClick={() => triggerNow.mutate({})}
            disabled={isTriggeringNow}
            className="gap-2"
          >
            {isTriggeringNow ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isTriggeringNow ? "Generating…" : "Run Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Scheduler toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Schedule
                </CardTitle>
                <Switch
                  checked={config?.enabled ?? false}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>
              <CardDescription className="text-xs">
                {config?.enabled
                  ? `Active — runs on cron: ${config.cronExpression}`
                  : "Disabled — manual trigger only"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cron expression</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={config?.cronExpression ?? "0 6 1 * *"}
                    className="font-mono text-xs h-8"
                    onChange={(e) => updateConfig.mutate({ cronExpression: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Default: 1st of each month at 06:00 UTC
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Standards */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Standards
              </CardTitle>
              <CardDescription className="text-xs">
                Select which regulatory standards to include in each export run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_STANDARDS.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Checkbox
                    id={s.id}
                    checked={config?.standards.includes(s.id) ?? false}
                    onCheckedChange={() => handleToggleStandard(s.id)}
                  />
                  <label htmlFor={s.id} className="flex-1 cursor-pointer">
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.description}</span>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Email recipients */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Recipients
              </CardTitle>
              <CardDescription className="text-xs">
                Reports are emailed as links. Requires SMTP_HOST env var.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {config?.recipients.map((email) => (
                <div key={email} className="flex items-center justify-between">
                  <span className="text-sm truncate">{email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive"
                    onClick={() => handleRemoveRecipient(email)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {config?.recipients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No recipients — owner notification will be used as fallback
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="engineer@company.com"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddRecipient()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleAddRecipient} className="h-8">
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Export History
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => utils.regulatoryScheduler.history.invalidate()}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : !history || history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Calendar className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No export runs yet</p>
                  <p className="text-xs">Click "Run Now" to generate your first export</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((run) => (
                    <div key={run.id} className="border border-border/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={run.status} />
                          <Badge variant="secondary" className="text-xs">
                            {run.triggeredBy === "manual" ? "Manual" : "Scheduled"}
                          </Badge>
                          {run.emailSent && (
                            <Badge variant="outline" className="text-xs gap-1 text-blue-500 border-blue-500">
                              <Mail className="h-2.5 w-2.5" />
                              Emailed
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.triggeredAt).toLocaleString()}
                          </p>
                          {run.durationMs && (
                            <p className="text-xs text-muted-foreground">{run.durationMs}ms</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {run.reports.map((report) => (
                          <div key={report.standard} className="flex items-center gap-1">
                            {report.status === "success" && report.s3Url ? (
                              <a
                                href={report.s3Url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Download className="h-3 w-3" />
                                {report.standard}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground line-through">
                                <XCircle className="h-3 w-3 text-destructive" />
                                {report.standard}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
