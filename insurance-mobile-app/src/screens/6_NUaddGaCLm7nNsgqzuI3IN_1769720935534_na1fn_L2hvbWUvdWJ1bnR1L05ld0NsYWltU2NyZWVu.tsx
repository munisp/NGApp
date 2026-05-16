import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Appbar,
  TextInput,
  Button,
  ActivityIndicator,
  Text,
  Snackbar,
  Card,
  useTheme,
  HelperText,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc } from '@/services/api';
import { theme } from '@/utils/theme'; // Assuming theme is exported from here
import { Dropdown } from 'react-native-element-dropdown'; // Assuming a simple dropdown component is available or can be simulated
import * as DocumentPicker from 'expo-document-picker'; // Assuming expo-document-picker for file upload

// --- Types and Interfaces ---

interface Policy {
  id: string;
  policyNumber: string;
  type: string;
}

interface ClaimForm {
  policyId: string;
  amount: string; // Use string for input, convert to number for API
  claimDate: Date;
  description: string;
  documentUri: string | null;
  documentName: string | null;
}

// --- Constants ---

const initialFormState: ClaimForm = {
  policyId: '',
  amount: '',
  claimDate: new Date(),
  description: '',
  documentUri: null,
  documentName: null,
};

// --- Helper Functions ---

const validateForm = (form: ClaimForm): Record<keyof ClaimForm, string> => {
  const errors: Record<keyof ClaimForm, string> = {};

  if (!form.policyId) {
    errors.policyId = 'Policy selection is required.';
  }

  const amountValue = parseFloat(form.amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    errors.amount = 'Claim amount must be a positive number.';
  }

  if (!form.description || form.description.length < 10) {
    errors.description = 'Description must be at least 10 characters long.';
  }

  // Date validation is simplified, assuming the date picker handles valid dates
  if (!form.claimDate || form.claimDate > new Date()) {
    errors.claimDate = 'Claim date cannot be in the future.';
  }

  return errors;
};

// --- Component ---

const NewClaimScreen: React.FC = () => {
  const paperTheme = useTheme();
  const navigation = useNavigation();
  const [form, setForm] = useState<ClaimForm>(initialFormState);
  const [errors, setErrors] = useState<Record<keyof ClaimForm, string>>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 1. Fetch Policies (useQuery)
  const {
    data: policies,
    isLoading: isLoadingPolicies,
    error: policiesError,
    refetch: refetchPolicies,
    isRefetching: isRefetchingPolicies,
  } = trpc.policies.list.useQuery();

  // 2. Create Claim (useMutation)
  const createClaimMutation = trpc.claims.create.useMutation({
    onSuccess: () => {
      setForm(initialFormState); // Reset form
      setSnackbarMessage('Claim submitted successfully!');
      setSnackbarVisible(true);
      // Optionally navigate back or to a confirmation screen
      // navigation.goBack();
    },
    onError: (err) => {
      setSnackbarMessage(`Submission failed: ${err.message}`);
      setSnackbarVisible(true);
    },
  });

  const handleInputChange = useCallback(
    (field: keyof ClaimForm, value: string | Date) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear error for the field on change
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors],
  );

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      handleInputChange('claimDate', selectedDate);
    }
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
        copyContents: false,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        handleInputChange('documentUri', asset.uri);
        handleInputChange('documentName', asset.name);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  const handleSubmit = useCallback(() => {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSnackbarMessage('Please correct the errors in the form.');
      setSnackbarVisible(true);
      return;
    }

    // Prepare data for API
    const data = {
      policyId: form.policyId,
      amount: parseFloat(form.amount),
      claimDate: form.claimDate.toISOString(),
      description: form.description,
      // In a real app, documentUri would be uploaded first, and the resulting ID/URL sent here.
      // For this implementation, we send the URI/Name as a placeholder.
      documentDetails: form.documentName
        ? { uri: form.documentUri, name: form.documentName }
        : undefined,
    };

    createClaimMutation.mutate(data as any); // Cast to any to simplify the mock API call
  }, [form, createClaimMutation]);

  const policyDropdownData = useMemo(() => {
    return (policies || []).map((p) => ({
      label: `${p.policyNumber} (${p.type})`,
      value: p.id,
    }));
  }, [policies]);

  const isSubmitting = createClaimMutation.isLoading;
  const isRefreshing = isRefetchingPolicies && !isLoadingPolicies;

  return (
    <View style={styles.container}>
      <Appbar.Header theme={theme}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="File New Claim" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          // Pull-to-refresh for policy list
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetchPolicies}
            colors={[paperTheme.colors.primary]}
          />
        }
      >
        <Card style={styles.card}>
          <Card.Content>
            {/* Policy Selection */}
            <Text style={styles.label}>Select Policy *</Text>
            {isLoadingPolicies ? (
              <ActivityIndicator animating={true} color={paperTheme.colors.primary} />
            ) : policiesError ? (
              <HelperText type="error" visible={true}>
                Failed to load policies: {policiesError.message}
              </HelperText>
            ) : (
              <Dropdown
                style={[styles.dropdown, errors.policyId && styles.dropdownError]}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                data={policyDropdownData}
                labelField="label"
                valueField="value"
                placeholder="Choose a policy"
                value={form.policyId}
                onChange={(item) => handleInputChange('policyId', item.value)}
                disable={isSubmitting}
              />
            )}
            <HelperText type="error" visible={!!errors.policyId}>
              {errors.policyId}
            </HelperText>

            <Divider style={styles.divider} />

            {/* Claim Amount Input */}
            <TextInput
              label="Claim Amount (USD) *"
              value={form.amount}
              onChangeText={(text) => handleInputChange('amount', text.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              error={!!errors.amount}
              disabled={isSubmitting}
            />
            <HelperText type="error" visible={!!errors.amount}>
              {errors.amount}
            </HelperText>

            {/* Claim Date Picker (Simplified for RN Paper/Expo) */}
            <View style={styles.datePickerContainer}>
              <TextInput
                label="Date of Incident *"
                value={form.claimDate.toLocaleDateString()}
                mode="outlined"
                style={styles.input}
                right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
                error={!!errors.claimDate}
                disabled={isSubmitting}
              />
              {/* In a real app, this would be a platform-specific date picker (e.g., @react-native-community/datetimepicker) */}
              {showDatePicker && (
                <Text style={styles.datePickerPlaceholder}>
                  [Date Picker Component Placeholder: Use a library like @react-native-community/datetimepicker]
                </Text>
                // Example of how a date picker might be used:
                // <DateTimePicker
                //   value={form.claimDate}
                //   mode="date"
                //   display="default"
                //   onChange={handleDateChange}
                // />
              )}
            </View>
            <HelperText type="error" visible={!!errors.claimDate}>
              {errors.claimDate}
            </HelperText>

            {/* Description Input */}
            <TextInput
              label="Description of Incident *"
              value={form.description}
              onChangeText={(text) => handleInputChange('description', text)}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              error={!!errors.description}
              disabled={isSubmitting}
            />
            <HelperText type="error" visible={!!errors.description}>
              {errors.description}
            </HelperText>

            <Divider style={styles.divider} />

            {/* Document Upload */}
            <Button
              icon="upload"
              mode="outlined"
              onPress={handleDocumentPick}
              style={styles.uploadButton}
              disabled={isSubmitting}
            >
              {form.documentName ? 'Change Document' : 'Upload Supporting Document'}
            </Button>
            {form.documentName && (
              <View style={styles.documentInfo}>
                <Text style={{ color: paperTheme.colors.onSurface }}>
                  File: {form.documentName}
                </Text>
                <Button
                  icon="close"
                  mode="text"
                  onPress={() => {
                    handleInputChange('documentUri', null);
                    handleInputChange('documentName', null);
                  }}
                  compact
                  disabled={isSubmitting}
                >
                  Remove
                </Button>
              </View>
            )}
            <HelperText type="info" visible={true}>
              Optional: Attach police reports, photos, or estimates.
            </HelperText>

            <Divider style={styles.divider} />

            {/* Submit Button */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || isLoadingPolicies}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              Submit Claim
            </Button>
            {createClaimMutation.isError && (
              <HelperText type="error" visible={true} style={styles.apiError}>
                API Error: {createClaimMutation.error.message}
              </HelperText>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Snackbar for Toast Notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
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
  card: {
    elevation: 4,
  },
  input: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: theme.colors.onSurface,
    marginBottom: 8,
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  uploadButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  documentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 8,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  apiError: {
    textAlign: 'center',
    marginTop: 10,
  },
  // Dropdown styles (simulated for react-native-element-dropdown)
  dropdown: {
    height: 50,
    borderColor: theme.colors.outline,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
  },
  dropdownError: {
    borderColor: theme.colors.error,
  },
  placeholderStyle: {
    fontSize: 16,
    color: theme.colors.onSurfaceDisabled,
  },
  selectedTextStyle: {
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  datePickerContainer: {
    // Placeholder for date picker
  },
  datePickerPlaceholder: {
    color: theme.colors.onSurfaceDisabled,
    textAlign: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 4,
    marginTop: 8,
  },
});

// Need to import RefreshControl from 'react-native' for pull-to-refresh
import { RefreshControl } from 'react-native';

export default NewClaimScreen;
