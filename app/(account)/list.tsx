import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { accountService } from '@/lib/api/services-mock';

interface Account {
  id: string;
  account_number: string;
  account_type: string;
  currency: string;
  balance: number;
  status: string;
  created_at: string;
}

export default function AccountListScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      if (!isAuthenticated) {
        Alert.alert('Error', 'Please log in to view accounts');
        return;
      }

      const response = await accountService.getAccounts();
      // Response is already an array of accounts
      setAccounts(Array.isArray(response) ? response : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleRefresh = () => {
    loadAccounts(true);
  };

  const getTotalBalance = () => {
    return accounts.reduce((sum, account) => sum + account.balance, 0);
  };

  const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'savings':
        return '💰';
      case 'checking':
        return '🏦';
      case 'wallet':
        return '👛';
      default:
        return '💳';
    }
  };

  const renderAccount = ({ item }: { item: Account }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(account)/${item.id}`)}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      style={{ opacity: 1 }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text className="text-3xl mr-3">{getAccountIcon(item.account_type)}</Text>
          <View>
            <Text className="text-lg font-semibold text-foreground">{item.account_type}</Text>
            <Text className="text-sm text-muted">{item.account_number}</Text>
          </View>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            item.status === 'active' ? 'bg-success/20' : 'bg-warning/20'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              item.status === 'active' ? 'text-success' : 'text-warning'
            }`}
          >
            {item.status}
          </Text>
        </View>
      </View>
      <View className="flex-row items-baseline mt-2">
        <Text className="text-2xl font-bold text-foreground">
          {item.currency} {item.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'My Accounts' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading accounts...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'My Accounts' }} />

      {/* Total Balance Card */}
      <View className="bg-primary rounded-2xl p-6 mb-6">
        <Text className="text-white/80 text-sm mb-2">Total Balance</Text>
        <Text className="text-white text-3xl font-bold">
          USD {getTotalBalance().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text className="text-white/60 text-xs mt-2">Across {accounts.length} accounts</Text>
      </View>

      {/* Accounts List */}
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-6xl mb-4">🏦</Text>
            <Text className="text-xl font-semibold text-foreground mb-2">No Accounts Yet</Text>
            <Text className="text-muted text-center">
              You don't have any accounts yet. Contact support to create one.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
