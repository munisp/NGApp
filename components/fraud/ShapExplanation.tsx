import { View, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface ShapFeature {
  feature: string;
  value: number;
  shap_value: number;
  contribution: number;
}

interface ShapExplanationProps {
  prediction: number;
  base_value: number;
  top_features: ShapFeature[];
  explanation: string;
}

export function ShapExplanation({
  prediction,
  base_value,
  top_features,
  explanation,
}: ShapExplanationProps) {
  const colors = useColors();

  const getFeatureColor = (shap_value: number) => {
    if (shap_value > 0) return "#EF4444"; // Red for fraud indicators
    return "#22C55E"; // Green for legitimate indicators
  };

  const getFeatureLabel = (feature: string) => {
    const labels: Record<string, string> = {
      amount: "Transaction Amount",
      hour_of_day: "Time of Day",
      day_of_week: "Day of Week",
      is_international: "International",
      account_age_days: "Account Age",
      balance: "Account Balance",
      kyc_verified: "KYC Verified",
      kyb_verified: "KYB Verified",
      account_risk_score: "Account Risk",
      total_transactions: "Total Transactions",
      avg_transaction_amount: "Avg Transaction",
      velocity_1h: "Transactions (1h)",
      velocity_24h: "Transactions (24h)",
      unusual_amount: "Unusual Amount",
      unusual_time: "Unusual Time",
      high_risk_country: "High Risk Country",
      suspicious_pattern: "Suspicious Pattern",
    };

    return labels[feature] || feature.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatValue = (feature: string, value: number) => {
    if (feature === "amount" || feature.includes("balance")) {
      return `$${value.toFixed(2)}`;
    }
    if (feature.includes("verified") || feature === "is_international") {
      return value > 0 ? "Yes" : "No";
    }
    if (feature.includes("days") || feature.includes("transactions")) {
      return Math.round(value).toString();
    }
    return value.toFixed(2);
  };

  return (
    <View className="bg-surface rounded-lg p-4 border border-border">
      {/* Header */}
      <Text className="text-lg font-semibold text-foreground mb-2">
        Why was this flagged?
      </Text>

      {/* Explanation Text */}
      <Text className="text-sm text-muted mb-4 leading-relaxed">
        {explanation}
      </Text>

      {/* Risk Score */}
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm text-muted">Base Risk</Text>
          <Text className="text-sm font-semibold text-foreground">
            {(base_value * 100).toFixed(1)}%
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-muted">Final Risk Score</Text>
          <Text
            className="text-sm font-bold"
            style={{
              color: prediction > 0.7 ? "#EF4444" : prediction > 0.4 ? "#F59E0B" : "#22C55E",
            }}
          >
            {(prediction * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Top Contributing Features */}
      <Text className="text-sm font-semibold text-foreground mb-3">
        Top Contributing Factors:
      </Text>

      {top_features.map((feature, index) => {
        const featureColor = getFeatureColor(feature.shap_value);
        const impact = feature.shap_value > 0 ? "increases" : "decreases";
        const maxContribution = Math.max(...top_features.map((f) => f.contribution));
        const barWidth = (feature.contribution / maxContribution) * 100;

        return (
          <View key={index} className="mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-sm text-foreground flex-1">
                {getFeatureLabel(feature.feature)}
              </Text>
              <Text className="text-xs text-muted ml-2">
                {formatValue(feature.feature, feature.value)}
              </Text>
            </View>

            {/* Impact Bar */}
            <View className="h-2 bg-surface rounded-full overflow-hidden border border-border">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: featureColor,
                }}
              />
            </View>

            <Text className="text-xs text-muted mt-1">
              {impact} risk by {(Math.abs(feature.shap_value) * 100).toFixed(1)}%
            </Text>
          </View>
        );
      })}

      {/* Info Footer */}
      <View className="mt-4 pt-4 border-t border-border">
        <Text className="text-xs text-muted leading-relaxed">
          This explanation uses SHAP (SHapley Additive exPlanations) to show how each factor
          contributed to the fraud risk score. Red bars indicate factors that increase risk, while
          green bars indicate factors that decrease risk.
        </Text>
      </View>
    </View>
  );
}
