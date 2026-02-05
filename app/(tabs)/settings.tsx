import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  badge?: string;
}

export default function SettingsScreen() {
  const colors = useColors();

  const settingsItems: SettingItem[] = [
    {
      id: 'notifications',
      title: 'Notification Preferences',
      description: 'Manage how you receive notifications',
      icon: 'bell.fill',
      route: '/(settings)/notifications',
    },
    {
      id: 'webhooks',
      title: 'Webhook Monitoring',
      description: 'Monitor and manage webhook deliveries',
      icon: 'link.circle.fill',
      route: '/(settings)/webhooks',
      badge: 'Admin',
    },
    {
      id: 'push-test',
      title: 'Push Notification Test',
      description: 'Send test push notifications to your device',
      icon: 'bell.badge.fill',
      route: '/(settings)/push-test',
      badge: 'Test',
    },
    {
      id: 'spending-alerts',
      title: 'Spending Alerts',
      description: 'View and manage spending pattern alerts',
      icon: 'exclamationmark.triangle.fill',
      route: '/(settings)/spending-alerts',
    },
    {
      id: 'categorize',
      title: 'Categorize Transactions',
      description: 'Auto-categorize transactions with AI',
      icon: 'tag.fill',
      route: '/(settings)/categorize-transactions',
      badge: 'AI',
    },
    {
      id: 'recurring',
      title: 'Recurring Contributions',
      description: 'Automate your savings with recurring payments',
      icon: 'arrow.clockwise.circle.fill',
      route: '/(settings)/recurring-contributions',
      badge: 'Auto',
    },
    {
      id: 'budget-recommendations',
      title: 'Budget Recommendations',
      description: 'AI-powered budget suggestions based on spending',
      icon: 'lightbulb.fill',
      route: '/(settings)/budget-recommendations',
      badge: 'AI',
    },
  ];

  const handleNavigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView className="flex-1">
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-muted mt-2">
              Manage your app preferences and configurations
            </Text>
          </View>

          {/* Settings List */}
          <View className="gap-3">
            {settingsItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleNavigate(item.route)}
                activeOpacity={0.7}
                className="bg-surface rounded-2xl p-4 border border-border"
              >
                <View className="flex-row items-center gap-4">
                  <View
                    style={{ backgroundColor: colors.primary }}
                    className="w-12 h-12 rounded-full items-center justify-center"
                  >
                    <IconSymbol name={item.icon as any} size={24} color={colors.background} />
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-foreground font-semibold text-base">
                        {item.title}
                      </Text>
                      {item.badge && (
                        <View
                          style={{ backgroundColor: colors.warning }}
                          className="px-2 py-0.5 rounded"
                        >
                          <Text className="text-background text-xs font-medium">
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-muted text-sm mt-1">{item.description}</Text>
                  </View>

                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Section */}
          <View className="bg-surface rounded-2xl p-4 border border-border mt-4">
            <Text className="text-foreground font-semibold mb-2">About</Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">Version</Text>
                <Text className="text-foreground font-medium">1.0.0</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Build</Text>
                <Text className="text-foreground font-medium">Production</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Platform</Text>
                <Text className="text-foreground font-medium">African Fintech</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
