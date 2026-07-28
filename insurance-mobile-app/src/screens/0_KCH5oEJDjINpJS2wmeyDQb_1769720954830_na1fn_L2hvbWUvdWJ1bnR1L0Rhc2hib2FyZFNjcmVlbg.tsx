import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc } from '@/services/api';
import { theme } from '@/utils/theme';
import {
  ActivityIndicator,
  Appbar,
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  FAB,
  Portal,
  Dialog,
  TextInput,
  HelperText,
  useTheme,
} from 'react-native-paper';

// --- Mock Data Types for tRPC Responses ---

interface PolicySummary {
  activePolicies: number;
  pendingClaims: number;
  totalCoverage: number; // In a currency format, e.g., 150000.00
}

interface RecentActivity {
  id: string;
  type: 'Claim' | 'Payment' | 'Update';
  description: string;
  date: string;
  status: 'Completed' | 'Pending' | 'Rejected';
}

// --- Component Definition ---

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const paperTheme = useTheme();
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [quickClaimPolicyId, setQuickClaimPolicyId] = useState('');
  const [quickClaimDescription, setQuickClaimDescription] = useState('');
  const [policyIdError, setPolicyIdError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Helper function to show a toast/alert (simulating a toast for now)
  const showToast = (message: string, isError: boolean = false) => {
    Alert.alert(isError ? 'Error' : 'Success', message);
  };

  // --- Data Fetching (useQuery) ---

  // 1. Fetch Policy Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = trpc.dashboard.getSummary.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 2. Fetch Recent Activity
  const {
    data: activityData,
    isLoading: isActivityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = trpc.activity.listRecent.useQuery({ limit: 5 }, {
    staleTime: 60 * 1000, // 1 minute
  });

  // --- Data Mutation (useMutation for Quick Action) ---

  const quickClaimMutation = trpc.claims.fileQuickClaim.useMutation({
    onSuccess: (data) => {
      showToast(`Quick Claim filed successfully! ID: ${data.claimId}`, false);
      setIsDialogVisible(false);
      setQuickClaimPolicyId('');
      setQuickClaimDescription('');
      refetchSummary(); // Refresh summary data after a successful claim
    },
    onError: (error) => {
      showToast(`Failed to file quick claim: ${error.message}`, true);
    },
  });

  // --- Pull-to-Refresh Logic ---

  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSummary(), refetchActivity()]);
    } catch (e) {
      // Errors are handled by the useQuery hooks
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchSummary, refetchActivity]);

  // --- Form Validation and Submission ---

  const validateAndSubmit = () => {
    let valid = true;
    setPolicyIdError('');
    setDescriptionError('');

    if (!quickClaimPolicyId.trim()) {
      setPolicyIdError('Policy ID is required.');
      valid = false;
    }
    if (quickClaimDescription.trim().length < 10) {
      setDescriptionError('Description must be at least 10 characters.');
      valid = false;
    }

    if (valid) {
      quickClaimMutation.mutate({
        policyId: quickClaimPolicyId.trim(),
        description: quickClaimDescription.trim(),
      });
    }
  };

  // --- UI Rendering Logic (Placeholder for Phase 3) ---

  const renderSummary = () => {
    if (isSummaryLoading) {
      return <ActivityIndicator animating={true} color={paperTheme.colors.primary} style={styles.loading} />;
    }

    if (summaryError) {
      return <Text style={styles.errorText}>Error loading summary: {summaryError.message}</Text>;
    }

    const data = summaryData || { activePolicies: 0, pendingClaims: 0, totalCoverage: 0 };
    const formattedCoverage = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(data.totalCoverage);

    return (
      <View style={styles.summaryContainer}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.summaryTitle}>Active Policies</Title>
            <Paragraph style={styles.summaryValue}>{data.activePolicies}</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.summaryTitle}>Pending Claims</Title>
            <Paragraph style={styles.summaryValue}>{data.pendingClaims}</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.summaryTitle}>Total Coverage</Title>
            <Paragraph style={styles.summaryValue}>{formattedCoverage}</Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderActivity = () => {
    if (isActivityLoading) {
      return <ActivityIndicator animating={true} color={paperTheme.colors.primary} style={styles.loading} />;
    }

    if (activityError) {
      return <Text style={styles.errorText}>Error loading activity: {activityError.message}</Text>;
    }

    const data = activityData || [];

    return (
      <View style={styles.activityContainer}>
        <Title style={styles.sectionTitle}>Recent Activity</Title>
        {data.length === 0 ? (
          <Text style={styles.noDataText}>No recent activity found.</Text>
        ) : (
          data.map((item) => (
            <Card key={item.id} style={styles.activityCard}>
              <Card.Content style={styles.activityContent}>
                <View style={styles.activityText}>
                  <Text style={styles.activityType}>{item.type}</Text>
                  <Paragraph numberOfLines={1}>{item.description}</Paragraph>
                </View>
                <View style={styles.activityMeta}>
                  <Text style={styles.activityDate}>{item.date}</Text>
                  <Text style={[styles.activityStatus, { color: item.status === 'Completed' ? theme.colors.success : item.status === 'Pending' ? theme.colors.warning : theme.colors.error }]}>
                    {item.status}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
        <Button
          mode="text"
          onPress={() => navigation.navigate('ActivityHistory')} // Assuming an 'ActivityHistory' screen exists
          style={styles.viewAllButton}
        >
          View All Activity
        </Button>
      </View>
    );
  };

  // --- Main Component Render ---

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: paperTheme.colors.background }}>
        <Appbar.Content title="Dashboard" titleStyle={{ color: paperTheme.colors.onBackground }} />
        <Appbar.Action
          icon="bell-outline"
          onPress={() => navigation.navigate('Notifications')} // Assuming a 'Notifications' screen exists
          color={paperTheme.colors.onBackground}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[paperTheme.colors.primary]}
            tintColor={paperTheme.colors.primary}
          />
        }
      >
        {/* Policy Summary Section */}
        {renderSummary()}

        {/* Quick Actions Section */}
        <View style={styles.quickActionsContainer}>
          <Title style={styles.sectionTitle}>Quick Actions</Title>
          <View style={styles.quickActionsRow}>
            <Button
              icon="file-document-edit-outline"
              mode="contained"
              onPress={() => setIsDialogVisible(true)}
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
            >
              File Quick Claim
            </Button>
            <Button
              icon="credit-card-outline"
              mode="outlined"
              onPress={() => navigation.navigate('Payments')} // Assuming a 'Payments' screen exists
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
            >
              Make a Payment
            </Button>
          </View>
        </View>

        {/* Recent Activity Section */}
        {renderActivity()}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Quick Claim Dialog (CRUD: Create/Mutation) */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
          <Dialog.Title>File a Quick Claim</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Policy ID"
              value={quickClaimPolicyId}
              onChangeText={(text) => {
                setQuickClaimPolicyId(text);
                setPolicyIdError('');
              }}
              mode="outlined"
              keyboardType="default"
              style={styles.input}
              error={!!policyIdError}
            />
            <HelperText type="error" visible={!!policyIdError}>
              {policyIdError}
            </HelperText>

            <TextInput
              label="Brief Description"
              value={quickClaimDescription}
              onChangeText={(text) => {
                setQuickClaimDescription(text);
                setDescriptionError('');
              }}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              error={!!descriptionError}
            />
            <HelperText type="error" visible={!!descriptionError}>
              {descriptionError}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDialogVisible(false)} disabled={quickClaimMutation.isLoading}>
              Cancel
            </Button>
            <Button
              onPress={validateAndSubmit}
              loading={quickClaimMutation.isLoading}
              disabled={quickClaimMutation.isLoading}
              mode="contained"
            >
              Submit Claim
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Floating Action Button (Alternative Quick Action) */}
      <FAB
        style={[styles.fab, { backgroundColor: paperTheme.colors.accent }]}
        icon="plus"
        onPress={() => setIsDialogVisible(true)}
        label="New Claim"
      />
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loading: {
    marginVertical: 20,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text,
  },
  // Summary Styles
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    marginBottom: 10,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  summaryTitle: {
    fontSize: 14,
    color: theme.colors.placeholder,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  // Quick Actions Styles
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: theme.roundness,
  },
  actionButtonLabel: {
    fontSize: 12,
  },
  // Activity Styles
  activityContainer: {
    marginBottom: 20,
  },
  activityCard: {
    marginBottom: 8,
    elevation: 1,
    backgroundColor: theme.colors.surface,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityText: {
    flex: 3,
  },
  activityType: {
    fontWeight: 'bold',
    fontSize: 14,
    color: theme.colors.primary,
  },
  activityMeta: {
    flex: 1,
    alignItems: 'flex-end',
  },
  activityDate: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  activityStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  noDataText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: theme.colors.placeholder,
  },
  viewAllButton: {
    marginTop: 10,
  },
  // Dialog/Form Styles
  input: {
    marginBottom: 0, // HelperText handles the spacing
    backgroundColor: theme.colors.surface,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    // Using theme.colors.accent for FAB background as per common RN-Paper practice
  },
});

export default DashboardScreen;
