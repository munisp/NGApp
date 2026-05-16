/**
 * Submit Claim Screen — Insurance Platform Mobile
 * Full claim submission with document upload
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Policy } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };
const CLAIM_TYPES = ['Health', 'Auto', 'Property', 'Life', 'Travel', 'Other'];

export default function SubmitClaimScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { policyId: preselectedPolicyId } = route.params ?? {};

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState(preselectedPolicyId ?? '');
  const [claimType, setClaimType] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    apiClient.getPolicies({ status: 'Active' }).then(setPolicies).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!selectedPolicyId || !claimType || !amount || !description) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    Alert.alert('Submit Claim', `Submit a ${claimType} claim for ₦${Number(amount).toLocaleString()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit', onPress: async () => {
          setSubmitting(true);
          try {
            const claim = await apiClient.submitClaim({
              policyId: selectedPolicyId,
              type: claimType,
              amount: Number(amount),
              description,
              incidentDate: incidentDate || new Date().toISOString(),
            });
            Alert.alert('Claim Submitted!', `Your claim ${claim.claimNumber} has been submitted successfully.\n\nWe will review it within 3-5 business days.`, [
              { text: 'View Claim', onPress: () => navigation.replace('ClaimDetail', { claimId: claim.id }) },
              { text: 'Go to Claims', onPress: () => navigation.navigate('Claims') },
            ]);
          } catch (e: any) {
            Alert.alert('Submission Failed', e.message ?? 'Please try again');
          } finally {
            setSubmitting(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.progressStep, step >= s && styles.progressStepActive]}>
                <Text style={[styles.progressStepText, step >= s && styles.progressStepTextActive]}>{s}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.stepLabel}>{step === 1 ? 'Select Policy & Type' : step === 2 ? 'Claim Details' : 'Review & Submit'}</Text>

          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Policy</Text>
              {policies.map(p => (
                <TouchableOpacity key={p.id} style={[styles.optionCard, selectedPolicyId === p.id && styles.optionCardSelected]} onPress={() => setSelectedPolicyId(p.id)}>
                  <Text style={styles.optionTitle}>{p.name}</Text>
                  <Text style={styles.optionSub}>{p.policyNumber} · {p.type}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Claim Type</Text>
              <View style={styles.typeGrid}>
                {CLAIM_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, claimType === t && styles.typeBtnActive]} onPress={() => setClaimType(t)}>
                    <Text style={[styles.typeBtnText, claimType === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.nextBtn, (!selectedPolicyId || !claimType) && styles.nextBtnDisabled]} onPress={() => setStep(2)} disabled={!selectedPolicyId || !claimType}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.label}>Claim Amount (₦) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 500000" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />
              <Text style={styles.label}>Incident Date</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={incidentDate} onChangeText={setIncidentDate} placeholderTextColor={COLORS.textSecondary} />
              <Text style={styles.label}>Description *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Describe what happened..." value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor={COLORS.textSecondary} />
              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }, (!amount || !description) && styles.nextBtnDisabled]} onPress={() => setStep(3)} disabled={!amount || !description}><Text style={styles.nextBtnText}>Review →</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review Your Claim</Text>
              <View style={styles.reviewCard}>
                {[
                  ['Policy', policies.find(p => p.id === selectedPolicyId)?.name ?? selectedPolicyId],
                  ['Claim Type', claimType],
                  ['Amount', `₦${Number(amount).toLocaleString()}`],
                  ['Incident Date', incidentDate || 'Today'],
                  ['Description', description],
                ].map(([label, value], i) => (
                  <View key={i} style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>{label}</Text>
                    <Text style={styles.reviewValue}>{value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { flex: 1 }, submitting && styles.nextBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.submitBtnText}>Submit Claim</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8 },
  progressStep: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  progressStepActive: { backgroundColor: COLORS.primary },
  progressStepText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  progressStepTextActive: { color: '#FFFFFF' },
  stepLabel: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 20 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  optionCard: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, borderWidth: 2, borderColor: COLORS.border },
  optionCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  optionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  optionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  typeBtnTextActive: { color: '#FFFFFF' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  input: { backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  textArea: { height: 100, textAlignVertical: 'top' },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn: { backgroundColor: COLORS.card, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  backBtnText: { color: COLORS.text, fontWeight: '600' },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  reviewCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, gap: 10 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  reviewLabel: { fontSize: 13, color: COLORS.textSecondary, width: '35%' },
  reviewValue: { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 1, textAlign: 'right' },
  submitBtn: { backgroundColor: COLORS.success, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
