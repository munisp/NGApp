import { ScrollView, Text, View, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface ModelVersion {
  versionId: string;
  status: "production" | "staged" | "training" | "retired";
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  auc: number;
  trainingSamples: string;
  trainingDuration: string;
  triggerType: string;
  createdAt: string;
  deployedAt: string;
}

interface TrainingJob {
  jobId: string;
  status: "running" | "completed" | "failed" | "queued";
  progress: number;
  triggerType: string;
  startedAt: string;
  duration: string;
  epoch: number;
  totalEpochs: number;
  currentLoss: number;
}

interface PerformanceAlert {
  id: string;
  metric: string;
  current: number;
  threshold: number;
  direction: "above" | "below";
  severity: "critical" | "warning";
  timestamp: string;
  acknowledged: boolean;
}

const DEMO_MODELS: ModelVersion[] = [
  { versionId: "v2.1.0", status: "production", precision: 0.9912, recall: 0.9673, f1: 0.9791, fpr: 0.0012, auc: 0.9847, trainingSamples: "12.4M", trainingDuration: "4h 23m", triggerType: "scheduled", createdAt: "2026-02-01", deployedAt: "2026-02-01" },
  { versionId: "v2.0.3", status: "retired", precision: 0.9889, recall: 0.9645, f1: 0.9765, fpr: 0.0015, auc: 0.9823, trainingSamples: "11.8M", trainingDuration: "4h 12m", triggerType: "degradation", createdAt: "2026-01-15", deployedAt: "2026-01-15" },
  { versionId: "v2.0.2", status: "retired", precision: 0.9856, recall: 0.9601, f1: 0.9727, fpr: 0.0019, auc: 0.9801, trainingSamples: "11.2M", trainingDuration: "3h 58m", triggerType: "scheduled", createdAt: "2026-01-01", deployedAt: "2026-01-01" },
  { versionId: "v2.0.1", status: "retired", precision: 0.9834, recall: 0.9578, f1: 0.9704, fpr: 0.0022, auc: 0.9789, trainingSamples: "10.6M", trainingDuration: "3h 45m", triggerType: "manual", createdAt: "2025-12-15", deployedAt: "2025-12-15" },
];

const DEMO_JOBS: TrainingJob[] = [
  { jobId: "job_a1b2c3", status: "running", progress: 67, triggerType: "scheduled", startedAt: "2 hours ago", duration: "2h 01m", epoch: 134, totalEpochs: 200, currentLoss: 0.0234 },
  { jobId: "job_d4e5f6", status: "completed", progress: 100, triggerType: "degradation", startedAt: "1 day ago", duration: "4h 23m", epoch: 200, totalEpochs: 200, currentLoss: 0.0189 },
  { jobId: "job_g7h8i9", status: "completed", progress: 100, triggerType: "scheduled", startedAt: "15 days ago", duration: "4h 12m", epoch: 200, totalEpochs: 200, currentLoss: 0.0201 },
];

const DEMO_ALERTS: PerformanceAlert[] = [
  { id: "pa1", metric: "False Positive Rate", current: 0.0018, threshold: 0.002, direction: "above", severity: "warning", timestamp: "30 min ago", acknowledged: false },
  { id: "pa2", metric: "Recall", current: 0.9610, threshold: 0.965, direction: "below", severity: "warning", timestamp: "2 hours ago", acknowledged: true },
  { id: "pa3", metric: "F1 Score", current: 0.9750, threshold: 0.970, direction: "below", severity: "critical", timestamp: "6 hours ago", acknowledged: true },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    production: { bg: "bg-green-100", text: "text-green-700" },
    staged: { bg: "bg-blue-100", text: "text-blue-700" },
    training: { bg: "bg-yellow-100", text: "text-yellow-700" },
    retired: { bg: "bg-gray-100", text: "text-gray-700" },
    running: { bg: "bg-blue-100", text: "text-blue-700" },
    completed: { bg: "bg-green-100", text: "text-green-700" },
    failed: { bg: "bg-red-100", text: "text-red-700" },
    queued: { bg: "bg-gray-100", text: "text-gray-700" },
  };
  const s = styles[status] || styles.retired;
  return (
    <View className={`px-2 py-0.5 rounded-full ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{status.toUpperCase()}</Text>
    </View>
  );
}

export default function FraudRetrainingScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<"models" | "jobs" | "alerts">("models");
  const [runningJob, setRunningJob] = useState(DEMO_JOBS[0]);

  useEffect(() => {
    if (runningJob.status !== "running") return;
    const interval = setInterval(() => {
      setRunningJob(prev => {
        if (prev.progress >= 100) return { ...prev, status: "completed" as const, progress: 100 };
        return { ...prev, progress: Math.min(prev.progress + 0.5, 100), epoch: Math.min(prev.epoch + 1, prev.totalEpochs), currentLoss: Math.max(prev.currentLoss - 0.0001, 0.0180) };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [runningJob.status]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-1">Model Retraining</Text>
        <Text className="text-sm text-muted mb-4">Automated via Ray + Temporal with performance monitoring</Text>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-green-50 rounded-xl p-3 border border-green-200 items-center">
            <Text className="text-xs text-green-600">Production</Text>
            <Text className="text-lg font-bold text-green-700">v2.1.0</Text>
          </View>
          <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-200 items-center">
            <Text className="text-xs text-blue-600">Training</Text>
            <Text className="text-lg font-bold text-blue-700">{runningJob.progress.toFixed(0)}%</Text>
          </View>
          <View className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-200 items-center">
            <Text className="text-xs text-yellow-600">Alerts</Text>
            <Text className="text-lg font-bold text-yellow-700">{DEMO_ALERTS.filter(a => !a.acknowledged).length}</Text>
          </View>
        </View>

        <View className="flex-row bg-surface rounded-xl p-1 border border-border mb-6">
          {(["models", "jobs", "alerts"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className={`flex-1 py-2 rounded-lg ${tab === t ? "bg-primary" : ""}`}>
              <Text className={`text-center text-sm font-semibold ${tab === t ? "text-white" : "text-muted"}`}>
                {t === "models" ? "Models" : t === "jobs" ? "Training" : "Alerts"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "models" && (
          <View className="gap-3 mb-6">
            {DEMO_MODELS.map((model) => (
              <View key={model.versionId} className="bg-surface rounded-xl border border-border p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-foreground">{model.versionId}</Text>
                    <StatusBadge status={model.status} />
                  </View>
                  <Text className="text-xs text-muted">{model.createdAt}</Text>
                </View>
                <View className="flex-row gap-3 mb-2">
                  <View className="flex-1">
                    <Text className="text-xs text-muted">Precision</Text>
                    <Text className="text-sm font-bold text-foreground">{model.precision.toFixed(4)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted">Recall</Text>
                    <Text className="text-sm font-bold text-foreground">{model.recall.toFixed(4)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted">F1</Text>
                    <Text className="text-sm font-bold text-foreground">{model.f1.toFixed(4)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted">AUC</Text>
                    <Text className="text-sm font-bold text-foreground">{model.auc.toFixed(4)}</Text>
                  </View>
                </View>
                <View className="flex-row gap-4">
                  <Text className="text-xs text-muted">FPR: {(model.fpr * 100).toFixed(2)}%</Text>
                  <Text className="text-xs text-muted">Samples: {model.trainingSamples}</Text>
                  <Text className="text-xs text-muted">Duration: {model.trainingDuration}</Text>
                </View>
                {model.status === "production" && (
                  <View className="flex-row gap-2 mt-2">
                    <Pressable className="bg-red-100 px-3 py-1.5 rounded-lg">
                      <Text className="text-red-700 text-xs font-semibold">Rollback</Text>
                    </Pressable>
                  </View>
                )}
                {model.status === "staged" && (
                  <View className="flex-row gap-2 mt-2">
                    <Pressable className="bg-green-100 px-3 py-1.5 rounded-lg">
                      <Text className="text-green-700 text-xs font-semibold">Deploy</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {tab === "jobs" && (
          <View className="gap-3 mb-6">
            {runningJob.status === "running" && (
              <View className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-2">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-bold text-blue-800">Training in Progress</Text>
                  <StatusBadge status="running" />
                </View>
                <View className="h-3 bg-blue-200 rounded-full overflow-hidden mb-2">
                  <View className="h-full bg-blue-500 rounded-full" style={{ width: `${runningJob.progress}%` }} />
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-blue-600">Epoch {runningJob.epoch}/{runningJob.totalEpochs}</Text>
                  <Text className="text-xs text-blue-600">Loss: {runningJob.currentLoss.toFixed(4)}</Text>
                  <Text className="text-xs text-blue-600">{runningJob.progress.toFixed(0)}%</Text>
                </View>
                <View className="flex-row gap-4 mt-2">
                  <Text className="text-xs text-blue-600">Job: {runningJob.jobId}</Text>
                  <Text className="text-xs text-blue-600">Duration: {runningJob.duration}</Text>
                  <Text className="text-xs text-blue-600">Trigger: {runningJob.triggerType}</Text>
                </View>
              </View>
            )}

            <Pressable className="bg-primary px-4 py-3 rounded-xl mb-2">
              <Text className="text-white text-center font-semibold">Trigger Manual Retraining</Text>
            </Pressable>

            {DEMO_JOBS.slice(1).map((job) => (
              <View key={job.jobId} className="bg-surface rounded-xl border border-border p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-foreground">{job.jobId}</Text>
                  <StatusBadge status={job.status} />
                </View>
                <View className="flex-row gap-4">
                  <Text className="text-xs text-muted">Trigger: {job.triggerType}</Text>
                  <Text className="text-xs text-muted">Duration: {job.duration}</Text>
                  <Text className="text-xs text-muted">Loss: {job.currentLoss.toFixed(4)}</Text>
                </View>
                <Text className="text-xs text-muted mt-1">Started: {job.startedAt}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === "alerts" && (
          <View className="gap-3 mb-6">
            {DEMO_ALERTS.map((alert) => (
              <View key={alert.id} className={`rounded-xl border p-3 ${alert.severity === "critical" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className={`text-sm font-bold ${alert.severity === "critical" ? "text-red-800" : "text-yellow-800"}`}>{alert.metric}</Text>
                  <Text className="text-xs text-muted">{alert.timestamp}</Text>
                </View>
                <Text className={`text-sm ${alert.severity === "critical" ? "text-red-700" : "text-yellow-700"}`}>
                  Current: {typeof alert.current === 'number' && alert.current < 1 ? (alert.current * 100).toFixed(2) + "%" : alert.current} {alert.direction === "above" ? ">" : "<"} Threshold: {typeof alert.threshold === 'number' && alert.threshold < 1 ? (alert.threshold * 100).toFixed(2) + "%" : alert.threshold}
                </Text>
                {!alert.acknowledged && (
                  <Pressable className="bg-white px-3 py-1.5 rounded-lg mt-2 self-start border border-gray-200">
                    <Text className="text-gray-700 text-xs font-semibold">Acknowledge</Text>
                  </Pressable>
                )}
                {alert.acknowledged && (
                  <Text className="text-xs text-muted mt-1">Acknowledged</Text>
                )}
              </View>
            ))}

            <Text className="text-lg font-semibold text-foreground mt-4 mb-3">Alert Thresholds</Text>
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              {[
                ["Precision", "> 0.98"],
                ["Recall", "> 0.965"],
                ["F1 Score", "> 0.970"],
                ["False Positive Rate", "< 0.002"],
                ["AUC-ROC", "> 0.980"],
              ].map(([metric, threshold], i) => (
                <View key={metric} className={`flex-row items-center justify-between p-3 ${i < 4 ? "border-b border-border" : ""}`}>
                  <Text className="text-sm text-foreground">{metric}</Text>
                  <Text className="text-sm font-mono text-muted">{threshold}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
