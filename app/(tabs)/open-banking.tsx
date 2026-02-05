import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Pressable, Alert, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';

interface LinkedAccount {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  balance: string;
  currency: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  transactionId: string;
  type: 'credit' | 'debit';
  amount: string;
  currency: string;
  description: string;
  category: string | null;
  balance: string;
  transactionDate: Date;
  createdAt: Date;
}

export default function OpenBankingScreen() {
  const colors = useColors();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);

  // Fetch linked accounts
  const { data: accountsData, isLoading, refetch } = trpc.openBanking.getLinkedAccounts.useQuery();
  
  // Fetch recent transactions - disabled for now since we need accountId
  // const recentTransactionsQuery = trpc.openBanking.getTransactions.useQuery({
  //   accountId: linkedAccounts[0]?.id || '',
  //   limit: 10
  // }, { enabled: linkedAccounts.length > 0 });

  useEffect(() => {
    if (accountsData) {
      setLinkedAccounts(accountsData);
      const totalBalance = linkedAccounts.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0);
      setTotalBalance(totalBalance);
      setLoading(false);
    }
  }, [accountsData]);

  // useEffect(() => {
  //   if (recentTransactionsQuery.data) {
  //     setRecentTransactions(recentTransactionsQuery.data);
  //   }
  // }, [recentTransactionsQuery.data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  };

  const handleLinkNewAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/open-banking/link-account');
  };

  const handleAccountDetails = (accountId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/open-banking/${accountId}`);
  };

  const getBankIcon = (bankName: string) => {
    // Map bank names to icons
    const bankIcons: { [key: string]: string } = {
      'GTBank': '🏦',
      'Access Bank': '🏦',
      'Zenith Bank': '🏦',
      'First Bank': '🏦',
      'UBA': '🏦',
    };
    return bankIcons[bankName] || '🏦';
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  };

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="bg-primary px-6 pt-6 pb-8">
        <Text className="text-3xl font-bold text-white mb-2">Open Banking</Text>
        <Text className="text-base text-white/80 mb-4">All your accounts in one place</Text>
        
        {/* Total Balance Card */}
        <View className="bg-white/20 rounded-2xl p-4 backdrop-blur">
          <Text className="text-sm text-white/80 mb-1">Total Balance</Text>
          <Text className="text-3xl font-bold text-white">
            {formatCurrency(totalBalance)}
          </Text>
          <Text className="text-xs text-white/60 mt-2">
            Across {linkedAccounts.length} linked account{linkedAccounts.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6 py-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {loading || isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-muted">Loading accounts...</Text>
          </View>
        ) : linkedAccounts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
              <Text className="text-4xl">🏦</Text>
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              No Linked Accounts
            </Text>
            <Text className="text-sm text-muted text-center mb-6 px-8">
              Connect your bank accounts to see all your balances and transactions in one place
            </Text>
            <Pressable
              className="bg-primary px-6 py-3 rounded-full"
              onPress={handleLinkNewAccount}
              style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text className="text-white font-semibold">Link Bank Account</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Linked Accounts Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-foreground">Linked Accounts</Text>
                <Pressable
                  onPress={handleLinkNewAccount}
                  style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <View className="flex-row items-center">
                    <IconSymbol name="plus" size={16} color={colors.primary} />
                    <Text className="text-sm text-primary font-medium ml-1">Add</Text>
                  </View>
                </Pressable>
              </View>

              {linkedAccounts.map((account) => (
                 <Pressable
                  key={account.id}
                  className="bg-surface rounded-2xl p-4 mb-3 border border-border"
                  onPress={() => handleAccountDetails(account.id)}
                  style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3">
                        <Text className="text-2xl">{getBankIcon('Bank')}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground mb-1">
                          {account.accountName}
                        </Text>
                        <Text className="text-sm text-muted">
                          {account.accountNumber} • {account.accountName}
                        </Text>
                      </View>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${
                      account.status === 'active' ? 'bg-success/20' : 'bg-error/20'
                    }`}>
                      <Text className={`text-xs font-medium ${
                        account.status === 'active' ? 'text-success' : 'text-error'
                      }`}>
                        {account.status === 'active' ? '●' : '○'}
                      </Text>
                    </View>
                  </View>

                  <View className="border-t border-border pt-3">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-xs text-muted mb-1">Balance</Text>
                        <Text className="text-xl font-bold text-foreground">
                          {formatCurrency(parseFloat(account.balance), account.currency)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs text-muted mb-1">Last synced</Text>
                        <Text className="text-xs text-muted">
                          {formatDate(account.updatedAt.toISOString())}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Recent Transactions Section */}
            {recentTransactions.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-bold text-foreground">Recent Transactions</Text>
                  <Pressable
                    onPress={() => router.push('/open-banking/transactions')}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text className="text-sm text-primary font-medium">View All</Text>
                  </Pressable>
                </View>

                {recentTransactions.map((transaction) => (
                  <View
                    key={transaction.id}
                    className="bg-surface rounded-xl p-4 mb-2 border border-border"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground mb-1">
                          {transaction.description}
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatDate(transaction.transactionDate.toISOString())}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-base font-bold ${
                          transaction.type === 'credit' ? 'text-success' : 'text-foreground'
                        }`}>
                          {transaction.type === 'credit' ? '+' : '-'}
                          {formatCurrency(parseFloat(transaction.amount), transaction.currency)}
                        </Text>
                        <Text className="text-xs text-muted mt-1">
                          Bal: {formatCurrency(parseFloat(transaction.balance), transaction.currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Info Card */}
            <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
              <View className="flex-row items-start">
                <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 mt-1">
                  <IconSymbol name="info.circle" size={16} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-1">
                    Secure & Encrypted
                  </Text>
                  <Text className="text-xs text-muted leading-relaxed">
                    Your bank credentials are encrypted and never stored. We use read-only access to fetch your balances and transactions.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {linkedAccounts.length > 0 && (
        <View className="absolute bottom-6 right-6">
          <Pressable
            className="bg-primary w-14 h-14 rounded-full items-center justify-center shadow-lg"
            onPress={handleLinkNewAccount}
            style={({ pressed }: { pressed: boolean }) => [
              { 
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              }
            ]}
           >
            <IconSymbol name="plus" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}
