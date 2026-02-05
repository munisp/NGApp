import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface P2PLoan {
  id: string;
  type: 'lent' | 'borrowed';
  contact: string;
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'overdue';
  amountPaid: number;
}

export default function P2PScreen() {
  const router = useRouter();
  const [loans, setLoans] = useState<P2PLoan[]>([]);
  const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent');

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      const stored = await AsyncStorage.getItem('p2pLoans');
      if (stored) {
        setLoans(JSON.parse(stored));
      } else {
        // Sample loans
        const sampleLoans: P2PLoan[] = [
          {
            id: '1',
            type: 'lent',
            contact: 'John Doe',
            amount: 500,
            interestRate: 5,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            amountPaid: 200,
          },
          {
            id: '2',
            type: 'borrowed',
            contact: 'Jane Smith',
            amount: 1000,
            interestRate: 3,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            amountPaid: 400,
          },
        ];
        await AsyncStorage.setItem('p2pLoans', JSON.stringify(sampleLoans));
        setLoans(sampleLoans);
      }
    } catch (error) {
      console.error('Failed to load loans:', error);
    }
  };

  const filteredLoans = loans.filter(loan => loan.type === activeTab);

  const getTotalAmount = (type: 'lent' | 'borrowed') => {
    return loans
      .filter(loan => loan.type === type && loan.status === 'active')
      .reduce((sum, loan) => sum + (loan.amount - loan.amountPaid), 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-primary/20 text-primary';
      case 'completed':
        return 'bg-success/20 text-success';
      case 'overdue':
        return 'bg-error/20 text-error';
      default:
        return 'bg-muted/20 text-muted';
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'P2P Lending', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Peer-to-Peer Lending</Text>
          <Text className="text-muted">Lend and borrow money with trusted contacts</Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-success/10 rounded-xl p-5 border border-success/30">
            <Text className="text-success text-sm mb-1">Lent Out</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${getTotalAmount('lent').toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">Active loans</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl p-5 border border-warning/30">
            <Text className="text-warning text-sm mb-1">Borrowed</Text>
            <Text className="text-foreground font-bold text-2xl">
              ${getTotalAmount('borrowed').toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">Active loans</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(p2p)/lend' as any)}
            className="flex-1 bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-bold text-center text-lg">💸 Lend Money</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(p2p)/borrow' as any)}
            className="flex-1 bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground font-bold text-center text-lg">🤝 Borrow Money</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1 mb-6 border border-border">
          <TouchableOpacity
            onPress={() => setActiveTab('lent')}
            className={`flex-1 rounded-lg py-3 ${
              activeTab === 'lent' ? 'bg-primary' : ''
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'lent' ? 'text-white' : 'text-muted'
              }`}
            >
              Lent ({loans.filter(l => l.type === 'lent').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('borrowed')}
            className={`flex-1 rounded-lg py-3 ${
              activeTab === 'borrowed' ? 'bg-primary' : ''
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'borrowed' ? 'text-white' : 'text-muted'
              }`}
            >
              Borrowed ({loans.filter(l => l.type === 'borrowed').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loans List */}
        <View>
          {filteredLoans.map(loan => {
            const progress = (loan.amountPaid / loan.amount) * 100;
            const remaining = loan.amount - loan.amountPaid;
            const totalWithInterest = loan.amount * (1 + loan.interestRate / 100);

            return (
              <TouchableOpacity
                key={loan.id}
                onPress={() => router.push(`/(p2p)/${loan.id}` as any)}
                className="bg-surface rounded-xl p-5 mb-3 border border-border"
                style={{ opacity: 1 }}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-lg mb-1">
                      {loan.contact}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View className={`px-3 py-1 rounded-full ${getStatusColor(loan.status)}`}>
                        <Text className={`text-xs font-semibold ${getStatusColor(loan.status).split(' ')[1]}`}>
                          {loan.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-muted text-sm">
                        {loan.interestRate}% interest
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-2xl">
                      ${loan.amount.toFixed(2)}
                    </Text>
                    <Text className="text-muted text-sm">
                      +${(totalWithInterest - loan.amount).toFixed(2)} interest
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="mb-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted text-sm">Repayment Progress</Text>
                    <Text className="text-muted text-sm">{progress.toFixed(0)}%</Text>
                  </View>
                  <View className="bg-muted/20 h-2 rounded-full overflow-hidden">
                    <View
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </View>
                </View>

                {/* Details */}
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-muted text-xs mb-1">Remaining</Text>
                    <Text className="text-foreground font-semibold">
                      ${remaining.toFixed(2)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-muted text-xs mb-1">Due Date</Text>
                    <Text className="text-foreground font-semibold">
                      {new Date(loan.endDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-muted text-xs mb-1">Days Left</Text>
                    <Text className="text-foreground font-semibold">
                      {Math.ceil((new Date(loan.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredLoans.length === 0 && (
            <View className="bg-surface rounded-xl p-12 items-center border border-border">
              <Text className="text-6xl mb-4">
                {activeTab === 'lent' ? '💸' : '🤝'}
              </Text>
              <Text className="text-foreground font-semibold text-lg mb-2">
                No {activeTab === 'lent' ? 'Lent' : 'Borrowed'} Loans
              </Text>
              <Text className="text-muted text-center">
                {activeTab === 'lent'
                  ? 'Start lending money to friends and family'
                  : 'Request a loan from trusted contacts'}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View className="mt-6 bg-primary/10 rounded-xl p-5 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-3">💡 How P2P Lending Works</Text>
          <View className="gap-2">
            <Text className="text-foreground leading-relaxed">
              • Set your own interest rates and repayment terms
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Track payments and send automatic reminders
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Build trust with transparent loan agreements
            </Text>
            <Text className="text-foreground leading-relaxed">
              • Only lend to people you know and trust
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
