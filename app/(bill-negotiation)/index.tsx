import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  loadRecurringBills,
  analyzeBillsForNegotiation,
  saveNegotiationResult,
  calculateTotalSavings,
  type RecurringBill,
  type NegotiationOpportunity,
} from "@/utils/bill-negotiation";

export default function BillNegotiationScreen() {
  const colors = useColors();
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [opportunities, setOpportunities] = useState<NegotiationOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<NegotiationOpportunity | null>(null);
  const [totalSavings, setTotalSavings] = useState({
    totalSavings: 0,
    monthlySavings: 0,
    annualSavings: 0,
    negotiationCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const billsData = await loadRecurringBills();
      const opportunitiesData = await analyzeBillsForNegotiation(billsData);
      const savingsData = await calculateTotalSavings();

      setBills(billsData);
      setOpportunities(opportunitiesData);
      setTotalSavings(savingsData);
    } catch (error) {
      console.error("Failed to load bill negotiation data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNegotiation = (opportunity: NegotiationOpportunity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedOpportunity(opportunity);
    setShowNegotiationModal(true);
    setNewAmount("");
    setNotes("");
  };

  const handleSaveResult = async () => {
    if (!selectedOpportunity || !newAmount) {
      Alert.alert("Error", "Please enter the new amount");
      return;
    }

    const newAmountNum = parseFloat(newAmount);
    if (isNaN(newAmountNum) || newAmountNum < 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      await saveNegotiationResult({
        billId: selectedOpportunity.billId,
        provider: selectedOpportunity.provider,
        originalAmount: selectedOpportunity.currentAmount,
        newAmount: newAmountNum,
        savings: selectedOpportunity.currentAmount - newAmountNum,
        negotiatedAt: Date.now(),
        notes: notes || "Successfully negotiated lower rate",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success!",
        `You saved $${(selectedOpportunity.currentAmount - newAmountNum).toFixed(2)}/month!`,
        [
          {
            text: "OK",
            onPress: () => {
              setShowNegotiationModal(false);
              loadData();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save negotiation result");
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return colors.success;
      case "medium":
        return colors.warning;
      case "hard":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "😊";
      case "medium":
        return "😐";
      case "hard":
        return "😓";
      default:
        return "❓";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Analyzing your bills...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Bill Negotiation</Text>
            <Text className="text-sm text-muted">
              Save money by negotiating lower rates on recurring bills
            </Text>
          </View>

          {/* Total Savings Card */}
          <View
            style={{ backgroundColor: colors.success + "20" }}
            className="rounded-2xl p-6"
          >
            <Text className="text-4xl font-bold text-foreground mb-2">
              ${totalSavings.annualSavings.toFixed(0)}
            </Text>
            <Text className="text-base text-muted mb-4">
              Potential Annual Savings
            </Text>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">
                  ${totalSavings.monthlySavings.toFixed(0)}
                </Text>
                <Text className="text-xs text-muted">Monthly</Text>
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">
                  {totalSavings.negotiationCount}
                </Text>
                <Text className="text-xs text-muted">Successful</Text>
              </View>
            </View>
          </View>

          {/* Negotiation Opportunities */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">
              Negotiation Opportunities
            </Text>

            {opportunities.length === 0 ? (
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-8 items-center"
              >
                <Text className="text-4xl mb-3">💰</Text>
                <Text className="text-base text-muted text-center">
                  No negotiation opportunities found
                </Text>
              </View>
            ) : (
              opportunities.map((opportunity) => (
                <View
                  key={opportunity.billId}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-5 mb-4"
                >
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground mb-1">
                        {opportunity.provider}
                      </Text>
                      <Text className="text-sm text-muted capitalize">
                        {opportunity.category}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-2xl font-bold text-foreground">
                        ${opportunity.potentialSavings.toFixed(0)}
                      </Text>
                      <Text className="text-xs text-muted">potential savings</Text>
                    </View>
                  </View>

                  {/* Current vs Target */}
                  <View className="flex-row items-center gap-3 mb-4">
                    <View className="flex-1">
                      <Text className="text-xs text-muted mb-1">Current</Text>
                      <Text className="text-base font-semibold text-foreground">
                        ${opportunity.currentAmount.toFixed(2)}/mo
                      </Text>
                    </View>

                    <Text className="text-xl">→</Text>

                    <View className="flex-1">
                      <Text className="text-xs text-muted mb-1">Target</Text>
                      <Text
                        style={{ color: colors.success }}
                        className="text-base font-semibold"
                      >
                        $
                        {(
                          opportunity.currentAmount -
                          opportunity.potentialSavings
                        ).toFixed(2)}
                        /mo
                      </Text>
                    </View>

                    <View
                      style={{ backgroundColor: colors.success + "20" }}
                      className="rounded-full px-3 py-1"
                    >
                      <Text
                        style={{ color: colors.success }}
                        className="text-sm font-bold"
                      >
                        -{opportunity.savingsPercent}%
                      </Text>
                    </View>
                  </View>

                  {/* Difficulty */}
                  <View className="flex-row items-center gap-2 mb-4">
                    <Text className="text-sm text-muted">Difficulty:</Text>
                    <View
                      style={{
                        backgroundColor:
                          getDifficultyColor(opportunity.negotiationDifficulty) + "20",
                      }}
                      className="rounded-full px-3 py-1 flex-row items-center gap-1"
                    >
                      <Text className="text-base">
                        {getDifficultyIcon(opportunity.negotiationDifficulty)}
                      </Text>
                      <Text
                        style={{
                          color: getDifficultyColor(opportunity.negotiationDifficulty),
                        }}
                        className="text-xs font-bold capitalize"
                      >
                        {opportunity.negotiationDifficulty}
                      </Text>
                    </View>
                  </View>

                  {/* Best Time */}
                  <View
                    style={{ backgroundColor: colors.background }}
                    className="rounded-xl p-3 mb-4"
                  >
                    <Text className="text-xs text-muted mb-1">Best time to call:</Text>
                    <Text className="text-sm text-foreground">
                      {opportunity.bestTimeToCall}
                    </Text>
                  </View>

                  {/* Action Button */}
                  <Pressable
                    onPress={() => handleStartNegotiation(opportunity)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="rounded-xl px-6 py-3"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="text-center font-bold text-base"
                    >
                      View Negotiation Script
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Negotiation Modal */}
      {showNegotiationModal && selectedOpportunity && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{ backgroundColor: colors.background }}
            className="rounded-2xl p-6 w-full max-w-md"
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xl font-bold text-foreground mb-4">
                Negotiation Script
              </Text>

              {/* Script */}
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 mb-4"
              >
                <Text className="text-sm text-foreground leading-relaxed">
                  {selectedOpportunity.script}
                </Text>
              </View>

              {/* Tips */}
              <Text className="text-base font-bold text-foreground mb-3">
                Negotiation Tips:
              </Text>
              {selectedOpportunity.tips.map((tip, index) => (
                <View key={index} className="flex-row items-start gap-2 mb-2">
                  <Text className="text-sm">•</Text>
                  <Text className="flex-1 text-sm text-muted leading-relaxed">
                    {tip}
                  </Text>
                </View>
              ))}

              {/* Alternative Providers */}
              {selectedOpportunity.alternativeProviders &&
                selectedOpportunity.alternativeProviders.length > 0 && (
                  <>
                    <Text className="text-base font-bold text-foreground mt-4 mb-3">
                      Alternative Providers:
                    </Text>
                    {selectedOpportunity.alternativeProviders.map((provider, index) => (
                      <View
                        key={index}
                        style={{ backgroundColor: colors.surface }}
                        className="rounded-xl p-3 mb-2"
                      >
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-sm font-bold text-foreground">
                            {provider.name}
                          </Text>
                          <Text className="text-sm font-bold text-foreground">
                            ${provider.price}/mo
                          </Text>
                        </View>
                        {provider.features.map((feature, fIndex) => (
                          <Text key={fIndex} className="text-xs text-muted">
                            • {feature}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </>
                )}

              {/* Result Input */}
              <Text className="text-base font-bold text-foreground mt-4 mb-3">
                Record Result:
              </Text>

              <View className="mb-3">
                <Text className="text-sm text-muted mb-2">New Amount ($/month)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="rounded-xl px-4 py-3 text-base border"
                  placeholder="Enter new amount"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={newAmount}
                  onChangeText={setNewAmount}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-muted mb-2">Notes (optional)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="rounded-xl px-4 py-3 text-base border"
                  placeholder="Add notes about the negotiation"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowNegotiationModal(false);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="flex-1 rounded-xl px-6 py-3"
                >
                  <Text
                    style={{ color: colors.foreground }}
                    className="text-center font-bold text-base"
                  >
                    Close
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveResult}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="flex-1 rounded-xl px-6 py-3"
                >
                  <Text
                    style={{ color: colors.background }}
                    className="text-center font-bold text-base"
                  >
                    Save Result
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
