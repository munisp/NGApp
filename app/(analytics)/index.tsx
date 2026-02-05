import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string;
  type: 'income' | 'expense';
  description: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

const categoryColors: Record<string, string> = {
  Food: '#FF6B6B',
  Transport: '#4ECDC4',
  Shopping: '#45B7D1',
  Entertainment: '#FFA07A',
  Bills: '#98D8C8',
  Healthcare: '#F7DC6F',
  Education: '#BB8FCE',
  Other: '#95A5A6',
};

export default function AnalyticsScreen() {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      // Generate sample transaction data
      const sampleTransactions: Transaction[] = [];
      const now = new Date();
      const monthsBack = timeRange === 'month' ? 1 : timeRange === 'quarter' ? 3 : 12;

      for (let i = 0; i < monthsBack * 30; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isIncome = Math.random() > 0.7;
        const categories = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Healthcare'];
        
        sampleTransactions.push({
          id: `txn-${i}`,
          amount: isIncome ? Math.random() * 5000 + 1000 : Math.random() * 500 + 50,
          category: isIncome ? 'Salary' : categories[Math.floor(Math.random() * categories.length)],
          date: date.toISOString(),
          type: isIncome ? 'income' : 'expense',
          description: isIncome ? 'Monthly salary' : 'Purchase',
        });
      }

      setTransactions(sampleTransactions);

      // Calculate monthly data
      const monthlyMap = new Map<string, { income: number; expenses: number }>();
      sampleTransactions.forEach(txn => {
        const month = new Date(txn.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { income: 0, expenses: 0 });
        }
        const data = monthlyMap.get(month)!;
        if (txn.type === 'income') {
          data.income += txn.amount;
        } else {
          data.expenses += txn.amount;
        }
      });

      const monthly = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .reverse()
        .slice(0, 6);
      setMonthlyData(monthly);

      // Calculate category data
      const categoryMap = new Map<string, number>();
      let expenseTotal = 0;
      sampleTransactions.forEach(txn => {
        if (txn.type === 'expense') {
          categoryMap.set(txn.category, (categoryMap.get(txn.category) || 0) + txn.amount);
          expenseTotal += txn.amount;
        }
      });

      const categories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: (amount / expenseTotal) * 100,
          color: categoryColors[category] || '#95A5A6',
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);
      setCategoryData(categories);

      // Calculate totals
      const income = sampleTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = sampleTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      setTotalIncome(income);
      setTotalExpenses(expenses);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Expense Analytics', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Expense Analytics</Text>
          <Text className="text-muted">Comprehensive insights into your spending</Text>
        </View>

        {/* Time Range Selector */}
        <View className="flex-row bg-surface rounded-xl p-1 mb-6">
          {(['month', 'quarter', 'year'] as const).map(range => (
            <TouchableOpacity
              key={range}
              onPress={() => {
                setTimeRange(range);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`flex-1 rounded-lg py-3 ${
                timeRange === range ? 'bg-primary' : 'bg-transparent'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-semibold capitalize ${
                  timeRange === range ? 'text-white' : 'text-muted'
                }`}
              >
                {range === 'month' ? '1M' : range === 'quarter' ? '3M' : '1Y'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-success/10 rounded-xl p-5 border border-success/30">
            <Text className="text-success text-sm mb-1">Income</Text>
            <Text className="text-foreground font-bold text-2xl">${totalIncome.toFixed(0)}</Text>
          </View>
          <View className="flex-1 bg-error/10 rounded-xl p-5 border border-error/30">
            <Text className="text-error text-sm mb-1">Expenses</Text>
            <Text className="text-foreground font-bold text-2xl">${totalExpenses.toFixed(0)}</Text>
          </View>
          <View className="flex-1 bg-primary/10 rounded-xl p-5 border border-primary/30">
            <Text className="text-primary text-sm mb-1">Savings</Text>
            <Text className="text-foreground font-bold text-2xl">{savingsRate.toFixed(0)}%</Text>
          </View>
        </View>

        {/* Monthly Trends Chart */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-xl mb-4">Monthly Trends</Text>
          
          {/* Bar Chart */}
          <View className="gap-4">
            {monthlyData.map((data, index) => {
              const maxValue = Math.max(...monthlyData.map(d => Math.max(d.income, d.expenses)));
              const incomeWidth = (data.income / maxValue) * (CHART_WIDTH - 120);
              const expenseWidth = (data.expenses / maxValue) * (CHART_WIDTH - 120);

              return (
                <View key={index}>
                  <Text className="text-muted text-sm mb-2">{data.month}</Text>
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <View className="w-16">
                        <Text className="text-success text-xs">Income</Text>
                      </View>
                      <View className="flex-1 bg-success/20 h-6 rounded-full overflow-hidden">
                        <View
                          className="bg-success h-full rounded-full"
                          style={{ width: incomeWidth }}
                        />
                      </View>
                      <Text className="text-foreground text-xs font-semibold w-16 text-right">
                        ${data.income.toFixed(0)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="w-16">
                        <Text className="text-error text-xs">Expense</Text>
                      </View>
                      <View className="flex-1 bg-error/20 h-6 rounded-full overflow-hidden">
                        <View
                          className="bg-error h-full rounded-full"
                          style={{ width: expenseWidth }}
                        />
                      </View>
                      <Text className="text-foreground text-xs font-semibold w-16 text-right">
                        ${data.expenses.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Category Breakdown */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-xl mb-4">Spending by Category</Text>
          
          {/* Pie Chart (simplified as stacked bars) */}
          <View className="mb-6">
            <View className="flex-row h-8 rounded-full overflow-hidden">
              {categoryData.map((cat, index) => (
                <View
                  key={index}
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Category List */}
          <View className="gap-3">
            {categoryData.map((cat, index) => (
              <View key={index} className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: cat.color }}
                  />
                  <Text className="text-foreground font-semibold flex-1">{cat.category}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-foreground font-bold">${cat.amount.toFixed(0)}</Text>
                  <Text className="text-muted text-sm">{cat.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Month-over-Month Comparison */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-xl mb-4">Month-over-Month</Text>
          
          {monthlyData.length >= 2 && (
            <View className="gap-4">
              {(() => {
                const current = monthlyData[0];
                const previous = monthlyData[1];
                const incomeChange = ((current.income - previous.income) / previous.income) * 100;
                const expenseChange = ((current.expenses - previous.expenses) / previous.expenses) * 100;

                return (
                  <>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-muted">Income Change</Text>
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`font-bold text-lg ${
                            incomeChange >= 0 ? 'text-success' : 'text-error'
                          }`}
                        >
                          {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(1)}%
                        </Text>
                        <Text className="text-2xl">{incomeChange >= 0 ? '📈' : '📉'}</Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-muted">Expense Change</Text>
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`font-bold text-lg ${
                            expenseChange <= 0 ? 'text-success' : 'text-error'
                          }`}
                        >
                          {expenseChange >= 0 ? '+' : ''}{expenseChange.toFixed(1)}%
                        </Text>
                        <Text className="text-2xl">{expenseChange <= 0 ? '📉' : '📈'}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>
          )}
        </View>

        {/* Insights */}
        <View className="bg-primary/10 rounded-xl p-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-3">💡 Insights</Text>
          <View className="gap-2">
            <Text className="text-foreground leading-relaxed">
              • Your savings rate is {savingsRate.toFixed(0)}% {savingsRate >= 20 ? '(Excellent!)' : savingsRate >= 10 ? '(Good)' : '(Needs improvement)'}
            </Text>
            {categoryData.length > 0 && (
              <Text className="text-foreground leading-relaxed">
                • Your top spending category is {categoryData[0].category} at ${categoryData[0].amount.toFixed(0)}
              </Text>
            )}
            {monthlyData.length >= 2 && (
              <Text className="text-foreground leading-relaxed">
                • Your expenses {monthlyData[0].expenses > monthlyData[1].expenses ? 'increased' : 'decreased'} compared to last month
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
