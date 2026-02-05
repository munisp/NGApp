import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUDGET_KEY = 'budgetCategories';

const iconOptions = [
  '🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '✈️', '🏠', '📱', '🎓',
  '💰', '🎯', '🎨', '🏋️', '📚', '🎮', '🐕', '🌱', '🔧', '☕',
];

const colorOptions = [
  { value: '#EF4444', label: 'Red' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#10B981', label: 'Green' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#6B7280', label: 'Gray' },
];

export default function AddCategoryScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [icon, setIcon] = useState('💰');
  const [color, setColor] = useState('#3B82F6');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !limit) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const limitAmount = parseFloat(limit);
    if (limitAmount <= 0) {
      Alert.alert('Error', 'Budget limit must be greater than 0');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing categories
      const stored = await AsyncStorage.getItem(BUDGET_KEY);
      const categories = stored ? JSON.parse(stored) : [];

      // Create new category
      const newCategory = {
        id: Date.now().toString(),
        name,
        limit: limitAmount,
        spent: 0,
        icon,
        color,
      };

      categories.push(newCategory);
      await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(categories));

      Alert.alert('Success', 'Budget category created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to create category:', error);
      Alert.alert('Error', 'Failed to create category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Category', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Name */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Category Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Groceries, Gas, Coffee"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Budget Limit */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Monthly Budget Limit *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-2xl font-bold mr-2">$</Text>
            <TextInput
              value={limit}
              onChangeText={setLimit}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-2xl font-bold"
            />
          </View>
        </View>

        {/* Icon Selection */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Icon</Text>
          <View className="flex-row flex-wrap gap-2">
            {iconOptions.map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => setIcon(i)}
                className={`w-14 h-14 rounded-xl items-center justify-center ${
                  icon === i
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-2xl">{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color Selection */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Color</Text>
          <View className="flex-row flex-wrap gap-2">
            {colorOptions.map(c => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setColor(c.value)}
                className={`px-4 py-3 rounded-xl flex-row items-center ${
                  color === c.value
                    ? 'border-2'
                    : 'bg-surface border border-border'
                }`}
                style={{
                  opacity: 1,
                  backgroundColor: color === c.value ? c.value : undefined,
                  borderColor: color === c.value ? c.value : undefined,
                }}
              >
                <View
                  className="w-6 h-6 rounded-full mr-2"
                  style={{ backgroundColor: c.value }}
                />
                <Text
                  className={`font-medium ${
                    color === c.value ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <Text className="text-foreground font-semibold mb-3">Preview</Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-2xl">{icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base">
                {name || 'Category Name'}
              </Text>
              <Text className="text-muted text-sm">
                $0.00 of ${limit || '0.00'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Creating...' : 'Create Category'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
