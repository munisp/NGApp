import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function LoanDetails() {
  const colors = useColors();
  const router = useRouter();
  const [fundAmount, setFundAmount] = useState("");

  const loan = {
    loan_id: "LOAN-20260124-000001",
    borrower_name: "Adewale Okonkwo",
    credit_score: 720,
    loan_amount: 150000,
    interest_rate: 12.5,
    loan_duration_months: 6,
    loan_purpose: "business",
    loan_story: "Expanding my textile business in Aba market. Need funds for new inventory and equipment.",
    risk_level: "low",
    funding_progress: 65,
    funded_amount: 97500,
    remaining_amount: 52500,
    total_funders: 8,
    funders: [
      { name: "Chioma N.", amount: 20000, date: "2026-01-20" },
      { name: "Ibrahim Y.", amount: 15000, date: "2026-01-21" },
      { name: "Grace O.", amount: 12500, date: "2026-01-22" },
    ],
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "#22C55E";
      case "medium": return "#F59E0B";
      case "high": return "#EF4444";
      default: return colors.muted;
    }
  };

  const handleFund = () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 5000) {
      Alert.alert("Error", "Minimum funding amount is ₦5,000");
      return;
    }
    if (amount > loan.remaining_amount) {
      Alert.alert("Error", `Maximum funding amount is ₦${loan.remaining_amount.toLocaleString()}`);
      return;
    }
    Alert.alert("Confirm Funding", `Fund ₦${amount.toLocaleString()} to this loan?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => Alert.alert("Success", "Funding successful!") },
    ]);
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Loan Details</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Borrower Profile */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-lg font-bold" style={{ color: colors.foreground }}>{loan.borrower_name}</Text>
              <Text className="mt-1" style={{ color: colors.muted }}>Credit Score: {loan.credit_score}</Text>
            </View>
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: getRiskColor(loan.risk_level) + "20" }}>
              <Text className="text-xs font-semibold capitalize" style={{ color: getRiskColor(loan.risk_level) }}>{loan.risk_level} Risk</Text>
            </View>
          </View>
        </View>

        {/* Loan Information */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Loan Information</Text>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Amount</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>₦{loan.loan_amount.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Interest Rate</Text>
            <Text className="font-bold" style={{ color: colors.primary }}>{loan.interest_rate}%</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Duration</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{loan.loan_duration_months} months</Text>
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: colors.muted }}>Purpose</Text>
            <Text className="font-bold capitalize" style={{ color: colors.foreground }}>{loan.loan_purpose}</Text>
          </View>
        </View>

        {/* Loan Story */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-2" style={{ color: colors.foreground }}>Borrower's Story</Text>
          <Text style={{ color: colors.foreground }}>{loan.loan_story}</Text>
        </View>

        {/* Funding Progress */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row justify-between mb-2">
            <Text className="font-semibold" style={{ color: colors.foreground }}>Funding Progress</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{loan.funding_progress}%</Text>
          </View>
          <View className="h-2 rounded-full mb-3 overflow-hidden" style={{ backgroundColor: colors.border }}>
            <View className="h-full rounded-full" style={{ width: `${loan.funding_progress}%`, backgroundColor: colors.primary }} />
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: colors.muted }}>₦{loan.funded_amount.toLocaleString()} funded</Text>
            <Text className="font-semibold" style={{ color: colors.primary }}>₦{loan.remaining_amount.toLocaleString()} remaining</Text>
          </View>
        </View>

        {/* Funders List */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Funders ({loan.total_funders})</Text>
          {loan.funders.map((funder, index) => (
            <View key={index} className="flex-row justify-between py-2" style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}>
              <View>
                <Text className="font-medium" style={{ color: colors.foreground }}>{funder.name}</Text>
                <Text className="text-xs" style={{ color: colors.muted }}>{funder.date}</Text>
              </View>
              <Text className="font-bold" style={{ color: colors.foreground }}>₦{funder.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Fund This Loan */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.primary + "10" }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Fund This Loan</Text>
          <TextInput
            value={fundAmount}
            onChangeText={setFundAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            className="px-4 py-3 rounded-lg mb-3"
            style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity onPress={handleFund} className="py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Fund Loan</Text>
          </TouchableOpacity>
        </View>

        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
