import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Calendar from 'expo-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';

const SCHEDULED_PAYMENTS_KEY = 'scheduledPayments';

export default function AddScheduledPaymentScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(true);

  const frequencies: Array<{ value: 'once' | 'daily' | 'weekly' | 'monthly'; label: string }> = [
    { value: 'once', label: 'One-time' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const addToDeviceCalendar = async (paymentTitle: string, date: Date) => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Calendar access is required to add events');
        return false;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(cal => cal.allowsModifications) || calendars[0];

      if (!defaultCalendar) {
        Alert.alert('Error', 'No calendar available');
        return false;
      }

      const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
        title: `Payment: ${paymentTitle}`,
        startDate: date,
        endDate: new Date(date.getTime() + 60 * 60 * 1000), // 1 hour duration
        notes: `Scheduled payment to ${recipient} for $${amount}`,
        alarms: [{ relativeOffset: -60 }], // 1 hour before
      });

      return !!eventId;
    } catch (error) {
      console.error('Failed to add to calendar:', error);
      return false;
    }
  };

  const schedulePayment = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a payment title');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!recipient.trim()) {
      Alert.alert('Error', 'Please enter a recipient');
      return;
    }

    if (scheduledDate < new Date()) {
      Alert.alert('Error', 'Scheduled date must be in the future');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_PAYMENTS_KEY);
      const payments = stored ? JSON.parse(stored) : [];

      const newPayment = {
        id: Date.now().toString(),
        title: title.trim(),
        amount: amountNum,
        recipient: recipient.trim(),
        scheduledDate: scheduledDate.toISOString(),
        frequency,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      payments.unshift(newPayment);
      await AsyncStorage.setItem(SCHEDULED_PAYMENTS_KEY, JSON.stringify(payments));

      // Add to device calendar if enabled
      if (addToCalendar) {
        await addToDeviceCalendar(title.trim(), scheduledDate);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Payment scheduled successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to schedule payment:', error);
      Alert.alert('Error', 'Failed to schedule payment');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Schedule Payment', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-2">Payment Title</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-lg"
            placeholder="e.g., Rent, Utilities"
            placeholderTextColor="#9BA1A6"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Amount */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-2">Amount</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-2xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-2xl"
              placeholder="0.00"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Recipient */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Recipient</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-lg"
            placeholder="Who will receive this payment?"
            placeholderTextColor="#9BA1A6"
            value={recipient}
            onChangeText={setRecipient}
          />
        </View>

        {/* Scheduled Date */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Scheduled Date & Time</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-lg">
              {scheduledDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={scheduledDate}
              mode="datetime"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Frequency */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Frequency</Text>
          <View className="flex-row flex-wrap gap-3">
            {frequencies.map(freq => (
              <TouchableOpacity
                key={freq.value}
                onPress={() => setFrequency(freq.value)}
                className={`flex-1 min-w-[45%] rounded-xl p-4 border ${
                  frequency === freq.value
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`text-center font-semibold ${
                    frequency === freq.value ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Add to Calendar */}
        <TouchableOpacity
          onPress={() => setAddToCalendar(!addToCalendar)}
          className="bg-surface rounded-xl p-4 mb-6 border border-border flex-row items-center justify-between"
          style={{ opacity: 1 }}
        >
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Add to Calendar</Text>
            <Text className="text-muted text-sm">
              Create a calendar event with reminder
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full p-1 ${
              addToCalendar ? 'bg-primary' : 'bg-border'
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white ${
                addToCalendar ? 'ml-auto' : ''
              }`}
            />
          </View>
        </TouchableOpacity>

        {/* Summary */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-3">Summary</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-muted">Amount</Text>
              <Text className="text-foreground font-semibold">
                ${(parseFloat(amount) || 0).toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Frequency</Text>
              <Text className="text-foreground font-semibold">
                {frequencies.find(f => f.value === frequency)?.label}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Next Payment</Text>
              <Text className="text-foreground font-semibold">
                {scheduledDate.toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Schedule Button */}
        <TouchableOpacity
          onPress={schedulePayment}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">Schedule Payment</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
