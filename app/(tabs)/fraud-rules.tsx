import { ScrollView, Text, View, Pressable, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Rule {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  logic: "all" | "any";
  action: "block" | "challenge" | "review" | "allow";
  priority: number;
  enabled: boolean;
  matchCount: number;
  lastMatched: string;
  createdBy: string;
}

const DEMO_RULES: Rule[] = [
  {
    id: "R001", name: "High velocity card usage",
    description: "Block when card used more than 5 times in 1 hour",
    conditions: ["txns_per_card_1h > 5"], logic: "all", action: "block",
    priority: 90, enabled: true, matchCount: 892, lastMatched: "2 min ago", createdBy: "system"
  },
  {
    id: "R002", name: "Multiple cards from same IP",
    description: "Block when more than 3 different cards used from same IP in 1 hour",
    conditions: ["cards_per_ip_1h > 3"], logic: "all", action: "block",
    priority: 85, enabled: true, matchCount: 234, lastMatched: "15 min ago", createdBy: "system"
  },
  {
    id: "R003", name: "Country mismatch challenge",
    description: "Challenge when card issuing country differs from IP country",
    conditions: ["card_country != ip_country"], logic: "all", action: "challenge",
    priority: 70, enabled: true, matchCount: 654, lastMatched: "1 min ago", createdBy: "system"
  },
  {
    id: "R004", name: "Impossible travel detection",
    description: "Block when user location changes faster than physically possible",
    conditions: ["speed_kmh > 900", "time_between_txns_min < 60"], logic: "all", action: "block",
    priority: 95, enabled: true, matchCount: 187, lastMatched: "22 min ago", createdBy: "system"
  },
  {
    id: "R005", name: "Throwaway email block",
    description: "Block transactions from known disposable email providers",
    conditions: ["email_domain in throwaway_list"], logic: "all", action: "block",
    priority: 80, enabled: true, matchCount: 156, lastMatched: "35 min ago", createdBy: "system"
  },
  {
    id: "R006", name: "Large transaction review",
    description: "Review all transactions above $10,000",
    conditions: ["amount > 10000"], logic: "all", action: "review",
    priority: 50, enabled: true, matchCount: 423, lastMatched: "5 min ago", createdBy: "system"
  },
  {
    id: "R007", name: "Emulator device block",
    description: "Block all transactions from emulated devices",
    conditions: ["is_emulator == true"], logic: "all", action: "block",
    priority: 92, enabled: true, matchCount: 89, lastMatched: "8 min ago", createdBy: "system"
  },
  {
    id: "R008", name: "VPN high-value challenge",
    description: "Challenge VPN transactions above $500",
    conditions: ["is_vpn == true", "amount > 500"], logic: "all", action: "challenge",
    priority: 60, enabled: true, matchCount: 312, lastMatched: "12 min ago", createdBy: "system"
  },
  {
    id: "R009", name: "High-risk BIN block",
    description: "Block high-risk BIN ranges with amount over $5000",
    conditions: ["bin_fraud_rate > 0.02", "amount > 5000"], logic: "all", action: "block",
    priority: 75, enabled: true, matchCount: 67, lastMatched: "1 hour ago", createdBy: "fraud-ops"
  },
  {
    id: "R010", name: "Safe merchant allowlist",
    description: "Allow known safe merchant transactions",
    conditions: ["merchant_id in safe_merchants"], logic: "all", action: "allow",
    priority: 100, enabled: true, matchCount: 15420, lastMatched: "Just now", createdBy: "system"
  },
];

function ActionBadge({ action }: { action: string }) {
  const bg = action === "block" ? "bg-red-100" : action === "challenge" ? "bg-yellow-100" : action === "review" ? "bg-blue-100" : "bg-green-100";
  const text = action === "block" ? "text-red-700" : action === "challenge" ? "text-yellow-700" : action === "review" ? "text-blue-700" : "text-green-700";
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{action.toUpperCase()}</Text>
    </View>
  );
}

export default function FraudRulesScreen() {
  const colors = useColors();
  const [rules, setRules] = useState<Rule[]>(DEMO_RULES);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const totalMatches = rules.reduce((sum, r) => sum + r.matchCount, 0);
  const blockRules = rules.filter(r => r.action === "block" && r.enabled).length;
  const challengeRules = rules.filter(r => r.action === "challenge" && r.enabled).length;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-1">Rules Engine</Text>
        <Text className="text-sm text-muted mb-4">Custom fraud detection rules with real-time evaluation</Text>

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Active Rules</Text>
            <Text className="text-xl font-bold text-foreground">{rules.filter(r => r.enabled).length}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Total Matches</Text>
            <Text className="text-xl font-bold text-foreground">{totalMatches.toLocaleString()}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
            <Text className="text-xs text-muted">Block / Challenge</Text>
            <Text className="text-xl font-bold text-foreground">{blockRules} / {challengeRules}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-foreground">Rules ({rules.length})</Text>
          <Pressable className="bg-primary px-3 py-1.5 rounded-lg flex-row items-center gap-1">
            <IconSymbol name="plus" size={14} color="#fff" />
            <Text className="text-white text-sm font-semibold">Add Rule</Text>
          </Pressable>
        </View>

        <View className="gap-3 mb-6">
          {rules.map((rule) => (
            <Pressable key={rule.id} onPress={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}>
              <View className="bg-surface rounded-xl border border-border overflow-hidden">
                <View className="p-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-xs font-mono text-muted">{rule.id}</Text>
                      <Text className="text-sm font-semibold text-foreground flex-shrink" numberOfLines={1}>{rule.name}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <ActionBadge action={rule.action} />
                      <Switch value={rule.enabled} onValueChange={() => toggleRule(rule.id)} trackColor={{ false: "#ccc", true: colors.primary }} />
                    </View>
                  </View>
                  <Text className="text-xs text-muted">{rule.description}</Text>
                  <View className="flex-row items-center gap-4 mt-2">
                    <Text className="text-xs text-muted">Priority: {rule.priority}</Text>
                    <Text className="text-xs text-muted">Matches: {rule.matchCount.toLocaleString()}</Text>
                    <Text className="text-xs text-muted">Last: {rule.lastMatched}</Text>
                  </View>
                </View>

                {expandedRule === rule.id && (
                  <View className="border-t border-border p-3 bg-background">
                    <Text className="text-xs font-semibold text-muted mb-2">CONDITIONS ({rule.logic === "all" ? "ALL must match" : "ANY must match"})</Text>
                    {rule.conditions.map((condition, i) => (
                      <View key={i} className="flex-row items-center gap-2 mb-1">
                        <View className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <Text className="text-sm font-mono text-foreground">{condition}</Text>
                      </View>
                    ))}
                    <View className="flex-row gap-2 mt-3">
                      <Pressable className="bg-blue-100 px-3 py-1.5 rounded-lg">
                        <Text className="text-blue-700 text-xs font-semibold">Edit</Text>
                      </Pressable>
                      <Pressable className="bg-gray-100 px-3 py-1.5 rounded-lg">
                        <Text className="text-gray-700 text-xs font-semibold">Duplicate</Text>
                      </Pressable>
                      <Pressable className="bg-red-100 px-3 py-1.5 rounded-lg">
                        <Text className="text-red-700 text-xs font-semibold">Delete</Text>
                      </Pressable>
                    </View>
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
