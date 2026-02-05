import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { paymentGatewayService, PaymentGateway } from '@/lib/api/payment-gateway-service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentGatewaySettingsScreen() {
  const router = useRouter();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('paystack');
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [paystackSecretKey, setPaystackSecretKey] = useState('');
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('');
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState('');
  const [flutterwaveEncryptionKey, setFlutterwaveEncryptionKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const gateway = await paymentGatewayService.getCurrentGateway();
      setSelectedGateway(gateway);

      const settings = await AsyncStorage.getItem('@payment_gateway_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setPaystackPublicKey(parsed.paystackPublicKey || '');
        setPaystackSecretKey(parsed.paystackSecretKey || '');
        setFlutterwavePublicKey(parsed.flutterwavePublicKey || '');
        setFlutterwaveSecretKey(parsed.flutterwaveSecretKey || '');
        setFlutterwaveEncryptionKey(parsed.flutterwaveEncryptionKey || '');
        setIsTestMode(parsed.isTestMode !== false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    if (selectedGateway === 'paystack') {
      if (!paystackPublicKey || !paystackSecretKey) {
        Alert.alert('Error', 'Please enter both Paystack public and secret keys');
        return;
      }
    } else {
      if (!flutterwavePublicKey || !flutterwaveSecretKey || !flutterwaveEncryptionKey) {
        Alert.alert('Error', 'Please enter all Flutterwave keys');
        return;
      }
    }

    try {
      setIsSaving(true);

      // Save settings
      const settings = {
        paystackPublicKey,
        paystackSecretKey,
        flutterwavePublicKey,
        flutterwaveSecretKey,
        flutterwaveEncryptionKey,
        isTestMode,
      };
      await AsyncStorage.setItem('@payment_gateway_settings', JSON.stringify(settings));

      // Initialize payment gateway
      if (selectedGateway === 'paystack') {
        await paymentGatewayService.initialize({
          gateway: 'paystack',
          paystack: {
            publicKey: paystackPublicKey,
            secretKey: paystackSecretKey,
            environment: isTestMode ? 'test' : 'live',
          },
        });
      } else {
        await paymentGatewayService.initialize({
          gateway: 'flutterwave',
          flutterwave: {
            publicKey: flutterwavePublicKey,
            secretKey: flutterwaveSecretKey,
            encryptionKey: flutterwaveEncryptionKey,
            environment: isTestMode ? 'test' : 'live',
          },
        });
      }

      Alert.alert('Success', 'Payment gateway configured successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to configure payment gateway');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Payment Gateway Settings' }} />

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-foreground mb-2">Configure Payment Gateway</Text>
        <Text className="text-muted mb-6">
          Set up your payment gateway to enable real money transactions
        </Text>

        {/* Gateway Selection */}
        <Text className="text-lg font-semibold text-foreground mb-3">Select Gateway</Text>
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => setSelectedGateway('paystack')}
            className={`flex-1 p-4 rounded-xl border ${
              selectedGateway === 'paystack'
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-border'
            }`}
            style={{ opacity: 1 }}
          >
            <Text className="text-2xl text-center mb-2">💳</Text>
            <Text
              className={`text-center font-semibold ${
                selectedGateway === 'paystack' ? 'text-primary' : 'text-foreground'
              }`}
            >
              Paystack
            </Text>
            <Text className="text-xs text-muted text-center mt-1">
              Nigeria, Ghana, South Africa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedGateway('flutterwave')}
            className={`flex-1 p-4 rounded-xl border ${
              selectedGateway === 'flutterwave'
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-border'
            }`}
            style={{ opacity: 1 }}
          >
            <Text className="text-2xl text-center mb-2">🌊</Text>
            <Text
              className={`text-center font-semibold ${
                selectedGateway === 'flutterwave' ? 'text-primary' : 'text-foreground'
              }`}
            >
              Flutterwave
            </Text>
            <Text className="text-xs text-muted text-center mt-1">
              Pan-African coverage
            </Text>
          </TouchableOpacity>
        </View>

        {/* Environment Toggle */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">Test Mode</Text>
              <Text className="text-sm text-muted">
                Use test API keys for development
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsTestMode(!isTestMode)}
              className={`w-14 h-8 rounded-full p-1 ${isTestMode ? 'bg-primary' : 'bg-border'}`}
              style={{ opacity: 1 }}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  isTestMode ? 'self-end' : 'self-start'
                }`}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Paystack Configuration */}
        {selectedGateway === 'paystack' && (
          <View className="gap-4 mb-6">
            <View>
              <Text className="text-foreground font-semibold mb-2">Public Key</Text>
              <TextInput
                value={paystackPublicKey}
                onChangeText={setPaystackPublicKey}
                placeholder="pk_test_..."
                placeholderTextColor="#9BA1A6"
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Secret Key</Text>
              <TextInput
                value={paystackSecretKey}
                onChangeText={setPaystackSecretKey}
                placeholder="sk_test_..."
                placeholderTextColor="#9BA1A6"
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View className="bg-warning/10 rounded-xl p-4 border border-warning">
              <Text className="text-warning font-semibold mb-2">ℹ️ Get Paystack API Keys</Text>
              <Text className="text-foreground text-sm">
                1. Sign up at paystack.com{'\n'}
                2. Go to Settings → API Keys & Webhooks{'\n'}
                3. Copy your {isTestMode ? 'test' : 'live'} keys{'\n'}
                4. Paste them above
              </Text>
            </View>
          </View>
        )}

        {/* Flutterwave Configuration */}
        {selectedGateway === 'flutterwave' && (
          <View className="gap-4 mb-6">
            <View>
              <Text className="text-foreground font-semibold mb-2">Public Key</Text>
              <TextInput
                value={flutterwavePublicKey}
                onChangeText={setFlutterwavePublicKey}
                placeholder="FLWPUBK_TEST-..."
                placeholderTextColor="#9BA1A6"
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Secret Key</Text>
              <TextInput
                value={flutterwaveSecretKey}
                onChangeText={setFlutterwaveSecretKey}
                placeholder="FLWSECK_TEST-..."
                placeholderTextColor="#9BA1A6"
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Encryption Key</Text>
              <TextInput
                value={flutterwaveEncryptionKey}
                onChangeText={setFlutterwaveEncryptionKey}
                placeholder="FLWSECK_TEST..."
                placeholderTextColor="#9BA1A6"
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View className="bg-warning/10 rounded-xl p-4 border border-warning">
              <Text className="text-warning font-semibold mb-2">ℹ️ Get Flutterwave API Keys</Text>
              <Text className="text-foreground text-sm">
                1. Sign up at flutterwave.com{'\n'}
                2. Go to Settings → API{'\n'}
                3. Copy your {isTestMode ? 'test' : 'live'} keys{'\n'}
                4. Paste them above
              </Text>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`rounded-xl p-4 mb-6 ${isSaving ? 'bg-primary/50' : 'bg-primary'}`}
          style={{ opacity: 1 }}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">Save Configuration</Text>
          )}
        </TouchableOpacity>

        {/* Security Notice */}
        <View className="bg-error/10 rounded-xl p-4 border border-error">
          <Text className="text-error font-semibold mb-2">🔒 Security Notice</Text>
          <Text className="text-foreground text-sm">
            • Never share your secret keys{'\n'}
            • Use test keys during development{'\n'}
            • Keep your keys secure{'\n'}
            • Rotate keys regularly in production
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
