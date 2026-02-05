import { ScrollView, Text, View, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface KYCSubmission {
  id: number;
  user_id: number;
  document_type: string;
  nationality: string;
  status: string;
  created_at: string;
}

export default function AdminKYCScreen() {
  const colors = useColors();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingSubmissions = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5010/pending');
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Failed to fetch KYC submissions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingSubmissions();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingSubmissions();
  }, []);

  const handleReviewSubmission = (submissionId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(admin-kyc-review)/${submissionId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return '#22C55E';
      case 'rejected':
        return '#EF4444';
      default:
        return colors.muted;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      national_id: 'National ID',
      passport: 'Passport',
      drivers_license: "Driver's License",
      voters_card: "Voter's Card",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4">Loading submissions...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View className="flex-1 gap-4">
          {/* Header */}
          <View className="mb-2">
            <Text className="text-3xl font-bold text-foreground">KYC Review</Text>
            <Text className="text-base text-muted mt-1">
              {submissions.length} pending submission{submissions.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Submissions List */}
          {submissions.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-xl text-muted">No pending submissions</Text>
              <Text className="text-sm text-muted mt-2">All KYC reviews are complete</Text>
            </View>
          ) : (
            submissions.map((submission) => (
              <TouchableOpacity
                key={submission.id}
                onPress={() => handleReviewSubmission(submission.id)}
                className="bg-surface rounded-2xl p-4 border border-border"
                style={{ opacity: 1 }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStatusColor(submission.status) }}
                    />
                    <Text className="text-sm font-semibold text-foreground uppercase">
                      {submission.status}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    ID: {submission.id}
                  </Text>
                </View>

                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">User ID:</Text>
                    <Text className="text-sm font-medium text-foreground">{submission.user_id}</Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Document Type:</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {getDocumentTypeLabel(submission.document_type)}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Nationality:</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {submission.nationality || 'N/A'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Submitted:</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 pt-3 border-t border-border">
                  <Text className="text-sm font-semibold text-primary text-center">
                    Tap to Review →
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
