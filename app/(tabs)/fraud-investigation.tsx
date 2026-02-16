import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Investigation {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  status: "open" | "in_progress" | "resolved" | "escalated";
  assignedTo: string;
  priority: "critical" | "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
  relatedTxns: number;
  notes: number;
}

interface AttackPattern {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium";
  description: string;
  affectedMerchants: number;
  transactionCount: number;
  totalAmount: number;
  detectedAt: string;
  status: "active" | "mitigated" | "resolved";
  indicators: string[];
}

interface GeoHotspot {
  country: string;
  city: string;
  events: number;
  fraudRate: number;
  topAttack: string;
}

const DEMO_INVESTIGATIONS: Investigation[] = [
  { id: "INV-001", transactionId: "txn_a8f2c", amount: 15200, reason: "High-risk score (92.4) + velocity anomaly", status: "open", assignedTo: "Sarah K.", priority: "critical", createdAt: "2 min ago", updatedAt: "2 min ago", relatedTxns: 12, notes: 0 },
  { id: "INV-002", transactionId: "txn_b7d3e", amount: 8900, reason: "Emulator + VPN + country mismatch", status: "in_progress", assignedTo: "Michael O.", priority: "critical", createdAt: "45 min ago", updatedAt: "10 min ago", relatedTxns: 5, notes: 3 },
  { id: "INV-003", transactionId: "txn_c1f9a", amount: 3450, reason: "Impossible travel detected (Lagos to London)", status: "in_progress", assignedTo: "Amaka N.", priority: "high", createdAt: "2 hours ago", updatedAt: "30 min ago", relatedTxns: 8, notes: 5 },
  { id: "INV-004", transactionId: "txn_d4e2b", amount: 22000, reason: "Cross-merchant fraud ring signal", status: "escalated", assignedTo: "David A.", priority: "critical", createdAt: "3 hours ago", updatedAt: "1 hour ago", relatedTxns: 34, notes: 12 },
  { id: "INV-005", transactionId: "txn_e6a8c", amount: 1200, reason: "BIN fraud rate spike + new device", status: "open", assignedTo: "Unassigned", priority: "medium", createdAt: "4 hours ago", updatedAt: "4 hours ago", relatedTxns: 3, notes: 0 },
  { id: "INV-006", transactionId: "txn_f2c7d", amount: 5600, reason: "Account takeover indicators", status: "resolved", assignedTo: "Sarah K.", priority: "high", createdAt: "1 day ago", updatedAt: "6 hours ago", relatedTxns: 7, notes: 8 },
];

const DEMO_ATTACK_PATTERNS: AttackPattern[] = [
  {
    id: "AP-001", type: "Card Testing", severity: "critical",
    description: "Automated card testing attack targeting multiple merchants with small amounts ($0.50-$2.00) before attempting larger purchases.",
    affectedMerchants: 12, transactionCount: 847, totalAmount: 1423,
    detectedAt: "1 hour ago", status: "active",
    indicators: ["Rapid small transactions ($0.50-$2.00)", "Sequential card numbers", "Same device fingerprint", "Bot-like timing patterns"]
  },
  {
    id: "AP-002", type: "Account Takeover", severity: "high",
    description: "Coordinated account takeover using credential stuffing. Compromised accounts used for high-value transactions with new devices.",
    affectedMerchants: 4, transactionCount: 23, totalAmount: 67800,
    detectedAt: "3 hours ago", status: "active",
    indicators: ["Password reset + immediate purchase", "New device for established accounts", "Shipping address change", "VPN/proxy usage"]
  },
  {
    id: "AP-003", type: "Fraud Ring", severity: "critical",
    description: "Network of linked accounts using shared devices and overlapping payment methods for coordinated fraud across merchants.",
    affectedMerchants: 8, transactionCount: 156, totalAmount: 234500,
    detectedAt: "6 hours ago", status: "active",
    indicators: ["Shared device fingerprints across 15+ accounts", "Overlapping card BINs", "Common IP subnets", "Similar email patterns (name+numbers@domain)"]
  },
];

const DEMO_GEO: GeoHotspot[] = [
  { country: "Nigeria", city: "Lagos", events: 234, fraudRate: 2.1, topAttack: "Card Testing" },
  { country: "UK", city: "London", events: 156, fraudRate: 1.8, topAttack: "Account Takeover" },
  { country: "Ghana", city: "Accra", events: 89, fraudRate: 3.2, topAttack: "Fraud Ring" },
  { country: "USA", city: "New York", events: 67, fraudRate: 0.9, topAttack: "Card Testing" },
  { country: "South Africa", city: "Johannesburg", events: 45, fraudRate: 2.7, topAttack: "Account Takeover" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    open: { bg: "bg-blue-100", text: "text-blue-700" },
    in_progress: { bg: "bg-yellow-100", text: "text-yellow-700" },
    resolved: { bg: "bg-green-100", text: "text-green-700" },
    escalated: { bg: "bg-red-100", text: "text-red-700" },
    active: { bg: "bg-red-100", text: "text-red-700" },
    mitigated: { bg: "bg-yellow-100", text: "text-yellow-700" },
  };
  const s = styles[status] || styles.open;
  return (
    <View className={`px-2 py-0.5 rounded-full ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{status.replace("_", " ").toUpperCase()}</Text>
    </View>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === "critical" ? "#ef4444" : priority === "high" ? "#f97316" : priority === "medium" ? "#f59e0b" : "#22c55e";
  return <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

export default function FraudInvestigationScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<"cases" | "attacks" | "geo">("cases");
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  const openCases = DEMO_INVESTIGATIONS.filter(i => i.status !== "resolved").length;
  const criticalCases = DEMO_INVESTIGATIONS.filter(i => i.priority === "critical").length;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-1">Investigation</Text>
        <Text className="text-sm text-muted mb-4">Fraud investigation, attack patterns, and geo analysis</Text>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Open Cases</Text>
            <Text className="text-xl font-bold text-foreground">{openCases}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Critical</Text>
            <Text className="text-xl font-bold text-red-500">{criticalCases}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Patterns</Text>
            <Text className="text-xl font-bold text-orange-500">{DEMO_ATTACK_PATTERNS.length}</Text>
          </View>
        </View>

        <View className="flex-row bg-surface rounded-xl p-1 border border-border mb-6">
          {(["cases", "attacks", "geo"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className={`flex-1 py-2 rounded-lg ${tab === t ? "bg-primary" : ""}`}>
              <Text className={`text-center text-sm font-semibold ${tab === t ? "text-white" : "text-muted"}`}>
                {t === "cases" ? "Cases" : t === "attacks" ? "Attacks" : "Geo"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "cases" && (
          <View className="gap-3 mb-6">
            {DEMO_INVESTIGATIONS.map((inv) => (
              <View key={inv.id} className="bg-surface rounded-xl border border-border p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <PriorityDot priority={inv.priority} />
                    <Text className="text-sm font-bold text-foreground">{inv.id}</Text>
                  </View>
                  <StatusBadge status={inv.status} />
                </View>
                <Text className="text-xs text-muted mb-2">{inv.reason}</Text>
                <View className="flex-row items-center gap-4">
                  <Text className="text-xs text-muted">Txn: {inv.transactionId}</Text>
                  <Text className="text-xs font-semibold text-foreground">${inv.amount.toLocaleString()}</Text>
                  <Text className="text-xs text-muted">{inv.relatedTxns} related</Text>
                </View>
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-xs text-muted">Assigned: {inv.assignedTo}</Text>
                  <Text className="text-xs text-muted">{inv.createdAt}</Text>
                </View>
                <View className="flex-row gap-2 mt-2">
                  <Pressable className="bg-primary px-3 py-1.5 rounded-lg">
                    <Text className="text-white text-xs font-semibold">View Details</Text>
                  </Pressable>
                  {inv.status === "open" && (
                    <Pressable className="bg-blue-100 px-3 py-1.5 rounded-lg">
                      <Text className="text-blue-700 text-xs font-semibold">Assign</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === "attacks" && (
          <View className="gap-3 mb-6">
            {DEMO_ATTACK_PATTERNS.map((pattern) => (
              <Pressable key={pattern.id} onPress={() => setExpandedPattern(expandedPattern === pattern.id ? null : pattern.id)}>
                <View className="bg-surface rounded-xl border border-border overflow-hidden">
                  <View className="p-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold text-foreground">{pattern.type}</Text>
                        <StatusBadge status={pattern.status} />
                      </View>
                      <View className={`px-2 py-0.5 rounded-full ${pattern.severity === "critical" ? "bg-red-100" : "bg-orange-100"}`}>
                        <Text className={`text-xs font-semibold ${pattern.severity === "critical" ? "text-red-700" : "text-orange-700"}`}>{pattern.severity.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-muted mb-2">{pattern.description}</Text>
                    <View className="flex-row gap-4">
                      <Text className="text-xs text-muted">{pattern.affectedMerchants} merchants</Text>
                      <Text className="text-xs text-muted">{pattern.transactionCount} txns</Text>
                      <Text className="text-xs font-semibold text-foreground">${pattern.totalAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                  {expandedPattern === pattern.id && (
                    <View className="border-t border-border p-3 bg-background">
                      <Text className="text-xs font-semibold text-muted mb-2">INDICATORS</Text>
                      {pattern.indicators.map((ind, i) => (
                        <View key={i} className="flex-row items-center gap-2 mb-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <Text className="text-xs text-foreground">{ind}</Text>
                        </View>
                      ))}
                      <Pressable className="bg-red-100 px-3 py-1.5 rounded-lg mt-2 self-start">
                        <Text className="text-red-700 text-xs font-semibold">Investigate</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {tab === "geo" && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-3">Fraud Hotspots</Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <View className="flex-row p-3 border-b border-border">
                <Text className="text-xs font-semibold text-muted flex-1">LOCATION</Text>
                <Text className="text-xs font-semibold text-muted w-16 text-center">EVENTS</Text>
                <Text className="text-xs font-semibold text-muted w-16 text-center">RATE</Text>
                <Text className="text-xs font-semibold text-muted w-24 text-right">TOP ATTACK</Text>
              </View>
              {DEMO_GEO.map((geo) => (
                <View key={geo.city} className="flex-row items-center p-3 border-b border-border">
                  <View className="flex-1">
                    <Text className="text-sm text-foreground">{geo.city}</Text>
                    <Text className="text-xs text-muted">{geo.country}</Text>
                  </View>
                  <Text className="text-sm text-foreground w-16 text-center">{geo.events}</Text>
                  <Text className="text-sm font-bold w-16 text-center" style={{ color: geo.fraudRate > 2.5 ? "#ef4444" : geo.fraudRate > 1.5 ? "#f59e0b" : "#22c55e" }}>{geo.fraudRate}%</Text>
                  <Text className="text-xs text-muted w-24 text-right">{geo.topAttack}</Text>
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
