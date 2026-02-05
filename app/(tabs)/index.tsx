import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { accountService, paymentService, Account, Transaction } from '@/lib/api/services-mock';

export default function HomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const [accountsData, transactionsData] = await Promise.all([
        accountService.getAccounts(),
        accountService.getTransactions('', 5), // Get recent transactions
      ]);
      setAccounts(accountsData);
      setRecentTransactions(transactionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Welcome, {user?.first_name}!
            </Text>
            <Text className="text-base text-muted">
              Here's your financial overview
            </Text>
          </View>

          {/* Total Balance Card */}
          <View className="bg-primary rounded-2xl p-6 shadow-sm">
            <Text className="text-background/80 text-sm mb-2">Total Balance</Text>
            <Text className="text-background text-4xl font-bold">
              ${totalBalance.toFixed(2)}
            </Text>
          </View>

          {/* All 20 Features Navigation */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">All Features</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(digital-identity)')}>
                <Text className="text-2xl mb-1">👤</Text>
                <Text className="text-xs font-medium text-foreground">Digital ID</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(school-fees)')}>
                <Text className="text-2xl mb-1">🎓</Text>
                <Text className="text-xs font-medium text-foreground">School Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(community-fund)')}>
                <Text className="text-2xl mb-1">🏘️</Text>
                <Text className="text-xs font-medium text-foreground">Community</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(airtime-collateral)')}>
                <Text className="text-2xl mb-1">📱</Text>
                <Text className="text-xs font-medium text-foreground">Airtime</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(land-tokenization)')}>
                <Text className="text-2xl mb-1">🏞️</Text>
                <Text className="text-xs font-medium text-foreground">Land</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(agricultural-insurance)')}>
                <Text className="text-2xl mb-1">🌾</Text>
                <Text className="text-xs font-medium text-foreground">Agric</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(p2p-lending)')}>
                <Text className="text-2xl mb-1">🤝</Text>
                <Text className="text-xs font-medium text-foreground">P2P</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(bill-splitting)')}>
                <Text className="text-2xl mb-1">💰</Text>
                <Text className="text-xs font-medium text-foreground">Bills</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(savings-circles)')}>
                <Text className="text-2xl mb-1">💎</Text>
                <Text className="text-xs font-medium text-foreground">Savings</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(rent-now-pay-later)')}>
                <Text className="text-2xl mb-1">🏪</Text>
                <Text className="text-xs font-medium text-foreground">Rent</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(remittance-credit)')}>
                <Text className="text-2xl mb-1">💳</Text>
                <Text className="text-xs font-medium text-foreground">Credit</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(water-service)')}>
                <Text className="text-2xl mb-1">💧</Text>
                <Text className="text-xs font-medium text-foreground">Water</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(transport-fare)')}>
                <Text className="text-2xl mb-1">🚌</Text>
                <Text className="text-xs font-medium text-foreground">Transport</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(micro-royalties)')}>
                <Text className="text-2xl mb-1">🎨</Text>
                <Text className="text-xs font-medium text-foreground">Royalties</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(forward-selling)')}>
                <Text className="text-2xl mb-1">🌽</Text>
                <Text className="text-xs font-medium text-foreground">Forward</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(solar-atm)')}>
                <Text className="text-2xl mb-1">☀️</Text>
                <Text className="text-xs font-medium text-foreground">Solar</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(health-installment)')}>
                <Text className="text-2xl mb-1">🏥</Text>
                <Text className="text-xs font-medium text-foreground">Health</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(disaster-relief)')}>
                <Text className="text-2xl mb-1">🆘</Text>
                <Text className="text-xs font-medium text-foreground">Relief</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(livestock-registry)')}>
                <Text className="text-2xl mb-1">🐄</Text>
                <Text className="text-xs font-medium text-foreground">Livestock</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(utility-arbitrage)')}>
                <Text className="text-2xl mb-1">⚡</Text>
                <Text className="text-xs font-medium text-foreground">Utilities</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="flex-row gap-4">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border rounded-xl p-4 items-center"
              onPress={() => router.push('/(payment)/send')}
            >
              <Text className="text-2xl mb-2">💸</Text>
              <Text className="text-foreground font-medium">Send</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-surface border border-border rounded-xl p-4 items-center"
              onPress={() => router.push('/(payment)/receive')}
            >
              <Text className="text-2xl mb-2">💰</Text>
              <Text className="text-foreground font-medium">Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-surface border border-border rounded-xl p-4 items-center"
              onPress={() => router.push('/(account)/list')}
            >
              <Text className="text-2xl mb-2">💳</Text>
              <Text className="text-foreground font-medium">Accounts</Text>
            </TouchableOpacity>
          </View>

          {/* Accounts Section */}
          <View className="gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-lg font-semibold text-foreground">My Accounts</Text>
              <TouchableOpacity onPress={() => router.push('/(account)/list')}>
                <Text className="text-primary font-medium">View All</Text>
              </TouchableOpacity>
            </View>

            {accounts.slice(0, 2).map((account) => (
              <TouchableOpacity
                key={account.id}
                className="bg-surface border border-border rounded-xl p-4"
                onPress={() => router.push(`/(account)/${account.id}`)}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-foreground font-medium capitalize">
                      {account.account_type} Account
                    </Text>
                    <Text className="text-muted text-sm">
                      {account.account_number}
                    </Text>
                  </View>
                  <Text className="text-foreground font-semibold text-lg">
                    ${account.balance.toFixed(2)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent Transactions */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">Recent Transactions</Text>

            {recentTransactions.length === 0 ? (
              <View className="bg-surface border border-border rounded-xl p-6 items-center">
                <Text className="text-muted">No recent transactions</Text>
              </View>
            ) : (
              recentTransactions.map((transaction) => (
                <View
                  key={transaction.id}
                  className="bg-surface border border-border rounded-xl p-4"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">
                        {transaction.description || 'Transaction'}
                      </Text>
                      <Text className="text-muted text-sm">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`font-semibold text-lg ${
                          transaction.type === 'deposit' ? 'text-success' : 'text-foreground'
                        }`}
                      >
                        {transaction.type === 'deposit' ? '+' : '-'}$
                        {transaction.amount.toFixed(2)}
                      </Text>
                      <Text
                        className={`text-xs ${
                          transaction.status === 'completed'
                            ? 'text-success'
                            : transaction.status === 'pending'
                            ? 'text-warning'
                            : 'text-error'
                        }`}
                      >
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* KYC Banner (if not verified) */}
          {user?.kyc_status !== 'verified' && (
            <TouchableOpacity
              className="bg-warning/10 border border-warning rounded-xl p-4"
              onPress={() => router.push('/(profile)/kyc')}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">⚠️</Text>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Verify Your Account</Text>
                  <Text className="text-muted text-sm">
                    Complete KYC to unlock all features
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
