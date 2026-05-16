/**
 * Make Payment Screen — Insurance Platform Mobile
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, Policy } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };
const CHANNELS = ['card', 'bank_transfer', 'ussd', 'mobile_money'];

export default function MakePaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { policyId: preselectedPolicyId } = route.params ?? {};
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState(preselectedPolicyId ?? '');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('card');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.getPolicies({ status: 'Active' }).then(p => {
      setPolicies(p);
      if (!preselectedPolicyId && p.length > 0) setSelectedPolicyId(p[0].id);
    }).catch(() => {});
  }, [preselectedPolicyId]);

  const handlePay = async () => {
    if (!selectedPolicyId || !amount) { Alert.alert('Error', 'Please select a policy and enter amount'); return; }
    Alert.alert('Confirm Payment', `Pay ₦${Number(amount).toLocaleString()} via ${channel}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pay Now', onPress: async () => {
          setSubmitting(true);
          try {
            const result = await apiClient.initiatePayment({ policyId: selectedPolicyId, amount: Number(amount), channel, currency: 'NGN' });
            if (result.authorizationUrl) {
              Alert.alert('Redirecting', `Please complete payment at:\n${result.authorizationUrl}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else {
              Alert.alert('Payment Initiated', `Reference: ${result.reference}`, [{ text: 'OK', onPress: () => navigation.navigate('Payments') }]);
            }
          } catch (e: any) {
            Alert.alert('Payment Failed', e.message ?? 'Please try again');
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Make a Payment</Text>
          <Text style={styles.label}>Select Policy</Text>
          {policies.map(p => (
            <TouchableOpacity key={p.id} style={[styles.optionCard, selectedPolicyId === p.id && styles.optionCardSelected]} onPress={() => { setSelectedPolicyId(p.id); setAmount(p.premium); }}>
              <Text style={styles.optionTitle}>{p.name}</Text>
              <Text style={styles.optionSub}>{p.policyNumber} · Premium: ₦{Number(p.premium).toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.label}>Amount (₦)</Text>
          <TextInput style={styles.input} placeholder="Enter amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />
          <Text style={styles.label}>Payment Channel</Text>
          <View style={styles.channelGrid}>
            {CHANNELS.map(c => (
              <TouchableOpacity key={c} style={[styles.channelBtn, channel === c && styles.channelBtnActive]} onPress={() => setChannel(c)}>
                <Text style={[styles.channelBtnText, channel === c && styles.channelBtnTextActive]}>{c.replace('_', ' ').toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.payBtn, (!selectedPolicyId || !amount || submitting) && styles.payBtnDisabled]} onPress={handlePay} disabled={!selectedPolicyId || !amount || submitting}>
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.payBtnText}>💳 Pay ₦{amount ? Number(amount).toLocaleString() : '0'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  optionCard: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, borderWidth: 2, borderColor: COLORS.border },
  optionCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  optionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  optionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  input: { backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  channelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  channelBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  channelBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  channelBtnTextActive: { color: '#FFFFFF' },
  payBtn: { backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
