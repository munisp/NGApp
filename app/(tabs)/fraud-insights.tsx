import { ScrollView, Text, View, Pressable } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Insight {
  id: string;
  category: string;
  categoryIcon: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  contribution: number;
  evidence: string[];
}

interface InsightReport {
  transactionId: string;
  score: number;
  action: string;
  summary: string;
  recommendation: string;
  insights: Insight[];
}

const DEMO_REPORT: InsightReport = {
  transactionId: "txn_a8f2c91d",
  score: 78.4,
  action: "challenge",
  summary: "This transaction was flagged due to unusual velocity patterns, a new device with geolocation mismatch, and suspicious email characteristics. The combination of these signals suggests potential account takeover.",
  recommendation: "Challenge the customer with step-up authentication (SMS OTP or biometric). If the customer fails the challenge, block the transaction and flag the account for review.",
  insights: [
    {
      id: "i1", category: "Velocity", categoryIcon: "speedometer",
      title: "Abnormal transaction frequency",
      description: "8 transactions from this card in the last hour, significantly above the normal rate of 1-2 per hour for this cardholder.",
      severity: "critical", contribution: 0.23,
      evidence: ["Card used 8 times in 60 min", "Normal rate: 1.3 txns/hour", "Amount velocity: $12,450 vs avg $340/hour"]
    },
    {
      id: "i2", category: "Geolocation", categoryIcon: "location.fill",
      title: "Card/IP country mismatch",
      description: "The card was issued in Nigeria but the transaction originated from a UK IP address. Previous transactions were primarily from Nigerian IPs.",
      severity: "critical", contribution: 0.19,
      evidence: ["Card country: Nigeria (NG)", "IP country: United Kingdom (GB)", "Historical: 96% Nigerian IPs", "No prior UK transactions"]
    },
    {
      id: "i3", category: "Device", categoryIcon: "desktopcomputer",
      title: "New unrecognized device",
      description: "This device has never been seen before for this cardholder. The device fingerprint shows characteristics consistent with browser automation.",
      severity: "warning", contribution: 0.15,
      evidence: ["Device age: 0 days (first seen)", "Canvas hash: new", "WebGL renderer: suspicious", "Timezone mismatch with IP location"]
    },
    {
      id: "i4", category: "Behavioral", categoryIcon: "person.fill",
      title: "Unusual transaction amount",
      description: "The transaction amount of $3,450 is 4.2x higher than this cardholder's average transaction of $820.",
      severity: "warning", contribution: 0.12,
      evidence: ["Amount: $3,450", "Cardholder avg: $820", "Std deviation: $340", "Z-score: 7.7"]
    },
    {
      id: "i5", category: "Network", categoryIcon: "network",
      title: "Email linked to multiple fraud reports",
      description: "The email address used has been associated with 3 fraud reports across other merchants in the network within the last 30 days.",
      severity: "warning", contribution: 0.09,
      evidence: ["3 fraud reports in 30 days", "2 chargebacks confirmed", "Email domain age: 2 days", "Domain: tempmail.org"]
    },
    {
      id: "i6", category: "Historical", categoryIcon: "clock.fill",
      title: "Account history is positive",
      description: "The cardholder has a 365-day history with 47 successful transactions and no previous fraud incidents. This reduces the overall risk score.",
      severity: "info", contribution: -0.08,
      evidence: ["Account age: 365 days", "47 successful transactions", "0 fraud incidents", "0 chargebacks"]
    },
  ],
};

function SeverityIcon({ severity }: { severity: string }) {
  const color = severity === "critical" ? "#ef4444" : severity === "warning" ? "#f59e0b" : "#3b82f6";
  const icon = severity === "critical" ? "xmark.octagon.fill" : severity === "warning" ? "exclamationmark.triangle.fill" : "info.circle.fill";
  return <IconSymbol name={icon as any} size={18} color={color} />;
}

export default function FraudInsightsScreen() {
  const colors = useColors();
  const [report] = useState<InsightReport>(DEMO_REPORT);
  const [expandedInsight, setExpandedInsight] = useState<string | null>("i1");

  const criticalCount = report.insights.filter(i => i.severity === "critical").length;
  const warningCount = report.insights.filter(i => i.severity === "warning").length;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-1">Risk Insights</Text>
        <Text className="text-sm text-muted mb-4">SHAP/LIME-style explainability for fraud decisions</Text>

        <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-muted">Transaction {report.transactionId}</Text>
            <View className="bg-yellow-100 px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-yellow-700">SCORE: {report.score}</Text>
            </View>
          </View>
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 bg-red-50 rounded-lg p-2 items-center">
              <Text className="text-lg font-bold text-red-700">{criticalCount}</Text>
              <Text className="text-xs text-red-600">Critical</Text>
            </View>
            <View className="flex-1 bg-yellow-50 rounded-lg p-2 items-center">
              <Text className="text-lg font-bold text-yellow-700">{warningCount}</Text>
              <Text className="text-xs text-yellow-600">Warning</Text>
            </View>
            <View className="flex-1 bg-blue-50 rounded-lg p-2 items-center">
              <Text className="text-lg font-bold text-blue-700">{report.insights.length}</Text>
              <Text className="text-xs text-blue-600">Total</Text>
            </View>
          </View>
        </View>

        <View className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
          <Text className="text-sm font-semibold text-blue-800 mb-1">Summary</Text>
          <Text className="text-sm text-blue-700">{report.summary}</Text>
        </View>

        <View className="bg-green-50 rounded-xl p-4 border border-green-200 mb-6">
          <Text className="text-sm font-semibold text-green-800 mb-1">Recommendation</Text>
          <Text className="text-sm text-green-700">{report.recommendation}</Text>
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Feature Attribution</Text>
        <View className="bg-surface rounded-2xl border border-border p-4 mb-6">
          {report.insights.map((insight) => (
            <View key={insight.id} className="flex-row items-center mb-2">
              <Text className="text-xs text-muted w-20" numberOfLines={1}>{insight.category}</Text>
              <View className="flex-1 mx-2">
                <View className="h-4 bg-gray-100 rounded-full overflow-hidden flex-row">
                  {insight.contribution > 0 ? (
                    <View className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(insight.contribution * 100 * 4, 100)}%` }} />
                  ) : (
                    <View className="h-full rounded-full bg-green-400" style={{ width: `${Math.min(Math.abs(insight.contribution) * 100 * 4, 100)}%` }} />
                  )}
                </View>
              </View>
              <Text className="text-xs font-bold w-12 text-right" style={{ color: insight.contribution > 0 ? "#ef4444" : "#22c55e" }}>
                {insight.contribution > 0 ? "+" : ""}{(insight.contribution * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-lg font-semibold text-foreground mb-3">Detailed Insights</Text>
        <View className="gap-3 mb-6">
          {report.insights.map((insight) => (
            <Pressable key={insight.id} onPress={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}>
              <View className="bg-surface rounded-xl border border-border overflow-hidden">
                <View className="p-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <SeverityIcon severity={insight.severity} />
                    <Text className="text-sm font-semibold text-foreground flex-1">{insight.title}</Text>
                    <Text className="text-xs font-bold" style={{ color: insight.contribution > 0 ? "#ef4444" : "#22c55e" }}>
                      {insight.contribution > 0 ? "+" : ""}{(insight.contribution * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">{insight.description}</Text>
                </View>
                {expandedInsight === insight.id && (
                  <View className="border-t border-border p-3 bg-background">
                    <Text className="text-xs font-semibold text-muted mb-2">EVIDENCE</Text>
                    {insight.evidence.map((ev, i) => (
                      <View key={i} className="flex-row items-center gap-2 mb-1">
                        <View className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <Text className="text-xs text-foreground">{ev}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
