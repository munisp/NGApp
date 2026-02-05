import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function CreateLoanRequest() {
  const colors = useColors();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loanAmount, setLoanAmount] = useState("");
  const [duration, setDuration] = useState("6");
  const [purpose, setPurpose] = useState("business");
  const [story, setStory] = useState("");
  const [interestRate, setInterestRate] = useState("12.5");

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) / 100 / 12;
    const months = parseInt(duration);
    if (principal === 0 || months === 0) return 0;
    const monthly = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    return Math.round(monthly);
  };

  const handleNext = () => {
    if (step === 1 && (!loanAmount || parseFloat(loanAmount) < 10000)) {
      Alert.alert("Error", "Minimum loan amount is ₦10,000");
      return;
    }
    if (step === 2 && story.length < 50) {
      Alert.alert("Error", "Please provide a detailed story (minimum 50 characters)");
      return;
    }
    if (step < 3) setStep(step + 1);
    else {
      Alert.alert("Success", "Loan request submitted!", [{ text: "OK", onPress: () => router.back() }]);
    }
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>
          Request a Loan
        </Text>
        <Text style={{ color: colors.muted }}>Step {step} of 3</Text>
      </View>

      <View className="px-6 py-3">
        <View className="flex-row gap-2">
          {[1, 2, 3].map((s) => (
            <View key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: s <= step ? colors.primary : colors.border }} />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {step === 1 && (
          <>
            <Text className="text-lg font-bold mb-4" style={{ color: colors.foreground }}>Loan Details</Text>
            <View className="mb-4">
              <Text className="mb-2" style={{ color: colors.foreground }}>Amount</Text>
              <TextInput
                value={loanAmount}
                onChangeText={setLoanAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                className="px-4 py-3 rounded-lg"
                style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View className="mb-4">
              <Text className="mb-2" style={{ color: colors.foreground }}>Duration</Text>
              <View className="flex-row gap-2">
                {["3", "6", "12", "18"].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDuration(d)}
                    className="flex-1 py-3 rounded-lg items-center"
                    style={{ backgroundColor: duration === d ? colors.primary : colors.surface }}
                  >
                    <Text style={{ color: duration === d ? "#FFF" : colors.foreground }}>{d}mo</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {loanAmount && (
              <View className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                <Text className="mb-2" style={{ color: colors.foreground }}>Monthly Payment: ₦{calculateMonthlyPayment().toLocaleString()}</Text>
                <Text style={{ color: colors.primary }}>Total: ₦{(calculateMonthlyPayment() * parseInt(duration)).toLocaleString()}</Text>
              </View>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Text className="text-lg font-bold mb-4" style={{ color: colors.foreground }}>Tell Your Story</Text>
            <TextInput
              value={story}
              onChangeText={setStory}
              multiline
              numberOfLines={8}
              placeholder="Explain why you need this loan..."
              className="px-4 py-3 rounded-lg mb-2"
              style={{ backgroundColor: colors.surface, color: colors.foreground, borderWidth: 1, borderColor: colors.border, minHeight: 200, textAlignVertical: "top" }}
              placeholderTextColor={colors.muted}
            />
            <Text style={{ color: colors.muted }}>{story.length} / 500 characters</Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text className="text-lg font-bold mb-4" style={{ color: colors.foreground }}>Review & Submit</Text>
            <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Amount</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>₦{parseFloat(loanAmount).toLocaleString()}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.muted }}>Duration</Text>
                <Text className="font-bold" style={{ color: colors.foreground }}>{duration} months</Text>
              </View>
              <View className="flex-row justify-between">
                <Text style={{ color: colors.muted }}>Interest Rate</Text>
                <Text className="font-bold" style={{ color: colors.primary }}>{interestRate}%</Text>
              </View>
            </View>
          </>
        )}

        <View className="h-32" />
      </ScrollView>

      <View className="px-6 py-4" style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View className="flex-row gap-3">
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} className="flex-1 py-4 rounded-full" style={{ backgroundColor: colors.surface }}>
              <Text className="text-center font-semibold" style={{ color: colors.foreground }}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleNext} className="flex-1 py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold" style={{ color: "#FFF" }}>{step < 3 ? "Next" : "Submit"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
