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

          {/* Core Banking */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Core Banking</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/account-management')}>
                <Text className="text-2xl mb-1">🏦</Text>
                <Text className="text-xs font-medium text-foreground">Account Mgmt</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(cards)')}>
                <Text className="text-2xl mb-1">💳</Text>
                <Text className="text-xs font-medium text-foreground">Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(family-accounts)')}>
                <Text className="text-2xl mb-1">👨‍👩‍👧‍👦</Text>
                <Text className="text-xs font-medium text-foreground">Family</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(net-worth)')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Net Worth</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(digital-identity)')}>
                <Text className="text-2xl mb-1">👤</Text>
                <Text className="text-xs font-medium text-foreground">Digital ID</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(estate-vault)')}>
                <Text className="text-2xl mb-1">🔐</Text>
                <Text className="text-xs font-medium text-foreground">Estate Vault</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/open-banking')}>
                <Text className="text-2xl mb-1">🏛️</Text>
                <Text className="text-xs font-medium text-foreground">Open Banking</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(account)/list')}>
                <Text className="text-2xl mb-1">📝</Text>
                <Text className="text-xs font-medium text-foreground">Acct Details</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(accounts)/account-number')}>
                <Text className="text-2xl mb-1">🔢</Text>
                <Text className="text-xs font-medium text-foreground">Acct Number</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(family)')}>
                <Text className="text-2xl mb-1">👨‍👩‍👧</Text>
                <Text className="text-xs font-medium text-foreground">Family Hub</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payments & Transfers */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Payments & Transfers</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(qr-payments-enhanced)')}>
                <Text className="text-2xl mb-1">📷</Text>
                <Text className="text-xs font-medium text-foreground">QR Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(split-bill-enhanced)')}>
                <Text className="text-2xl mb-1">💰</Text>
                <Text className="text-xs font-medium text-foreground">Split Bill</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(payment-requests)')}>
                <Text className="text-2xl mb-1">📩</Text>
                <Text className="text-xs font-medium text-foreground">Requests</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(remittance-credit)')}>
                <Text className="text-2xl mb-1">🌍</Text>
                <Text className="text-xs font-medium text-foreground">Remittance</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(currency)')}>
                <Text className="text-2xl mb-1">💱</Text>
                <Text className="text-xs font-medium text-foreground">Currency</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(schedule)')}>
                <Text className="text-2xl mb-1">🕐</Text>
                <Text className="text-xs font-medium text-foreground">Scheduled</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(bills)')}>
                <Text className="text-2xl mb-1">🧾</Text>
                <Text className="text-xs font-medium text-foreground">Bills</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/bill-reminders')}>
                <Text className="text-2xl mb-1">🔔</Text>
                <Text className="text-xs font-medium text-foreground">Reminders</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(qr)/scan')}>
                <Text className="text-2xl mb-1">📱</Text>
                <Text className="text-xs font-medium text-foreground">QR Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(bill-splitting)')}>
                <Text className="text-2xl mb-1">✂️</Text>
                <Text className="text-xs font-medium text-foreground">Bill Split</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(split)')}>
                <Text className="text-2xl mb-1">➗</Text>
                <Text className="text-xs font-medium text-foreground">Split</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(recurring)')}>
                <Text className="text-2xl mb-1">🔁</Text>
                <Text className="text-xs font-medium text-foreground">Recurring</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(templates)')}>
                <Text className="text-2xl mb-1">📄</Text>
                <Text className="text-xs font-medium text-foreground">Templates</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(bill-reminders)')}>
                <Text className="text-2xl mb-1">⏰</Text>
                <Text className="text-xs font-medium text-foreground">Bill Alerts</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(receipts)')}>
                <Text className="text-2xl mb-1">🧾</Text>
                <Text className="text-xs font-medium text-foreground">Receipts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* KYC / KYB */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">KYC / KYB Verification</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(profile)/kyc')}>
                <Text className="text-2xl mb-1">🛂</Text>
                <Text className="text-xs font-medium text-foreground">KYC</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(profile)/kyc-video-liveness')}>
                <Text className="text-2xl mb-1">🎥</Text>
                <Text className="text-xs font-medium text-foreground">Video KYC</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(kyb-verification)')}>
                <Text className="text-2xl mb-1">🏢</Text>
                <Text className="text-xs font-medium text-foreground">KYB</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(kyc-enhanced)')}>
                <Text className="text-2xl mb-1">✅</Text>
                <Text className="text-xs font-medium text-foreground">KYC Enhanced</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(kyc-resubmit)')}>
                <Text className="text-2xl mb-1">🔄</Text>
                <Text className="text-xs font-medium text-foreground">KYC Resubmit</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(admin-kyc-review)')}>
                <Text className="text-2xl mb-1">🔍</Text>
                <Text className="text-xs font-medium text-foreground">KYC Review</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Lending & Credit */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Lending & Credit</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/bnpl')}>
                <Text className="text-2xl mb-1">🛒</Text>
                <Text className="text-xs font-medium text-foreground">BNPL</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/credit-score')}>
                <Text className="text-2xl mb-1">📈</Text>
                <Text className="text-xs font-medium text-foreground">Credit Score</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(p2p-lending)')}>
                <Text className="text-2xl mb-1">🤝</Text>
                <Text className="text-xs font-medium text-foreground">P2P Lending</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(lending-circles)')}>
                <Text className="text-2xl mb-1">🔄</Text>
                <Text className="text-xs font-medium text-foreground">Lending Circles</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(school-fees)')}>
                <Text className="text-2xl mb-1">🎓</Text>
                <Text className="text-xs font-medium text-foreground">School Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(rent-now-pay-later)')}>
                <Text className="text-2xl mb-1">🏪</Text>
                <Text className="text-xs font-medium text-foreground">Rent BNPL</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(debt-payoff)')}>
                <Text className="text-2xl mb-1">📉</Text>
                <Text className="text-xs font-medium text-foreground">Debt Payoff</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(credit)')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Credit Detail</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(credit-score)')}>
                <Text className="text-2xl mb-1">🎯</Text>
                <Text className="text-xs font-medium text-foreground">Score Alt</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(loans)')}>
                <Text className="text-2xl mb-1">💵</Text>
                <Text className="text-xs font-medium text-foreground">Loans</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Savings & Investments */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Savings & Investments</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/savings-goals')}>
                <Text className="text-2xl mb-1">🎯</Text>
                <Text className="text-xs font-medium text-foreground">Goals</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(trading)')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Trading</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(portfolio-analytics)')}>
                <Text className="text-2xl mb-1">🥧</Text>
                <Text className="text-xs font-medium text-foreground">Portfolio</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(robo-advisor)/questionnaire')}>
                <Text className="text-2xl mb-1">🤖</Text>
                <Text className="text-xs font-medium text-foreground">Robo-Advisor</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(wealth)')}>
                <Text className="text-2xl mb-1">💎</Text>
                <Text className="text-xs font-medium text-foreground">Wealth</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(retirement)')}>
                <Text className="text-2xl mb-1">🏖️</Text>
                <Text className="text-xs font-medium text-foreground">Retirement</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(savings-circles)')}>
                <Text className="text-2xl mb-1">🔁</Text>
                <Text className="text-xs font-medium text-foreground">Savings Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(savings-roundup)')}>
                <Text className="text-2xl mb-1">🪙</Text>
                <Text className="text-xs font-medium text-foreground">Roundup</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(crypto-wallet)')}>
                <Text className="text-2xl mb-1">₿</Text>
                <Text className="text-xs font-medium text-foreground">Crypto</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(gamified-goals)')}>
                <Text className="text-2xl mb-1">🎮</Text>
                <Text className="text-xs font-medium text-foreground">Gamified</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(savings)')}>
                <Text className="text-2xl mb-1">💰</Text>
                <Text className="text-xs font-medium text-foreground">Savings Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(goals)')}>
                <Text className="text-2xl mb-1">🏹</Text>
                <Text className="text-xs font-medium text-foreground">Goals</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(investments)')}>
                <Text className="text-2xl mb-1">📈</Text>
                <Text className="text-xs font-medium text-foreground">Investments</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(portfolio-enhanced)')}>
                <Text className="text-2xl mb-1">🧩</Text>
                <Text className="text-xs font-medium text-foreground">Portfolio+</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(investment-news)')}>
                <Text className="text-2xl mb-1">📰</Text>
                <Text className="text-xs font-medium text-foreground">Invest News</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Budgeting & Expenses */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Budgeting & Expenses</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/budget-analytics')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Analytics</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/expense-categories')}>
                <Text className="text-2xl mb-1">📂</Text>
                <Text className="text-xs font-medium text-foreground">Categories</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/spending-alerts')}>
                <Text className="text-2xl mb-1">🔔</Text>
                <Text className="text-xs font-medium text-foreground">Alerts</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(expense-forecast)')}>
                <Text className="text-2xl mb-1">🔮</Text>
                <Text className="text-xs font-medium text-foreground">Forecast</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(subscription-manager)')}>
                <Text className="text-2xl mb-1">📋</Text>
                <Text className="text-xs font-medium text-foreground">Subscriptions</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(bill-negotiation)')}>
                <Text className="text-2xl mb-1">🤝</Text>
                <Text className="text-xs font-medium text-foreground">Negotiate</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(budget)')}>
                <Text className="text-2xl mb-1">💳</Text>
                <Text className="text-xs font-medium text-foreground">Budget Detail</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(budget-alerts)')}>
                <Text className="text-2xl mb-1">⚠️</Text>
                <Text className="text-xs font-medium text-foreground">Budget Alerts</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(expense-categories)')}>
                <Text className="text-2xl mb-1">🏷️</Text>
                <Text className="text-xs font-medium text-foreground">Exp. Categories</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(categories)')}>
                <Text className="text-2xl mb-1">🗂️</Text>
                <Text className="text-xs font-medium text-foreground">Categories</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(spending-limits)')}>
                <Text className="text-2xl mb-1">🚫</Text>
                <Text className="text-xs font-medium text-foreground">Spend Limits</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(subscriptions)')}>
                <Text className="text-2xl mb-1">🔄</Text>
                <Text className="text-xs font-medium text-foreground">Subscriptions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Insurance & Health */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Insurance & Health</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(insurance-enhanced)')}>
                <Text className="text-2xl mb-1">🛡️</Text>
                <Text className="text-xs font-medium text-foreground">Insurance</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(health-installment)')}>
                <Text className="text-2xl mb-1">🏥</Text>
                <Text className="text-xs font-medium text-foreground">Health Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(agricultural-insurance)')}>
                <Text className="text-2xl mb-1">🌾</Text>
                <Text className="text-xs font-medium text-foreground">Agric</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/financial-health')}>
                <Text className="text-2xl mb-1">❤️</Text>
                <Text className="text-xs font-medium text-foreground">Health Score</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(wellness-score)')}>
                <Text className="text-2xl mb-1">🧘</Text>
                <Text className="text-xs font-medium text-foreground">Wellness</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(insurance)')}>
                <Text className="text-2xl mb-1">🛡️</Text>
                <Text className="text-xs font-medium text-foreground">Insurance Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(health-dashboard)')}>
                <Text className="text-2xl mb-1">🏥</Text>
                <Text className="text-xs font-medium text-foreground">Health Dash</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(health-score)')}>
                <Text className="text-2xl mb-1">💚</Text>
                <Text className="text-xs font-medium text-foreground">Health Score</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(wellness)')}>
                <Text className="text-2xl mb-1">🌿</Text>
                <Text className="text-xs font-medium text-foreground">Wellness Hub</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tax & Financial Planning */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Tax & Financial Planning</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(tax)')}>
                <Text className="text-2xl mb-1">📋</Text>
                <Text className="text-xs font-medium text-foreground">Tax</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(tax-optimization)')}>
                <Text className="text-2xl mb-1">🎯</Text>
                <Text className="text-xs font-medium text-foreground">Optimize</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(tax-export)')}>
                <Text className="text-2xl mb-1">📤</Text>
                <Text className="text-xs font-medium text-foreground">Tax Export</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(advisor)')}>
                <Text className="text-2xl mb-1">👨‍💼</Text>
                <Text className="text-xs font-medium text-foreground">Advisor</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(advisor-matching)')}>
                <Text className="text-2xl mb-1">🤝</Text>
                <Text className="text-xs font-medium text-foreground">Match</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* African Market Features */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">African Market Features</Text>
            <View className="flex-row flex-wrap gap-3">
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
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(forward-selling)')}>
                <Text className="text-2xl mb-1">🌽</Text>
                <Text className="text-xs font-medium text-foreground">Forward Sell</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(livestock-registry)')}>
                <Text className="text-2xl mb-1">🐄</Text>
                <Text className="text-xs font-medium text-foreground">Livestock</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(solar-atm)')}>
                <Text className="text-2xl mb-1">☀️</Text>
                <Text className="text-xs font-medium text-foreground">Solar ATM</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(disaster-relief)')}>
                <Text className="text-2xl mb-1">🆘</Text>
                <Text className="text-xs font-medium text-foreground">Relief</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(transport-fare)')}>
                <Text className="text-2xl mb-1">🚌</Text>
                <Text className="text-xs font-medium text-foreground">Transport</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(water-service)')}>
                <Text className="text-2xl mb-1">💧</Text>
                <Text className="text-xs font-medium text-foreground">Water</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(utility-arbitrage)')}>
                <Text className="text-2xl mb-1">⚡</Text>
                <Text className="text-xs font-medium text-foreground">Utilities</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(micro-royalties)')}>
                <Text className="text-2xl mb-1">🎨</Text>
                <Text className="text-xs font-medium text-foreground">Royalties</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Merchant & Business */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Merchant & Business</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(merchant)')}>
                <Text className="text-2xl mb-1">🏪</Text>
                <Text className="text-xs font-medium text-foreground">Merchant</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(payment-gateway-settings)')}>
                <Text className="text-2xl mb-1">⚙️</Text>
                <Text className="text-xs font-medium text-foreground">Gateway</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/developer')}>
                <Text className="text-2xl mb-1">👨‍💻</Text>
                <Text className="text-xs font-medium text-foreground">Developer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI & Analytics */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">AI & Analytics</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/insights')}>
                <Text className="text-2xl mb-1">💡</Text>
                <Text className="text-xs font-medium text-foreground">Insights</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(predictive-alerts)')}>
                <Text className="text-2xl mb-1">🔮</Text>
                <Text className="text-xs font-medium text-foreground">Predictions</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/challenges')}>
                <Text className="text-2xl mb-1">🏆</Text>
                <Text className="text-xs font-medium text-foreground">Challenges</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(voice)')}>
                <Text className="text-2xl mb-1">🎤</Text>
                <Text className="text-xs font-medium text-foreground">Voice</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(loyalty)')}>
                <Text className="text-2xl mb-1">🎁</Text>
                <Text className="text-xs font-medium text-foreground">Loyalty</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(news)')}>
                <Text className="text-2xl mb-1">📰</Text>
                <Text className="text-xs font-medium text-foreground">News</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(insights)')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(analytics)')}>
                <Text className="text-2xl mb-1">📈</Text>
                <Text className="text-xs font-medium text-foreground">Analytics</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(smart-notifications)')}>
                <Text className="text-2xl mb-1">📣</Text>
                <Text className="text-xs font-medium text-foreground">Smart Alerts</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(spending-challenges)')}>
                <Text className="text-2xl mb-1">🏁</Text>
                <Text className="text-xs font-medium text-foreground">Spend Challenge</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(referral)')}>
                <Text className="text-2xl mb-1">👥</Text>
                <Text className="text-xs font-medium text-foreground">Referral</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(referral-rewards-enhanced)')}>
                <Text className="text-2xl mb-1">🎁</Text>
                <Text className="text-xs font-medium text-foreground">Refer Rewards</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(financial-literacy)')}>
                <Text className="text-2xl mb-1">📚</Text>
                <Text className="text-xs font-medium text-foreground">Fin. Literacy</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(education)')}>
                <Text className="text-2xl mb-1">🎓</Text>
                <Text className="text-xs font-medium text-foreground">Education</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(cashback)')}>
                <Text className="text-2xl mb-1">💸</Text>
                <Text className="text-xs font-medium text-foreground">Cashback</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(challenges)')}>
                <Text className="text-2xl mb-1">🏆</Text>
                <Text className="text-xs font-medium text-foreground">Challenges</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(p2p)')}>
                <Text className="text-2xl mb-1">📱</Text>
                <Text className="text-xs font-medium text-foreground">Mobile Money</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(joint)')}>
                <Text className="text-2xl mb-1">👥</Text>
                <Text className="text-xs font-medium text-foreground">Joint Accts</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(admin)/fraud-monitor-live')}>
                <Text className="text-2xl mb-1">🛡️</Text>
                <Text className="text-xs font-medium text-foreground">Fraud Monitor</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(admin)/fraud-analytics')}>
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-xs font-medium text-foreground">Fraud Stats</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(admin)/fraud-patterns')}>
                <Text className="text-2xl mb-1">🔎</Text>
                <Text className="text-xs font-medium text-foreground">Fraud Detect</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tools & Utilities */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Tools & Utilities</Text>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(calendar)')}>
                <Text className="text-2xl mb-1">📅</Text>
                <Text className="text-xs font-medium text-foreground">Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(calendar-widget)')}>
                <Text className="text-2xl mb-1">🗓️</Text>
                <Text className="text-xs font-medium text-foreground">Cal Widget</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(notifications)/center')}>
                <Text className="text-2xl mb-1">🔔</Text>
                <Text className="text-xs font-medium text-foreground">Notifications</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(notifications-system)')}>
                <Text className="text-2xl mb-1">📨</Text>
                <Text className="text-xs font-medium text-foreground">System Notifs</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(quick-actions)')}>
                <Text className="text-2xl mb-1">⚡</Text>
                <Text className="text-xs font-medium text-foreground">Quick Actions</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(transaction-search)')}>
                <Text className="text-2xl mb-1">🔍</Text>
                <Text className="text-xs font-medium text-foreground">Search Txns</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(reports)')}>
                <Text className="text-2xl mb-1">📝</Text>
                <Text className="text-xs font-medium text-foreground">Reports</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(export)')}>
                <Text className="text-2xl mb-1">📤</Text>
                <Text className="text-xs font-medium text-foreground">Export</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-xl p-3 flex-1 min-w-[30%]" onPress={() => router.push('/(settings)')}>
                <Text className="text-2xl mb-1">⚙️</Text>
                <Text className="text-xs font-medium text-foreground">Settings</Text>
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
