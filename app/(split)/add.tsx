import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const SPLIT_EXPENSES_KEY = 'splitExpenses';

interface Participant {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
}

export default function AddSplitExpenseScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'You', amount: 0, paid: true },
  ]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');

  const addParticipant = () => {
    if (!newParticipantName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: newParticipantName.trim(),
      amount: 0,
      paid: false,
    };

    setParticipants([...participants, newParticipant]);
    setNewParticipantName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= 1) {
      Alert.alert('Error', 'You need at least one participant');
      return;
    }
    setParticipants(participants.filter(p => p.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateParticipantAmount = (id: string, amount: string) => {
    setParticipants(
      participants.map(p => (p.id === id ? { ...p, amount: parseFloat(amount) || 0 } : p))
    );
  };

  const calculateSplit = () => {
    const total = parseFloat(totalAmount) || 0;
    if (total <= 0) return;

    if (splitType === 'equal') {
      const perPerson = total / participants.length;
      setParticipants(participants.map(p => ({ ...p, amount: perPerson })));
    }
  };

  const createExpense = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const total = parseFloat(totalAmount) || 0;
    if (total <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (participants.length === 0) {
      Alert.alert('Error', 'Please add at least one participant');
      return;
    }

    const totalSplit = participants.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalSplit - total) > 0.01) {
      Alert.alert(
        'Error',
        `Split amounts ($${totalSplit.toFixed(2)}) don't match total ($${total.toFixed(2)})`
      );
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(SPLIT_EXPENSES_KEY);
      const expenses = stored ? JSON.parse(stored) : [];

      const newExpense = {
        id: Date.now().toString(),
        title: title.trim(),
        totalAmount: total,
        date: new Date().toISOString(),
        createdBy: 'You',
        participants,
        settled: false,
      };

      expenses.unshift(newExpense);
      await AsyncStorage.setItem(SPLIT_EXPENSES_KEY, JSON.stringify(expenses));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Split expense created!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create expense:', error);
      Alert.alert('Error', 'Failed to create expense');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Split Expense', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-2">Expense Title</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-lg"
            placeholder="e.g., Dinner, Rent, Trip"
            placeholderTextColor="#9BA1A6"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Total Amount */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Total Amount</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-2xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-2xl"
              placeholder="0.00"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={totalAmount}
              onChangeText={text => {
                setTotalAmount(text);
                if (splitType === 'equal' && text) {
                  const total = parseFloat(text) || 0;
                  const perPerson = total / participants.length;
                  setParticipants(participants.map(p => ({ ...p, amount: perPerson })));
                }
              }}
            />
          </View>
        </View>

        {/* Split Type */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Split Type</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setSplitType('equal');
                calculateSplit();
              }}
              className={`flex-1 rounded-xl p-4 border ${
                splitType === 'equal'
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-semibold ${
                  splitType === 'equal' ? 'text-white' : 'text-foreground'
                }`}
              >
                Equal Split
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSplitType('custom')}
              className={`flex-1 rounded-xl p-4 border ${
                splitType === 'custom'
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-semibold ${
                  splitType === 'custom' ? 'text-white' : 'text-foreground'
                }`}
              >
                Custom Split
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Participants */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Participants</Text>

          {participants.map(participant => (
            <View
              key={participant.id}
              className="bg-surface rounded-xl p-4 mb-3 border border-border"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-foreground font-semibold flex-1">{participant.name}</Text>
                {participant.name !== 'You' && (
                  <TouchableOpacity
                    onPress={() => removeParticipant(participant.id)}
                    className="ml-2"
                  >
                    <Text className="text-error text-lg">✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-row items-center">
                <Text className="text-muted text-sm mr-2">Amount:</Text>
                {splitType === 'equal' ? (
                  <Text className="text-foreground font-semibold text-lg">
                    ${participant.amount.toFixed(2)}
                  </Text>
                ) : (
                  <View className="flex-row items-center flex-1">
                    <Text className="text-foreground text-lg mr-2">$</Text>
                    <TextInput
                      className="flex-1 bg-background border border-border rounded-lg p-2 text-foreground text-lg"
                      placeholder="0.00"
                      placeholderTextColor="#9BA1A6"
                      keyboardType="decimal-pad"
                      value={participant.amount > 0 ? participant.amount.toString() : ''}
                      onChangeText={text => updateParticipantAmount(participant.id, text)}
                    />
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Add Participant */}
          <View className="flex-row gap-3">
            <TextInput
              className="flex-1 bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="Add participant name"
              placeholderTextColor="#9BA1A6"
              value={newParticipantName}
              onChangeText={setNewParticipantName}
            />
            <TouchableOpacity
              onPress={addParticipant}
              className="bg-primary rounded-xl px-6 justify-center"
              style={{ opacity: 1 }}
            >
              <Text className="text-white font-semibold text-lg">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Total Amount</Text>
            <Text className="text-foreground font-bold text-lg">
              ${(parseFloat(totalAmount) || 0).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Split Among</Text>
            <Text className="text-foreground font-bold text-lg">
              {participants.length} {participants.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={createExpense}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">Create Split Expense</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
