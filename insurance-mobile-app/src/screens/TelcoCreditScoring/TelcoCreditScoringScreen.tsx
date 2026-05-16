import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CreditScoreResult {
  creditScore: number;
  scoreCategory: string;
  riskLevel: string;
  maxLoanAmount: number;
  recommendedInterestRate: number;
  approvalProbability: number;
  components: {
    paymentHistory: number;
    accountAge: number;
    spendingConsistency: number;
    usagePattern: number;
    accountHealth: number;
  };
  riskFactors: string[];
  positiveFactors: string[];
  telcoData: {
    provider: string;
    accountAgeMonths: number;
    avgMonthlyAirtime: number;
    avgMonthlyData: number;
    paymentConsistencyScore: number;
    latePaymentCount: number;
  };
}

const TelcoCreditScoringScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CreditScoreResult | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const detectProvider = (phone: string): string => {
    const prefixes: Record<string, string[]> = {
      MTN: ['0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906'],
      Airtel: ['0802', '0808', '0812', '0901', '0902', '0904', '0907'],
      Glo: ['0805', '0807', '0811', '0815', '0905', '0915'],
      '9mobile': ['0809', '0817', '0818', '0908', '0909'],
    };

    for (const [provider, prefixList] of Object.entries(prefixes)) {
      if (prefixList.some((prefix) => phone.startsWith(prefix))) {
        return provider;
      }
    }
    return 'Unknown';
  };

  const calculateCreditScore = async () => {
    if (!phoneNumber || phoneNumber.length < 11) {
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const provider = detectProvider(phoneNumber);
    const seed = phoneNumber.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const isGoodCustomer = seed % 10 > 3;

    const mockResult: CreditScoreResult = {
      creditScore: isGoodCustomer ? 650 + (seed % 150) : 400 + (seed % 150),
      scoreCategory: isGoodCustomer ? 'Good' : 'Fair',
      riskLevel: isGoodCustomer ? 'Low' : 'Medium',
      maxLoanAmount: isGoodCustomer ? 500000 + (seed % 500000) : 100000 + (seed % 200000),
      recommendedInterestRate: isGoodCustomer ? 12 + (seed % 5) : 18 + (seed % 8),
      approvalProbability: isGoodCustomer ? 75 + (seed % 20) : 40 + (seed % 30),
      components: {
        paymentHistory: isGoodCustomer ? 80 + (seed % 15) : 50 + (seed % 25),
        accountAge: 60 + (seed % 35),
        spendingConsistency: isGoodCustomer ? 75 + (seed % 20) : 45 + (seed % 30),
        usagePattern: 65 + (seed % 30),
        accountHealth: isGoodCustomer ? 85 + (seed % 10) : 55 + (seed % 25),
      },
      riskFactors: isGoodCustomer
        ? ['Moderate data usage variability']
        : ['Multiple late payments', 'Low spending consistency', 'Short account history'],
      positiveFactors: isGoodCustomer
        ? ['Consistent payments', 'Long tenure', 'High spending capacity', 'Regular usage']
        : ['Active account', 'Regular top-ups'],
      telcoData: {
        provider,
        accountAgeMonths: 12 + (seed % 60),
        avgMonthlyAirtime: isGoodCustomer ? 5000 + (seed % 5000) : 1000 + (seed % 2000),
        avgMonthlyData: isGoodCustomer ? 3000 + (seed % 3000) : 500 + (seed % 1000),
        paymentConsistencyScore: isGoodCustomer ? 80 + (seed % 15) : 50 + (seed % 25),
        latePaymentCount: isGoodCustomer ? seed % 3 : 3 + (seed % 5),
      },
    };

    setResult(mockResult);
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 750) return '#22c55e';
    if (score >= 650) return '#3b82f6';
    if (score >= 550) return '#eab308';
    return '#ef4444';
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return '#22c55e';
      case 'medium': return '#eab308';
      case 'high': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const ProgressBar = ({ value, label, weight }: { value: number; label: string; weight: string }) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label} ({weight})</Text>
        <Text style={styles.progressValue}>{value}/100</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: getScoreColor(value * 8.5) }]} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Alternative Credit Scoring</Text>
          <Text style={styles.subtitle}>Get your credit score using telco data</Text>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Nigerian Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="08012345678"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={11}
          />
          {phoneNumber.length >= 4 && (
            <Text style={styles.providerText}>
              Detected Provider: <Text style={styles.providerName}>{detectProvider(phoneNumber)}</Text>
            </Text>
          )}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={calculateCreditScore}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Calculate Score</Text>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <>
            <View style={styles.tabContainer}>
              {['overview', 'components', 'telco'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'overview' && (
              <>
                <View style={[styles.scoreCard, { backgroundColor: getScoreColor(result.creditScore) + '20' }]}>
                  <Text style={styles.scoreLabel}>Your Credit Score</Text>
                  <Text style={[styles.scoreValue, { color: getScoreColor(result.creditScore) }]}>
                    {result.creditScore}
                  </Text>
                  <Text style={styles.scoreMax}>out of 850</Text>
                  <View style={[styles.badge, { backgroundColor: getScoreColor(result.creditScore) }]}>
                    <Text style={styles.badgeText}>{result.scoreCategory}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Risk Level</Text>
                    <View style={[styles.riskBadge, { backgroundColor: getRiskColor(result.riskLevel) }]}>
                      <Text style={styles.riskText}>{result.riskLevel}</Text>
                    </View>
                    <Text style={styles.infoSubtext}>
                      Approval: {result.approvalProbability}%
                    </Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Max Loan</Text>
                    <Text style={styles.loanAmount}>
                      ₦{result.maxLoanAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.infoSubtext}>
                      Rate: {result.recommendedInterestRate}%
                    </Text>
                  </View>
                </View>

                <View style={styles.factorsCard}>
                  <Text style={styles.factorsTitle}>Risk Factors</Text>
                  {result.riskFactors.map((factor, index) => (
                    <View key={index} style={styles.factorRow}>
                      <Text style={styles.factorIcon}>⚠️</Text>
                      <Text style={styles.factorText}>{factor}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.factorsCard}>
                  <Text style={[styles.factorsTitle, { color: '#22c55e' }]}>Positive Factors</Text>
                  {result.positiveFactors.map((factor, index) => (
                    <View key={index} style={styles.factorRow}>
                      <Text style={styles.factorIcon}>✓</Text>
                      <Text style={styles.factorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {activeTab === 'components' && (
              <View style={styles.componentsCard}>
                <Text style={styles.componentsTitle}>Score Components</Text>
                <ProgressBar value={result.components.paymentHistory} label="Payment History" weight="35%" />
                <ProgressBar value={result.components.spendingConsistency} label="Spending Consistency" weight="30%" />
                <ProgressBar value={result.components.accountAge} label="Account Age" weight="15%" />
                <ProgressBar value={result.components.usagePattern} label="Usage Pattern" weight="10%" />
                <ProgressBar value={result.components.accountHealth} label="Account Health" weight="10%" />
              </View>
            )}

            {activeTab === 'telco' && (
              <View style={styles.telcoCard}>
                <Text style={styles.telcoTitle}>Telco Data Analysis</Text>
                <Text style={styles.telcoSubtitle}>Data from {result.telcoData.provider}</Text>
                
                <View style={styles.telcoGrid}>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Provider</Text>
                    <Text style={styles.telcoValue}>{result.telcoData.provider}</Text>
                  </View>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Account Age</Text>
                    <Text style={styles.telcoValue}>{result.telcoData.accountAgeMonths} months</Text>
                  </View>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Avg Airtime</Text>
                    <Text style={styles.telcoValue}>₦{result.telcoData.avgMonthlyAirtime.toLocaleString()}</Text>
                  </View>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Avg Data</Text>
                    <Text style={styles.telcoValue}>₦{result.telcoData.avgMonthlyData.toLocaleString()}</Text>
                  </View>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Payment Score</Text>
                    <Text style={styles.telcoValue}>{result.telcoData.paymentConsistencyScore}%</Text>
                  </View>
                  <View style={styles.telcoItem}>
                    <Text style={styles.telcoLabel}>Late Payments</Text>
                    <Text style={styles.telcoValue}>{result.telcoData.latePaymentCount}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {!result && (
          <View style={styles.howItWorks}>
            <Text style={styles.howTitle}>How It Works</Text>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Enter Phone Number</Text>
                <Text style={styles.stepDesc}>Provide your Nigerian mobile number</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Data Analysis</Text>
                <Text style={styles.stepDesc}>We analyze your telco usage patterns</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>AI Scoring</Text>
                <Text style={styles.stepDesc}>ML models calculate your credit score</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Get Results</Text>
                <Text style={styles.stepDesc}>Receive your score and loan eligibility</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  providerText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  providerName: {
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  scoreCard: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#374151',
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 14,
    color: '#6b7280',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  riskBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 8,
  },
  riskText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loanAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
    marginVertical: 8,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  factorsCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  factorsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  factorIcon: {
    marginRight: 8,
  },
  factorText: {
    fontSize: 14,
    color: '#374151',
  },
  componentsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  componentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 14,
    color: '#374151',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  telcoCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  telcoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  telcoSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  telcoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  telcoItem: {
    width: '47%',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
  },
  telcoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  telcoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 4,
  },
  howItWorks: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  howTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default TelcoCreditScoringScreen;
