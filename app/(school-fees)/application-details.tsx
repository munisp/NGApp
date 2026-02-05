import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';

interface Application {
  id: string;
  studentName: string;
  schoolName: string;
  grade: string;
  totalFee: number;
  downPayment: number;
  principalAmount: number;
  interestAmount: number;
  serviceFee: number;
  totalAmount: number;
  numberOfInstallments: number;
  installmentAmount: number;
  status: ApplicationStatus;
  purpose: string;
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
  paidInstallments: number;
  remainingInstallments: number;
  totalPaid: number;
  totalRemaining: number;
}

interface Payment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed';
  lateFee?: number;
}

export default function ApplicationDetailsScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const applicationId = params.applicationId as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'payments'>('details');

  useEffect(() => {
    loadApplicationData();
  }, []);

  const loadApplicationData = async () => {
    try {
      setLoading(true);
      // In production: const response = await fetch(`/api/v1/applications/${applicationId}`);
      
      // Mock data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setApplication({
        id: applicationId,
        studentName: 'Chioma Okafor',
        schoolName: 'Lagos International School',
        grade: 'JSS 2',
        totalFee: 450000,
        downPayment: 90000,
        principalAmount: 360000,
        interestAmount: 18000,
        serviceFee: 6750,
        totalAmount: 474750,
        numberOfInstallments: 6,
        installmentAmount: 64125,
        status: 'active',
        purpose: 'Term 2 School Fees',
        appliedAt: '2026-01-15T10:30:00Z',
        approvedAt: '2026-01-16T14:20:00Z',
        nextPaymentDate: '2026-02-15T00:00:00Z',
        nextPaymentAmount: 64125,
        paidInstallments: 2,
        remainingInstallments: 4,
        totalPaid: 218250,
        totalRemaining: 256500,
      });

      setPayments([
        {
          id: '1',
          installmentNumber: 1,
          amount: 64125,
          paidAt: '2026-01-20T09:15:00Z',
          paymentMethod: 'Bank Transfer',
          status: 'completed',
        },
        {
          id: '2',
          installmentNumber: 2,
          amount: 64125,
          paidAt: '2026-01-22T11:45:00Z',
          paymentMethod: 'Card Payment',
          status: 'completed',
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load application data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'pending':
        return 'text-warning';
      case 'approved':
        return 'text-success';
      case 'rejected':
        return 'text-error';
      case 'active':
        return 'text-primary';
      case 'completed':
        return 'text-success';
      case 'defaulted':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const getStatusBgColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10';
      case 'approved':
        return 'bg-success/10';
      case 'rejected':
        return 'bg-error/10';
      case 'active':
        return 'bg-primary/10';
      case 'completed':
        return 'bg-success/10';
      case 'defaulted':
        return 'bg-error/10';
      default:
        return 'bg-surface';
    }
  };

  const getStatusText = (status: ApplicationStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleMakePayment = () => {
    if (!application) return;
    router.push({
      pathname: '/(school-fees)/payment',
      params: {
        applicationId: application.id,
        amount: application.nextPaymentAmount?.toString() || '0',
      },
    });
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading application...</Text>
      </ScreenContainer>
    );
  }

  if (!application) {
    return (
      <ScreenContainer className="items-center justify-center px-4">
        <Text className="text-xl font-bold text-foreground mb-2">Application Not Found</Text>
        <Text className="text-base text-muted text-center mb-6">
          Unable to load application details
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
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-base text-primary">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Application Details</Text>
          <View className="flex-row items-center mt-3">
            <View className={`px-3 py-1 rounded-full ${getStatusBgColor(application.status)}`}>
              <Text className={`text-sm font-semibold ${getStatusColor(application.status)}`}>
                {getStatusText(application.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row px-4 py-3 bg-background border-b border-border">
          <TouchableOpacity
            onPress={() => setActiveTab('details')}
            className={`flex-1 pb-2 border-b-2 ${
              activeTab === 'details' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-center text-base font-semibold ${
                activeTab === 'details' ? 'text-primary' : 'text-muted'
              }`}
            >
              Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('payments')}
            className={`flex-1 pb-2 border-b-2 ${
              activeTab === 'payments' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-center text-base font-semibold ${
                activeTab === 'payments' ? 'text-primary' : 'text-muted'
              }`}
            >
              Payments ({payments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {activeTab === 'details' ? (
            <View className="gap-6">
              {/* Student Information */}
              <View>
                <Text className="text-xl font-semibold text-foreground mb-3">Student Information</Text>
                <View className="rounded-2xl bg-surface p-4 border border-border gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Name</Text>
                    <Text className="text-sm font-semibold text-foreground">{application.studentName}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">School</Text>
                    <Text className="text-sm font-semibold text-foreground">{application.schoolName}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Grade</Text>
                    <Text className="text-sm font-semibold text-foreground">{application.grade}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Purpose</Text>
                    <Text className="text-sm font-semibold text-foreground">{application.purpose}</Text>
                  </View>
                </View>
              </View>

              {/* Payment Summary */}
              <View>
                <Text className="text-xl font-semibold text-foreground mb-3">Payment Summary</Text>
                <View className="rounded-2xl bg-surface p-4 border border-border gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Total School Fee</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(application.totalFee)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Down Payment</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(application.downPayment)}
                    </Text>
                  </View>
                  <View className="h-px bg-border" />
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Principal Amount</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(application.principalAmount)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Interest</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(application.interestAmount)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Service Fee</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(application.serviceFee)}
                    </Text>
                  </View>
                  <View className="h-px bg-border" />
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-foreground">Total Amount</Text>
                    <Text className="text-base font-bold text-primary">
                      {formatCurrency(application.totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Payment Progress */}
              {application.status === 'active' && (
                <View>
                  <Text className="text-xl font-semibold text-foreground mb-3">Payment Progress</Text>
                  <View className="rounded-2xl bg-surface p-4 border border-border gap-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Installments Paid</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {application.paidInstallments} / {application.numberOfInstallments}
                      </Text>
                    </View>
                    
                    {/* Progress Bar */}
                    <View className="h-2 rounded-full bg-border overflow-hidden">
                      <View
                        className="h-full bg-primary"
                        style={{
                          width: `${(application.paidInstallments / application.numberOfInstallments) * 100}%`,
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-xs text-muted mb-1">Total Paid</Text>
                        <Text className="text-sm font-semibold text-success">
                          {formatCurrency(application.totalPaid)}
                        </Text>
                      </View>
                      <View className="flex-1 items-end">
                        <Text className="text-xs text-muted mb-1">Remaining</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatCurrency(application.totalRemaining)}
                        </Text>
                      </View>
                    </View>

                    {application.nextPaymentDate && (
                      <View className="mt-2 pt-3 border-t border-border">
                        <Text className="text-xs text-muted mb-1">Next Payment Due</Text>
                        <Text className="text-lg font-bold text-foreground">
                          {formatCurrency(application.nextPaymentAmount || 0)}
                        </Text>
                        <Text className="text-xs text-muted mt-1">
                          Due on {formatDate(application.nextPaymentDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Timeline */}
              <View>
                <Text className="text-xl font-semibold text-foreground mb-3">Timeline</Text>
                <View className="rounded-2xl bg-surface p-4 border border-border gap-4">
                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-3" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">Application Submitted</Text>
                      <Text className="text-xs text-muted mt-1">
                        {formatDateTime(application.appliedAt)}
                      </Text>
                    </View>
                  </View>

                  {application.approvedAt && (
                    <View className="flex-row items-start">
                      <View className="w-2 h-2 rounded-full bg-success mt-1.5 mr-3" />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">Application Approved</Text>
                        <Text className="text-xs text-muted mt-1">
                          {formatDateTime(application.approvedAt)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {application.rejectedAt && (
                    <View className="flex-row items-start">
                      <View className="w-2 h-2 rounded-full bg-error mt-1.5 mr-3" />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">Application Rejected</Text>
                        <Text className="text-xs text-muted mt-1">
                          {formatDateTime(application.rejectedAt)}
                        </Text>
                        {application.rejectionReason && (
                          <Text className="text-xs text-error mt-2">
                            Reason: {application.rejectionReason}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-4">
              {payments.length === 0 ? (
                <View className="rounded-2xl bg-surface p-8 border border-border items-center">
                  <Text className="text-base text-muted text-center">No payments yet</Text>
                </View>
              ) : (
                payments.map((payment, index) => (
                  <View
                    key={payment.id}
                    className="rounded-2xl bg-surface p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-base font-semibold text-foreground">
                        Installment #{payment.installmentNumber}
                      </Text>
                      <View className={`px-3 py-1 rounded-full ${
                        payment.status === 'completed' ? 'bg-success/10' :
                        payment.status === 'pending' ? 'bg-warning/10' : 'bg-error/10'
                      }`}>
                        <Text className={`text-xs font-semibold ${
                          payment.status === 'completed' ? 'text-success' :
                          payment.status === 'pending' ? 'text-warning' : 'text-error'
                        }`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Amount</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatCurrency(payment.amount)}
                        </Text>
                      </View>

                      {payment.lateFee && payment.lateFee > 0 && (
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-error">Late Fee</Text>
                          <Text className="text-sm font-semibold text-error">
                            {formatCurrency(payment.lateFee)}
                          </Text>
                        </View>
                      )}

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Payment Method</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {payment.paymentMethod}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Paid At</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatDateTime(payment.paidAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* Make Payment Button (Fixed at bottom) */}
      {application.status === 'active' && application.nextPaymentDate && (
        <View className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-background border-t border-border">
          <TouchableOpacity
            onPress={handleMakePayment}
            className="rounded-2xl py-4 bg-primary items-center"
          >
            <Text className="text-base font-semibold text-background">
              Make Payment - {formatCurrency(application.nextPaymentAmount || 0)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
