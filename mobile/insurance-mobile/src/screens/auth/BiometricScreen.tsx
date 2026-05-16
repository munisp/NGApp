/**
 * Biometric Authentication Screen — Insurance Platform Mobile
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { primary: '#1E40AF', background: '#F8FAFC', text: '#1E293B', textSecondary: '#64748B' };

export default function BiometricScreen() {
  const navigation = useNavigation<any>();
  const [authenticating, setAuthenticating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');

  const handleBiometric = async () => {
    setAuthenticating(true);
    setStatus('scanning');
    // Simulate biometric authentication (react-native-biometrics in production)
    setTimeout(() => {
      setStatus('success');
      setAuthenticating(false);
      // In production: use ReactNativeBiometrics.simplePrompt() then call apiClient.login with biometric token
      Alert.alert('Authenticated', 'Biometric authentication successful!', [
        { text: 'Continue', onPress: () => navigation.goBack() }
      ]);
    }, 1500);
  };

  const STATUS_ICONS: Record<string, string> = { idle: '🔐', scanning: '⏳', success: '✅', failed: '❌' };
  const STATUS_LABELS: Record<string, string> = { idle: 'Touch to authenticate', scanning: 'Scanning...', success: 'Authenticated!', failed: 'Authentication failed' };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Biometric Login</Text>
        <Text style={styles.subtitle}>Use your fingerprint or face to sign in securely</Text>
        <TouchableOpacity style={[styles.biometricCircle, status === 'scanning' && styles.biometricCircleActive]} onPress={handleBiometric} disabled={authenticating}>
          {authenticating ? <ActivityIndicator size="large" color="#FFFFFF" /> : <Text style={styles.biometricIcon}>{STATUS_ICONS[status]}</Text>}
        </TouchableOpacity>
        <Text style={styles.statusLabel}>{STATUS_LABELS[status]}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Use Password Instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  biometricCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  biometricCircleActive: { opacity: 0.8 },
  biometricIcon: { fontSize: 56 },
  statusLabel: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
  backBtn: { marginTop: 20 },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
