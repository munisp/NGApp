import { useState } from 'react';
import { categorizeTransaction } from "@/lib/api/ml-service-client";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { requireBiometricForTransaction } from '@/utils/biometric-reauth';
import { TutorialOverlay, TutorialStep } from '@/components/tutorial-overlay';
import { ScreenContainer } from '@/components/screen-container';
import { accountService, paymentService } from '@/lib/api/services-mock';
import { RiskScoreDisplay } from '@/components/fraud/RiskScoreDisplay';
import { fraudDetectionAPI } from '@/lib/api/fraud-detection';
import { transactionLimitsService } from '@/lib/services/transaction-limits';

export default function SendMoneyScreen() {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskExplanation, setRiskExplanation] = useState<string>('');
  const [suspiciousPatterns, setSuspiciousPatterns] = useState<string[]>([]);
  const [showRiskScore, setShowRiskScore] = useState(false);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'payment_intro',
      title: 'Send Money Easily',
      description: 'Enter the recipient details, amount, and description to send money securely.',
      position: 'top',
    },
    {
      id: 'payment_biometric',
      title: 'Biometric Security',
      description: 'All transactions require authentication with Face ID or Touch ID for maximum security.',
      position: 'center',
    },
    {
      id: 'payment_receipt',
      title: 'Transaction Receipt',
      description: 'After sending, you\'ll receive a detailed receipt that you can share or save for your records.',
      position: 'bottom',
    },
  ];

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAccounts();
      setAccounts(data);
      if (data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load accounts');
    }
  };

  useState(() => {
    loadAccounts();
  });

  const handleSend = async () => {
    if (!amount || !recipient || !selectedAccount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Check fraud risk before proceeding
    setIsLoading(true);
    try {
      const limitCheck = await transactionLimitsService.checkLimit(
        'current_user',  // TODO: Get from auth context
        amountNum,
        'USD',
        recipient,
        'transfer',
        false,  // isInternational
        true    // enableFraudCheck
      );

      if (!limitCheck.allowed) {
        setIsLoading(false);
        Alert.alert('Transaction Blocked', limitCheck.reason || 'Transaction not allowed');
        return;
      }

      // Show risk score if medium or high risk
      const riskScore = limitCheck.fraudCheck?.risk_score || 0;
      const explanation = limitCheck.fraudCheck?.explanation || limitCheck.reason || '';
      const patterns = limitCheck.fraudCheck?.suspicious_patterns || [];

      if (riskScore >= 30) {
        setRiskScore(riskScore);
        setRiskExplanation(explanation);
        setSuspiciousPatterns(patterns);
        setShowRiskScore(true);
        setIsLoading(false);

        // Ask user to confirm if they want to proceed
        Alert.alert(
          'Transaction Risk Detected',
          `This transaction has a ${riskScore >= 70 ? 'high' : 'medium'} fraud risk score (${riskScore}/100). ${explanation}\n\nDo you want to proceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setShowRiskScore(false) },
            { text: 'Continue', onPress: () => proceedWithTransaction(amountNum) },
          ]
        );
        return;
      }

      // Low risk - proceed directly
      await proceedWithTransaction(amountNum);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to check transaction risk. Please try again.');
      return;
    }
  };

  const proceedWithTransaction = async (amountNum: number) => {

    try {
      setIsLoading(true);

      // Authenticate with biometric (required for all transactions)
      const authenticated = await requireBiometricForTransaction(amountNum, 0);
      if (!authenticated) {
        Alert.alert('Authentication Failed', 'Biometric authentication is required for this transaction');
        return;
      }

      setIsLoading(true);

      // Send money
      const payment = await paymentService.sendMoney({
        amount: amountNum,
        currency: 'USD',
        payment_method_id: 'default',
        recipient_account: recipient,
        description: description || 'Money transfer',
      });

      setIsLoading(false);

      // Navigate to receipt
      router.push({
        pathname: '/(payment)/receipt',
        params: {
          payment_id: payment.id,
          amount: amountNum.toString(),
          recipient,
        },
      });
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Failed to send money');
    }
  };

  return (
    <>
      <TutorialOverlay
        tutorialKey="payment_send"
        steps={tutorialSteps}
        autoStart={true}
      />
      <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Amount Input */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Amount</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
              <Text className="text-2xl font-bold text-foreground mr-2">$</Text>
              <TextInput
                className="flex-1 text-2xl font-bold text-foreground"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* Recipient Input */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Recipient</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="Email or phone number"
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Account Selection */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">From Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    className={`bg-surface border rounded-xl p-4 min-w-[150px] ${
                      selectedAccount === account.id ? 'border-primary' : 'border-border'
                    }`}
                    onPress={() => setSelectedAccount(account.id)}
                  >
                    <Text className="text-foreground font-medium capitalize">
                      {account.account_type}
                    </Text>
                    <Text className="text-muted text-sm">{account.account_number}</Text>
                    <Text className="text-foreground font-semibold mt-2">
                      ${account.balance.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Description Input */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Description (Optional)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="What's this for?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            className={`bg-primary rounded-xl p-4 items-center ${
              isLoading || !amount || !recipient ? 'opacity-50' : ''
            }`}
            onPress={handleSend}
            disabled={isLoading || !amount || !recipient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background font-semibold text-lg">Send Money</Text>
            )}
          </TouchableOpacity>

          {/* Quick Amounts */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Quick Amounts</Text>
            <View className="flex-row gap-3">
              {['10', '25', '50', '100'].map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  className="flex-1 bg-surface border border-border rounded-xl p-3 items-center"
                  onPress={() => setAmount(quickAmount)}
                >
                  <Text className="text-foreground font-medium">${quickAmount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
    </>
  );
}
