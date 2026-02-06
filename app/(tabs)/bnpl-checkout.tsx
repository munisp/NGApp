import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { bnplService, BNPLPlan } from '@/lib/api/bnpl-service';

type CheckoutStep = 'amount' | 'plans' | 'review' | 'success';

export default function BNPLCheckoutScreen() {
  const colors = useColors();
  const [step, setStep] = useState<CheckoutStep>('amount');
  const [amount, setAmount] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<BNPLPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plans, setPlans] = useState<BNPLPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const handleContinueFromAmount = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid purchase amount');
      return;
    }
    if (!merchantName.trim()) {
      Alert.alert('Missing Information', 'Please enter the merchant name');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setStep('plans');
    setPlansLoading(true);
    try {
      const fetchedPlans = await bnplService.getAvailablePlans(amountNum);
      setPlans(fetchedPlans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  const handleSelectPlan = (plan: BNPLPlan) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPlan(plan);
    setStep('review');
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    try {
      await bnplService.applyForBNPL({
        category: 'general_purchase',
        merchant_name: merchantName,
        amount: parseFloat(amount),
        installment_months: selectedPlan.months,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStep('success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create purchase';
      Alert.alert('Error', message);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOver = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setStep('amount');
    setAmount('');
    setMerchantName('');
    setSelectedPlan(null);
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'amount', label: 'Amount', icon: 'dollarsign.circle.fill' },
      { id: 'plans', label: 'Plan', icon: 'list.bullet.circle.fill' },
      { id: 'review', label: 'Review', icon: 'checkmark.circle.fill' },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === step);

    return (
      <View className="flex-row items-center justify-between mb-6">
        {steps.map((s, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = s.id === step;
          return (
            <View key={s.id} className="flex-1 items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderWidth: isCurrent ? 2 : 0,
                  borderColor: colors.primary,
                }}
              >
                <IconSymbol
                  name={s.icon as any}
                  size={20}
                  color={isActive ? colors.background : colors.muted}
                />
              </View>
              <Text
                className="text-xs mt-1"
                style={{ color: isActive ? colors.foreground : colors.muted }}
              >
                {s.label}
              </Text>
              {index < steps.length - 1 && (
                <View
                  className="absolute h-0.5"
                  style={{
                    width: '100%',
                    top: 20,
                    left: '50%',
                    backgroundColor: isActive ? colors.primary : colors.border,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderAmountStep = () => (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-foreground mb-2">Purchase Details</Text>
      <Text className="text-muted mb-6">Enter the purchase amount and merchant name</Text>

      <View className="gap-4">
        <View>
          <Text className="text-sm font-medium text-foreground mb-2">Merchant Name</Text>
          <View className="bg-surface rounded-2xl px-4 py-4 border border-border">
            <TextInput
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="e.g., Jumia, Konga, etc."
              className="text-foreground text-base"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <View>
          <Text className="text-sm font-medium text-foreground mb-2">Purchase Amount</Text>
          <View className="bg-surface rounded-2xl px-4 py-4 border border-border flex-row items-center">
            <Text className="text-2xl font-bold text-foreground mr-2">₦</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              className="text-foreground text-2xl font-bold flex-1"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <View className="bg-primary/10 rounded-2xl p-4 mt-2">
          <View className="flex-row items-start">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="text-sm text-foreground ml-3 flex-1">
              Buy now and pay later with flexible installment plans. No hidden fees.
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-auto pt-6">
        <TouchableOpacity
          onPress={handleContinueFromAmount}
          activeOpacity={0.7}
          className="bg-primary rounded-2xl py-4 px-6"
        >
          <Text className="text-background font-bold text-center text-base">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPlansStep = () => (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-foreground mb-2">Choose a Plan</Text>
      <Text className="text-muted mb-6">Select an installment plan that works for you</Text>

      {plansLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading plans...</Text>
        </View>
      ) : plans.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <IconSymbol name="exclamationmark.triangle.fill" size={64} color={colors.warning} />
          <Text className="text-lg font-semibold text-foreground mt-4">No plans available</Text>
          <Text className="text-muted mt-2 text-center">
            The purchase amount may not qualify for BNPL
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.months}
                onPress={() => handleSelectPlan(plan)}
                activeOpacity={0.7}
                className="bg-surface rounded-3xl p-6 border border-border"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-xl font-bold text-foreground">
                      {plan.months} Installments
                    </Text>
                    <Text className="text-sm text-muted mt-1">
                      Monthly payments
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                      {formatCurrency(plan.monthly_payment)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">per payment</Text>
                  </View>
                </View>

                <View className="bg-background rounded-2xl p-4 gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Interest Rate</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {plan.interest_rate}%
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Total Amount</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(plan.total_amount)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">First Payment</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatDate(plan.first_payment_date)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-center mt-4">
                  <IconSymbol name="arrow.right.circle.fill" size={24} color={colors.primary} />
                  <Text className="text-sm font-semibold ml-2" style={{ color: colors.primary }}>
                    Select Plan
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <View className="mt-4">
        <TouchableOpacity
          onPress={() => setStep('amount')}
          activeOpacity={0.7}
          className="bg-surface rounded-2xl py-4 px-6 border border-border"
        >
          <Text className="text-foreground font-semibold text-center text-base">
            Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => {
    if (!selectedPlan) return null;

    return (
      <View className="flex-1">
        <Text className="text-2xl font-bold text-foreground mb-2">Review Purchase</Text>
        <Text className="text-muted mb-6">Confirm your purchase details</Text>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {/* Purchase Summary */}
            <View className="bg-surface rounded-3xl p-6 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Purchase Summary</Text>
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Merchant</Text>
                  <Text className="text-sm font-semibold text-foreground">{merchantName}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Purchase Amount</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(parseFloat(amount))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Plan */}
            <View className="bg-surface rounded-3xl p-6 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Payment Plan</Text>
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Installments</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {selectedPlan.months} payments
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Payment Amount</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(selectedPlan.monthly_payment)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Interest Rate</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {selectedPlan.interest_rate}%
                  </Text>
                </View>
                <View className="h-px bg-border my-2" />
                <View className="flex-row justify-between">
                  <Text className="text-base font-bold text-foreground">Total Amount</Text>
                  <Text className="text-base font-bold" style={{ color: colors.primary }}>
                    {formatCurrency(selectedPlan.total_amount)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Schedule */}
            <View className="bg-surface rounded-3xl p-6 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Payment Schedule</Text>
              <View className="gap-2">
                {Array.from({ length: selectedPlan.months }).map((_, index) => {
                  const paymentDate = new Date(selectedPlan.first_payment_date);
                  paymentDate.setMonth(paymentDate.getMonth() + index);
                  return (
                    <View key={index} className="flex-row justify-between py-2">
                      <Text className="text-sm text-muted">
                        Payment {index + 1}
                      </Text>
                      <View className="items-end">
                        <Text className="text-sm font-semibold text-foreground">
                          {formatCurrency(selectedPlan.monthly_payment)}
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatDate(paymentDate.toISOString())}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Terms */}
            <View className="bg-warning/10 rounded-2xl p-4">
              <View className="flex-row items-start">
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
                <Text className="text-xs text-foreground ml-3 flex-1 leading-5">
                  By confirming, you agree to the payment schedule. Late payments may incur additional fees.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View className="gap-3 mt-4">
          <TouchableOpacity
            onPress={handleConfirmPurchase}
            disabled={isProcessing}
            activeOpacity={0.7}
            className="bg-primary rounded-2xl py-4 px-6"
            style={{ opacity: isProcessing ? 0.6 : 1 }}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text className="text-background font-bold text-center text-base">
                Confirm Purchase
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep('plans')}
            disabled={isProcessing}
            activeOpacity={0.7}
            className="bg-surface rounded-2xl py-4 px-6 border border-border"
          >
            <Text className="text-foreground font-semibold text-center text-base">
              Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccessStep = () => (
    <View className="flex-1 items-center justify-center px-6">
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: colors.success + '20' }}
      >
        <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
      </View>

      <Text className="text-3xl font-bold text-foreground text-center mb-2">
        Purchase Confirmed!
      </Text>
      <Text className="text-muted text-center mb-8">
        Your BNPL purchase has been successfully created
      </Text>

      <View className="w-full bg-surface rounded-3xl p-6 border border-border mb-6">
        <View className="gap-3">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">Merchant</Text>
            <Text className="text-sm font-semibold text-foreground">{merchantName}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">Total Amount</Text>
            <Text className="text-sm font-semibold text-foreground">
              {selectedPlan && formatCurrency(selectedPlan.total_amount)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">First Payment</Text>
            <Text className="text-sm font-semibold text-foreground">
              {selectedPlan && formatDate(selectedPlan.first_payment_date)}
            </Text>
          </View>
        </View>
      </View>

      <View className="w-full gap-3">
        <TouchableOpacity
          onPress={handleStartOver}
          activeOpacity={0.7}
          className="bg-primary rounded-2xl py-4 px-6"
        >
          <Text className="text-background font-bold text-center text-base">
            Make Another Purchase
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          activeOpacity={0.7}
          className="bg-surface rounded-2xl py-4 px-6 border border-border"
        >
          <Text className="text-foreground font-semibold text-center text-base">
            View My Purchases
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <View className="flex-1">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Buy Now Pay Later</Text>
          <Text className="text-muted mt-1">Split your purchase into easy installments</Text>
        </View>

        {/* Step Indicator */}
        {step !== 'success' && renderStepIndicator()}

        {/* Content */}
        {step === 'amount' && renderAmountStep()}
        {step === 'plans' && renderPlansStep()}
        {step === 'review' && renderReviewStep()}
        {step === 'success' && renderSuccessStep()}
      </View>
    </ScreenContainer>
  );
}
