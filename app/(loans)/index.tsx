import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoanApplication {
  id: string;
  amount: number;
  term: number; // months
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'repaid';
  interestRate: number;
  monthlyPayment: number;
  appliedAt: string;
  approvedAt?: string;
  disbursedAt?: string;
}

const LOANS_KEY = 'loanApplications';

const statusColors: Record<LoanApplication['status'], { bg: string; text: string }> = {
  pending: { bg: 'bg-warning/20', text: 'text-warning' },
  approved: { bg: 'bg-success/20', text: 'text-success' },
  rejected: { bg: 'bg-error/20', text: 'text-error' },
  disbursed: { bg: 'bg-primary/20', text: 'text-primary' },
  repaid: { bg: 'bg-muted/20', text: 'text-muted' },
};

const statusLabels: Record<LoanApplication['status'], string> = {
  pending: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Active',
  repaid: 'Repaid',
};

export default function LoansScreen() {
  const router = useRouter();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(LOANS_KEY);
      if (stored) {
        setLoans(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load loans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderLoan = ({ item }: { item: LoanApplication }) => {
    const colors = statusColors[item.status];
    
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(loans)/${item.id}`)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-lg mb-1">
              ${item.amount.toLocaleString()}
            </Text>
            <Text className="text-muted text-sm">
              {item.term} months • {item.interestRate}% APR
            </Text>
          </View>
          <View className={`${colors.bg} rounded-xl px-3 py-1`}>
            <Text className={`${colors.text} font-semibold text-sm`}>
              {statusLabels[item.status]}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-muted text-xs mb-1">Purpose</Text>
            <Text className="text-foreground font-medium">{item.purpose}</Text>
          </View>
          {item.monthlyPayment > 0 && (
            <View>
              <Text className="text-muted text-xs mb-1">Monthly Payment</Text>
              <Text className="text-foreground font-medium">
                ${item.monthlyPayment.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <Text className="text-muted text-xs mt-3">
          Applied on {new Date(item.appliedAt).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const activeLoans = loans.filter(l => l.status === 'disbursed');
  const totalBorrowed = activeLoans.reduce((sum, l) => sum + l.amount, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Loans', headerShown: true }} />

      {/* Active Loans Summary */}
      {activeLoans.length > 0 && (
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-2">Active Loans</Text>
          <Text className="text-primary font-bold text-4xl mb-2">
            ${totalBorrowed.toLocaleString()}
          </Text>
          <Text className="text-muted text-sm">
            {activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Apply for Loan Button */}
      <TouchableOpacity
        onPress={() => router.push('/(loans)/apply')}
        className="bg-primary rounded-xl p-4 mb-6 flex-row items-center justify-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-white text-2xl mr-2">+</Text>
        <Text className="text-white font-semibold text-lg">Apply for Loan</Text>
      </TouchableOpacity>

      {/* Loans List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : loans.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">💰</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Loan Applications</Text>
          <Text className="text-muted text-center mb-6">
            Apply for a loan to get quick access to funds
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-foreground font-bold text-lg mb-3">Your Applications</Text>
          <FlatList
            data={loans}
            renderItem={renderLoan}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
