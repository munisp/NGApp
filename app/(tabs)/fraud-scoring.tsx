import { ScrollView, Text, View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface ScoreResult {
  transactionId: string;
  score: number;
  riskLevel: string;
  action: string;
  confidence: number;
  inferenceTime: number;
  branches: BranchScore[];
  topFeatures: Feature[];
}

interface BranchScore {
  name: string;
  score: number;
  weight: number;
  icon: string;
  color: string;
}

interface Feature {
  name: string;
  value: string;
  contribution: number;
  direction: "positive" | "negative";
}

const DEMO_RESULT: ScoreResult = {
  transactionId: "txn_a8f2c91d",
  score: 78.4,
  riskLevel: "HIGH",
  action: "challenge",
  confidence: 0.94,
  inferenceTime: 42,
  branches: [
    { name: "Velocity", score: 89.2, weight: 0.20, icon: "speedometer", color: "#ef4444" },
    { name: "Device", score: 72.1, weight: 0.18, icon: "desktopcomputer", color: "#f97316" },
    { name: "Geolocation", score: 85.6, weight: 0.17, icon: "location.fill", color: "#ef4444" },
    { name: "Behavioral", score: 45.3, weight: 0.15, icon: "person.fill", color: "#f59e0b" },
    { name: "Network", score: 68.9, weight: 0.15, icon: "network", color: "#f97316" },
    { name: "Historical", score: 32.1, weight: 0.15, icon: "clock.fill", color: "#22c55e" },
  ],
  topFeatures: [
    { name: "txns_per_card_1h", value: "8 (threshold: 5)", contribution: 0.23, direction: "positive" },
    { name: "country_mismatch", value: "true (card: NG, IP: GB)", contribution: 0.19, direction: "positive" },
    { name: "device_age_days", value: "0 (new device)", contribution: 0.15, direction: "positive" },
    { name: "amount_velocity_1h", value: "$12,450 (avg: $340)", contribution: 0.12, direction: "positive" },
    { name: "email_domain_age", value: "2 days", contribution: 0.09, direction: "positive" },
    { name: "historical_txn_count", value: "47", contribution: -0.08, direction: "negative" },
    { name: "account_age_days", value: "365", contribution: -0.06, direction: "negative" },
  ],
};

const MODEL_INFO = {
  version: "v2.1.0",
  architecture: "Multi-Branch DNN (ResNeXt-inspired)",
  branches: 6,
  totalFeatures: 1247,
  trainingSamples: "12.4M",
  auc: 0.9847,
  precision: 0.9912,
  recall: 0.9673,
  f1: 0.9791,
  falsePositiveRate: 0.0012,
  lastRetrained: "2026-02-01",
};

function ScoreGauge({ score }: { score: number }) {
  const color = score > 80 ? "#ef4444" : score > 50 ? "#f59e0b" : score > 20 ? "#3b82f6" : "#22c55e";
  const label = score > 80 ? "CRITICAL" : score > 50 ? "HIGH" : score > 20 ? "MEDIUM" : "LOW";
  return (
    <View className="items-center py-6">
      <View className="w-32 h-32 rounded-full border-8 items-center justify-center" style={{ borderColor: color }}>
        <Text className="text-3xl font-bold" style={{ color }}>{score.toFixed(1)}</Text>
        <Text className="text-xs font-semibold" style={{ color }}>{label}</Text>
      </View>
    </View>
  );
}

export default function FraudScoringScreen() {
  const colors = useColors();
  const [result] = useState<ScoreResult>(DEMO_RESULT);
  const [tab, setTab] = useState<"score" | "model">("score");

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-1">Fraud Scoring</Text>
        <Text className="text-sm text-muted mb-4">Multi-branch DNN with 1,247 features</Text>

        <View className="flex-row bg-surface rounded-xl p-1 border border-border mb-6">
          <Pressable onPress={() => setTab("score")} className={`flex-1 py-2 rounded-lg ${tab === "score" ? "bg-primary" : ""}`}>
            <Text className={`text-center text-sm font-semibold ${tab === "score" ? "text-white" : "text-muted"}`}>Score Result</Text>
          </Pressable>
          <Pressable onPress={() => setTab("model")} className={`flex-1 py-2 rounded-lg ${tab === "model" ? "bg-primary" : ""}`}>
            <Text className={`text-center text-sm font-semibold ${tab === "model" ? "text-white" : "text-muted"}`}>Model Info</Text>
          </Pressable>
        </View>

        {tab === "score" ? (
          <>
            <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-muted">Transaction {result.transactionId}</Text>
                <View className="flex-row items-center gap-1">
                  <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                  <Text className="text-xs text-muted">{result.inferenceTime}ms</Text>
                </View>
              </View>
              <ScoreGauge score={result.score} />
              <View className="flex-row justify-center gap-6">
                <View className="items-center">
                  <Text className="text-xs text-muted">Confidence</Text>
                  <Text className="text-lg font-bold text-foreground">{(result.confidence * 100).toFixed(0)}%</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xs text-muted">Action</Text>
                  <View className="bg-yellow-100 px-3 py-1 rounded-full mt-1">
                    <Text className="text-sm font-bold text-yellow-700">{result.action.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text className="text-lg font-semibold text-foreground mb-3">Branch Scores</Text>
            <View className="gap-2 mb-6">
              {result.branches.map((branch) => (
                <View key={branch.name} className="bg-surface rounded-xl p-3 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name={branch.icon as any} size={18} color={branch.color} />
                      <Text className="text-sm font-semibold text-foreground">{branch.name}</Text>
                    </View>
                    <Text className="text-sm font-bold" style={{ color: branch.color }}>{branch.score.toFixed(1)}</Text>
                  </View>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View className="h-full rounded-full" style={{ width: `${branch.score}%`, backgroundColor: branch.color }} />
                  </View>
                  <Text className="text-xs text-muted mt-1">Weight: {(branch.weight * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>

            <Text className="text-lg font-semibold text-foreground mb-3">Top Contributing Features</Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-6">
              {result.topFeatures.map((feature, i) => (
                <View key={feature.name} className={`p-3 flex-row items-center ${i < result.topFeatures.length - 1 ? "border-b border-border" : ""}`}>
                  <View className="flex-1">
                    <Text className="text-sm font-mono text-foreground">{feature.name}</Text>
                    <Text className="text-xs text-muted">{feature.value}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold" style={{ color: feature.direction === "positive" ? "#ef4444" : "#22c55e" }}>
                      {feature.direction === "positive" ? "+" : "-"}{(feature.contribution * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
              <Text className="text-lg font-semibold text-foreground mb-3">Model Architecture</Text>
              <View className="gap-3">
                {[
                  ["Version", MODEL_INFO.version],
                  ["Architecture", MODEL_INFO.architecture],
                  ["Branches", MODEL_INFO.branches.toString()],
                  ["Total Features", MODEL_INFO.totalFeatures.toLocaleString()],
                  ["Training Samples", MODEL_INFO.trainingSamples],
                  ["Last Retrained", MODEL_INFO.lastRetrained],
                ].map(([label, value]) => (
                  <View key={label} className="flex-row justify-between">
                    <Text className="text-sm text-muted">{label}</Text>
                    <Text className="text-sm font-semibold text-foreground">{value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text className="text-lg font-semibold text-foreground mb-3">Performance Metrics</Text>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
                <Text className="text-xs text-muted">AUC-ROC</Text>
                <Text className="text-xl font-bold text-foreground">{MODEL_INFO.auc}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
                <Text className="text-xs text-muted">F1 Score</Text>
                <Text className="text-xl font-bold text-foreground">{MODEL_INFO.f1}</Text>
              </View>
            </View>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
                <Text className="text-xs text-muted">Precision</Text>
                <Text className="text-xl font-bold text-foreground">{MODEL_INFO.precision}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
                <Text className="text-xs text-muted">Recall</Text>
                <Text className="text-xl font-bold text-foreground">{MODEL_INFO.recall}</Text>
              </View>
            </View>
            <View className="bg-green-50 rounded-xl p-3 border border-green-200 items-center mb-6">
              <Text className="text-xs text-green-600">False Positive Rate</Text>
              <Text className="text-xl font-bold text-green-700">{(MODEL_INFO.falsePositiveRate * 100).toFixed(2)}%</Text>
              <Text className="text-xs text-green-600">Target: &lt;0.1%</Text>
            </View>
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
