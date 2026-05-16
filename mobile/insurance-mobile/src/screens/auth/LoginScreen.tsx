/**
 * Login Screen — Insurance Platform Mobile
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';

const COLORS = { primary: '#1E40AF', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0', danger: '#EF4444' };

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { Alert.alert('Error', 'Please enter your credentials'); return; }
    setLoading(true);
    try {
      await apiClient.login(username, password);
      // Navigation handled by AppNavigator auth state
    } catch (e: any) {
      Alert.alert('Login Failed', e.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>🛡️</Text></View>
          <Text style={styles.appName}>InsurePlatform</Text>
          <Text style={styles.tagline}>Your trusted insurance partner</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Sign In</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email or Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email or phone"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.loginBtn, (!username || !password || loading) && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!username || !password || loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.biometricBtn} onPress={() => navigation.navigate('Biometric')}>
            <Text style={styles.biometricBtnText}>🔐 Use Biometrics</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 36 },
  appName: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  form: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, gap: 16 },
  formTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  input: { backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingLeft: 14 },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  loginBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  biometricBtn: { backgroundColor: COLORS.background, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  biometricBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
