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
import { useRouter } from 'expo-router';

/**
 * Savings Goal Templates Screen
 * 
 * Pre-built goal templates with recommended amounts and timelines
 */

export default function GoalTemplatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Form state
  const [customName, setCustomName] = useState('');
  const [useRecommendedAmount, setUseRecommendedAmount] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [useRecommendedTimeline, setUseRecommendedTimeline] = useState(true);
  const [customMonths, setCustomMonths] = useState('');

  const { data, isLoading, refetch } = trpc.goalTemplates.getTemplates.useQuery();
  const createMutation = trpc.goalTemplates.createGoalFromTemplate.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openTemplateModal = (template: any) => {
    setSelectedTemplate(template);
    setCustomName('');
    setUseRecommendedAmount(true);
    setCustomAmount((template.recommendedAmount / 100).toString());
    setUseRecommendedTimeline(true);
    setCustomMonths(template.recommendedMonths.toString());
    setModalVisible(true);
  };

  const handleCreateGoal = async () => {
    if (!selectedTemplate) return;

    try {
      const result = await createMutation.mutateAsync({
        templateId: selectedTemplate.id,
        customName: customName.trim() || undefined,
        useRecommendedAmount,
        customAmount: !useRecommendedAmount && customAmount ? parseFloat(customAmount) : undefined,
        useRecommendedTimeline,
        customMonths: !useRecommendedTimeline && customMonths ? parseInt(customMonths) : undefined,
      });

      Alert.alert('Success', 'Goal created successfully!');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setModalVisible(false);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to create goal');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 100).toLocaleString()}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return colors.success;
      case 'medium':
        return colors.warning;
      case 'hard':
        return colors.error;
      default:
        return colors.muted;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading templates...</Text>
      </ScreenContainer>
    );
  }

  const templates = data?.templates || [];
  const categories = data?.categories || [];

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
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Goal Templates</Text>
          <Text className="text-base text-muted mt-1">
            Start with pre-built templates and customize to your needs
          </Text>
        </View>

        {/* Templates List */}
        {templates.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-6xl mb-4">🎯</Text>
            <Text className="text-xl font-bold text-foreground mb-2">No Templates Available</Text>
            <Text className="text-sm text-muted text-center">
              Templates will be loaded automatically
            </Text>
          </View>
        ) : (
          templates.map((template: any) => (
            <TouchableOpacity
              key={template.id}
              onPress={() => openTemplateModal(template)}
              activeOpacity={0.7}
              className="bg-surface rounded-2xl p-5 mb-4 border border-border"
            >
              {/* Header */}
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-row items-center flex-1">
                  <Text className="text-4xl mr-3">{template.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">{template.name}</Text>
                    <Text className="text-sm text-muted mt-1">{template.category}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: getDifficultyColor(template.difficulty) + '20' }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: getDifficultyColor(template.difficulty) }}
                    >
                      {template.difficulty.toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted mt-1">{template.successRate}% success</Text>
                </View>
              </View>

              {/* Description */}
              <Text className="text-sm text-muted mb-3">{template.description}</Text>

              {/* Recommended Amount & Timeline */}
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1 bg-background rounded-xl p-3">
                  <Text className="text-xs text-muted mb-1">Recommended Amount</Text>
                  <Text className="text-lg font-bold text-foreground">
                    {formatCurrency(template.recommendedAmount)}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {formatCurrency(template.minAmount)} - {formatCurrency(template.maxAmount)}
                  </Text>
                </View>
                <View className="flex-1 bg-background rounded-xl p-3">
                  <Text className="text-xs text-muted mb-1">Timeline</Text>
                  <Text className="text-lg font-bold text-foreground">
                    {template.recommendedMonths} months
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {template.minMonths}-{template.maxMonths} months
                  </Text>
                </View>
              </View>

              {/* Tips Preview */}
              {template.tips && template.tips.length > 0 && (
                <View className="bg-background rounded-xl p-3">
                  <Text className="text-xs font-semibold text-foreground mb-2">💡 Quick Tips</Text>
                  {template.tips.slice(0, 2).map((tip: string, index: number) => (
                    <Text key={index} className="text-xs text-muted mb-1">
                      • {tip}
                    </Text>
                  ))}
                  {template.tips.length > 2 && (
                    <Text className="text-xs text-primary mt-1">
                      +{template.tips.length - 2} more tips
                    </Text>
                  )}
                </View>
              )}

              <Text className="text-xs text-primary mt-3 text-center">Tap to customize and create goal</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Goal Modal */}
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
              <View className="flex-row items-center flex-1">
                <Text className="text-4xl mr-3">{selectedTemplate?.icon}</Text>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    {selectedTemplate?.name}
                  </Text>
                  <Text className="text-sm text-muted">{selectedTemplate?.category}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Custom Name */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-foreground mb-2">
                  Goal Name (Optional)
                </Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder={selectedTemplate?.name}
                  placeholderTextColor={colors.muted}
                  className="px-4 py-3 rounded-2xl text-base text-foreground"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                />
              </View>

              {/* Amount Section */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">Target Amount</Text>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-muted mr-2">Use recommended</Text>
                    <Switch
                      value={useRecommendedAmount}
                      onValueChange={setUseRecommendedAmount}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.background}
                    />
                  </View>
                </View>
                {useRecommendedAmount ? (
                  <View className="px-4 py-3 rounded-2xl" style={{ backgroundColor: colors.surface }}>
                    <Text className="text-2xl font-bold text-foreground">
                      {formatCurrency(selectedTemplate?.recommendedAmount || 0)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Recommended amount</Text>
                  </View>
                ) : (
                  <TextInput
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="Enter custom amount"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="px-4 py-3 rounded-2xl text-base text-foreground"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                  />
                )}
              </View>

              {/* Timeline Section */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">Timeline (Months)</Text>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-muted mr-2">Use recommended</Text>
                    <Switch
                      value={useRecommendedTimeline}
                      onValueChange={setUseRecommendedTimeline}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.background}
                    />
                  </View>
                </View>
                {useRecommendedTimeline ? (
                  <View className="px-4 py-3 rounded-2xl" style={{ backgroundColor: colors.surface }}>
                    <Text className="text-2xl font-bold text-foreground">
                      {selectedTemplate?.recommendedMonths} months
                    </Text>
                    <Text className="text-xs text-muted mt-1">Recommended timeline</Text>
                  </View>
                ) : (
                  <TextInput
                    value={customMonths}
                    onChangeText={setCustomMonths}
                    placeholder="Enter months"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="px-4 py-3 rounded-2xl text-base text-foreground"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                  />
                )}
              </View>

              {/* Tips */}
              {selectedTemplate?.tips && selectedTemplate.tips.length > 0 && (
                <View className="mb-4 p-4 rounded-2xl" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-base font-semibold text-foreground mb-3">💡 Tips for Success</Text>
                  {selectedTemplate.tips.map((tip: string, index: number) => (
                    <Text key={index} className="text-sm text-muted mb-2">
                      • {tip}
                    </Text>
                  ))}
                </View>
              )}

              {/* Create Button */}
              <TouchableOpacity
                onPress={handleCreateGoal}
                activeOpacity={0.7}
                className="py-4 rounded-2xl items-center mb-4"
                style={{ backgroundColor: colors.primary }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text className="text-base font-bold text-background">Create Goal</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
