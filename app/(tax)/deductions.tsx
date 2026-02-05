import { View, Text, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface Deduction {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

const DEDUCTIONS_KEY = 'taxDeductions';

const deductionCategories = [
  { value: 'business', label: 'Business Expenses', emoji: '💼' },
  { value: 'home_office', label: 'Home Office', emoji: '🏠' },
  { value: 'travel', label: 'Business Travel', emoji: '✈️' },
  { value: 'education', label: 'Education', emoji: '📚' },
  { value: 'medical', label: 'Medical', emoji: '🏥' },
  { value: 'charitable', label: 'Charitable', emoji: '❤️' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

export default function DeductionsScreen() {
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [category, setCategory] = useState('business');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    loadDeductions();
  }, []);

  const loadDeductions = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEDUCTIONS_KEY);
      let deductionsData: Deduction[] = [];

      if (stored) {
        deductionsData = JSON.parse(stored);
      } else {
        // Sample data
        deductionsData = [
          {
            id: '1',
            category: 'business',
            description: 'Office supplies',
            amount: 250,
            date: new Date().toISOString(),
          },
          {
            id: '2',
            category: 'home_office',
            description: 'Internet service',
            amount: 80,
            date: new Date().toISOString(),
          },
        ];
        await AsyncStorage.setItem(DEDUCTIONS_KEY, JSON.stringify(deductionsData));
      }

      setDeductions(deductionsData);
    } catch (error) {
      console.error('Failed to load deductions:', error);
    }
  };

  const handleAddDeduction = async () => {
    if (!description || !amount) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    try {
      const newDeduction: Deduction = {
        id: Date.now().toString(),
        category,
        description,
        amount: parseFloat(amount),
        date: new Date().toISOString(),
      };

      const updated = [newDeduction, ...deductions];
      await AsyncStorage.setItem(DEDUCTIONS_KEY, JSON.stringify(updated));
      setDeductions(updated);

      // Reset form
      setDescription('');
      setAmount('');
      setShowAddForm(false);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to add deduction:', error);
      Alert.alert('Error', 'Failed to add deduction');
    }
  };

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

  const getCategoryInfo = (cat: string) => {
    return deductionCategories.find(c => c.value === cat) || deductionCategories[0];
  };

  const renderDeduction = ({ item }: { item: Deduction }) => {
    const catInfo = getCategoryInfo(item.category);

    return (
      <View className="bg-surface rounded-xl p-5 mb-3 border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <Text className="text-3xl mr-3">{catInfo.emoji}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.description}
              </Text>
              <Text className="text-muted text-sm">{catInfo.label}</Text>
            </View>
          </View>
          <Text className="text-foreground font-bold text-xl">${item.amount.toFixed(2)}</Text>
        </View>
        <Text className="text-muted text-xs">
          {new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Tax Deductions', headerShown: true }} />

      {/* Total */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
        <Text className="text-muted mb-2">Total Deductions This Year</Text>
        <Text className="text-primary font-bold text-5xl">
          ${totalDeductions.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </Text>
        <Text className="text-muted text-sm mt-2">{deductions.length} items tracked</Text>
      </View>

      {/* Add Form */}
      {showAddForm ? (
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Add Deduction</Text>

          {/* Category */}
          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {deductionCategories.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    setCategory(cat.value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`px-4 py-2 rounded-xl ${
                    category === cat.value
                      ? 'bg-primary'
                      : 'bg-background border border-border'
                  }`}
                  style={{ opacity: 1 }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      category === cat.value ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Description</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-4 text-foreground"
              placeholder="e.g., Office supplies"
              placeholderTextColor="#9BA1A6"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Amount */}
          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Amount</Text>
            <View className="flex-row items-center bg-background border border-border rounded-xl p-4">
              <Text className="text-foreground text-xl mr-2">$</Text>
              <TextInput
                className="flex-1 text-foreground text-xl"
                placeholder="0.00"
                placeholderTextColor="#9BA1A6"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleAddDeduction}
              className="flex-1 bg-primary rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold">Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowAddForm(false);
                setDescription('');
                setAmount('');
              }}
              className="flex-1 bg-surface border border-border rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            ➕ Add Deduction
          </Text>
        </TouchableOpacity>
      )}

      {/* Deductions List */}
      {deductions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">📋</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Deductions Yet</Text>
          <Text className="text-muted text-center">
            Start tracking your tax deductions to reduce your tax liability
          </Text>
        </View>
      ) : (
        <FlatList
          data={deductions}
          renderItem={renderDeduction}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
