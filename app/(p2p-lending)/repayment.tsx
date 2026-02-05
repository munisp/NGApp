import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";

export default function RepaymentTracking() {
  const colors = useColors();
  const router = useRouter();

  const loan = {
    loan_id: "LOAN-20260120-000015",
    loan_amount: 200000,
    total_repayment: 225000,
    paid_amount: 75000,
    remaining_amount: 150000,
    next_payment: 25000,
    next_payment_date: "2026-02-15",
    status: "active",
  };

  const schedule = [
    { installment: 1, amount: 25000, due_date: "2026-01-15", status: "paid", paid_date: "2026-01-14" },
    { installment: 2, amount: 25000, due_date: "2026-02-15", status: "paid", paid_date: "2026-02-14" },
    { installment: 3, amount: 25000, due_date: "2026-03-15", status: "paid", paid_date: "2026-03-13" },
    { installment: 4, amount: 25000, due_date: "2026-04-15", status: "pending", paid_date: null },
    { installment: 5, amount: 25000, due_date: "2026-05-15", status: "pending", paid_date: null },
    { installment: 6, amount: 25000, due_date: "2026-06-15", status: "pending", paid_date: null },
  ];

  const handleMakePayment = () => {
    Alert.alert("Make Payment", `Pay ₦${loan.next_payment.toLocaleString()} for installment 4?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Pay Now", onPress: () => Alert.alert("Success", "Payment successful!") },
    ]);
  };

  const getStatusColor = (status: string) => {
    return status === "paid" ? "#22C55E" : status === "overdue" ? "#EF4444" : colors.muted;
  };

  return (
    <ScreenContainer className="p-0">
      <View className="px-6 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold mt-2" style={{ color: colors.foreground }}>Repayment Tracking</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Loan Summary */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Loan Summary</Text>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Loan ID</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{loan.loan_id}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Original Amount</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>₦{loan.loan_amount.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: colors.muted }}>Total Repayment</Text>
            <Text className="font-bold" style={{ color: colors.primary }}>₦{loan.total_repayment.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: colors.muted }}>Remaining</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>₦{loan.remaining_amount.toLocaleString()}</Text>
          </View>
        </View>

        {/* Progress */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row justify-between mb-2">
            <Text className="font-semibold" style={{ color: colors.foreground }}>Repayment Progress</Text>
            <Text className="font-bold" style={{ color: colors.foreground }}>{Math.round((loan.paid_amount / loan.total_repayment) * 100)}%</Text>
          </View>
          <View className="h-2 rounded-full mb-2 overflow-hidden" style={{ backgroundColor: colors.border }}>
            <View className="h-full rounded-full" style={{ width: `${(loan.paid_amount / loan.total_repayment) * 100}%`, backgroundColor: colors.primary }} />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs" style={{ color: colors.muted }}>₦{loan.paid_amount.toLocaleString()} paid</Text>
            <Text className="text-xs" style={{ color: colors.muted }}>₦{loan.remaining_amount.toLocaleString()} remaining</Text>
          </View>
        </View>

        {/* Next Payment */}
        <View className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.primary + "10" }}>
          <Text className="text-base font-semibold mb-2" style={{ color: colors.foreground }}>Next Payment</Text>
          <View className="flex-row justify-between mb-3">
            <View>
              <Text className="text-xs" style={{ color: colors.muted }}>Amount</Text>
              <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>₦{loan.next_payment.toLocaleString()}</Text>
            </View>
            <View>
              <Text className="text-xs" style={{ color: colors.muted }}>Due Date</Text>
              <Text className="text-lg font-bold" style={{ color: colors.foreground }}>{loan.next_payment_date}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleMakePayment} className="py-4 rounded-full" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold" style={{ color: "#FFF" }}>Make Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Schedule */}
        <Text className="text-base font-semibold mb-3" style={{ color: colors.foreground }}>Payment Schedule</Text>

        {schedule.map((payment) => (
          <View key={payment.installment} className="p-4 rounded-xl mb-3" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className="font-bold" style={{ color: colors.foreground }}>Installment #{payment.installment}</Text>
                <Text className="text-xs mt-1" style={{ color: colors.muted }}>Due: {payment.due_date}</Text>
                {payment.paid_date && (
                  <Text className="text-xs" style={{ color: colors.muted }}>Paid: {payment.paid_date}</Text>
                )}
              </View>
              <View className="items-end">
                <Text className="text-lg font-bold" style={{ color: colors.foreground }}>₦{payment.amount.toLocaleString()}</Text>
                <View className="px-3 py-1 rounded-full mt-1" style={{ backgroundColor: getStatusColor(payment.status) + "20" }}>
                  <Text className="text-xs font-semibold capitalize" style={{ color: getStatusColor(payment.status) }}>{payment.status}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
