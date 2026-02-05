import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOANS_KEY = 'loanApplications';

const loanPurposes = [
  'Personal',
  'Business',
  'Education',
  'Medical',
  'Home Improvement',
  'Debt Consolidation',
  'Other',
];

const loanTerms = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
  { value: 48, label: '48 months' },
];

export default function ApplyLoanScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Loan Details
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState(12);
  const [purpose, setPurpose] = useState('Personal');

  // Step 2: Income Verification
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('employed');
  const [employer, setEmployer] = useState('');

  // Step 3: Document Upload
  const [documents, setDocuments] = useState<{ name: string; uri: string }[]>([]);

  const calculateMonthlyPayment = (principal: number, months: number, rate: number): number => {
    const monthlyRate = rate / 12 / 100;
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                   (Math.pow(1 + monthlyRate, months) - 1);
    return payment;
  };

  const getInterestRate = (loanAmount: number): number => {
    // Simple tiered interest rate
    if (loanAmount < 5000) return 8.5;
    if (loanAmount < 10000) return 7.5;
    if (loanAmount < 25000) return 6.5;
    return 5.5;
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        setDocuments([...documents, { name: doc.name, uri: doc.uri }]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSubmit = async () => {
    const loanAmount = parseFloat(amount);
    
    if (!amount || loanAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid loan amount');
      return;
    }

    if (!monthlyIncome || parseFloat(monthlyIncome) <= 0) {
      Alert.alert('Error', 'Please enter your monthly income');
      return;
    }

    if (employmentStatus === 'employed' && !employer) {
      Alert.alert('Error', 'Please enter your employer name');
      return;
    }

    if (documents.length === 0) {
      Alert.alert('Error', 'Please upload at least one document');
      return;
    }

    try {
      setIsSubmitting(true);

      const interestRate = getInterestRate(loanAmount);
      const monthlyPayment = calculateMonthlyPayment(loanAmount, term, interestRate);

      // Load existing loans
      const stored = await AsyncStorage.getItem(LOANS_KEY);
      const loans = stored ? JSON.parse(stored) : [];

      // Create new loan application
      const newLoan = {
        id: Date.now().toString(),
        amount: loanAmount,
        term,
        purpose,
        status: 'pending' as const,
        interestRate,
        monthlyPayment,
        appliedAt: new Date().toISOString(),
        monthlyIncome: parseFloat(monthlyIncome),
        employmentStatus,
        employer,
        documents: documents.map(d => d.name),
      };

      loans.push(newLoan);
      await AsyncStorage.setItem(LOANS_KEY, JSON.stringify(loans));

      Alert.alert(
        'Application Submitted',
        'Your loan application has been submitted successfully. We will review it and get back to you within 2-3 business days.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to submit loan application:', error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => {
    const loanAmount = parseFloat(amount) || 0;
    const interestRate = getInterestRate(loanAmount);
    const monthlyPayment = loanAmount > 0 ? calculateMonthlyPayment(loanAmount, term, interestRate) : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-foreground font-bold text-2xl mb-2">Loan Details</Text>
        <Text className="text-muted mb-6">
          Tell us how much you need and for how long
        </Text>

        {/* Loan Amount */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Loan Amount *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-2xl font-bold mr-2">$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-2xl font-bold"
            />
          </View>
        </View>

        {/* Loan Term */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Loan Term *</Text>
          <View className="flex-row flex-wrap gap-2">
            {loanTerms.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setTerm(t.value)}
                className={`px-4 py-3 rounded-xl ${
                  term === t.value
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`font-medium ${
                    term === t.value ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Purpose */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Purpose *</Text>
          <View className="flex-row flex-wrap gap-2">
            {loanPurposes.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPurpose(p)}
                className={`px-4 py-2 rounded-xl ${
                  purpose === p
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`font-medium ${
                    purpose === p ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Loan Summary */}
        {loanAmount > 0 && (
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <Text className="text-foreground font-semibold mb-3">Loan Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Interest Rate</Text>
              <Text className="text-foreground font-semibold">{interestRate}% APR</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Monthly Payment</Text>
              <Text className="text-primary font-bold text-lg">
                ${monthlyPayment.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted">Total Repayment</Text>
              <Text className="text-foreground font-semibold">
                ${(monthlyPayment * term).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setStep(2)}
          disabled={!amount || parseFloat(amount) <= 0}
          className="bg-primary rounded-xl p-4"
          style={{ opacity: !amount || parseFloat(amount) <= 0 ? 0.5 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Continue
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text className="text-foreground font-bold text-2xl mb-2">Income Verification</Text>
      <Text className="text-muted mb-6">
        Help us verify your ability to repay
      </Text>

      {/* Monthly Income */}
      <View className="mb-4">
        <Text className="text-foreground font-semibold mb-2">Monthly Income *</Text>
        <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
          <Text className="text-foreground text-xl font-bold mr-2">$</Text>
          <TextInput
            value={monthlyIncome}
            onChangeText={setMonthlyIncome}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor="#9BA1A6"
            className="flex-1 text-foreground text-xl font-bold"
          />
        </View>
      </View>

      {/* Employment Status */}
      <View className="mb-4">
        <Text className="text-foreground font-semibold mb-2">Employment Status *</Text>
        <View className="flex-row gap-2">
          {['employed', 'self-employed', 'unemployed'].map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => setEmploymentStatus(status)}
              className={`flex-1 px-4 py-3 rounded-xl ${
                employmentStatus === status
                  ? 'bg-primary'
                  : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-medium ${
                  employmentStatus === status ? 'text-white' : 'text-foreground'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Employer */}
      {employmentStatus === 'employed' && (
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Employer Name *</Text>
          <TextInput
            value={employer}
            onChangeText={setEmployer}
            placeholder="Company Name"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>
      )}

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => setStep(1)}
          className="flex-1 bg-surface border border-border rounded-xl p-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStep(3)}
          disabled={!monthlyIncome || (employmentStatus === 'employed' && !employer)}
          className="flex-1 bg-primary rounded-xl p-4"
          style={{ opacity: !monthlyIncome || (employmentStatus === 'employed' && !employer) ? 0.5 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text className="text-foreground font-bold text-2xl mb-2">Document Upload</Text>
      <Text className="text-muted mb-6">
        Upload documents to verify your identity and income
      </Text>

      {/* Document List */}
      {documents.length > 0 && (
        <View className="mb-4">
          {documents.map((doc, index) => (
            <View
              key={index}
              className="bg-surface rounded-xl p-4 mb-2 flex-row items-center justify-between border border-border"
            >
              <View className="flex-1">
                <Text className="text-foreground font-medium">{doc.name}</Text>
                <Text className="text-muted text-xs mt-1">Uploaded</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDocuments(documents.filter((_, i) => i !== index))}
                className="bg-error/20 rounded-full w-8 h-8 items-center justify-center"
                style={{ opacity: 1 }}
              >
                <Text className="text-error font-bold">×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Upload Button */}
      <TouchableOpacity
        onPress={handleDocumentPick}
        className="bg-primary/20 border-2 border-dashed border-primary rounded-xl p-6 mb-6 items-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-primary text-4xl mb-2">📄</Text>
        <Text className="text-primary font-semibold text-lg mb-1">
          Upload Document
        </Text>
        <Text className="text-muted text-sm text-center">
          ID, Pay Stub, Bank Statement, or Tax Return
        </Text>
      </TouchableOpacity>

      {/* Required Documents */}
      <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
        <Text className="text-foreground font-semibold mb-2">Required Documents</Text>
        <Text className="text-muted text-sm mb-2">• Government-issued ID</Text>
        <Text className="text-muted text-sm mb-2">• Proof of income (pay stub or bank statement)</Text>
        <Text className="text-muted text-sm">• Proof of address (utility bill)</Text>
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => setStep(2)}
          className="flex-1 bg-surface border border-border rounded-xl p-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={documents.length === 0 || isSubmitting}
          className="flex-1 bg-primary rounded-xl p-4"
          style={{ opacity: documents.length === 0 || isSubmitting ? 0.5 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Apply for Loan', headerShown: true }} />

      {/* Progress Indicator */}
      <View className="flex-row items-center mb-6">
        {[1, 2, 3].map(s => (
          <View key={s} className="flex-1 flex-row items-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                s <= step ? 'bg-primary' : 'bg-border'
              }`}
            >
              <Text
                className={`font-bold ${
                  s <= step ? 'text-white' : 'text-muted'
                }`}
              >
                {s}
              </Text>
            </View>
            {s < 3 && (
              <View
                className={`flex-1 h-1 mx-2 ${
                  s < step ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </View>
        ))}
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </ScreenContainer>
  );
}
