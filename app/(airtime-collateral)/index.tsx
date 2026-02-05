import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface BalanceInfo {
  phoneNumber: string;
  provider: string;
  airtimeBalance: number;
  dataBalanceMB: number;
  totalValueNGN: number;
  verified: boolean;
}

interface CollateralValuation {
  totalValueNGN: number;
  maxLoanAmountNGN: number;
  recommendedLoanNGN: number;
  interestRate: number;
  approvalProbability: number;
  riskScore: number;
}

export default function AirtimeCollateralScreen() {
  const colors = useColors();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState<string>("MTN");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTermDays, setLoanTermDays] = useState("30");
  const [purpose, setPurpose] = useState("");

  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [valuation, setValuation] = useState<CollateralValuation | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [applying, setApplying] = useState(false);

  const providers = ["MTN", "Airtel", "Glo", "9mobile"];

  const verifyBalance = async () => {
    if (!phoneNumber) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    setVerifying(true);
    try {
      // Call API to verify balance
      const response = await fetch("http://localhost:8080/api/v1/airtime-collateral/verify-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          provider: provider,
        }),
      });

      const data = await response.json();
      
      if (data.verified) {
        setBalanceInfo({
          phoneNumber: data.phone_number,
          provider: data.provider,
          airtimeBalance: data.airtime_balance,
          dataBalanceMB: data.data_balance_mb,
          totalValueNGN: data.total_value_ngn,
          verified: true,
        });

        // Calculate collateral value
        await calculateValue();
      } else {
        Alert.alert("Verification Failed", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to verify balance. Please try again.");
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  const calculateValue = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8080/api/v1/airtime-collateral/calculate-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "user123", // Replace with actual user ID from auth context
          phone_number: phoneNumber,
          provider: provider,
        }),
      });

      const data = await response.json();
      setValuation(data);
    } catch (error) {
      Alert.alert("Error", "Failed to calculate collateral value");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyForLoan = async () => {
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid loan amount");
      return;
    }

    if (!valuation) {
      Alert.alert("Error", "Please verify your balance first");
      return;
    }

    const requestedAmount = parseFloat(loanAmount);
    if (requestedAmount > valuation.maxLoanAmountNGN) {
      Alert.alert(
        "Amount Too High",
        `Maximum eligible amount is ₦${valuation.maxLoanAmountNGN.toFixed(2)}`
      );
      return;
    }

    setApplying(true);
    try {
      const response = await fetch("http://localhost:8080/api/v1/airtime-collateral/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "user123", // Replace with actual user ID
          phone_number: phoneNumber,
          provider: provider,
          requested_amount_ngn: requestedAmount,
          loan_term_days: parseInt(loanTermDays),
          purpose: purpose,
        }),
      });

      const data = await response.json();

      if (data.status === "approved") {
        Alert.alert(
          "Loan Approved!",
          `Your loan of ₦${data.approved_amount_ngn.toFixed(2)} has been approved.\n\nInterest Rate: ${data.interest_rate.toFixed(2)}%\nTotal Repayment: ₦${data.total_repayment_ngn.toFixed(2)}\nLoan ID: ${data.loan_id}`,
          [
            {
              text: "View Loans",
              onPress: () => router.push("/(airtime-collateral)/my-loans"),
            },
            { text: "OK" },
          ]
        );
      } else {
        Alert.alert("Application Status", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit loan application");
      console.error(error);
    } finally {
      setApplying(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Airtime as Collateral</Text>
            <Text className="text-muted mt-2">
              Get instant loans using your airtime and data balance as collateral
            </Text>
          </View>

          {/* Phone Number Input */}
          <View className="gap-2">
            <Text className="text-foreground font-medium">Phone Number</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="08012345678"
              placeholderTextColor={colors.muted}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          {/* Provider Selection */}
          <View className="gap-2">
            <Text className="text-foreground font-medium">Network Provider</Text>
            <View className="flex-row gap-2">
              {providers.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setProvider(p)}
                  className="flex-1 py-3 rounded-xl border"
                  style={{
                    backgroundColor: provider === p ? colors.primary : colors.surface,
                    borderColor: provider === p ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-center font-medium"
                    style={{ color: provider === p ? "#FFFFFF" : colors.foreground }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Verify Balance Button */}
          <TouchableOpacity
            onPress={verifyBalance}
            disabled={verifying || !phoneNumber}
            className="bg-primary py-4 rounded-xl"
            style={{ opacity: verifying || !phoneNumber ? 0.5 : 1 }}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Verify Balance
              </Text>
            )}
          </TouchableOpacity>

          {/* Balance Information */}
          {balanceInfo && (
            <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
              <Text className="text-lg font-bold text-foreground">Your Balance</Text>
              
              <View className="flex-row justify-between">
                <Text className="text-muted">Airtime Balance</Text>
                <Text className="text-foreground font-semibold">
                  ₦{balanceInfo.airtimeBalance.toFixed(2)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">Data Balance</Text>
                <Text className="text-foreground font-semibold">
                  {balanceInfo.dataBalanceMB.toFixed(0)} MB
                </Text>
              </View>

              <View className="h-px bg-border" />

              <View className="flex-row justify-between">
                <Text className="text-foreground font-bold">Total Value</Text>
                <Text className="text-primary font-bold text-xl">
                  ₦{balanceInfo.totalValueNGN.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Collateral Valuation */}
          {valuation && (
            <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
              <Text className="text-lg font-bold text-foreground">Loan Eligibility</Text>

              <View className="flex-row justify-between">
                <Text className="text-muted">Maximum Loan Amount</Text>
                <Text className="text-success font-semibold">
                  ₦{valuation.maxLoanAmountNGN.toFixed(2)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">Recommended Amount</Text>
                <Text className="text-foreground font-semibold">
                  ₦{valuation.recommendedLoanNGN.toFixed(2)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">Interest Rate</Text>
                <Text className="text-foreground font-semibold">
                  {valuation.interestRate.toFixed(2)}%
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-muted">Approval Probability</Text>
                <Text
                  className="font-semibold"
                  style={{
                    color:
                      valuation.approvalProbability >= 0.7
                        ? colors.success
                        : valuation.approvalProbability >= 0.5
                        ? colors.warning
                        : colors.error,
                  }}
                >
                  {(valuation.approvalProbability * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          )}

          {/* Loan Application Form */}
          {valuation && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Apply for Loan</Text>

              <View className="gap-2">
                <Text className="text-foreground font-medium">Loan Amount (₦)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  placeholder={`Max: ${valuation.maxLoanAmountNGN.toFixed(2)}`}
                  placeholderTextColor={colors.muted}
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  keyboardType="numeric"
                />
              </View>

              <View className="gap-2">
                <Text className="text-foreground font-medium">Loan Term (Days)</Text>
                <View className="flex-row gap-2">
                  {["7", "14", "30", "60"].map((days) => (
                    <TouchableOpacity
                      key={days}
                      onPress={() => setLoanTermDays(days)}
                      className="flex-1 py-3 rounded-xl border"
                      style={{
                        backgroundColor: loanTermDays === days ? colors.primary : colors.surface,
                        borderColor: loanTermDays === days ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        className="text-center font-medium"
                        style={{ color: loanTermDays === days ? "#FFFFFF" : colors.foreground }}
                      >
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-foreground font-medium">Purpose (Optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  placeholder="e.g., Emergency, Business, Personal"
                  placeholderTextColor={colors.muted}
                  value={purpose}
                  onChangeText={setPurpose}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Repayment Calculation */}
              {loanAmount && parseFloat(loanAmount) > 0 && (
                <View className="bg-primary/10 rounded-xl p-4 border border-primary/30">
                  <Text className="text-foreground font-bold mb-2">Repayment Summary</Text>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted">Loan Amount</Text>
                    <Text className="text-foreground">₦{parseFloat(loanAmount).toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted">Interest ({valuation.interestRate.toFixed(2)}%)</Text>
                    <Text className="text-foreground">
                      ₦{(parseFloat(loanAmount) * (valuation.interestRate / 100)).toFixed(2)}
                    </Text>
                  </View>
                  <View className="h-px bg-border my-2" />
                  <View className="flex-row justify-between">
                    <Text className="text-foreground font-bold">Total Repayment</Text>
                    <Text className="text-primary font-bold text-lg">
                      ₦
                      {(
                        parseFloat(loanAmount) +
                        parseFloat(loanAmount) * (valuation.interestRate / 100)
                      ).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Apply Button */}
              <TouchableOpacity
                onPress={applyForLoan}
                disabled={applying || !loanAmount}
                className="bg-success py-4 rounded-xl mt-2"
                style={{ opacity: applying || !loanAmount ? 0.5 : 1 }}
              >
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">
                    Apply for Loan
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Info Section */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-foreground font-bold mb-3">How It Works</Text>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">1.</Text>
                <Text className="text-muted flex-1">
                  Verify your airtime and data balance with your network provider
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">2.</Text>
                <Text className="text-muted flex-1">
                  Get instant loan eligibility based on your balance value
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">3.</Text>
                <Text className="text-muted flex-1">
                  Apply for a loan up to 80% of your total balance value
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">4.</Text>
                <Text className="text-muted flex-1">
                  Repay within the agreed term or your airtime/data will be used as repayment
                </Text>
              </View>
            </View>
          </View>

          {/* View My Loans Button */}
          <TouchableOpacity
            onPress={() => router.push("/(airtime-collateral)/my-loans")}
            className="border border-primary py-4 rounded-xl"
          >
            <Text className="text-primary text-center font-semibold text-lg">
              View My Loans
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
