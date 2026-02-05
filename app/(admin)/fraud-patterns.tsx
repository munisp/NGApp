import { View, Text, ScrollView, TextInput, Pressable, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface FraudPattern {
  id: string;
  name: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  common_indicators: string[];
  tags: string[];
}

// Mock data - in production, fetch from API
const FRAUD_PATTERNS: FraudPattern[] = [
  {
    id: "ato_001",
    name: "Account Takeover - Credential Stuffing",
    category: "account_takeover",
    severity: "critical",
    description: "Fraudster gains unauthorized access using stolen credentials from data breaches",
    common_indicators: [
      "Login from new device/location",
      "Multiple failed login attempts followed by success",
      "Immediate password/email change after login",
      "Large transaction shortly after login",
    ],
    tags: ["account_security", "credential_theft", "unauthorized_access"],
  },
  {
    id: "card_test_001",
    name: "Card Testing - Small Transaction Probing",
    category: "card_testing",
    severity: "high",
    description: "Testing stolen card details with small transactions before larger purchases",
    common_indicators: [
      "Multiple small transactions (< $5) in short time",
      "Transactions to different merchants",
      "High decline rate followed by successful transactions",
      "Round dollar amounts ($1.00, $2.00, etc.)",
    ],
    tags: ["card_fraud", "testing", "stolen_cards"],
  },
  {
    id: "mule_001",
    name: "Money Mule - Layering Scheme",
    category: "money_mule",
    severity: "critical",
    description: "Network of accounts moving illicit funds through multiple layers",
    common_indicators: [
      "Rapid in-and-out transactions",
      "Funds received and immediately transferred",
      "No legitimate business activity",
      "Transactions to high-risk jurisdictions",
    ],
    tags: ["money_laundering", "mule_networks", "aml"],
  },
  {
    id: "synthetic_001",
    name: "Synthetic Identity - Credit Building",
    category: "synthetic_identity",
    severity: "high",
    description: "Fake identity using combination of real and fake information",
    common_indicators: [
      "New SSN with no credit history",
      "Inconsistent personal information",
      "Address doesn't match demographics",
      "Phone number recently activated",
    ],
    tags: ["identity_fraud", "synthetic_identity", "credit_fraud"],
  },
];

export default function FraudPatternsScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<FraudPattern | null>(null);

  const categories = [
    { id: "all", name: "All Patterns" },
    { id: "account_takeover", name: "Account Takeover" },
    { id: "card_testing", name: "Card Testing" },
    { id: "money_mule", name: "Money Mule" },
    { id: "synthetic_identity", name: "Synthetic Identity" },
  ];

  const filteredPatterns = FRAUD_PATTERNS.filter((pattern) => {
    const matchesSearch =
      searchQuery === "" ||
      pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      !selectedCategory || selectedCategory === "all" || pattern.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#DC2626";
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#10B981";
      default:
        return colors.muted;
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="text-2xl font-bold text-foreground mb-2">Fraud Pattern Library</Text>
        <Text className="text-sm text-muted mb-6">
          Searchable database of known fraud patterns with detection signatures and response
          playbooks
        </Text>

        {/* Search */}
        <View className="mb-4">
          <TextInput
            className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            placeholder="Search patterns, tags, or indicators..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          <View className="flex-row gap-2">
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full border ${
                  selectedCategory === category.id || (!selectedCategory && category.id === "all")
                    ? "bg-primary border-primary"
                    : "bg-surface border-border"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedCategory === category.id || (!selectedCategory && category.id === "all")
                      ? "text-white"
                      : "text-foreground"
                  }`}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Results Count */}
        <Text className="text-sm text-muted mb-4">
          {filteredPatterns.length} pattern{filteredPatterns.length !== 1 ? "s" : ""} found
        </Text>

        {/* Pattern List */}
        {filteredPatterns.map((pattern) => (
          <Pressable
            key={pattern.id}
            onPress={() => setSelectedPattern(pattern)}
            className="bg-surface rounded-lg p-4 mb-3 border border-border active:opacity-70"
          >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-base font-semibold text-foreground mb-1">
                  {pattern.name}
                </Text>
                <Text className="text-xs text-muted">{pattern.category.replace(/_/g, " ")}</Text>
              </View>

              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: getSeverityColor(pattern.severity) + "20" }}
              >
                <Text
                  className="text-xs font-semibold uppercase"
                  style={{ color: getSeverityColor(pattern.severity) }}
                >
                  {pattern.severity}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text className="text-sm text-muted mb-3 leading-relaxed">{pattern.description}</Text>

            {/* Indicators */}
            <Text className="text-xs font-semibold text-foreground mb-2">Key Indicators:</Text>
            {pattern.common_indicators.slice(0, 3).map((indicator, index) => (
              <View key={index} className="flex-row items-start mb-1">
                <Text className="text-primary mr-2">•</Text>
                <Text className="text-xs text-muted flex-1">{indicator}</Text>
              </View>
            ))}
            {pattern.common_indicators.length > 3 && (
              <Text className="text-xs text-primary mt-1">
                +{pattern.common_indicators.length - 3} more indicators
              </Text>
            )}

            {/* Tags */}
            <View className="flex-row flex-wrap gap-2 mt-3">
              {pattern.tags.map((tag) => (
                <View key={tag} className="bg-background px-2 py-1 rounded">
                  <Text className="text-xs text-muted">{tag}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}

        {/* Pattern Detail Modal (simplified - in production use Modal component) */}
        {selectedPattern && (
          <View className="bg-surface rounded-lg p-4 mb-4 border-2 border-primary">
            <Pressable onPress={() => setSelectedPattern(null)} className="self-end mb-2">
              <Text className="text-primary font-semibold">Close</Text>
            </Pressable>

            <Text className="text-xl font-bold text-foreground mb-2">
              {selectedPattern.name}
            </Text>

            <View
              className="px-3 py-1 rounded-full self-start mb-4"
              style={{ backgroundColor: getSeverityColor(selectedPattern.severity) + "20" }}
            >
              <Text
                className="text-xs font-semibold uppercase"
                style={{ color: getSeverityColor(selectedPattern.severity) }}
              >
                {selectedPattern.severity} Severity
              </Text>
            </View>

            <Text className="text-sm text-muted mb-4 leading-relaxed">
              {selectedPattern.description}
            </Text>

            <Text className="text-sm font-semibold text-foreground mb-2">
              Common Indicators:
            </Text>
            {selectedPattern.common_indicators.map((indicator, index) => (
              <View key={index} className="flex-row items-start mb-2">
                <Text className="text-primary mr-2">•</Text>
                <Text className="text-sm text-foreground flex-1">{indicator}</Text>
              </View>
            ))}

            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-xs text-muted">
                Pattern ID: {selectedPattern.id}
              </Text>
            </View>
          </View>
        )}

        {/* Empty State */}
        {filteredPatterns.length === 0 && (
          <View className="items-center justify-center py-12">
            <Text className="text-muted text-center mb-2">No patterns found</Text>
            <Text className="text-sm text-muted text-center">
              Try adjusting your search or filter criteria
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
