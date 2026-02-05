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
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Expense Categories Management Screen
 * 
 * Features:
 * - View all categories (default + custom)
 * - Create custom categories with icon and color selection
 * - Edit existing custom categories
 * - Delete custom categories
 * - Category usage statistics
 */

// Available icons for categories
const AVAILABLE_ICONS = [
  { name: 'fork.knife', label: 'Food' },
  { name: 'car.fill', label: 'Transport' },
  { name: 'cart.fill', label: 'Shopping' },
  { name: 'star.fill', label: 'Entertainment' },
  { name: 'bolt.fill', label: 'Utilities' },
  { name: 'heart.fill', label: 'Healthcare' },
  { name: 'book.fill', label: 'Education' },
  { name: 'airplane', label: 'Travel' },
  { name: 'person.fill', label: 'Personal' },
  { name: 'house.fill', label: 'Home' },
  { name: 'phone.fill', label: 'Phone' },
  { name: 'tv.fill', label: 'Entertainment' },
  { name: 'ellipsis.circle.fill', label: 'Other' },
];

// Available colors for categories
const AVAILABLE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181',
  '#AA96DA', '#FCBAD3', '#A8D8EA', '#FFD93D',
  '#6BCB77', '#95A5A6', '#3498DB', '#E74C3C',
  '#F39C12', '#9B59B6', '#1ABC9C', '#34495E',
];

export default function ExpenseCategoriesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  
  // Form state
  const [categoryName, setCategoryName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('fork.knife');
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');

  const { data, isLoading, refetch } = trpc.expenseCategories.getCategories.useQuery();
  const createMutation = trpc.expenseCategories.createCategory.useMutation();
  const updateMutation = trpc.expenseCategories.updateCategory.useMutation();
  const deleteMutation = trpc.expenseCategories.deleteCategory.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setSelectedIcon('fork.knife');
    setSelectedColor('#FF6B6B');
    setModalVisible(true);
  };

  const openEditModal = (category: any) => {
    if (category.isDefault) {
      Alert.alert('Cannot Edit', 'Default categories cannot be edited');
      return;
    }
    setEditingCategory(category);
    setCategoryName(category.name);
    setSelectedIcon(category.icon);
    setSelectedColor(category.color);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({
          categoryId: editingCategory.id,
          name: categoryName,
          icon: selectedIcon,
          color: selectedColor,
        });
        Alert.alert('Success', 'Category updated successfully');
      } else {
        await createMutation.mutateAsync({
          name: categoryName,
          icon: selectedIcon,
          color: selectedColor,
        });
        Alert.alert('Success', 'Category created successfully');
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setModalVisible(false);
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to save category');
    }
  };

  const handleDelete = (category: any) => {
    if (category.isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ categoryId: category.id });
              Alert.alert('Success', 'Category deleted successfully');
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 100).toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading categories...</Text>
      </ScreenContainer>
    );
  }

  const categories = data?.categories || [];
  const defaultCategories = categories.filter(c => c.isDefault);
  const customCategories = categories.filter(c => !c.isDefault);

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
            <Text className="text-3xl font-bold text-foreground">Categories</Text>
            <Text className="text-base text-muted mt-1">
              {categories.length} total • {customCategories.length} custom
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

        {/* Default Categories */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-foreground mb-3">Default Categories</Text>
          <View className="flex-row flex-wrap gap-3">
            {defaultCategories.map((category) => (
              <View
                key={category.id}
                className="bg-surface rounded-2xl p-4 border border-border"
                style={{ width: '48%' }}
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <IconSymbol
                      name={category.icon as any}
                      size={20}
                      color={category.color}
                    />
                  </View>
                  <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
                    {category.name}
                  </Text>
                </View>
                {category.stats && category.stats.transactionCount > 0 && (
                  <View className="mt-2">
                    <Text className="text-xs text-muted">
                      {category.stats.transactionCount} transactions
                    </Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(category.stats.totalAmount)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Custom Categories */}
        {customCategories.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground mb-3">Custom Categories</Text>
            <View className="flex-row flex-wrap gap-3">
              {customCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => openEditModal(category)}
                  onLongPress={() => handleDelete(category)}
                  activeOpacity={0.7}
                  className="bg-surface rounded-2xl p-4 border border-border"
                  style={{ width: '48%' }}
                >
                  <View className="flex-row items-center gap-3 mb-2">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <IconSymbol
                        name={category.icon as any}
                        size={20}
                        color={category.color}
                      />
                    </View>
                    <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>
                  {category.stats && category.stats.transactionCount > 0 && (
                    <View className="mt-2">
                      <Text className="text-xs text-muted">
                        {category.stats.transactionCount} transactions
                      </Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {formatCurrency(category.stats.totalAmount)}
                      </Text>
                    </View>
                  )}
                  <Text className="text-xs text-muted mt-2">Tap to edit • Long press to delete</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {customCategories.length === 0 && (
          <View className="items-center py-12">
            <Text className="text-6xl mb-4">📁</Text>
            <Text className="text-xl font-bold text-foreground mb-2">No Custom Categories</Text>
            <Text className="text-sm text-muted text-center mb-4">
              Create custom categories to organize your expenses
            </Text>
            <TouchableOpacity
              onPress={openCreateModal}
              activeOpacity={0.7}
              className="px-6 py-3 rounded-full"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-base font-semibold text-background">Create Category</Text>
            </TouchableOpacity>
          </View>
        )}
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
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Name */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-foreground mb-2">Category Name</Text>
                <TextInput
                  value={categoryName}
                  onChangeText={setCategoryName}
                  placeholder="e.g., Groceries, Gym, Coffee"
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Icon Selection */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-foreground mb-2">Select Icon</Text>
                <View className="flex-row flex-wrap gap-3">
                  {AVAILABLE_ICONS.map((icon) => (
                    <TouchableOpacity
                      key={icon.name}
                      onPress={() => setSelectedIcon(icon.name)}
                      activeOpacity={0.7}
                      className="w-14 h-14 rounded-2xl items-center justify-center border-2"
                      style={{
                        backgroundColor: selectedIcon === icon.name ? colors.primary + '20' : colors.surface,
                        borderColor: selectedIcon === icon.name ? colors.primary : colors.border,
                      }}
                    >
                      <IconSymbol
                        name={icon.name as any}
                        size={24}
                        color={selectedIcon === icon.name ? colors.primary : colors.foreground}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color Selection */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-foreground mb-2">Select Color</Text>
                <View className="flex-row flex-wrap gap-3">
                  {AVAILABLE_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      activeOpacity={0.7}
                      className="w-12 h-12 rounded-full border-4"
                      style={{
                        backgroundColor: color,
                        borderColor: selectedColor === color ? colors.foreground : 'transparent',
                      }}
                    />
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-foreground mb-2">Preview</Text>
                <View className="bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{ backgroundColor: selectedColor + '20' }}
                    >
                      <IconSymbol
                        name={selectedIcon as any}
                        size={24}
                        color={selectedColor}
                      />
                    </View>
                    <Text className="text-lg font-semibold text-foreground">
                      {categoryName || 'Category Name'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                className="py-4 rounded-2xl items-center mb-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-bold text-background">
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
