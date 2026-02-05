import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';

type WebhookStatus = 'active' | 'inactive' | 'error';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  secret: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  responseBody?: string;
  attempts: number;
  createdAt: Date;
}

export default function WebhookMonitoringScreen() {
  const colors = useColors();
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['transaction.created']);

  // Queries
  const { data: webhooks, isLoading, refetch, isRefetching } = trpc.developerPortal.getWebhooks.useQuery();
  const { data: deliveries, refetch: refetchDeliveries } = trpc.developerPortal.getWebhookDeliveries.useQuery(
    { webhookId: selectedWebhook || '', limit: 50 },
    { enabled: !!selectedWebhook }
  );

  // Mutations
  const createWebhook = trpc.developerPortal.createWebhook.useMutation();
  const deleteWebhook = trpc.developerPortal.deleteWebhook.useMutation();
  const testWebhook = trpc.developerPortal.testWebhook.useMutation();
  const updateWebhook = trpc.developerPortal.updateWebhook.useMutation();

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      Alert.alert('Error', 'Please enter a webhook URL');
      return;
    }

    if (!newWebhookUrl.startsWith('http://') && !newWebhookUrl.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }

    try {
      await createWebhook.mutateAsync({
        url: newWebhookUrl,
        events: selectedEvents,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewWebhookUrl('');
      setSelectedEvents(['transaction.created']);
      setShowAddWebhook(false);
      await refetch();
      Alert.alert('Success', 'Webhook created successfully');
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create webhook');
    }
  };

  const handleDeleteWebhook = (webhookId: string) => {
    Alert.alert(
      'Delete Webhook',
      'Are you sure you want to delete this webhook? All delivery logs will also be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWebhook.mutateAsync({ webhookId });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (selectedWebhook === webhookId) {
                setSelectedWebhook(null);
              }
              await refetch();
              Alert.alert('Success', 'Webhook deleted');
            } catch (error) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete webhook');
            }
          },
        },
      ]
    );
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await testWebhook.mutateAsync({
        webhookId,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refetchDeliveries();
      Alert.alert('Success', 'Test webhook sent');
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send test webhook');
    }
  };

  const handleToggleStatus = async (webhookId: string, currentStatus: WebhookStatus) => {
    const newStatus: WebhookStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateWebhook.mutateAsync({
        webhookId,
        status: newStatus,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to update webhook status');
    }
  };

  const getStatusColor = (status: WebhookStatus | 'pending' | 'success' | 'failed') => {
    switch (status) {
      case 'active':
      case 'success':
        return colors.success;
      case 'inactive':
        return colors.muted;
      case 'error':
      case 'failed':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.muted;
    }
  };

  const availableEvents = [
    'transaction.created',
    'transaction.updated',
    'account.created',
    'account.updated',
    'user.created',
    'user.updated',
    'payment.success',
    'payment.failed',
  ];

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Webhook Monitoring</Text>
              <Text className="text-muted mt-1">
                {webhooks?.webhooks?.length || 0} webhook{webhooks?.webhooks?.length !== 1 ? 's' : ''} configured
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddWebhook(!showAddWebhook);
              }}
                        className="bg-primary px-4 py-2 rounded-full"
              activeOpacity={0.7}
            >
              <Text className="text-background font-semibold">
                {showAddWebhook ? 'Cancel' : '+ Add'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Webhook Form */}
          {showAddWebhook && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
              <Text className="text-lg font-semibold text-foreground">Create New Webhook</Text>

              <View>
                <Text className="text-foreground font-medium mb-2">Webhook URL</Text>
                <TextInput
                  value={newWebhookUrl}
                  onChangeText={setNewWebhookUrl}
                  placeholder="https://your-domain.com/webhook"
                  placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              <View>
                <Text className="text-foreground font-medium mb-2">Events to Subscribe</Text>
                <View className="flex-row flex-wrap gap-2">
                  {availableEvents.map((event) => {
                    const isSelected = selectedEvents.includes(event);
                    return (
                      <TouchableOpacity
                        key={event}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedEvents((prev) =>
                            isSelected ? prev.filter((e) => e !== event) : [...prev, event]
                          );
                        }}
                        activeOpacity={0.7}
                        className="px-3 py-2 rounded-full border"
                      >
                        <Text
                          style={{ color: isSelected ? colors.background : colors.foreground }}
                          className="text-sm"
                        >
                          {event}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateWebhook}
                disabled={createWebhook.isPending}
              activeOpacity={0.7}
                className="bg-primary py-3 rounded-xl items-center"
              >
                {createWebhook.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text className="text-background font-semibold">Create Webhook</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Webhooks List */}
          {webhooks && webhooks.webhooks && webhooks.webhooks.length > 0 ? (
            <View className="gap-4">
              {webhooks.webhooks.map((webhook: any) => (
                <View key={webhook.id} className="bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View
                          style={{ backgroundColor: getStatusColor(webhook.status) }}
                          className="w-2 h-2 rounded-full"
                        />
                        <Text className="text-foreground font-semibold">{webhook.status}</Text>
                      </View>
                      <Text className="text-muted text-sm" numberOfLines={1}>
                        {webhook.url}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {webhook.events.map((event: string) => (
                      <View key={event} className="bg-background px-2 py-1 rounded">
                        <Text className="text-muted text-xs">{event}</Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedWebhook(webhook.id === selectedWebhook ? null : webhook.id);
                      }}
                      className="flex-1 py-2 rounded-lg items-center border border-border"
                      activeOpacity={0.7}
                    >
                      <Text className="text-foreground text-sm font-medium">
                        {webhook.id === selectedWebhook ? 'Hide' : 'View'} Deliveries
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleTestWebhook(webhook.id)}
                      className="flex-1 py-2 rounded-lg items-center bg-primary"
                      activeOpacity={0.7}
                    >
                      <Text className="text-background text-sm font-medium">Test</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleToggleStatus(webhook.id, webhook.status)}
                      className="flex-1 py-2 rounded-lg items-center bg-warning"
                      activeOpacity={0.7}
                    >
                      <Text className="text-background text-sm font-medium">
                        {webhook.status === 'active' ? 'Pause' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteWebhook(webhook.id)}
                      className="px-3 py-2 rounded-lg items-center bg-error"
                      activeOpacity={0.7}
                    >
                      <Text className="text-background text-sm font-medium">Delete</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Deliveries */}
                   {webhook.id === selectedWebhook && deliveries && deliveries.deliveries && (
                  <View className="mt-4 pt-4 border-t border-border">
                    <Text className="text-foreground font-semibold mb-3">
                      Recent Deliveries ({deliveries.deliveries.length || 0})
                    </Text>
                    {deliveries.deliveries.length > 0 ? (
                        <View className="gap-2">
                          {deliveries.deliveries.map((delivery: any) => (
                            <View
                              key={delivery.id}
                              className="bg-background rounded-lg p-3 border border-border"
                            >
                              <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center gap-2">
                                  <View
                                    style={{ backgroundColor: getStatusColor(delivery.status) }}
                                    className="w-2 h-2 rounded-full"
                                  />
                                  <Text className="text-foreground font-medium">{delivery.event}</Text>
                                </View>
                                <Text className="text-muted text-xs">
                                  {new Date(delivery.createdAt).toLocaleTimeString()}
                                </Text>
                              </View>
                              <View className="flex-row items-center justify-between">
                                <Text className="text-muted text-sm">
                                  Status: {delivery.status} {delivery.statusCode ? `(${delivery.statusCode})` : ''}
                                </Text>
                                <Text className="text-muted text-sm">
                                  Attempts: {delivery.attempts}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-muted text-center py-4">No deliveries yet</Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-surface rounded-2xl p-8 border border-border items-center">
              <Text className="text-foreground text-lg font-semibold mb-2">No Webhooks</Text>
              <Text className="text-muted text-center">
                Create your first webhook to start receiving real-time event notifications
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
