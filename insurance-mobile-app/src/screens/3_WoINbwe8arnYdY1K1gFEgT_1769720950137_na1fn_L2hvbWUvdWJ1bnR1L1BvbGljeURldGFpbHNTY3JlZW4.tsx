import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import {
  Appbar,
  ActivityIndicator,
  Text,
  Card,
  Button,
  Divider,
  Dialog,
  Portal,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/services/api';
import { theme } from '@/utils/theme'; // Assuming theme is exported from here
import * as z from 'zod'; // For form validation

// --- MOCK UTILITIES (Replace with actual implementation in a real project) ---

// Mock Toast Notification Hook
const useToast = () => {
  const show = (message: string, type: 'success' | 'error' | 'info') => {
    // In a real app, this would use a library like react-native-toast-message
    console.log(`[TOAST ${type.toUpperCase()}]: ${message}`);
    Alert.alert(type.toUpperCase(), message);
  };
  return { showSuccess: (msg: string) => show(msg, 'success'), showError: (msg: string) => show(msg, 'error') };
};

// Mock File Download Utility
const downloadFile = async (url: string, filename: string) => {
  console.log(`Attempting to download file from: ${url} as ${filename}`);
  // In a real app, this would use a library like rn-fetch-blob or expo-file-system
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
  return { success: true, path: `/downloads/${filename}` };
};

// --- TYPES ---

type PolicyStatus = 'Active' | 'Expired' | 'Pending Cancellation';

interface Policy {
  id: string;
  policyNumber: string;
  type: string;
  startDate: string;
  endDate: string;
  premium: number;
  status: PolicyStatus;
  coverage: string[];
  holderName: string;
  pdfUrl: string;
}

type RootStackParamList = {
  PolicyDetails: { policyId: string };
  // Other screens...
};

type PolicyDetailsScreenRouteProp = RouteProp<RootStackParamList, 'PolicyDetails'>;

// --- VALIDATION SCHEMAS ---

const renewSchema = z.object({
  duration: z.number().min(1, 'Duration must be at least 1 month').max(12, 'Duration cannot exceed 12 months'),
});

const cancelSchema = z.object({
  reason: z.string().min(10, 'Cancellation reason must be at least 10 characters long'),
});

// --- COMPONENT ---

const PolicyDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PolicyDetailsScreenRouteProp>();
  const { policyId } = route.params;
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const paperTheme = useTheme(); // Use react-native-paper theme

  // State for Modals
  const [isRenewModalVisible, setIsRenewModalVisible] = useState(false);
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [renewDuration, setRenewDuration] = useState('12');
  const [cancelReason, setCancelReason] = useState('');
  const [renewError, setRenewError] = useState('');
  const [cancelError, setCancelError] = useState('');

  // 1. Data Fetching (Read)
  const { data: policy, isLoading, isError, error, refetch, isRefetching } = trpc.policies.getDetails.useQuery(
    { policyId },
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      onError: (err) => {
        showError(`Failed to load policy details: ${err.message}`);
      },
    }
  );

  // 2. Policy Renewal (Update)
  const renewMutation = trpc.policies.renew.useMutation({
    onSuccess: (newPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['policies', 'getDetails', { policyId }] });
      showSuccess(`Policy ${newPolicy.policyNumber} successfully renewed!`);
      setIsRenewModalVisible(false);
    },
    onError: (err) => {
      showError(`Renewal failed: ${err.message}`);
      setRenewError(err.message);
    },
  });

  // 3. Policy Cancellation (Delete/Update)
  const cancelMutation = trpc.policies.cancel.useMutation({
    onSuccess: (updatedPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['policies', 'getDetails', { policyId }] });
      showSuccess(`Policy ${updatedPolicy.policyNumber} cancellation initiated.`);
      setIsCancelModalVisible(false);
    },
    onError: (err) => {
      showError(`Cancellation failed: ${err.message}`);
      setCancelError(err.message);
    },
  });

  // 4. PDF Download
  const downloadMutation = trpc.policies.downloadPdf.useMutation({
    onSuccess: async (data) => {
      try {
        // Assuming data contains the temporary URL for the PDF
        const result = await downloadFile(data.url, `${policy?.policyNumber}_details.pdf`);
        if (result.success) {
          showSuccess(`Policy PDF downloaded to ${result.path}`);
        } else {
          showError('Failed to save PDF to device.');
        }
      } catch (e) {
        showError('An error occurred during file download.');
      }
    },
    onError: (err) => {
      showError(`PDF download failed: ${err.message}`);
    },
  });

  // --- HANDLERS ---

  const handleRenew = () => {
    const duration = parseInt(renewDuration, 10);
    try {
      renewSchema.parse({ duration });
      setRenewError('');
      renewMutation.mutate({ policyId, duration });
    } catch (e) {
      if (e instanceof z.ZodError) {
        setRenewError(e.errors[0].message);
      } else {
        setRenewError('Invalid input.');
      }
    }
  };

  const handleCancel = () => {
    try {
      cancelSchema.parse({ reason: cancelReason });
      setCancelError('');
      cancelMutation.mutate({ policyId, reason: cancelReason });
    } catch (e) {
      if (e instanceof z.ZodError) {
        setCancelError(e.errors[0].message);
      } else {
        setCancelError('Invalid input.');
      }
    }
  };

  const handleDownloadPdf = () => {
    if (policy?.pdfUrl) {
      downloadMutation.mutate({ policyId });
    } else {
      showError('PDF URL not available for this policy.');
    }
  };

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // --- RENDER STATES ---

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
        <Text style={styles.loadingText}>Loading Policy Details...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Error Loading Policy</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
          Try Again
        </Button>
      </View>
    );
  }

  if (!policy) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Policy Not Found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.retryButton}>
          Go Back
        </Button>
      </View>
    );
  }

  // --- MAIN RENDER ---

  const isPolicyActive = policy.status === 'Active';

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: paperTheme.colors.background }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Policy Details" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[paperTheme.colors.primary]} />
        }
      >
        <Card style={styles.card}>
          <Card.Title
            title={`Policy: ${policy.policyNumber}`}
            subtitle={`Status: ${policy.status}`}
            titleStyle={styles.cardTitle}
            subtitleStyle={{ color: isPolicyActive ? paperTheme.colors.primary : paperTheme.colors.error }}
          />
          <Card.Content>
            <DetailRow label="Policy Type" value={policy.type} />
            <DetailRow label="Policy Holder" value={policy.holderName} />
            <DetailRow label="Start Date" value={policy.startDate} />
            <DetailRow label="End Date" value={policy.endDate} />
            <DetailRow label="Premium" value={`$${policy.premium.toFixed(2)}`} />

            <Divider style={styles.divider} />

            <Text style={styles.sectionTitle}>Coverage Details</Text>
            {policy.coverage.map((item, index) => (
              <Text key={index} style={styles.coverageItem}>
                • {item}
              </Text>
            ))}
          </Card.Content>
        </Card>

        <View style={styles.actionContainer}>
          {isPolicyActive && (
            <>
              <Button
                mode="contained"
                icon="autorenew"
                onPress={() => setIsRenewModalVisible(true)}
                style={styles.actionButton}
                loading={renewMutation.isPending}
                disabled={renewMutation.isPending || cancelMutation.isPending}
              >
                Renew Policy
              </Button>
              <Button
                mode="outlined"
                icon="cancel"
                onPress={() => setIsCancelModalVisible(true)}
                style={styles.actionButton}
                loading={cancelMutation.isPending}
                disabled={renewMutation.isPending || cancelMutation.isPending}
                textColor={paperTheme.colors.error}
              >
                Cancel Policy
              </Button>
            </>
          )}
          <Button
            mode="text"
            icon="file-download"
            onPress={handleDownloadPdf}
            style={styles.actionButton}
            loading={downloadMutation.isPending}
            disabled={downloadMutation.isPending}
          >
            Download PDF
          </Button>
        </View>
      </ScrollView>

      {/* Renew Policy Modal */}
      <Portal>
        <Dialog visible={isRenewModalVisible} onDismiss={() => setIsRenewModalVisible(false)}>
          <Dialog.Title>Renew Policy {policy.policyNumber}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.modalText}>
              Select the duration for which you want to renew your policy (in months).
            </Text>
            <TextInput
              label="Renewal Duration (Months)"
              value={renewDuration}
              onChangeText={setRenewDuration}
              keyboardType="numeric"
              mode="outlined"
              style={styles.textInput}
              error={!!renewError}
            />
            {renewError ? <Text style={styles.errorText}>{renewError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsRenewModalVisible(false)} disabled={renewMutation.isPending}>
              Cancel
            </Button>
            <Button onPress={handleRenew} loading={renewMutation.isPending} disabled={renewMutation.isPending}>
              Renew
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Cancel Policy Modal */}
      <Portal>
        <Dialog visible={isCancelModalVisible} onDismiss={() => setIsCancelModalVisible(false)}>
          <Dialog.Title>Cancel Policy {policy.policyNumber}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.modalText}>
              Please provide a reason for cancellation. This action cannot be undone.
            </Text>
            <TextInput
              label="Reason for Cancellation"
              value={cancelReason}
              onChangeText={setCancelReason}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.textInput}
              error={!!cancelError}
            />
            {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsCancelModalVisible(false)} disabled={cancelMutation.isPending}>
              Close
            </Button>
            <Button onPress={handleCancel} loading={cancelMutation.isPending} disabled={cancelMutation.isPending} textColor={paperTheme.colors.error}>
              Confirm Cancellation
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

// --- HELPER COMPONENT & STYLES ---

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.text,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginBottom: 8,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    marginTop: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.backdrop,
  },
  detailLabel: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  detailValue: {
    color: theme.colors.text,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  coverageItem: {
    marginLeft: 8,
    marginBottom: 4,
    color: theme.colors.text,
  },
  actionContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 1,
  },
  actionButton: {
    marginVertical: 8,
  },
  modalText: {
    marginBottom: 15,
    lineHeight: 20,
  },
  textInput: {
    marginBottom: 10,
  }
});

export default PolicyDetailsScreen;
