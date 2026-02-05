import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const GOALS_KEY = 'financialGoals';

const categories = [
  { key: 'emergency', name: 'Emergency Fund', emoji: '🛡️' },
  { key: 'vacation', name: 'Vacation', emoji: '✈️' },
  { key: 'home', name: 'Home Purchase', emoji: '🏠' },
  { key: 'education', name: 'Education', emoji: '🎓' },
  { key: 'retirement', name: 'Retirement', emoji: '🏖️' },
  { key: 'car', name: 'Car Purchase', emoji: '🚗' },
  { key: 'wedding', name: 'Wedding', emoji: '💒' },
  { key: 'other', name: 'Other', emoji: '🎯' },
];

export default function CreateGoalScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('emergency');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [months, setMonths] = useState('12');

  const selectedCategory = categories.find(c => c.key === category) || categories[0];

  const calculateProjection = () => {
    const target = parseFloat(targetAmount) || 0;
    const current = parseFloat(currentAmount) || 0;
    const monthly = parseFloat(monthlyContribution) || 0;
    const remaining = target - current;

    if (monthly > 0) {
      const monthsNeeded = Math.ceil(remaining / monthly);
      return {
        monthsNeeded,
        totalContribution: monthly * monthsNeeded,
        projectedDate: new Date(Date.now() + monthsNeeded * 30 * 86400000),
      };
    }

    return null;
  };

  const projection = calculateProjection();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter a goal name');
      return;
    }

    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid target amount');
      return;
    }

    const monthly = parseFloat(monthlyContribution);
    if (isNaN(monthly) || monthly < 0) {
      Alert.alert('Invalid Contribution', 'Please enter a valid monthly contribution');
      return;
    }

    const monthsInt = parseInt(months);
    if (isNaN(monthsInt) || monthsInt <= 0) {
      Alert.alert('Invalid Timeline', 'Please enter a valid timeline');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(GOALS_KEY);
      const goals = stored ? JSON.parse(stored) : [];

      const newGoal = {
        id: Date.now().toString(),
        name: name.trim(),
        category,
        targetAmount: target,
        currentAmount: parseFloat(currentAmount) || 0,
        deadline: new Date(Date.now() + monthsInt * 30 * 86400000).toISOString(),
        monthlyContribution: monthly,
        emoji: selectedCategory.emoji,
      };

      goals.push(newGoal);
      await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Goal Created', `Your goal "${name}" has been created!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create goal:', error);
      Alert.alert('Error', 'Failed to create goal');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Create Financial Goal', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Goal Name */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Goal Name</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-base"
            placeholder="e.g., Emergency Fund"
            placeholderTextColor="#9BA1A6"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Category */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => {
                  setCategory(cat.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`mr-3 px-4 py-3 rounded-xl ${
                  category === cat.key ? 'bg-primary' : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-3xl mb-1">{cat.emoji}</Text>
                <Text
                  className={`font-semibold text-sm ${
                    category === cat.key ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Target Amount */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Target Amount</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-2xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-2xl font-bold"
              placeholder="0.00"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />
          </View>
        </View>

        {/* Current Amount */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Current Amount (Optional)</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-xl"
              placeholder="0.00"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={currentAmount}
              onChangeText={setCurrentAmount}
            />
          </View>
        </View>

        {/* Monthly Contribution */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Monthly Contribution</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-xl"
              placeholder="0.00"
              placeholderTextColor="#9BA1A6"
              keyboardType="decimal-pad"
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
            />
          </View>
        </View>

        {/* Timeline */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Timeline (Months)</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-xl"
            placeholder="12"
            placeholderTextColor="#9BA1A6"
            keyboardType="number-pad"
            value={months}
            onChangeText={setMonths}
          />
        </View>

        {/* Projection */}
        {projection && (
          <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
            <Text className="text-foreground font-bold text-lg mb-4">📊 Projection</Text>
            
            <View className="mb-3">
              <Text className="text-muted text-sm mb-1">Months Needed</Text>
              <Text className="text-foreground font-bold text-xl">
                {projection.monthsNeeded} months
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-muted text-sm mb-1">Total Contributions</Text>
              <Text className="text-foreground font-bold text-xl">
                ${projection.totalContribution.toFixed(2)}
              </Text>
            </View>

            <View>
              <Text className="text-muted text-sm mb-1">Projected Completion</Text>
              <Text className="text-primary font-bold text-xl">
                {projection.projectedDate.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">Create Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
