import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';

interface Payment {
  id: string;
  type: string;
  amount: number;
  status: string;
  reference: string;
  createdAt: string;
}

export default function DomesticPaymentsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'send'>('list');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trpc/domesticPayments.listPayments');
      const data = await res.json();
      setPayments(data?.result?.data || []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const sendPayment = async () => {
    if (!amount || !recipient) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/trpc/domesticPayments.createPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NIP', amount: parseFloat(amount), recipientAccount: recipient }),
      });
      Alert.alert('Success', 'Payment submitted');
      setAmount('');
      setRecipient('');
      loadPayments();
    } catch {
      Alert.alert('Error', 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'list' && styles.activeTab]} onPress={() => setActiveTab('list')}>
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'send' && styles.activeTab]} onPress={() => setActiveTab('send')}>
          <Text style={[styles.tabText, activeTab === 'send' && styles.activeTabText]}>Send</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'list' ? (
        loading ? <ActivityIndicator size="large" /> : (
          <FlatList
            data={payments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.paymentItem}>
                <Text style={styles.paymentAmount}>₦{item.amount.toLocaleString()}</Text>
                <Text style={styles.paymentStatus}>{item.status}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No payments yet</Text>}
          />
        )
      ) : (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Amount (NGN)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder="Recipient Account" keyboardType="numeric" value={recipient} onChangeText={setRecipient} />
          <TouchableOpacity style={styles.button} onPress={sendPayment} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Payment'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 16, color: '#6b7280' },
  activeTabText: { color: '#2563eb', fontWeight: '600' },
  paymentItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  paymentAmount: { fontSize: 16, fontWeight: '600' },
  paymentStatus: { fontSize: 14, color: '#6b7280' },
  empty: { textAlign: 'center', padding: 32, color: '#9ca3af' },
  form: { padding: 16 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
