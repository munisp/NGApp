import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AuthService from '../../services/AuthService';

export const OTPVerificationScreen = ({ navigation, route }: any) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await AuthService.verifyOTP(otp);
      Alert.alert('Success', 'OTP verified successfully');
      navigation.replace('Main');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a code to your phone</Text>
      
      <TextInput
        style={styles.input}
        placeholder="000000"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={styles.linkText}>Resend OTP</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 24, textAlign: 'center', letterSpacing: 10 },
  button: { backgroundColor: '#667eea', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { color: '#667eea', textAlign: 'center', marginTop: 20 },
});
