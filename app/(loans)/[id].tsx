import { View, Text, TouchableOpacity, ScrollView, Share } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoanApplication {
  id: string;
  amount: number;
  term: number;
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

export default function LoanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<LoanApplication | null>(null);

  useEffect(() => {
    loadLoan();
  }, [loanId]);

  const loadLoan = async () => {
    try {
      const stored = await AsyncStorage.getItem(LOANS_KEY);
      if (stored) {
        const loans = JSON.parse(stored);
        const found = loans.find((l: LoanApplication) => l.id === loanId);
        if (found) {
          setLoan(found);
        }
      }
    } catch (error) {
      console.error('Failed to load loan:', error);
    }
  };

  const handleShareSchedule = async () => {
    if (!loan) return;

    const totalRepayment = loan.monthlyPayment * loan.term;
    const totalInterest = totalRepayment - loan.amount;

    const message = `
Loan Repayment Schedule

Loan Amount: $${loan.amount.toLocaleString()}
Interest Rate: ${loan.interestRate}% APR
Term: ${loan.term} months
Monthly Payment: $${loan.monthlyPayment.toFixed(2)}

Total Interest: $${totalInterest.toFixed(2)}
Total Repayment: $${totalRepayment.toFixed(2)}

Status: ${loan.status}
Applied: ${new Date(loan.appliedAt).toLocaleDateString()}
    `.trim();

    try {
      await Share.share({
        message,
        title: 'Loan Repayment Schedule',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  if (!loan) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const colors = statusColors[loan.status];
  const totalRepayment = loan.monthlyPayment * loan.term;
  const totalInterest = totalRepayment - loan.amount;

  // Generate repayment schedule
  const schedule = Array.from({ length: loan.term }, (_, i) => {
    const monthlyInterest = (loan.amount * loan.interestRate / 100) / 12;
    const principal = loan.monthlyPayment - monthlyInterest;
    
    return {
      month: i + 1,
      payment: loan.monthlyPayment,
      principal,
      interest: monthlyInterest,
      date: new Date(new Date(loan.appliedAt).setMonth(new Date(loan.appliedAt).getMonth() + i + 1)),
    };
  });

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View className="items-center mb-6">
          <View className={`${colors.bg} rounded-xl px-6 py-3`}>
            <Text className={`${colors.text} font-bold text-lg`}>
              {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Loan Amount */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <Text className="text-muted mb-2">Loan Amount</Text>
          <Text className="text-primary font-bold text-5xl mb-2">
            ${loan.amount.toLocaleString()}
          </Text>
          <Text className="text-muted text-sm">{loan.purpose}</Text>
        </View>

        {/* Loan Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Loan Terms</Text>
          
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Interest Rate</Text>
            <Text className="text-foreground font-semibold">{loan.interestRate}% APR</Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Loan Term</Text>
            <Text className="text-foreground font-semibold">{loan.term} months</Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Monthly Payment</Text>
            <Text className="text-primary font-bold text-lg">
              ${loan.monthlyPayment.toFixed(2)}
            </Text>
          </View>

          <View className="h-px bg-border my-3" />

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Total Interest</Text>
            <Text className="text-foreground font-semibold">
              ${totalInterest.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted">Total Repayment</Text>
            <Text className="text-foreground font-bold text-lg">
              ${totalRepayment.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Application Timeline */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Timeline</Text>
          
          <View className="flex-row items-start mb-3">
            <View className="w-3 h-3 rounded-full bg-primary mt-1 mr-3" />
            <View className="flex-1">
              <Text className="text-foreground font-semibold">Application Submitted</Text>
              <Text className="text-muted text-sm">
                {new Date(loan.appliedAt).toLocaleString()}
              </Text>
            </View>
          </View>

          {loan.approvedAt && (
            <View className="flex-row items-start mb-3">
              <View className="w-3 h-3 rounded-full bg-success mt-1 mr-3" />
              <View className="flex-1">
                <Text className="text-foreground font-semibold">Approved</Text>
                <Text className="text-muted text-sm">
                  {new Date(loan.approvedAt).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {loan.disbursedAt && (
            <View className="flex-row items-start">
              <View className="w-3 h-3 rounded-full bg-primary mt-1 mr-3" />
              <View className="flex-1">
                <Text className="text-foreground font-semibold">Funds Disbursed</Text>
                <Text className="text-muted text-sm">
                  {new Date(loan.disbursedAt).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Repayment Schedule */}
        {(loan.status === 'approved' || loan.status === 'disbursed') && (
          <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-foreground font-bold text-lg">Repayment Schedule</Text>
              <TouchableOpacity
                onPress={handleShareSchedule}
                className="bg-primary/20 rounded-full px-3 py-1"
                style={{ opacity: 1 }}
              >
                <Text className="text-primary font-medium text-sm">Share</Text>
              </TouchableOpacity>
            </View>

            {schedule.slice(0, 6).map(item => (
              <View key={item.month} className="flex-row justify-between mb-3">
                <View>
                  <Text className="text-foreground font-medium">Month {item.month}</Text>
                  <Text className="text-muted text-xs">
                    {item.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Text className="text-foreground font-semibold">
                  ${item.payment.toFixed(2)}
                </Text>
              </View>
            ))}

            {schedule.length > 6 && (
              <Text className="text-muted text-center text-sm mt-2">
                +{schedule.length - 6} more payments
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Back to Loans
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
