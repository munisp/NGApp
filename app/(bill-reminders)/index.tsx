import { ScrollView, Text, View, Pressable, Switch, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getBillReminders,
  getUpcomingReminders,
  getOverdueReminders,
  markReminderAsPaid,
  enableAutoPay,
  disableAutoPay,
  getReminderStatistics,
  type BillReminder,
} from "@/utils/bill-reminders";

export default function BillRemindersScreen() {
  const colors = useColors();
  const [reminders, setReminders] = useState<BillReminder[]>([]);
  const [upcoming, setUpcoming] = useState<BillReminder[]>([]);
  const [overdue, setOverdue] = useState<BillReminder[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    const [allReminders, upcomingReminders, overdueReminders, statistics] = await Promise.all([
      getBillReminders(),
      getUpcomingReminders(),
      getOverdueReminders(),
      getReminderStatistics(),
    ]);
    
    setReminders(allReminders);
    setUpcoming(upcomingReminders);
    setOverdue(overdueReminders);
    setStats(statistics);
  };

  const handleMarkAsPaid = async (reminderId: string, billName: string) => {
    Alert.alert(
      "Mark as Paid",
      `Mark ${billName} as paid?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await markReminderAsPaid(reminderId);
            Alert.alert("Success", "Bill marked as paid!");
            await loadReminders();
          },
        },
      ]
    );
  };

  const handleToggleAutoPay = async (reminder: BillReminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (reminder.auto_pay_enabled) {
      await disableAutoPay(reminder.id);
    } else {
      // In production, would show account selector
      await enableAutoPay(reminder.id, "default_account");
    }
    
    await loadReminders();
  };

  const renderReminder = (reminder: BillReminder, showStatus: boolean = true) => {
    const daysUntilDue = Math.ceil((reminder.due_date - Date.now()) / (24 * 60 * 60 * 1000));
    const isOverdue = daysUntilDue < 0;
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3;

    return (
      <View
        key={reminder.id}
        className="bg-surface rounded-2xl p-4 border border-border"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground mb-1">
              {reminder.bill_name}
            </Text>
            <Text className="text-sm text-muted mb-1">
              {reminder.biller_name}
            </Text>
            <Text className="text-lg font-bold text-foreground">
              ${reminder.amount.toFixed(2)}
            </Text>
          </View>
          
          {showStatus && (
            <View
              style={{
                backgroundColor: isOverdue
                  ? colors.error + "20"
                  : isDueSoon
                  ? colors.warning + "20"
                  : colors.success + "20",
              }}
              className="px-3 py-1 rounded-full"
            >
              <Text
                style={{
                  color: isOverdue ? colors.error : isDueSoon ? colors.warning : colors.success,
                }}
                className="text-xs font-semibold"
              >
                {isOverdue
                  ? `${Math.abs(daysUntilDue)} days overdue`
                  : daysUntilDue === 0
                  ? "Due today"
                  : `${daysUntilDue} days`}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-muted">
            Due: {new Date(reminder.due_date).toLocaleDateString()}
          </Text>
          {reminder.is_recurring && (
            <Text className="text-xs text-muted">
              🔄 {reminder.recurrence_frequency}
            </Text>
          )}
        </View>

        {/* Auto-Pay Toggle */}
        <View className="flex-row items-center justify-between mb-3 p-3 bg-background rounded-xl">
          <View className="flex-1">
            <Text className="text-sm font-medium text-foreground mb-1">
              Auto-Pay
            </Text>
            <Text className="text-xs text-muted">
              {reminder.auto_pay_enabled
                ? "Enabled - Payment will be automatic"
                : "Disabled - Manual payment required"}
            </Text>
          </View>
          <Switch
            value={reminder.auto_pay_enabled}
            onValueChange={() => handleToggleAutoPay(reminder)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        {/* Actions */}
        {reminder.status === "pending" && (
          <Pressable
            onPress={() => handleMarkAsPaid(reminder.id, reminder.bill_name)}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-xl py-3"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold"
            >
              Mark as Paid
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Bill Reminders
            </Text>
            <Text className="text-sm text-muted">
              Smart reminders with one-tap auto-pay
            </Text>
          </View>

          {/* Stats Cards */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Upcoming</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.upcoming_7_days}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Auto-Pay</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.auto_pay_enabled}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Due</Text>
                <Text className="text-xl font-bold text-foreground">
                  ${stats.total_amount_due.toFixed(0)}
                </Text>
              </View>
            </View>
          )}

          {/* Overdue Bills */}
          {overdue.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-semibold text-foreground">
                  Overdue
                </Text>
                <View
                  style={{ backgroundColor: colors.error + "20" }}
                  className="px-2 py-1 rounded-full"
                >
                  <Text style={{ color: colors.error }} className="text-xs font-semibold">
                    {overdue.length}
                  </Text>
                </View>
              </View>
              {overdue.map((reminder) => renderReminder(reminder))}
            </View>
          )}

          {/* Upcoming Bills */}
          {upcoming.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Upcoming (Next 7 Days)
              </Text>
              {upcoming.map((reminder) => renderReminder(reminder))}
            </View>
          )}

          {/* All Reminders */}
          {reminders.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                All Reminders
              </Text>
              {reminders
                .filter((r) => r.status === "pending")
                .map((reminder) => renderReminder(reminder))}
            </View>
          )}

          {/* Empty State */}
          {reminders.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">🔔</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No bill reminders yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Set up reminders for your bills to never miss a payment
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View
            style={{ backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }}
            className="rounded-2xl p-4 border"
          >
            <Text className="text-sm font-semibold text-foreground mb-2">
              💡 Auto-Pay Benefits
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Never miss a payment deadline
            </Text>
            <Text className="text-sm text-muted mb-1">
              • Automatic payment processing
            </Text>
            <Text className="text-sm text-muted">
              • Instant notifications on success/failure
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
