import { ScrollView, Text, View, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert, Pressable } from "react-native";
import { useState, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { bnplService, BNPLApplication, BNPLAnalytics } from "@/lib/api/bnpl-service";

type TabType = 'pending' | 'approved' | 'rejected' | 'active' | 'all';

export default function AdminBNPLScreen() {
  const colors = useColors();
  const [applications, setApplications] = useState<BNPLApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedApp, setSelectedApp] = useState<BNPLApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [analytics, setAnalytics] = useState<BNPLAnalytics | null>(null);

  const fetchApplications = async () => {
    try {
      if (activeTab === 'pending') {
        const result = await bnplService.getPendingApplications();
        setApplications(result.applications);
      } else if (activeTab === 'all') {
        const result = await bnplService.getUserApplications();
        setApplications(result.applications);
      } else {
        const result = await bnplService.getUserApplications(activeTab);
        setApplications(result.applications);
      }
    } catch (error) {
      console.error('Failed to fetch BNPL applications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await bnplService.getAnalyticsSummary();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchAnalytics();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApplications();
    fetchAnalytics();
  }, [activeTab]);

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedApp) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      Alert.alert('Required', 'Please provide a rejection reason');
      return;
    }

    setIsReviewing(true);
    try {
      await bnplService.reviewApplication({
        application_id: selectedApp.application_id,
        reviewer_id: 'admin-1',
        action,
        notes: reviewNotes || undefined,
        rejection_reason: action === 'reject' ? rejectionReason : undefined,
        adjusted_amount: adjustedAmount ? parseFloat(adjustedAmount) : undefined,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          action === 'approve'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
      }

      Alert.alert('Success', `Application ${action}d successfully`);
      setSelectedApp(null);
      setReviewNotes('');
      setRejectionReason('');
      setAdjustedAmount('');
      fetchApplications();
      fetchAnalytics();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Review failed';
      Alert.alert('Error', message);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDisburse = async (applicationId: string) => {
    try {
      await bnplService.disburseFunds(applicationId);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', 'Funds disbursed successfully');
      fetchApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Disbursement failed';
      Alert.alert('Error', message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'credit_check':
      case 'under_review':
        return '#F59E0B';
      case 'approved':
        return '#3B82F6';
      case 'active':
      case 'disbursed':
        return '#22C55E';
      case 'completed':
        return '#8B5CF6';
      case 'rejected':
      case 'defaulted':
        return '#EF4444';
      default:
        return colors.muted;
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  if (selectedApp) {
    return (
      <ScreenContainer className="p-0">
        <View className="bg-primary px-6 pt-6 pb-6">
          <View className="flex-row items-center mb-2">
            <Pressable onPress={() => setSelectedApp(null)} style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}>
              <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text className="text-xl font-bold text-white ml-4">Review Application</Text>
          </View>
          <Text className="text-white/80 text-sm">{selectedApp.application_id.slice(0, 12)}...</Text>
        </View>

        <ScrollView className="flex-1 px-6 py-4">
          <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
            <Text className="text-lg font-bold text-foreground mb-3">Application Details</Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Merchant</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedApp.merchant_name}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Category</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedApp.category}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Amount</Text>
                <Text className="text-sm font-semibold text-foreground">{formatCurrency(selectedApp.principal_amount)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Plan</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedApp.installment_months} months @ {selectedApp.interest_rate}%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Monthly Payment</Text>
                <Text className="text-sm font-semibold text-primary">{formatCurrency(selectedApp.monthly_payment)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Total</Text>
                <Text className="text-sm font-semibold text-foreground">{formatCurrency(selectedApp.total_amount)}</Text>
              </View>
              {selectedApp.employment_status && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Employment</Text>
                  <Text className="text-sm font-semibold text-foreground">{selectedApp.employment_status}</Text>
                </View>
              )}
              {selectedApp.monthly_income && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Monthly Income</Text>
                  <Text className="text-sm font-semibold text-foreground">{formatCurrency(selectedApp.monthly_income)}</Text>
                </View>
              )}
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Applied</Text>
                <Text className="text-sm font-semibold text-foreground">{new Date(selectedApp.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          {selectedApp.credit_decision && (
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Credit Decision</Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Credit Score</Text>
                  <Text className="text-sm font-semibold text-foreground">{selectedApp.credit_decision.credit_score} ({selectedApp.credit_decision.credit_grade})</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Fraud Risk</Text>
                  <Text className="text-sm font-semibold" style={{ color: selectedApp.credit_decision.fraud_risk_score > 0.5 ? '#EF4444' : '#22C55E' }}>
                    {(selectedApp.credit_decision.fraud_risk_score * 100).toFixed(1)}% ({selectedApp.credit_decision.fraud_risk_level})
                  </Text>
                </View>
                {selectedApp.credit_decision.dti_ratio !== null && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">DTI Ratio</Text>
                    <Text className="text-sm font-semibold text-foreground">{(selectedApp.credit_decision.dti_ratio * 100).toFixed(1)}%</Text>
                  </View>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Max Approved</Text>
                  <Text className="text-sm font-semibold text-foreground">{formatCurrency(selectedApp.credit_decision.max_approved_amount)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Recommendation</Text>
                  <Text className="text-sm font-bold" style={{
                    color: selectedApp.credit_decision.recommended_action === 'approve' ? '#22C55E'
                      : selectedApp.credit_decision.recommended_action === 'reject' ? '#EF4444' : '#F59E0B'
                  }}>
                    {selectedApp.credit_decision.recommended_action.toUpperCase()}
                  </Text>
                </View>
                {selectedApp.credit_decision.risk_factors.length > 0 && (
                  <View className="mt-2">
                    <Text className="text-sm font-semibold text-foreground mb-1">Risk Factors:</Text>
                    {selectedApp.credit_decision.risk_factors.map((f, i) => (
                      <View key={i} className="flex-row items-center gap-2 ml-2">
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.impact === 'critical' ? '#EF4444' : '#F59E0B' }} />
                        <Text className="text-xs text-muted">{f.factor} ({f.impact})</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {selectedApp.status === 'under_review' && (
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Review Actions</Text>

              <View className="mb-3">
                <Text className="text-sm font-medium text-foreground mb-1">Adjusted Amount (optional)</Text>
                <View className="flex-row items-center bg-background border border-border rounded-xl px-4 py-3">
                  <Text className="text-foreground mr-2">₦</Text>
                  <TextInput
                    className="flex-1 text-foreground"
                    placeholder={selectedApp.principal_amount.toString()}
                    placeholderTextColor={colors.muted}
                    value={adjustedAmount}
                    onChangeText={setAdjustedAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View className="mb-3">
                <Text className="text-sm font-medium text-foreground mb-1">Notes</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Review notes..."
                  placeholderTextColor={colors.muted}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  multiline
                  numberOfLines={3}
                  style={{ textAlignVertical: 'top', minHeight: 80 }}
                />
              </View>

              <View className="mb-3">
                <Text className="text-sm font-medium text-foreground mb-1">Rejection Reason (required if rejecting)</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Reason for rejection..."
                  placeholderTextColor={colors.muted}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  multiline
                  numberOfLines={2}
                  style={{ textAlignVertical: 'top', minHeight: 60 }}
                />
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  className="flex-1 bg-green-600 py-3 rounded-xl items-center"
                  onPress={() => handleReview('approve')}
                  disabled={isReviewing}
                  style={(state) => ({ opacity: state.pressed || isReviewing ? 0.7 : 1 })}
                >
                  {isReviewing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-semibold">Approve</Text>
                  )}
                </Pressable>
                <Pressable
                  className="flex-1 bg-red-600 py-3 rounded-xl items-center"
                  onPress={() => handleReview('reject')}
                  disabled={isReviewing}
                  style={(state) => ({ opacity: state.pressed || isReviewing ? 0.7 : 1 })}
                >
                  {isReviewing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-semibold">Reject</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {selectedApp.status === 'approved' && !selectedApp.disbursement && (
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Disbursement</Text>
              <Text className="text-sm text-muted mb-3">Application is approved. Disburse funds to the merchant.</Text>
              <Pressable
                className="bg-primary py-3 rounded-xl items-center"
                onPress={() => handleDisburse(selectedApp.application_id)}
                style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
              >
                <Text className="text-white font-semibold">Disburse {formatCurrency(selectedApp.principal_amount)}</Text>
              </Pressable>
            </View>
          )}

          {selectedApp.installments.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">Payment Schedule</Text>
              <View className="gap-2">
                {selectedApp.installments.map((inst) => (
                  <View key={inst.installment_id} className="flex-row justify-between items-center py-2 border-b border-border">
                    <View>
                      <Text className="text-sm font-medium text-foreground">Payment #{inst.installment_number}</Text>
                      <Text className="text-xs text-muted">{new Date(inst.due_date).toLocaleDateString()}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-semibold text-foreground">{formatCurrency(inst.amount)}</Text>
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getStatusColor(inst.status) + '20' }}>
                        <Text className="text-xs font-medium" style={{ color: getStatusColor(inst.status) }}>
                          {inst.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4">Loading applications...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <View className="bg-primary px-6 pt-6 pb-4">
        <Text className="text-3xl font-bold text-white mb-1">BNPL Admin</Text>
        <Text className="text-base text-white/80">Review and manage applications</Text>

        <View className="flex-row gap-3 mt-4">
          <View className="flex-1 bg-white/20 rounded-xl p-3">
            <Text className="text-white/70 text-xs">Total</Text>
            <Text className="text-white text-lg font-bold">{analytics?.total_applications || 0}</Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-xl p-3">
            <Text className="text-white/70 text-xs">Approval Rate</Text>
            <Text className="text-white text-lg font-bold">{analytics?.approval_rate || 0}%</Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-xl p-3">
            <Text className="text-white/70 text-xs">Disbursed</Text>
            <Text className="text-white text-lg font-bold">₦{(analytics?.total_disbursed || 0).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-border bg-surface" contentContainerStyle={{ paddingHorizontal: 16 }}>
        {(['pending', 'approved', 'active', 'rejected', 'all'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`px-4 py-3 mr-2 ${activeTab === tab ? 'border-b-2 border-primary' : ''}`}
            onPress={() => {
              setActiveTab(tab);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text className={`text-sm font-semibold capitalize ${activeTab === tab ? 'text-primary' : 'text-muted'}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {applications.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="doc.text" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">No {activeTab} applications</Text>
          </View>
        ) : (
          applications.map((app) => (
            <TouchableOpacity
              key={app.application_id}
              className="bg-surface rounded-2xl p-4 border border-border mb-3"
              onPress={() => {
                setSelectedApp(app);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{app.merchant_name}</Text>
                  <Text className="text-xs text-muted mt-0.5">{app.category} | {app.application_id.slice(0, 8)}</Text>
                </View>
                <View className="px-2 py-1 rounded-full" style={{ backgroundColor: getStatusColor(app.status) + '20' }}>
                  <Text className="text-xs font-semibold" style={{ color: getStatusColor(app.status) }}>
                    {app.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View className="border-t border-border pt-2 gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">Amount</Text>
                  <Text className="text-xs font-semibold text-foreground">{formatCurrency(app.principal_amount)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">Monthly</Text>
                  <Text className="text-xs font-semibold text-primary">{formatCurrency(app.monthly_payment)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">Plan</Text>
                  <Text className="text-xs font-semibold text-foreground">{app.installment_months}mo @ {app.interest_rate}%</Text>
                </View>
                {app.credit_decision && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">Credit Score</Text>
                    <Text className="text-xs font-semibold text-foreground">{app.credit_decision.credit_score}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-end mt-2">
                <Text className="text-xs text-primary font-medium mr-1">Review</Text>
                <IconSymbol name="chevron.right" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
