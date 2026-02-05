import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface JointAccount {
  id: string;
  name: string;
  balance: number;
  partners: { id: string; name: string; email: string }[];
  createdAt: string;
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  partnerId: string;
  partnerName: string;
  type: 'income' | 'expense';
}

export default function JointAccountScreen() {
  const router = useRouter();
  const [jointAccounts, setJointAccounts] = useState<JointAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'mine' | 'partner'>('all');

  useEffect(() => {
    loadJointAccounts();
  }, []);

  const loadJointAccounts = async () => {
    try {
      const stored = await AsyncStorage.getItem('jointAccounts');
      if (stored) {
        setJointAccounts(JSON.parse(stored));
      } else {
        // Sample joint account
        const sampleAccount: JointAccount = {
          id: '1',
          name: 'Family Account',
          balance: 12450.75,
          partners: [
            { id: 'user1', name: 'You', email: 'you@example.com' },
            { id: 'user2', name: 'Partner', email: 'partner@example.com' },
          ],
          createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        };
        await AsyncStorage.setItem('jointAccounts', JSON.stringify([sampleAccount]));
        setJointAccounts([sampleAccount]);
      }

      // Load transactions
      const txnStored = await AsyncStorage.getItem('jointTransactions');
      if (txnStored) {
        setTransactions(JSON.parse(txnStored));
      } else {
        // Sample transactions
        const sampleTxns: Transaction[] = [
          {
            id: '1',
            amount: 2500,
            description: 'Monthly salary contribution',
            category: 'Income',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            partnerId: 'user1',
            partnerName: 'You',
            type: 'income',
          },
          {
            id: '2',
            amount: 1200,
            description: 'Rent payment',
            category: 'Bills',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            partnerId: 'user2',
            partnerName: 'Partner',
            type: 'expense',
          },
          {
            id: '3',
            amount: 350,
            description: 'Groceries',
            category: 'Food',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            partnerId: 'user1',
            partnerName: 'You',
            type: 'expense',
          },
          {
            id: '4',
            amount: 2500,
            description: 'Monthly salary contribution',
            category: 'Income',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            partnerId: 'user2',
            partnerName: 'Partner',
            type: 'income',
          },
        ];
        await AsyncStorage.setItem('jointTransactions', JSON.stringify(sampleTxns));
        setTransactions(sampleTxns);
      }
    } catch (error) {
      console.error('Failed to load joint accounts:', error);
    }
  };

  const createJointAccount = () => {
    router.push('/(joint)/create' as any);
  };

  const filteredTransactions = transactions.filter(txn => {
    if (viewMode === 'all') return true;
    if (viewMode === 'mine') return txn.partnerId === 'user1';
    return txn.partnerId === 'user2';
  });

  const mySpending = transactions
    .filter(t => t.partnerId === 'user1' && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const partnerSpending = transactions
    .filter(t => t.partnerId === 'user2' && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpending = mySpending + partnerSpending;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Joint Accounts', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Joint Accounts</Text>
          <Text className="text-muted">Manage shared finances with your partner</Text>
        </View>

        {/* Joint Account Cards */}
        {jointAccounts.length > 0 ? (
          <View className="gap-4 mb-6">
            {jointAccounts.map(account => (
              <TouchableOpacity
                key={account.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6"
                style={{ opacity: 1 }}
              >
                <View className="mb-4">
                  <Text className="text-white/80 text-sm mb-1">{account.name}</Text>
                  <Text className="text-white font-bold text-4xl mb-3">
                    ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View className="flex-row items-center gap-3 pt-4 border-t border-white/20">
                  {account.partners.map((partner, index) => (
                    <View
                      key={partner.id}
                      className="flex-row items-center gap-2"
                    >
                      <View className="w-8 h-8 rounded-full bg-white/30 items-center justify-center">
                        <Text className="text-white font-bold">{partner.name[0]}</Text>
                      </View>
                      <Text className="text-white/90 font-semibold">{partner.name}</Text>
                      {index < account.partners.length - 1 && (
                        <Text className="text-white/60 mx-2">+</Text>
                      )}
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="bg-surface rounded-xl p-8 mb-6 items-center border border-border">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-foreground font-bold text-xl mb-2">No Joint Accounts</Text>
            <Text className="text-muted text-center mb-4">
              Create a joint account to manage shared finances with your partner
            </Text>
            <TouchableOpacity
              onPress={createJointAccount}
              className="bg-primary rounded-xl px-6 py-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-white font-semibold">Create Joint Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {jointAccounts.length > 0 && (
          <>
            {/* Spending Breakdown */}
            <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
              <Text className="text-foreground font-bold text-xl mb-4">Spending Breakdown</Text>
              
              <View className="gap-4">
                <View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted">Your Spending</Text>
                    <Text className="text-foreground font-bold">${mySpending.toFixed(2)}</Text>
                  </View>
                  <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
                    <View
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${totalSpending > 0 ? (mySpending / totalSpending) * 100 : 0}%` }}
                    />
                  </View>
                </View>

                <View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted">Partner's Spending</Text>
                    <Text className="text-foreground font-bold">${partnerSpending.toFixed(2)}</Text>
                  </View>
                  <View className="bg-muted/20 h-3 rounded-full overflow-hidden">
                    <View
                      className="bg-success h-full rounded-full"
                      style={{ width: `${totalSpending > 0 ? (partnerSpending / totalSpending) * 100 : 0}%` }}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* View Mode Selector */}
            <View className="flex-row bg-surface rounded-xl p-1 mb-4">
              {(['all', 'mine', 'partner'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    setViewMode(mode);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`flex-1 rounded-lg py-3 ${
                    viewMode === mode ? 'bg-primary' : 'bg-transparent'
                  }`}
                  style={{ opacity: 1 }}
                >
                  <Text
                    className={`text-center font-semibold capitalize ${
                      viewMode === mode ? 'text-white' : 'text-muted'
                    }`}
                  >
                    {mode === 'all' ? 'All' : mode === 'mine' ? 'Mine' : 'Partner'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Transactions */}
            <View>
              <Text className="text-foreground font-bold text-xl mb-4">Recent Transactions</Text>
              
              {filteredTransactions.length > 0 ? (
                <View className="gap-3">
                  {filteredTransactions.map(txn => (
                    <View
                      key={txn.id}
                      className="bg-surface rounded-xl p-5 border border-border"
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1">
                          <Text className="text-foreground font-bold text-lg mb-1">
                            {txn.description}
                          </Text>
                          <Text className="text-muted text-sm">{txn.category}</Text>
                        </View>
                        <Text
                          className={`font-bold text-xl ${
                            txn.type === 'income' ? 'text-success' : 'text-error'
                          }`}
                        >
                          {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between pt-3 border-t border-border">
                        <View className="flex-row items-center gap-2">
                          <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center">
                            <Text className="text-primary font-bold text-xs">
                              {txn.partnerName[0]}
                            </Text>
                          </View>
                          <Text className="text-muted text-sm">{txn.partnerName}</Text>
                        </View>
                        <Text className="text-muted text-sm">
                          {new Date(txn.date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-surface rounded-xl p-8 items-center border border-border">
                  <Text className="text-muted">No transactions in this view</Text>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View className="mt-6 gap-3">
              <TouchableOpacity
                onPress={() => router.push('/(joint)/invite' as any)}
                className="bg-primary rounded-xl p-5"
                style={{ opacity: 1 }}
              >
                <Text className="text-white font-semibold text-center text-lg">
                  Invite Partner
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
