import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Card, Title, Text, TextInput, Button, HelperText, Menu } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsApi, policiesApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

interface Policy {
  id: number;
  policyNumber: string;
  type: string;
  status: string;
}

export default function NewClaimScreen({ route, navigation }: any) {
  const { policyId } = route.params || {};
  const queryClient = useQueryClient();

  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [policyMenuVisible, setPolicyMenuVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: policiesData } = useQuery({
    queryKey: ['policies'],
    queryFn: () => policiesApi.getAll(),
  });

  const activePolicies: Policy[] = (policiesData?.data || []).filter(
    (p: Policy) => p.status === 'Active'
  );

  React.useEffect(() => {
    if (policyId && activePolicies.length > 0) {
      const policy = activePolicies.find(p => p.id === policyId);
      if (policy) setSelectedPolicy(policy);
    }
  }, [policyId, activePolicies]);

  const createClaimMutation = useMutation({
    mutationFn: (data: any) => claimsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      Alert.alert(
        'Claim Submitted',
        'Your claim has been submitted successfully. You can track its progress in the Claims section.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit claim');
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!selectedPolicy) newErrors.policy = 'Please select a policy';
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Please enter a valid amount';
    if (!description.trim()) newErrors.description = 'Please describe the incident';
    if (description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    Alert.alert(
      'Submit Claim',
      'Are you sure you want to submit this claim?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            createClaimMutation.mutate({
              policyId: selectedPolicy?.id,
              amount: parseFloat(amount),
              incidentDate: incidentDate.toISOString(),
              description,
              documents,
            });
          },
        },
      ]
    );
  };

  const handleAddDocument = () => {
    Alert.alert(
      'Add Document',
      'Choose how to add a document',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await launchCamera({
              mediaType: 'photo',
              quality: 0.8,
            });
            if (result.assets && result.assets[0]) {
              setDocuments([...documents, result.assets[0]]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const result = await launchImageLibrary({
              mediaType: 'photo',
              quality: 0.8,
              selectionLimit: 5,
            });
            if (result.assets) {
              setDocuments([...documents, ...result.assets]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const formatCurrency = (value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('en-NG').format(parseInt(num));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>File a Claim</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Policy Information</Title>
          
          <Menu
            visible={policyMenuVisible}
            onDismiss={() => setPolicyMenuVisible(false)}
            anchor={
              <TouchableOpacity
                style={[styles.selectButton, errors.policy && styles.selectButtonError]}
                onPress={() => setPolicyMenuVisible(true)}
              >
                <Text style={selectedPolicy ? styles.selectText : styles.selectPlaceholder}>
                  {selectedPolicy
                    ? `${selectedPolicy.type} - ${selectedPolicy.policyNumber}`
                    : 'Select a policy'}
                </Text>
                <Icon name="chevron-down" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            }
          >
            {activePolicies.map((policy) => (
              <Menu.Item
                key={policy.id}
                onPress={() => {
                  setSelectedPolicy(policy);
                  setPolicyMenuVisible(false);
                  setErrors({ ...errors, policy: '' });
                }}
                title={`${policy.type} - ${policy.policyNumber}`}
              />
            ))}
          </Menu>
          {errors.policy && <HelperText type="error">{errors.policy}</HelperText>}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Claim Details</Title>
          
          <Text style={styles.inputLabel}>Claim Amount (NGN)</Text>
          <TextInput
            value={amount ? `₦${formatCurrency(amount)}` : ''}
            onChangeText={(text) => {
              const num = text.replace(/[^0-9]/g, '');
              setAmount(num);
              setErrors({ ...errors, amount: '' });
            }}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            placeholder="Enter amount"
            error={!!errors.amount}
          />
          {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}

          <Text style={styles.inputLabel}>Incident Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar" size={20} color={theme.colors.primary} />
            <Text style={styles.dateText}>
              {incidentDate.toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={incidentDate}
              mode="date"
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setIncidentDate(date);
              }}
            />
          )}

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setErrors({ ...errors, description: '' });
            }}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.textArea]}
            mode="outlined"
            placeholder="Describe what happened in detail..."
            error={!!errors.description}
          />
          {errors.description && <HelperText type="error">{errors.description}</HelperText>}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Supporting Documents</Title>
          <Text style={styles.documentHint}>
            Upload photos of receipts, medical bills, police reports, or other relevant documents
          </Text>

          <View style={styles.documentsGrid}>
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <Image source={{ uri: doc.uri }} style={styles.documentImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeDocument(index)}
                >
                  <Icon name="close-circle" size={24} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addDocumentButton} onPress={handleAddDocument}>
              <Icon name="camera-plus" size={32} color={theme.colors.primary} />
              <Text style={styles.addDocumentText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={createClaimMutation.isPending}
          disabled={createClaimMutation.isPending}
          style={styles.submitButton}
          icon="send"
        >
          Submit Claim
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
  },
  card: {
    margin: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
  },
  selectButtonError: {
    borderColor: theme.colors.error,
  },
  selectText: {
    ...typography.body,
    color: theme.colors.text,
  },
  selectPlaceholder: {
    ...typography.body,
    color: theme.colors.textSecondary,
  },
  inputLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  textArea: {
    minHeight: 100,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
  },
  dateText: {
    ...typography.body,
    color: theme.colors.text,
    marginLeft: spacing.md,
  },
  documentHint: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.md,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  documentItem: {
    width: 100,
    height: 100,
    borderRadius: theme.roundness,
    overflow: 'hidden',
    position: 'relative',
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  addDocumentButton: {
    width: 100,
    height: 100,
    borderRadius: theme.roundness,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
  },
  addDocumentText: {
    ...typography.small,
    color: theme.colors.primary,
    marginTop: spacing.xs,
  },
  actions: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  submitButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
  },
});
