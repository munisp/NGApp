import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

/**
 * Bill Reminders & Auto-Pay Screen
 * 
 * Features:
 * - View all recurring bills
 * - Create new bill reminders
 * - Edit existing reminders
 * - Mark bills as paid
 * - Enable/disable auto-pay
 * - View upcoming and overdue bills
 */

export default function BillRemindersScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  
  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [dueDay, setDueDay] = useState('1');
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');

    const { data: _data, isLoading, isError: billsError, refetch } = trpc.billReminders.getBillReminders.useQuery();
    const { data: _upcomingData, isError: upError } = trpc.billReminders.getUpcomingBills.useQuery();
    const { data: _overdueData, isError: odError } = trpc.billReminders.getOverdueBills.useQuery();
    const data = billsError ? DEMO.billReminders : _data;
    const upcomingData = upError ? DEMO.upcomingBills : _upcomingData;
    const overdueData = odError ? DEMO.overdueBills : _overdueData;
  
  const createMutation = trpc.billReminders.createBillReminder.useMutation();
  const updateMutation = trpc.billReminders.updateBillReminder.useMutation();
  const deleteMutation = trpc.billReminders.deleteBillReminder.useMutation();
  const markPaidMutation = trpc.billReminders.markBillAsPaid.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openCreateModal = () => {
    setEditingBill(null);
    setMerchantName('');
    setAmount('');
    setFrequency('monthly');
    setDueDay('1');
    setAutoPayEnabled(false);
    setReminderDays('3');
    setModalVisible(true);
  };

  const openEditModal = (bill: any) => {
    setEditingBill(bill);
    setMerchantName(bill.merchantName);
    setAmount((bill.amount / 100).toString());
    setFrequency(bill.frequency);
    setDueDay(bill.dueDay.toString());
    setAutoPayEnabled(bill.autoPayEnabled);
    setReminderDays(bill.reminderDaysBefore.toString());
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!merchantName.trim() || !amount || !dueDay) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const dueDayNum = parseInt(dueDay);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      Alert.alert('Error', 'Please enter a valid due day (1-31)');
      return;
    }

    try {
      if (editingBill) {
        await updateMutation.mutateAsync({
          reminderId: editingBill.id,
          merchantName,
          amount: amountNum,
          frequency,
          dueDay: dueDayNum,
          autoPayEnabled,
          reminderDaysBefore: parseInt(reminderDays),
        });
        Alert.alert('Success', 'Bill reminder updated successfully');
      } else {
        // Calculate next due date
        const now = new Date();
        const nextDueDate = new Date(now.getFullYear(), now.getMonth(), dueDayNum);
        if (nextDueDate < now) {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }

        await createMutation.mutateAsync({
          merchantName,
          amount: amountNum,
          frequency,
          dueDay: dueDayNum,
          nextDueDate: nextDueDate.toISOString(),
          autoPayEnabled,
          reminderDaysBefore: parseInt(reminderDays),
          isAmountVariable: false,
        });
        Alert.alert('Success', 'Bill reminder created successfully');
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setModalVisible(false);
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill reminder');
    }
  };

  const handleDelete = (bill: any) => {
    Alert.alert(
      'Delete Bill Reminder',
      `Are you sure you want to delete "${bill.merchantName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ reminderId: bill.id });
              Alert.alert('Success', 'Bill reminder deleted successfully');
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete bill reminder');
            }
          },
        },
      ]
    );
  };

  const handleMarkPaid = (payment: any) => {
    Alert.alert(
      'Mark as Paid',
      `Confirm payment for ${payment.reminder?.merchantName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              await markPaidMutation.mutateAsync({
                paymentId: payment.id,
                paymentMethod: 'manual',
              });
              Alert.alert('Success', 'Bill marked as paid');
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to mark bill as paid');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (date: Date | string) => {
    const now = new Date();
    const target = new Date(date);
    const days = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

    if (isLoading && !billsError) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted">Loading bill reminders...</Text>
        </ScreenContainer>
      );
    }

  const reminders = data?.reminders || [];
  const upcomingCount = data?.upcomingCount || 0;
  const autoPayCount = data?.autoPayCount || 0;
  const overdueBills = overdueData?.overdueBills || [];

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-3xl font-bold text-foreground">Bill Reminders</Text>
            <Text className="text-base text-muted mt-1">
              {reminders.length} bills • {upcomingCount} upcoming
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreateModal}
            activeOpacity={0.7}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-sm font-semibold text-background">+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-xs text-muted mb-1">Upcoming (30d)</Text>
            <Text className="text-2xl font-bold text-foreground">{upcomingCount}</Text>
            {upcomingData && (
              <Text className="text-xs text-muted mt-1">
                {formatCurrency(upcomingData.totalAmount)}
              </Text>
            )}
          </View>
          <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-xs text-muted mb-1">Auto-Pay</Text>
            <Text className="text-2xl font-bold text-foreground">{autoPayCount}</Text>
            <Text className="text-xs text-muted mt-1">enabled</Text>
          </View>
        </View>

        {/* Overdue Bills */}
        {overdueBills.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-error mb-3">
              ⚠️ Overdue Bills ({overdueBills.length})
            </Text>
            {overdueBills.map((bill) => (
              <TouchableOpacity
                key={bill.id}
                onPress={() => handleMarkPaid(bill)}
                activeOpacity={0.7}
                className="bg-surface rounded-2xl p-4 mb-3 border-2"
                style={{ borderColor: colors.error }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-lg font-bold text-foreground flex-1">
                    {bill.reminder?.merchantName}
                  </Text>
                  <Text className="text-lg font-bold text-error">
                    {formatCurrency(bill.amount)}
                  </Text>
                </View>
                <Text className="text-sm text-muted">
                  Due: {formatDate(bill.dueDate)} • {bill.daysOverdue} days overdue
                </Text>
                <Text className="text-xs text-primary mt-2">Tap to mark as paid</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* All Bill Reminders */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-foreground mb-3">All Bills</Text>
          {reminders.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">📄</Text>
              <Text className="text-xl font-bold text-foreground mb-2">No Bill Reminders</Text>
              <Text className="text-sm text-muted text-center mb-4">
                Create reminders for recurring bills to never miss a payment
              </Text>
              <TouchableOpacity
                onPress={openCreateModal}
                activeOpacity={0.7}
                className="px-6 py-3 rounded-full"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-semibold text-background">Create Reminder</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reminders.map((bill) => {
              const daysUntil = getDaysUntil(bill.nextDueDate);
              const isUpcoming = daysUntil <= 7;

              return (
                <TouchableOpacity
                  key={bill.id}
                  onPress={() => openEditModal(bill)}
                  onLongPress={() => handleDelete(bill)}
                  activeOpacity={0.7}
                  className="bg-surface rounded-2xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">
                        {bill.merchantName}
                      </Text>
                      <Text className="text-sm text-muted">
                        {bill.frequency.charAt(0).toUpperCase() + bill.frequency.slice(1)} • Day {bill.dueDay}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-bold text-foreground">
                        {formatCurrency(bill.amount)}
                      </Text>
                      {bill.autoPayEnabled && (
                        <View className="flex-row items-center gap-1 mt-1">
                          <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                          <Text className="text-xs text-success">Auto-pay</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-2">
                    <Text className={`text-sm ${isUpcoming ? 'text-warning' : 'text-muted'}`}>
                      Next: {formatDate(bill.nextDueDate)} ({daysUntil} days)
                    </Text>
                    {bill.overdueCount > 0 && (
                      <Text className="text-xs text-error">
                        {bill.overdueCount} overdue
                      </Text>
                    )}
                  </View>

                  <Text className="text-xs text-muted mt-2">
                    Tap to edit • Long press to delete
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.background, maxHeight: '90%' }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">
                {editingBill ? 'Edit Bill Reminder' : 'New Bill Reminder'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Merchant Name */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">Merchant Name *</Text>
                <TextInput
                  value={merchantName}
                  onChangeText={setMerchantName}
                  placeholder="e.g., Netflix, DSTV, Power Company"
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Amount */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">Amount (₦) *</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Frequency */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">Frequency *</Text>
                <View className="flex-row gap-2">
                  {(['monthly', 'quarterly', 'yearly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => setFrequency(freq)}
                      activeOpacity={0.7}
                      className="flex-1 py-3 rounded-2xl border-2"
                      style={{
                        backgroundColor: frequency === freq ? colors.primary + '20' : colors.surface,
                        borderColor: frequency === freq ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        className="text-center font-semibold"
                        style={{ color: frequency === freq ? colors.primary : colors.foreground }}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Due Day */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">Due Day (1-31) *</Text>
                <TextInput
                  value={dueDay}
                  onChangeText={setDueDay}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Reminder Days */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">Remind me (days before)</Text>
                <TextInput
                  value={reminderDays}
                  onChangeText={setReminderDays}
                  placeholder="3"
                  keyboardType="numeric"
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Auto-Pay Toggle */}
              <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl" style={{ backgroundColor: colors.surface }}>
                <View className="flex-1 mr-4">
                  <Text className="text-base font-semibold text-foreground">Enable Auto-Pay</Text>
                  <Text className="text-sm text-muted mt-1">Automatically pay from linked account</Text>
                </View>
                <Switch
                  value={autoPayEnabled}
                  onValueChange={setAutoPayEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                className="py-4 rounded-2xl items-center mb-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-bold text-background">
                  {editingBill ? 'Update Reminder' : 'Create Reminder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
