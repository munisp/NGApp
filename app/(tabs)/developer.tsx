import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Pressable, TextInput, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { trpc } from '@/lib/trpc';

interface APIKey {
  id: string;
  name: string;
  key: string;
  environment: 'development' | 'production';
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  lastUsedAt: Date | null;
  requestCount: number;
}

interface APIUsage {
  api_name: string;
  calls_today: number;
  calls_this_month: number;
  limit: number;
  revenue: number;
}

interface DeveloperStats {
  total_api_calls: number;
  total_revenue: number;
  active_apps: number;
  api_keys: number;
}

export default function DeveloperPortalScreen() {
  const colors = useColors();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [apiUsage, setApiUsage] = useState<APIUsage[]>([]);
  const [stats, setStats] = useState<DeveloperStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  // Fetch developer data
  const { data: apiKeysData, isLoading, refetch } = trpc.developerPortal.getAPIKeys.useQuery();

  useEffect(() => {
    if (apiKeysData) {
      setApiKeys(apiKeysData);
      setLoading(false);
    }
  }, [apiKeysData]);

  const handleCopyKey = async (key: string) => {
    await Clipboard.setStringAsync(key);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'API key copied to clipboard');
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      Alert.alert('Error', 'Please enter a name for your API key');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Call API to create key
    // const result = await trpc.developer.createAPIKey.mutate({ name: newKeyName });
    setShowCreateKey(false);
    setNewKeyName('');
    refetch();
  };

  const handleRevokeKey = (keyId: string) => {
    Alert.alert(
      'Revoke API Key',
      'Are you sure? This action cannot be undone and all apps using this key will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            // await trpc.developer.revokeAPIKey.mutate({ key_id: keyId });
            refetch();
          }
        }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const maskAPIKey = (key: string) => {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="bg-primary px-6 pt-6 pb-8">
        <Text className="text-3xl font-bold text-white mb-2">Developer Portal</Text>
        <Text className="text-base text-white/80 mb-4">Build with our APIs</Text>
        
        {/* Stats Cards */}
        {stats && (
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white/20 rounded-xl p-3 backdrop-blur">
              <Text className="text-xs text-white/80 mb-1">API Calls</Text>
              <Text className="text-xl font-bold text-white">
                {formatNumber(stats.total_api_calls)}
              </Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-xl p-3 backdrop-blur">
              <Text className="text-xs text-white/80 mb-1">Revenue</Text>
              <Text className="text-xl font-bold text-white">
                {formatCurrency(stats.total_revenue)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {loading || isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-muted">Loading developer dashboard...</Text>
          </View>
        ) : (
          <>
            {/* API Keys Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-foreground">API Keys</Text>
                <Pressable
                  onPress={() => setShowCreateKey(true)}
                  style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <View className="flex-row items-center">
                    <IconSymbol name="plus" size={16} color={colors.primary} />
                    <Text className="text-sm text-primary font-medium ml-1">Create</Text>
                  </View>
                </Pressable>
              </View>

              {showCreateKey && (
                <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Create New API Key
                  </Text>
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
                    placeholder="e.g., Production App"
                    placeholderTextColor={colors.muted}
                    value={newKeyName}
                    onChangeText={setNewKeyName}
                    autoFocus
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      className="flex-1 bg-primary rounded-lg py-3"
                      onPress={handleCreateKey}
                      style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text className="text-white font-semibold text-center">Create</Text>
                    </Pressable>
                    <Pressable
                      className="flex-1 bg-surface border border-border rounded-lg py-3"
                      onPress={() => {
                        setShowCreateKey(false);
                        setNewKeyName('');
                      }}
                      style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text className="text-foreground font-semibold text-center">Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {apiKeys.length === 0 ? (
                <View className="bg-surface rounded-xl p-6 border border-border items-center">
                  <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                    <Text className="text-3xl">🔑</Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground mb-1">
                    No API Keys Yet
                  </Text>
                  <Text className="text-xs text-muted text-center">
                    Create an API key to start building
                  </Text>
                </View>
              ) : (
                apiKeys.map((key) => (
                  <View
                    key={key.id}
                    className="bg-surface rounded-xl p-4 mb-3 border border-border"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground mb-1">
                          {key.name}
                        </Text>
                        <Text className="text-xs text-muted">
                          Created {formatDate(key.createdAt.toISOString())}
                        </Text>
                      </View>
                      <View className={`px-2 py-1 rounded-full ${
                        key.status === 'active' ? 'bg-success/20' : 'bg-error/20'
                      }`}>
                        <Text className={`text-xs font-medium ${
                          key.status === 'active' ? 'text-success' : 'text-error'
                        }`}>
                          {key.status}
                        </Text>
                      </View>
                    </View>

                    <View className="bg-background rounded-lg p-3 mb-3">
                      <Text className="text-xs text-muted mb-1">API Key</Text>
                      <Text className="text-sm font-mono text-foreground">
                        {maskAPIKey(key.key)}
                      </Text>
                    </View>

                    <View className="flex-row gap-2">
                      <Pressable
                        className="flex-1 bg-primary/10 rounded-lg py-2"
                        onPress={() => handleCopyKey(key.key)}
                        style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Text className="text-primary font-medium text-center text-sm">
                          Copy Key
                        </Text>
                      </Pressable>
                      {key.status === 'active' && (
                        <Pressable
                          className="flex-1 bg-error/10 rounded-lg py-2"
                          onPress={() => handleRevokeKey(key.id)}
                          style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Text className="text-error font-medium text-center text-sm">
                            Revoke
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {key.lastUsedAt && (
                      <Text className="text-xs text-muted mt-2">
                        Last used: {formatDate(key.lastUsedAt.toISOString())}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* API Usage Section */}
            {apiUsage.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-bold text-foreground mb-3">
                  API Usage
                </Text>
                {apiUsage.map((usage, index) => (
                  <View
                    key={index}
                    className="bg-surface rounded-xl p-4 mb-3 border border-border"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground mb-1">
                          {usage.api_name}
                        </Text>
                        <Text className="text-xs text-muted">
                          {usage.calls_today} calls today • {usage.calls_this_month} this month
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-success">
                        {formatCurrency(usage.revenue)}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View className="bg-background rounded-full h-2 overflow-hidden">
                      <View 
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min((usage.calls_this_month / usage.limit) * 100, 100)}%` }}
                      />
                    </View>
                    <Text className="text-xs text-muted mt-2">
                      {formatNumber(usage.calls_this_month)} / {formatNumber(usage.limit)} calls
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Documentation Links */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-foreground mb-3">
                Resources
              </Text>
              {[
                { title: 'API Documentation', icon: '📚', route: '/developer/docs' },
                { title: 'Code Examples', icon: '💻', route: '/developer/examples' },
                { title: 'SDKs & Libraries', icon: '📦', route: '/developer/sdks' },
                { title: 'API Status', icon: '🟢', route: '/developer/status' },
              ].map((item, index) => (
                <Pressable
                  key={index}
                  className="bg-surface rounded-xl p-4 mb-2 border border-border flex-row items-center justify-between"
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{item.icon}</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {item.title}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </View>

            {/* Revenue Share Info */}
            <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
              <View className="flex-row items-start">
                <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 mt-1">
                  <IconSymbol name="info.circle" size={16} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-1">
                    70% Revenue Share
                  </Text>
                  <Text className="text-xs text-muted leading-relaxed">
                    You earn 70% of all revenue generated through your API integrations. Payments are processed monthly.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
