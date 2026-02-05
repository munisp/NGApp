import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  schoolName: string;
  schoolId: string;
}

interface PaymentPlan {
  numberOfInstallments: number;
  installmentAmount: number;
  totalAmount: number;
  interestRate: number;
  serviceFee: number;
  monthlyPayment: number;
}

export default function ApplyForInstallmentScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const studentId = params.studentId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  
  const [formData, setFormData] = useState({
    totalFee: '',
    downPayment: '',
    numberOfInstallments: 3,
    purpose: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);

  const installmentOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  useEffect(() => {
    loadStudentData();
  }, []);

  useEffect(() => {
    if (formData.totalFee && formData.downPayment) {
      calculatePaymentPlan();
    }
  }, [formData.totalFee, formData.downPayment, formData.numberOfInstallments]);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      // In production: const response = await fetch(`/api/v1/students/${studentId}`);
      
      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setStudent({
        id: studentId,
        firstName: 'Chioma',
        lastName: 'Okafor',
        grade: 'JSS 2',
        schoolName: 'Lagos International School',
        schoolId: '1',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const getInterestRate = (months: number): number => {
    if (months <= 3) return 0;
    if (months <= 6) return 0.05;
    if (months <= 9) return 0.08;
    return 0.12;
  };

  const calculatePaymentPlan = () => {
    const totalFee = parseFloat(formData.totalFee) || 0;
    const downPayment = parseFloat(formData.downPayment) || 0;
    const months = formData.numberOfInstallments;

    if (totalFee <= 0 || downPayment < 0) {
      setPaymentPlan(null);
      return;
    }

    const serviceFeeRate = 0.015; // 1.5%
    const serviceFee = totalFee * serviceFeeRate;
    
    const principalAmount = totalFee - downPayment;
    const interestRate = getInterestRate(months);
    const interestAmount = principalAmount * interestRate;
    
    const totalAmountToPay = principalAmount + interestAmount + serviceFee;
    const installmentAmount = totalAmountToPay / months;

    setPaymentPlan({
      numberOfInstallments: months,
      installmentAmount: Math.ceil(installmentAmount),
      totalAmount: Math.ceil(totalAmountToPay + downPayment),
      interestRate: interestRate * 100,
      serviceFee: Math.ceil(serviceFee),
      monthlyPayment: Math.ceil(installmentAmount),
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const totalFee = parseFloat(formData.totalFee) || 0;
    if (totalFee <= 0) {
      newErrors.totalFee = 'Total fee must be greater than 0';
    } else if (totalFee < 10000) {
      newErrors.totalFee = 'Minimum fee is ₦10,000';
    } else if (totalFee > 5000000) {
      newErrors.totalFee = 'Maximum fee is ₦5,000,000';
    }

    const downPayment = parseFloat(formData.downPayment) || 0;
    if (downPayment < 0) {
      newErrors.downPayment = 'Down payment cannot be negative';
    } else if (downPayment > totalFee) {
      newErrors.downPayment = 'Down payment cannot exceed total fee';
    } else if (downPayment < totalFee * 0.1) {
      newErrors.downPayment = 'Minimum down payment is 10% of total fee';
    }

    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    try {
      setSubmitting(true);

      // In production: POST to /api/v1/applications
      const applicationData = {
        studentId: student!.id,
        schoolId: student!.schoolId,
        totalFee: parseFloat(formData.totalFee),
        downPayment: parseFloat(formData.downPayment),
        numberOfInstallments: formData.numberOfInstallments,
        purpose: formData.purpose,
        paymentPlan,
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Application Submitted',
        'Your application has been submitted successfully! You will receive a notification once it is approved.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading student data...</Text>
      </ScreenContainer>
    );
  }

  if (!student) {
    return (
      <ScreenContainer className="items-center justify-center px-4">
        <Text className="text-xl font-bold text-foreground mb-2">Student Not Found</Text>
        <Text className="text-base text-muted text-center mb-6">
          Unable to load student information
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-6 py-3 rounded-full bg-primary"
        >
          <Text className="text-base font-semibold text-background">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-base text-primary">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Apply for Installment</Text>
          <Text className="mt-2 text-base text-muted">
            Create a payment plan for {student.firstName}'s school fees
          </Text>
        </View>

        {/* Student Info Card */}
        <View className="mb-6 rounded-2xl bg-surface p-4 border border-border">
          <Text className="text-sm text-muted mb-2">Student</Text>
          <Text className="text-lg font-semibold text-foreground">
            {student.firstName} {student.lastName}
          </Text>
          <Text className="mt-1 text-sm text-muted">{student.schoolName}</Text>
          <Text className="text-sm text-muted">Grade: {student.grade}</Text>
        </View>

        {/* Fee Information */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Fee Information</Text>

          {/* Total Fee */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Total School Fee *</Text>
            <View className="flex-row items-center">
              <Text className="text-lg font-semibold text-foreground mr-2">₦</Text>
              <TextInput
                className={`flex-1 px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                  errors.totalFee ? 'border-error' : 'border-border'
                }`}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formData.totalFee}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  setFormData({ ...formData, totalFee: cleaned });
                  if (errors.totalFee) {
                    setErrors({ ...errors, totalFee: '' });
                  }
                }}
              />
            </View>
            {errors.totalFee && (
              <Text className="mt-1 text-xs text-error">{errors.totalFee}</Text>
            )}
          </View>

          {/* Down Payment */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Down Payment (Min 10%) *</Text>
            <View className="flex-row items-center">
              <Text className="text-lg font-semibold text-foreground mr-2">₦</Text>
              <TextInput
                className={`flex-1 px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                  errors.downPayment ? 'border-error' : 'border-border'
                }`}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formData.downPayment}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  setFormData({ ...formData, downPayment: cleaned });
                  if (errors.downPayment) {
                    setErrors({ ...errors, downPayment: '' });
                  }
                }}
              />
            </View>
            {errors.downPayment && (
              <Text className="mt-1 text-xs text-error">{errors.downPayment}</Text>
            )}
            {formData.totalFee && (
              <Text className="mt-1 text-xs text-muted">
                Minimum: {formatCurrency(parseFloat(formData.totalFee) * 0.1)}
              </Text>
            )}
          </View>

          {/* Purpose */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Purpose *</Text>
            <TextInput
              className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                errors.purpose ? 'border-error' : 'border-border'
              }`}
              placeholder="e.g., Term 1 Fees, Annual Fees"
              placeholderTextColor={colors.muted}
              value={formData.purpose}
              onChangeText={(text) => {
                setFormData({ ...formData, purpose: text });
                if (errors.purpose) {
                  setErrors({ ...errors, purpose: '' });
                }
              }}
            />
            {errors.purpose && (
              <Text className="mt-1 text-xs text-error">{errors.purpose}</Text>
            )}
          </View>
        </View>

        {/* Payment Plan */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Payment Plan</Text>

          {/* Number of Installments */}
          <Text className="text-sm font-medium text-foreground mb-3">Number of Installments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {installmentOptions.map((months) => (
                <TouchableOpacity
                  key={months}
                  onPress={() => setFormData({ ...formData, numberOfInstallments: months })}
                  className={`px-4 py-3 rounded-2xl border ${
                    formData.numberOfInstallments === months
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-border'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      formData.numberOfInstallments === months ? 'text-background' : 'text-foreground'
                    }`}
                  >
                    {months} months
                  </Text>
                  <Text
                    className={`text-xs mt-1 ${
                      formData.numberOfInstallments === months ? 'text-background/80' : 'text-muted'
                    }`}
                  >
                    {getInterestRate(months) * 100}% interest
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Payment Plan Summary */}
          {paymentPlan && (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <Text className="text-base font-semibold text-foreground mb-4">Payment Summary</Text>

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Total School Fee</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(parseFloat(formData.totalFee))}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Down Payment</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    -{formatCurrency(parseFloat(formData.downPayment))}
                  </Text>
                </View>

                <View className="h-px bg-border" />

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Principal Amount</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(parseFloat(formData.totalFee) - parseFloat(formData.downPayment))}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Interest ({paymentPlan.interestRate}%)</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency((parseFloat(formData.totalFee) - parseFloat(formData.downPayment)) * (paymentPlan.interestRate / 100))}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Service Fee (1.5%)</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(paymentPlan.serviceFee)}
                  </Text>
                </View>

                <View className="h-px bg-border" />

                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-foreground">Total Amount</Text>
                  <Text className="text-base font-bold text-primary">
                    {formatCurrency(paymentPlan.totalAmount)}
                  </Text>
                </View>

                <View className="mt-4 pt-4 border-t border-border">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-foreground">Monthly Payment</Text>
                    <Text className="text-2xl font-bold text-primary">
                      {formatCurrency(paymentPlan.monthlyPayment)}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-muted text-right">
                    for {paymentPlan.numberOfInstallments} months
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Important Information */}
        <View className="mb-6 rounded-2xl bg-surface p-4 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">⚠️ Important Information</Text>
          <View className="gap-2">
            <Text className="text-xs text-muted">
              • Late payment fee: 1% per week (maximum 10%)
            </Text>
            <Text className="text-xs text-muted">
              • Payments are due on the same day each month
            </Text>
            <Text className="text-xs text-muted">
              • Early payment is allowed without penalty
            </Text>
            <Text className="text-xs text-muted">
              • Approval typically takes 1-2 business days
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !paymentPlan}
          className={`rounded-2xl py-4 items-center ${
            submitting || !paymentPlan ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-background">Submit Application</Text>
          )}
        </TouchableOpacity>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
