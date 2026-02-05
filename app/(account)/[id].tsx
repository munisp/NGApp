import { View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { accountService, Account, Transaction } from '@/lib/api/services-mock';

export default function AccountDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, authenticateBiometric } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccountDetails();
  }, [id]);

  const loadAccountDetails = async () => {
    try {
      if (!isAuthenticated || !id) {
        Alert.alert('Error', 'Please log in to view account details');
        return;
      }

      setLoading(true);
      const [accountData, transactionsData] = await Promise.all([
        accountService.getAccount(id),
        accountService.getTransactions(id, 10),
      ]);

      setAccount(accountData);
      setTransactions(transactionsData);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    const authenticated = await authenticateBiometric();
    if (authenticated) {
      router.push('/(payment)/send');
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return '💰';
      case 'withdrawal':
        return '💸';
      case 'transfer':
        return '🔄';
      default:
        return '📝';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'pending':
        return 'text-warning';
      case 'failed':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Account Details' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading account...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!account) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Account Details' }} />
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-6xl mb-4">❌</Text>
          <Text className="text-xl font-semibold text-foreground mb-2">Account Not Found</Text>
          <Text className="text-muted text-center">The requested account could not be found.</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 bg-primary px-6 py-3 rounded-lg"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: account.account_type }} />
      <ScrollView className="flex-1 p-4">
        {/* Account Balance Card */}
        <View className="bg-primary rounded-2xl p-6 mb-6">
          <Text className="text-white/80 text-sm mb-2">Available Balance</Text>
          <Text className="text-white text-4xl font-bold mb-4">
            {account.currency} {account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-white/60 text-xs">Account Number</Text>
              <Text className="text-white text-base font-medium">{account.account_number}</Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${
                account.status === 'active' ? 'bg-white/20' : 'bg-warning/20'
              }`}
            >
              <Text className="text-white text-xs font-medium">{account.status}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={handleTransfer}
            className="flex-1 bg-surface rounded-xl p-4 border border-border"
            style={{ opacity: 1 }}
          >
            <Text className="text-3xl mb-2">💸</Text>
            <Text className="text-foreground font-semibold">Send Money</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(payment)/receive')}
            className="flex-1 bg-surface rounded-xl p-4 border border-border"
            style={{ opacity: 1 }}
          >
            <Text className="text-3xl mb-2">📥</Text>
            <Text className="text-foreground font-semibold">Receive</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-foreground">Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(account)/transactions')}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center border border-border">
              <Text className="text-4xl mb-2">📭</Text>
              <Text className="text-muted">No transactions yet</Text>
            </View>
          ) : (
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              {transactions.map((transaction, index) => (
                <View
                  key={transaction.id}
                  className={`p-4 ${index < transactions.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-2xl mr-3">{getTransactionIcon(transaction.type)}</Text>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">{transaction.description}</Text>
                        <Text className="text-muted text-xs">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-lg font-bold ${
                          transaction.type === 'deposit' ? 'text-success' : 'text-foreground'
                        }`}
                      >
                        {transaction.type === 'deposit' ? '+' : '-'}
                        {transaction.currency} {transaction.amount.toFixed(2)}
                      </Text>
                      <Text className={`text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
