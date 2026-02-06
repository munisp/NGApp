import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DEMO } from '@/lib/demo-data';

export default function AccountManagementScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  const { data: _accounts = [], isLoading, isError, refetch } = trpc.openBanking.getLinkedAccounts.useQuery();
  const accounts = isError ? DEMO.linkedAccounts : _accounts;
  const syncAccountMutation = trpc.openBanking.syncAccount.useMutation();
  const unlinkAccountMutation = trpc.openBanking.unlinkAccount.useMutation();

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSyncAccount = async (accountId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSyncingAccountId(accountId);
    try {
      await syncAccountMutation.mutateAsync({ accountId });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refetch();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to sync account');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleUnlinkAccount = (accountId: string, accountName: string) => {
    Alert.alert(
      'Unlink Account',
      `Are you sure you want to unlink ${accountName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            try {
              await unlinkAccountMutation.mutateAsync({ accountId });
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await refetch();
            } catch (error: any) {
              Alert.alert('Unlink Failed', error.message || 'Failed to unlink account');
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '₦0.00';
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'failed':
      case 'inactive':
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'inactive':
        return 'Inactive';
      default:
        return status;
    }
  };

  const getBankIcon = (bankName: string) => {
    // Return emoji based on bank name
    if (bankName.toLowerCase().includes('gt')) return '🟠';
    if (bankName.toLowerCase().includes('access')) return '🟡';
    if (bankName.toLowerCase().includes('zenith')) return '🔴';
    return '🏦';
  };

    if (isLoading && !isError) {
      return (
        <ScreenContainer className="p-4">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading accounts...</Text>
          </View>
        </ScreenContainer>
      );
    }

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Account Management</Text>
            <Text className="text-muted mt-1">Manage your linked bank accounts</Text>
          </View>

          {/* Summary Card */}
          <View className="bg-primary rounded-3xl p-6">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-background/80 text-sm">Total Accounts</Text>
                <Text className="text-background text-4xl font-bold mt-1">{accounts.length}</Text>
              </View>
              <View
                className="w-16 h-16 rounded-full items-center justify-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <IconSymbol name="building.columns.fill" size={32} color={colors.background} />
              </View>
            </View>
            <View className="flex-row items-center mt-4">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: colors.success }}
                />
                <Text className="text-background/80 text-xs">
                  {accounts.filter((a) => a.status === 'active').length} Active
                </Text>
              </View>
              <View className="flex-row items-center flex-1">
                <View
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: colors.warning }}
                />
                <Text className="text-background/80 text-xs">
                  {accounts.filter((a: any) => a.status === 'pending').length} Pending
                </Text>
              </View>
            </View>
          </View>

          {/* Accounts List */}
          {accounts.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <IconSymbol name="building.columns" size={64} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground mt-4">No accounts linked</Text>
              <Text className="text-muted mt-2 text-center">
                Link your bank account to get started
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                activeOpacity={0.7}
                className="bg-primary rounded-2xl py-3 px-6 mt-6"
              >
                <Text className="text-background font-bold text-center">
                  Link Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-4">
              {accounts.map((account: any) => (
                <View
                  key={account.id}
                  className="bg-surface rounded-3xl p-6 border border-border"
                >
                  {/* Account Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-12 h-12 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: colors.primary + '20' }}
                      >
                        <Text className="text-2xl">{getBankIcon(account.bankName)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-foreground">
                          {account.bankName}
                        </Text>
                        <Text className="text-sm text-muted mt-0.5">
                          •••• {account.accountNumber.slice(-4)}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: `${getStatusColor(account.status)}20` }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: getStatusColor(account.status) }}
                      >
                        {getStatusLabel(account.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Account Details */}
                  <View className="bg-background rounded-2xl p-4 gap-3 mb-4">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Account Name</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {account.accountName}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Balance</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {formatCurrency(account.balance)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Last Synced</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {formatDate(account.lastSyncedAt || account.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => handleSyncAccount(account.id)}
                      disabled={syncingAccountId === account.id}
                      activeOpacity={0.7}
                      className="flex-1 bg-primary rounded-2xl py-3 px-4 flex-row items-center justify-center"
                      style={{ opacity: syncingAccountId === account.id ? 0.6 : 1 }}
                    >
                      {syncingAccountId === account.id ? (
                        <ActivityIndicator size="small" color={colors.background} />
                      ) : (
                        <>
                          <IconSymbol name="arrow.clockwise" size={18} color={colors.background} />
                          <Text className="text-background font-semibold ml-2">Sync</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnlinkAccount(account.id, account.bankName)}
                      activeOpacity={0.7}
                      className="flex-1 bg-error/10 rounded-2xl py-3 px-4 flex-row items-center justify-center"
                    >
                      <IconSymbol name="trash" size={18} color={colors.error} />
                      <Text className="font-semibold ml-2" style={{ color: colors.error }}>
                        Unlink
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add Account Button */}
          {accounts.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
              className="bg-surface rounded-2xl py-4 px-6 border border-border flex-row items-center justify-center"
            >
              <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-3 text-base">
                Link Another Account
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
