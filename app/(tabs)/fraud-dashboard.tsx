import { ScrollView, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface FraudMetrics {
  totalTransactions: number;
  flaggedTransactions: number;
  blockedTransactions: number;
  challengedTransactions: number;
  falsePositiveRate: number;
  avgScoringTime: number;
  activeRules: number;
  modelVersion: string;
  openInvestigations: number;
  attackPatternsDetected: number;
  recentAlerts: Alert[];
  riskDistribution: RiskBucket[];
  topRules: RuleMatch[];
  recentScores: RecentScore[];
}

interface Alert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
}

interface RiskBucket {
  level: string;
  count: number;
  percentage: number;
  color: string;
}

interface RuleMatch {
  ruleId: string;
  name: string;
  matches: number;
  action: string;
}

interface RecentScore {
  txnId: string;
  score: number;
  action: string;
  amount: number;
  timestamp: string;
}

const DEMO_METRICS: FraudMetrics = {
  totalTransactions: 284739,
  flaggedTransactions: 1423,
  blockedTransactions: 312,
  challengedTransactions: 487,
  falsePositiveRate: 0.0012,
  avgScoringTime: 47,
  activeRules: 24,
  modelVersion: "v2.1.0",
  openInvestigations: 18,
  attackPatternsDetected: 3,
  recentAlerts: [
    { id: "a1", type: "velocity", severity: "critical", message: "Card ending 4521: 12 transactions in 5 minutes from 3 different countries", timestamp: "2 min ago" },
    { id: "a2", type: "device", severity: "critical", message: "Emulator detected on high-value transaction ($8,450)", timestamp: "8 min ago" },
    { id: "a3", type: "pattern", severity: "warning", message: "BIN 411111 fraud rate spike: 3.2% (threshold: 2%)", timestamp: "15 min ago" },
    { id: "a4", type: "geo", severity: "warning", message: "Impossible travel: Lagos to London in 23 minutes", timestamp: "22 min ago" },
    { id: "a5", type: "email", severity: "info", message: "Throwaway email domain detected: tempmail.org", timestamp: "35 min ago" },
  ],
  riskDistribution: [
    { level: "Low (0-20)", count: 268102, percentage: 94.2, color: "#22c55e" },
    { level: "Medium (20-50)", count: 11389, percentage: 4.0, color: "#f59e0b" },
    { level: "High (50-80)", count: 3997, percentage: 1.4, color: "#f97316" },
    { level: "Critical (80+)", count: 1251, percentage: 0.4, color: "#ef4444" },
  ],
  topRules: [
    { ruleId: "R001", name: "High velocity card usage", matches: 892, action: "block" },
    { ruleId: "R003", name: "Country mismatch", matches: 654, action: "challenge" },
    { ruleId: "R006", name: "Large transaction review", matches: 423, action: "review" },
    { ruleId: "R004", name: "Impossible travel", matches: 187, action: "block" },
    { ruleId: "R005", name: "Throwaway email", matches: 156, action: "block" },
  ],
  recentScores: [
    { txnId: "txn_a8f2c", score: 92.4, action: "block", amount: 15200, timestamp: "Just now" },
    { txnId: "txn_b3d1e", score: 67.8, action: "challenge", amount: 3450, timestamp: "1 min ago" },
    { txnId: "txn_c7a9f", score: 45.2, action: "review", amount: 890, timestamp: "2 min ago" },
    { txnId: "txn_d1b4c", score: 12.1, action: "allow", amount: 245, timestamp: "3 min ago" },
    { txnId: "txn_e5f8a", score: 88.7, action: "block", amount: 8900, timestamp: "4 min ago" },
  ],
};

function StatCard({ title, value, subtitle, color, icon }: { title: string; value: string; subtitle?: string; color?: string; icon?: string }) {
  const colors = useColors();
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border flex-1">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-muted">{title}</Text>
        {icon && <IconSymbol name={icon as any} size={16} color={color || colors.primary} />}
      </View>
      <Text className="text-xl font-bold" style={{ color: color || colors.foreground }}>{value}</Text>
      {subtitle && <Text className="text-xs text-muted mt-1">{subtitle}</Text>}
    </View>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const bg = severity === "critical" ? "bg-red-100" : severity === "warning" ? "bg-yellow-100" : "bg-blue-100";
  const text = severity === "critical" ? "text-red-700" : severity === "warning" ? "text-yellow-700" : "text-blue-700";
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{severity.toUpperCase()}</Text>
    </View>
  );
}

function ActionBadge({ action }: { action: string }) {
  const bg = action === "block" ? "bg-red-100" : action === "challenge" ? "bg-yellow-100" : action === "review" ? "bg-blue-100" : "bg-green-100";
  const text = action === "block" ? "text-red-700" : action === "challenge" ? "text-yellow-700" : action === "review" ? "text-blue-700" : "text-green-700";
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{action.toUpperCase()}</Text>
    </View>
  );
}

export default function FraudDashboardScreen() {
  const colors = useColors();
  const [metrics] = useState<FraudMetrics>(DEMO_METRICS);
  const [liveIndicator, setLiveIndicator] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setLiveIndicator(prev => !prev), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-3xl font-bold text-foreground">Fraud Radar</Text>
            <Text className="text-sm text-muted">Stripe Radar-inspired fraud detection</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: liveIndicator ? "#22c55e" : "#86efac" }} />
            <Text className="text-xs text-muted">LIVE</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Transactions" value={metrics.totalTransactions.toLocaleString()} subtitle="Last 24h" icon="doc.text.fill" />
          <StatCard title="Blocked" value={metrics.blockedTransactions.toLocaleString()} color="#ef4444" icon="xmark.shield.fill" />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Challenged" value={metrics.challengedTransactions.toLocaleString()} color="#f59e0b" icon="exclamationmark.triangle.fill" />
          <StatCard title="Flagged" value={metrics.flaggedTransactions.toLocaleString()} color="#f97316" icon="flag.fill" />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="False Positive Rate" value={`${(metrics.falsePositiveRate * 100).toFixed(2)}%`} subtitle="Target: <0.1%" color="#22c55e" />
          <StatCard title="Avg Score Time" value={`${metrics.avgScoringTime}ms`} subtitle="Target: <100ms" color="#22c55e" />
        </View>
        <View className="flex-row gap-3 mb-6">
          <StatCard title="Active Rules" value={metrics.activeRules.toString()} icon="list.bullet.rectangle.fill" />
          <StatCard title="Model" value={metrics.modelVersion} subtitle="Multi-branch DNN" icon="brain" />
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Risk Distribution</Text>
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <View className="flex-row h-6 rounded-full overflow-hidden mb-3">
            {metrics.riskDistribution.map((bucket) => (
              <View key={bucket.level} style={{ flex: bucket.percentage, backgroundColor: bucket.color }} />
            ))}
          </View>
          {metrics.riskDistribution.map((bucket) => (
            <View key={bucket.level} className="flex-row items-center justify-between py-1.5">
              <View className="flex-row items-center gap-2">
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: bucket.color }} />
                <Text className="text-sm text-foreground">{bucket.level}</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">{bucket.count.toLocaleString()} ({bucket.percentage}%)</Text>
            </View>
          ))}
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Live Alerts</Text>
        <View className="gap-2 mb-6">
          {metrics.recentAlerts.map((alert) => (
            <View key={alert.id} className="bg-surface rounded-xl p-3 border border-border">
              <View className="flex-row items-center justify-between mb-1">
                <SeverityBadge severity={alert.severity} />
                <Text className="text-xs text-muted">{alert.timestamp}</Text>
              </View>
              <Text className="text-sm text-foreground mt-1">{alert.message}</Text>
            </View>
          ))}
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Recent Scores</Text>
        <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-6">
          <View className="flex-row p-3 border-b border-border bg-surface">
            <Text className="text-xs font-semibold text-muted flex-1">TXN ID</Text>
            <Text className="text-xs font-semibold text-muted w-16 text-center">SCORE</Text>
            <Text className="text-xs font-semibold text-muted w-20 text-right">AMOUNT</Text>
            <Text className="text-xs font-semibold text-muted w-20 text-right">ACTION</Text>
          </View>
          {metrics.recentScores.map((score) => (
            <View key={score.txnId} className="flex-row items-center p-3 border-b border-border">
              <Text className="text-sm text-foreground flex-1 font-mono">{score.txnId}</Text>
              <Text className="text-sm font-bold w-16 text-center" style={{ color: score.score > 80 ? "#ef4444" : score.score > 50 ? "#f59e0b" : "#22c55e" }}>{score.score}</Text>
              <Text className="text-sm text-foreground w-20 text-right">${score.amount.toLocaleString()}</Text>
              <View className="w-20 items-end"><ActionBadge action={score.action} /></View>
            </View>
          ))}
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Top Matching Rules</Text>
        <View className="gap-2 mb-6">
          {metrics.topRules.map((rule) => (
            <View key={rule.ruleId} className="bg-surface rounded-xl p-3 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{rule.name}</Text>
                <Text className="text-xs text-muted">{rule.ruleId} - {rule.matches} matches</Text>
              </View>
              <ActionBadge action={rule.action} />
            </View>
          ))}
        </View>

        <View className="flex-row gap-3 mb-6">
          <StatCard title="Open Cases" value={metrics.openInvestigations.toString()} color="#f59e0b" icon="magnifyingglass" />
          <StatCard title="Attack Patterns" value={metrics.attackPatternsDetected.toString()} color="#ef4444" icon="exclamationmark.shield.fill" />
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
