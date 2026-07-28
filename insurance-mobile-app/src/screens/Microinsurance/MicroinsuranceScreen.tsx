import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface MicroProduct {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPremium: { min: number; max: number };
  coverage: { min: number; max: number };
  features: string[];
  category: string;
  isParametric?: boolean;
}

const microProducts: MicroProduct[] = [
  {
    id: 'funeral',
    name: 'Funeral Cover',
    description: 'Dignified send-off for your loved ones',
    icon: 'account-group',
    monthlyPremium: { min: 50, max: 500 },
    coverage: { min: 50000, max: 500000 },
    features: ['Immediate family coverage', '24-hour claim payout', 'No medical exam', 'Covers up to 6 family members'],
    category: 'Life',
  },
  {
    id: 'hospital-cash',
    name: 'Hospital Cash',
    description: 'Daily cash benefit during hospitalization',
    icon: 'hospital-building',
    monthlyPremium: { min: 100, max: 300 },
    coverage: { min: 2000, max: 5000 },
    features: ['N2,000-5,000 daily benefit', 'Up to 30 days coverage', 'No hospital restrictions', 'Covers accidents & illness'],
    category: 'Health',
  },
  {
    id: 'personal-accident',
    name: 'Personal Accident',
    description: 'Protection against accidental death & disability',
    icon: 'shield-account',
    monthlyPremium: { min: 50, max: 200 },
    coverage: { min: 100000, max: 1000000 },
    features: ['Accidental death benefit', 'Permanent disability cover', 'Medical expense reimbursement', '24/7 coverage worldwide'],
    category: 'Life',
  },
  {
    id: 'crop-insurance',
    name: 'Crop Insurance',
    description: 'Weather-indexed protection for your harvest',
    icon: 'sprout',
    monthlyPremium: { min: 200, max: 1000 },
    coverage: { min: 50000, max: 500000 },
    features: ['Automatic payout on weather trigger', 'No loss assessment needed', 'Covers drought & flood', 'Satellite-verified claims'],
    category: 'Agricultural',
    isParametric: true,
  },
  {
    id: 'livestock',
    name: 'Livestock Insurance',
    description: 'Protect your cattle, goats, and poultry',
    icon: 'cow',
    monthlyPremium: { min: 100, max: 500 },
    coverage: { min: 20000, max: 200000 },
    features: ['Covers death from disease', 'Theft protection', 'Natural disaster coverage', 'Veterinary expense benefit'],
    category: 'Agricultural',
  },
  {
    id: 'mobile-credit-life',
    name: 'Mobile Credit Life',
    description: 'Loan protection tied to your mobile money',
    icon: 'cellphone',
    monthlyPremium: { min: 20, max: 100 },
    coverage: { min: 10000, max: 100000 },
    features: ['Clears loan on death', 'Disability coverage', 'Auto-deducted from airtime', 'Instant activation'],
    category: 'Life',
  },
];

interface UnderwritingResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  fraudScore: number;
  fraudRisk: 'low' | 'medium' | 'high';
  creditScore: number;
  geoRiskScore: number;
  adjustedPremium: number;
  basePremium: number;
  premiumMultiplier: number;
  factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; value: string }[];
  approved: boolean;
  declineReason?: string;
}

export default function MicroinsuranceScreen() {
  const [activeTab, setActiveTab] = useState<'products' | 'ussd' | 'whatsapp' | 'telegram' | 'claims'>('products');
  const [selectedProduct, setSelectedProduct] = useState<MicroProduct | null>(null);
  const [ussdInput, setUssdInput] = useState('');
  const [ussdMessages, setUssdMessages] = useState<string[]>([]);
  const [enrollmentStep, setEnrollmentStep] = useState(0);
  const [underwritingResult, setUnderwritingResult] = useState<UnderwritingResult | null>(null);
  const [isUnderwriting, setIsUnderwriting] = useState(false);

  // WhatsApp Integration State
  const [whatsappMessages, setWhatsappMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [whatsappInput, setWhatsappInput] = useState('');

  // Telegram Integration State
  const [telegramMessages, setTelegramMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [telegramInput, setTelegramInput] = useState('');

  // MCMC State
  const [mcmcResult, setMcmcResult] = useState<{
    posteriorMean: number;
    posteriorStd: number;
    credibleInterval: [number, number];
    chainConverged: boolean;
  } | null>(null);
  const [isRunningMCMC, setIsRunningMCMC] = useState(false);

  // Smart Document Upload State
  const [documentVerified, setDocumentVerified] = useState(false);
  const [isVerifyingDocument, setIsVerifyingDocument] = useState(false);

  // WhatsApp Bot Handler
  const handleWhatsappMessage = () => {
    if (!whatsappInput.trim()) return;
    
    setWhatsappMessages(prev => [...prev, { sender: 'user', text: whatsappInput }]);
    const input = whatsappInput.toLowerCase();
    setWhatsappInput('');

    setTimeout(() => {
      let botResponse = '';
      if (input.includes('enroll') || input === '1') {
        botResponse = 'Welcome to InsurePortal! To enroll:\n\n1. Your NIN (11 digits)\n2. Your phone number\n3. Select product:\n   - FUNERAL\n   - HOSPITAL\n   - ACCIDENT';
      } else if (input.includes('funeral')) {
        botResponse = 'FUNERAL COVER selected.\n\nOptions:\n1. N50,000 - N50/month\n2. N100,000 - N100/month\n3. N250,000 - N250/month';
      } else if (input.includes('claim') || input === '2') {
        botResponse = 'To file a claim:\n\n1. Send a photo of document\n2. Describe the incident\n3. We process within 24 hours';
      } else {
        botResponse = 'Welcome! Reply with:\n\n1 - Enroll\n2 - File Claim\n3 - Policy Status\n0 - Help';
      }
      setWhatsappMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 800);
  };

  // Telegram Bot Handler
  const handleTelegramMessage = () => {
    if (!telegramInput.trim()) return;
    
    setTelegramMessages(prev => [...prev, { sender: 'user', text: telegramInput }]);
    const input = telegramInput.toLowerCase();
    setTelegramInput('');

    setTimeout(() => {
      let botResponse = '';
      if (input.includes('/start')) {
        botResponse = 'Welcome to InsurePortal Bot!\n\n/enroll - Get insured\n/claim - File a claim\n/status - Check policies\n/help - Get assistance';
      } else if (input.includes('/enroll')) {
        botResponse = 'Let\'s get you enrolled!\n\nPlease share your NIN to begin verification.';
      } else {
        botResponse = 'Try:\n/start - Main menu\n/enroll - Get insured\n/claim - File claim';
      }
      setTelegramMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 600);
  };

  // MCMC Risk Modeling
  const runMCMCRiskModel = async () => {
    setIsRunningMCMC(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setMcmcResult({
      posteriorMean: 42.5,
      posteriorStd: 8.3,
      credibleInterval: [28, 58],
      chainConverged: true,
    });
    setIsRunningMCMC(false);
  };

  // Smart Document Verification
  const verifyDocument = async () => {
    setIsVerifyingDocument(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setDocumentVerified(true);
    setIsVerifyingDocument(false);
    Alert.alert('Document Verified', 'Your NIN has been verified successfully. Form fields have been auto-filled.');
  };

  const runUnderwriting = async () => {
    if (!selectedProduct) return;
    setIsUnderwriting(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; value: string }[] = [];
    
    const ageRisk = 1.0;
    factors.push({ name: 'Age Factor', impact: 'positive', value: 'Prime age (no adjustment)' });
    
    const occupationRisk = 1.0;
    factors.push({ name: 'Occupation Risk', impact: 'neutral', value: 'Standard rate' });
    
    const geoRiskScore = 45;
    factors.push({ name: 'Geographic Risk', impact: 'positive', value: 'Low risk zone' });
    
    const telcoCreditScore = Math.floor(Math.random() * 200) + 500;
    if (telcoCreditScore >= 650) {
      factors.push({ name: 'Telco Credit Score', impact: 'positive', value: `${telcoCreditScore} (Excellent - 10% discount)` });
    } else if (telcoCreditScore >= 550) {
      factors.push({ name: 'Telco Credit Score', impact: 'neutral', value: `${telcoCreditScore} (Good - standard rate)` });
    } else {
      factors.push({ name: 'Telco Credit Score', impact: 'negative', value: `${telcoCreditScore} (Fair - 15% premium)` });
    }
    
    const fraudScore = Math.floor(Math.random() * 30);
    factors.push({ name: 'Fraud Detection (GNN)', impact: 'positive', value: 'No fraud indicators' });
    
    factors.push({ name: 'Claims History', impact: 'positive', value: 'No prior claims (5% discount)' });
    
    let premiumMultiplier = ageRisk * occupationRisk;
    if (telcoCreditScore >= 650) premiumMultiplier *= 0.9;
    premiumMultiplier *= 0.95;
    
    const basePremium = selectedProduct.monthlyPremium.min * 2;
    const adjustedPremium = Math.round(basePremium * premiumMultiplier);
    
    const riskScore = 35;
    
    setUnderwritingResult({
      riskScore,
      riskLevel: 'low',
      fraudScore,
      fraudRisk: 'low',
      creditScore: telcoCreditScore,
      geoRiskScore,
      adjustedPremium,
      basePremium,
      premiumMultiplier,
      factors,
      approved: true,
      declineReason: undefined,
    });
    
    setIsUnderwriting(false);
  };

  const handleProductSelect = (product: MicroProduct) => {
    setSelectedProduct(product);
    setEnrollmentStep(1);
  };

  const handleUssdInput = () => {
    if (!ussdInput) return;
    
    const newMessages = [...ussdMessages];
    newMessages.push(`> ${ussdInput}`);
    
    if (ussdMessages.length === 0) {
      newMessages.push('Welcome to InsurePortal Microinsurance');
      newMessages.push('1. Funeral Cover (N50-500/month)');
      newMessages.push('2. Hospital Cash (N100-300/month)');
      newMessages.push('3. Personal Accident (N50-200/month)');
      newMessages.push('4. Crop Insurance (N200-1000/month)');
      newMessages.push('5. Check My Policies');
      newMessages.push('6. File a Claim');
    } else if (ussdInput === '1' && ussdMessages.length < 10) {
      newMessages.push('FUNERAL COVER');
      newMessages.push('Select coverage amount:');
      newMessages.push('1. N50,000 (N50/month)');
      newMessages.push('2. N100,000 (N100/month)');
      newMessages.push('3. N200,000 (N200/month)');
      newMessages.push('4. N500,000 (N500/month)');
    } else if (['1', '2', '3', '4'].includes(ussdInput) && ussdMessages.length > 5) {
      newMessages.push('Enter beneficiary phone number:');
    } else if (ussdInput.startsWith('080') || ussdInput.startsWith('090') || ussdInput.startsWith('070')) {
      newMessages.push('Payment method:');
      newMessages.push('1. Airtime deduction');
      newMessages.push('2. Mobile money (OPay)');
      newMessages.push('3. Bank transfer');
    } else if (ussdInput === '1' && ussdMessages.length > 15) {
      newMessages.push('Policy activated!');
      newMessages.push('Policy No: MIC-2026-' + Math.random().toString(36).substr(2, 6).toUpperCase());
      newMessages.push('Premium: N100/month');
      newMessages.push('Coverage: N100,000');
      newMessages.push('SMS confirmation sent to your phone.');
    }
    
    setUssdMessages(newMessages);
    setUssdInput('');
  };

  const renderProductCard = (product: MicroProduct) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => handleProductSelect(product)}
    >
      <View style={styles.productHeader}>
        <View style={styles.productIconContainer}>
          <Icon name={product.icon} size={24} color="#2563eb" />
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{product.category}</Text>
        </View>
      </View>
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.productDescription}>{product.description}</Text>
      <View style={styles.productDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Premium:</Text>
          <Text style={styles.detailValue}>N{product.monthlyPremium.min}-{product.monthlyPremium.max}/mo</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Coverage:</Text>
          <Text style={styles.detailValue}>Up to N{product.coverage.max.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.featuresList}>
        {product.features.slice(0, 2).map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <Icon name="check-circle" size={14} color="#22c55e" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      {product.isParametric && (
        <View style={styles.parametricBadge}>
          <Icon name="cloud-sync" size={14} color="#2563eb" />
          <Text style={styles.parametricText}>Auto Payout</Text>
        </View>
      )}
      <TouchableOpacity style={styles.getStartedButton}>
        <Text style={styles.getStartedText}>Get Covered</Text>
        <Icon name="arrow-right" size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEnrollmentForm = () => {
    if (!selectedProduct) return null;

    return (
      <View style={styles.enrollmentContainer}>
        <View style={styles.enrollmentHeader}>
          <TouchableOpacity onPress={() => setSelectedProduct(null)}>
            <Icon name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.enrollmentTitle}>Enroll in {selectedProduct.name}</Text>
        </View>

                <View style={styles.stepsIndicator}>
                  {[1, 2, 3, 4, 5].map((step) => (
                    <View key={step} style={styles.stepContainer}>
                      <View style={[styles.stepCircle, enrollmentStep >= step && styles.stepCircleActive]}>
                        {enrollmentStep > step ? (
                          <Icon name="check" size={14} color="#fff" />
                        ) : (
                          <Text style={[styles.stepNumber, enrollmentStep >= step && styles.stepNumberActive]}>{step}</Text>
                        )}
                      </View>
                      {step < 5 && <View style={[styles.stepLine, enrollmentStep > step && styles.stepLineActive]} />}
                    </View>
                  ))}
                </View>
                <Text style={styles.stepLabel}>Step {enrollmentStep} of 5</Text>

        {enrollmentStep === 1 && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Step 1: Basic Information (Lite KYC)</Text>
            <Text style={styles.sectionSubtitle}>We only need your phone number and NIN - no complex paperwork!</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput style={styles.input} placeholder="08012345678" keyboardType="phone-pad" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NIN (National ID) *</Text>
              <TextInput style={styles.input} placeholder="12345678901" keyboardType="number-pad" maxLength={11} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="Enter your full name" />
            </View>

            <View style={styles.liteKycBadge}>
              <Icon name="check-circle" size={20} color="#22c55e" />
              <View style={styles.liteKycText}>
                <Text style={styles.liteKycTitle}>Lite KYC - No documents required!</Text>
                <Text style={styles.liteKycSubtitle}>Your identity will be verified instantly using your NIN and phone number.</Text>
              </View>
            </View>
          </View>
        )}

        {enrollmentStep === 2 && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Step 2: Coverage Selection</Text>
            
            <View style={styles.coverageOptions}>
              {[
                { tier: 'tier1', amount: selectedProduct.coverage.min, premium: selectedProduct.monthlyPremium.min },
                { tier: 'tier2', amount: selectedProduct.coverage.min * 2, premium: selectedProduct.monthlyPremium.min * 2 },
                { tier: 'tier3', amount: selectedProduct.coverage.max / 2, premium: selectedProduct.monthlyPremium.max / 2, popular: true },
                { tier: 'tier4', amount: selectedProduct.coverage.max, premium: selectedProduct.monthlyPremium.max },
              ].map((option) => (
                <TouchableOpacity key={option.tier} style={[styles.coverageOption, option.popular && styles.coverageOptionPopular]}>
                  <View style={styles.coverageOptionContent}>
                    <Text style={styles.coverageAmount}>N{option.amount.toLocaleString()}</Text>
                    <Text style={styles.coveragePremium}>N{option.premium}/month</Text>
                    {option.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>Most Popular</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {selectedProduct.isParametric && (
              <View style={styles.parametricInfo}>
                <View style={styles.parametricInfoHeader}>
                  <Icon name="cloud" size={20} color="#2563eb" />
                  <Text style={styles.parametricInfoTitle}>Parametric Insurance - Automatic Payouts</Text>
                </View>
                <Text style={styles.parametricInfoText}>
                  Your payout is triggered automatically when weather conditions meet these thresholds:
                </Text>
                <View style={styles.thresholdGrid}>
                  <View style={styles.thresholdItem}>
                    <Icon name="water-off" size={24} color="#2563eb" />
                    <Text style={styles.thresholdLabel}>Drought</Text>
                    <Text style={styles.thresholdValue}>&lt;50mm/month</Text>
                  </View>
                  <View style={styles.thresholdItem}>
                    <Icon name="weather-pouring" size={24} color="#6b7280" />
                    <Text style={styles.thresholdLabel}>Flood</Text>
                    <Text style={styles.thresholdValue}>&gt;300mm/week</Text>
                  </View>
                  <View style={styles.thresholdItem}>
                    <Icon name="thermometer-high" size={24} color="#ef4444" />
                    <Text style={styles.thresholdLabel}>Heat Wave</Text>
                    <Text style={styles.thresholdValue}>&gt;40C for 5+ days</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {enrollmentStep === 3 && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Step 3: Beneficiary & Payment</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Beneficiary Name *</Text>
              <TextInput style={styles.input} placeholder="Full name" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Beneficiary Phone *</Text>
              <TextInput style={styles.input} placeholder="08012345678" keyboardType="phone-pad" />
            </View>

            <Text style={styles.paymentTitle}>Payment Method</Text>
            {[
              { id: 'airtime', icon: 'phone', label: 'Airtime Deduction', desc: 'Auto-deduct from your airtime balance' },
              { id: 'mobile-money', icon: 'cellphone', label: 'Mobile Money', desc: 'OPay, Kuda, PalmPay' },
              { id: 'bank', icon: 'bank', label: 'Bank Transfer', desc: 'Direct debit from bank account' },
              { id: 'ussd', icon: 'dialpad', label: 'USSD Payment', desc: 'Pay via *737# or *901#' },
            ].map((method) => (
              <TouchableOpacity key={method.id} style={styles.paymentOption}>
                <Icon name={method.icon} size={24} color="#2563eb" />
                <View style={styles.paymentOptionText}>
                  <Text style={styles.paymentOptionLabel}>{method.label}</Text>
                  <Text style={styles.paymentOptionDesc}>{method.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

                {enrollmentStep === 4 && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Step 4: Risk Assessment & Underwriting</Text>
                    <Text style={styles.sectionSubtitle}>AI-powered underwriting to determine your personalized premium.</Text>
            
                    {!underwritingResult && !isUnderwriting && (
                      <View style={styles.underwritingCard}>
                        <Icon name="brain" size={48} color="#2563eb" />
                        <Text style={styles.underwritingTitle}>Ready for Risk Assessment</Text>
                        <Text style={styles.underwritingSubtitle}>This will analyze:</Text>
                        <View style={styles.underwritingFactors}>
                          <View style={styles.factorItem}>
                            <Icon name="chart-line" size={16} color="#2563eb" />
                            <Text style={styles.factorText}>Telco Credit Score</Text>
                          </View>
                          <View style={styles.factorItem}>
                            <Icon name="shield-search" size={16} color="#9333ea" />
                            <Text style={styles.factorText}>Fraud Detection (GNN)</Text>
                          </View>
                          <View style={styles.factorItem}>
                            <Icon name="map-marker" size={16} color="#22c55e" />
                            <Text style={styles.factorText}>Geographic Risk</Text>
                          </View>
                          <View style={styles.factorItem}>
                            <Icon name="account" size={16} color="#f97316" />
                            <Text style={styles.factorText}>Age & Occupation</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.runAssessmentButton} onPress={runUnderwriting}>
                          <Icon name="lightning-bolt" size={20} color="#fff" />
                          <Text style={styles.runAssessmentText}>Run Risk Assessment</Text>
                        </TouchableOpacity>
                      </View>
                    )}
            
                    {isUnderwriting && (
                      <View style={styles.underwritingCard}>
                        <Icon name="loading" size={48} color="#2563eb" />
                        <Text style={styles.underwritingTitle}>Analyzing Your Application...</Text>
                        <Text style={styles.underwritingSubtitle}>Running fraud detection, credit scoring, and risk assessment...</Text>
                      </View>
                    )}
            
                    {underwritingResult && (
                      <View style={styles.underwritingResults}>
                        <View style={styles.scoreGrid}>
                          <View style={[styles.scoreCard, { backgroundColor: '#dcfce7' }]}>
                            <Text style={styles.scoreValue}>{underwritingResult.riskScore}</Text>
                            <Text style={styles.scoreLabel}>Risk Score</Text>
                            <View style={[styles.scoreBadge, { backgroundColor: '#22c55e' }]}>
                              <Text style={styles.scoreBadgeText}>{underwritingResult.riskLevel.toUpperCase()}</Text>
                            </View>
                          </View>
                          <View style={[styles.scoreCard, { backgroundColor: '#dbeafe' }]}>
                            <Text style={styles.scoreValue}>{underwritingResult.creditScore}</Text>
                            <Text style={styles.scoreLabel}>Credit Score</Text>
                            <View style={[styles.scoreBadge, { backgroundColor: '#2563eb' }]}>
                              <Text style={styles.scoreBadgeText}>{underwritingResult.creditScore >= 650 ? 'EXCELLENT' : 'GOOD'}</Text>
                            </View>
                          </View>
                        </View>
                
                        <View style={styles.factorsCard}>
                          <Text style={styles.factorsTitle}>Risk Factors Analysis</Text>
                          {underwritingResult.factors.map((factor, idx) => (
                            <View key={idx} style={styles.factorRow}>
                              <Icon 
                                name={factor.impact === 'positive' ? 'trending-down' : factor.impact === 'negative' ? 'trending-up' : 'minus'} 
                                size={16} 
                                color={factor.impact === 'positive' ? '#22c55e' : factor.impact === 'negative' ? '#ef4444' : '#6b7280'} 
                              />
                              <Text style={styles.factorName}>{factor.name}</Text>
                              <Text style={[styles.factorValue, { color: factor.impact === 'positive' ? '#22c55e' : factor.impact === 'negative' ? '#ef4444' : '#6b7280' }]}>
                                {factor.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                
                        <View style={[styles.approvalCard, { backgroundColor: underwritingResult.approved ? '#dcfce7' : '#fee2e2' }]}>
                          <Icon 
                            name={underwritingResult.approved ? 'shield-check' : 'shield-alert'} 
                            size={40} 
                            color={underwritingResult.approved ? '#22c55e' : '#ef4444'} 
                          />
                          <Text style={styles.approvalTitle}>{underwritingResult.approved ? 'Application Approved' : 'Application Declined'}</Text>
                          {underwritingResult.approved && (
                            <View style={styles.premiumDisplay}>
                              <Text style={styles.basePremium}>N{underwritingResult.basePremium}/month</Text>
                              <Text style={styles.adjustedPremium}>N{underwritingResult.adjustedPremium}/month</Text>
                              <Text style={styles.discountText}>
                                {underwritingResult.premiumMultiplier < 1 
                                  ? `${((1 - underwritingResult.premiumMultiplier) * 100).toFixed(0)}% discount applied` 
                                  : 'Standard rate'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {enrollmentStep === 5 && (
                  <View style={styles.formSection}>
                    <View style={styles.successContainer}>
                      <Icon name="check-circle" size={64} color="#22c55e" />
                      <Text style={styles.successTitle}>Policy Ready for Activation!</Text>
                      <Text style={styles.successSubtitle}>Review your details below and confirm to activate your coverage.</Text>
              
                      <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Policy Summary</Text>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Product:</Text>
                          <Text style={styles.summaryValue}>{selectedProduct.name}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Coverage:</Text>
                          <Text style={styles.summaryValue}>N{(selectedProduct.coverage.max / 2).toLocaleString()}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Premium:</Text>
                          <Text style={styles.summaryValue}>N{underwritingResult?.adjustedPremium || (selectedProduct.monthlyPremium.max / 2)}/month</Text>
                        </View>
                      </View>

                      <TouchableOpacity style={styles.activateButton} onPress={() => Alert.alert('Success', 'Your policy has been activated!')}>
                        <Icon name="check-circle" size={20} color="#fff" />
                        <Text style={styles.activateButtonText}>Activate My Policy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.navigationButtons}>
                  {enrollmentStep > 1 && (
                    <TouchableOpacity style={styles.prevButton} onPress={() => setEnrollmentStep(enrollmentStep - 1)}>
                      <Text style={styles.prevButtonText}>Previous</Text>
                    </TouchableOpacity>
                  )}
                  {enrollmentStep === 4 && underwritingResult?.approved ? (
                    <TouchableOpacity style={styles.nextButton} onPress={() => setEnrollmentStep(5)}>
                      <Text style={styles.nextButtonText}>Continue to Review</Text>
                    </TouchableOpacity>
                  ) : enrollmentStep === 4 && !underwritingResult ? (
                    <TouchableOpacity style={[styles.nextButton, { opacity: 0.5 }]} disabled>
                      <Text style={styles.nextButtonText}>Run Assessment First</Text>
                    </TouchableOpacity>
                  ) : enrollmentStep < 4 ? (
                    <TouchableOpacity style={styles.nextButton} onPress={() => setEnrollmentStep(enrollmentStep + 1)}>
                      <Text style={styles.nextButtonText}>{enrollmentStep === 3 ? 'Risk Assessment' : 'Next'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
      </View>
    );
  };

  const renderUSSDSimulation = () => (
    <View style={styles.ussdContainer}>
      <Text style={styles.ussdTitle}>USSD Enrollment Simulation</Text>
      <Text style={styles.ussdSubtitle}>Experience how customers can enroll via USSD on feature phones. Dial *384*Insurance# to start.</Text>
      
      <View style={styles.ussdScreen}>
        {ussdMessages.length === 0 ? (
          <View style={styles.ussdPlaceholder}>
            <Text style={styles.ussdPlaceholderText}>Dial *384*Insurance# to start</Text>
            <Text style={styles.ussdPlaceholderHint}>Type "1" below and press Send to simulate</Text>
          </View>
        ) : (
          <ScrollView style={styles.ussdMessages}>
            {ussdMessages.map((msg, idx) => (
              <Text key={idx} style={[styles.ussdMessage, msg.startsWith('>') && styles.ussdMessageUser]}>
                {msg}
              </Text>
            ))}
          </ScrollView>
        )}
      </View>
      
      <View style={styles.ussdInputContainer}>
        <TextInput
          style={styles.ussdInput}
          placeholder="Enter your response..."
          value={ussdInput}
          onChangeText={setUssdInput}
          onSubmitEditing={handleUssdInput}
        />
        <TouchableOpacity style={styles.ussdSendButton} onPress={handleUssdInput}>
          <Text style={styles.ussdSendText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ussdResetButton} onPress={() => setUssdMessages([])}>
          <Text style={styles.ussdResetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.networkCodes}>
        <Text style={styles.networkCodesTitle}>USSD Codes for Different Networks</Text>
        <View style={styles.networkGrid}>
          {[
            { name: 'MTN', color: '#fbbf24' },
            { name: 'Airtel', color: '#ef4444' },
            { name: 'Glo', color: '#22c55e' },
            { name: '9mobile', color: '#8b5cf6' },
          ].map((network) => (
            <View key={network.name} style={[styles.networkItem, { backgroundColor: network.color + '20' }]}>
              <Text style={[styles.networkName, { color: network.color }]}>{network.name}</Text>
              <Text style={styles.networkCode}>*384*Insurance#</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderQuickClaims = () => (
    <View style={styles.claimsContainer}>
      <Text style={styles.claimsTitle}>Simplified Claims Process</Text>
      <Text style={styles.claimsSubtitle}>File a claim in under 2 minutes - no paperwork required!</Text>
      
      <View style={styles.claimsSteps}>
        {[
          { icon: 'phone', title: '1. Report via Phone', desc: 'Call our hotline or use USSD *384*Claim#' },
          { icon: 'camera', title: '2. Submit Photo', desc: 'Send a photo via WhatsApp or SMS' },
          { icon: 'cash', title: '3. Get Paid', desc: 'Receive payout within 24 hours' },
        ].map((step, idx) => (
          <View key={idx} style={styles.claimStep}>
            <View style={styles.claimStepIcon}>
              <Icon name={step.icon} size={32} color="#2563eb" />
            </View>
            <Text style={styles.claimStepTitle}>{step.title}</Text>
            <Text style={styles.claimStepDesc}>{step.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.parametricClaimsInfo}>
        <Icon name="alert" size={20} color="#f59e0b" />
        <View style={styles.parametricClaimsText}>
          <Text style={styles.parametricClaimsTitle}>Parametric Claims (Crop Insurance)</Text>
          <Text style={styles.parametricClaimsDesc}>
            For crop insurance, claims are processed automatically when weather triggers are met. 
            No need to file a claim - we monitor satellite data and pay you automatically!
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.fileClaimButton}>
        <Icon name="phone" size={20} color="#fff" />
        <Text style={styles.fileClaimText}>File a Claim Now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Microinsurance</Text>
          <Text style={styles.subtitle}>Affordable protection for everyone - starting from N50/month</Text>
          <View style={styles.badge}>
            <Icon name="piggy-bank" size={16} color="#2563eb" />
            <Text style={styles.badgeText}>Low-Income Friendly</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {[
            { value: 'N50', label: 'Starting premium/month', color: '#2563eb' },
            { value: '2 Min', label: 'Enrollment time', color: '#22c55e' },
            { value: '24 Hrs', label: 'Claim payout', color: '#8b5cf6' },
            { value: 'No', label: 'Documents required', color: '#f59e0b' },
          ].map((stat, idx) => (
            <View key={idx} style={[styles.statCard, { backgroundColor: stat.color + '10' }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {selectedProduct ? (
          renderEnrollmentForm()
        ) : (
          <>
                        <View style={styles.tabs}>
                          {[
                            { id: 'products', label: 'Products' },
                            { id: 'ussd', label: 'USSD' },
                            { id: 'whatsapp', label: 'WhatsApp' },
                            { id: 'telegram', label: 'Telegram' },
                            { id: 'claims', label: 'Claims' },
                          ].map((tab) => (
                            <TouchableOpacity
                              key={tab.id}
                              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                              onPress={() => setActiveTab(tab.id as any)}
                            >
                              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {activeTab === 'products' && (
                          <View style={styles.productsGrid}>
                            {microProducts.map(renderProductCard)}
                          </View>
                        )}

                        {activeTab === 'ussd' && renderUSSDSimulation()}

                        {activeTab === 'whatsapp' && (
                          <View style={styles.chatContainer}>
                            <View style={styles.chatHeader}>
                              <Icon name="whatsapp" size={24} color="#25D366" />
                              <Text style={styles.chatTitle}>WhatsApp Bot</Text>
                              <View style={styles.statusDot} />
                              <Text style={styles.statusText}>Demo Mode</Text>
                            </View>
                            <ScrollView style={styles.chatMessages}>
                              {whatsappMessages.length === 0 ? (
                                <View style={styles.chatEmpty}>
                                  <Icon name="whatsapp" size={48} color="#ccc" />
                                  <Text style={styles.chatEmptyText}>Start a conversation</Text>
                                  <Text style={styles.chatEmptyHint}>Try typing "help" or "1"</Text>
                                </View>
                              ) : (
                                whatsappMessages.map((msg, idx) => (
                                  <View key={idx} style={[styles.chatBubble, msg.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot]}>
                                    <Text style={[styles.chatBubbleText, msg.sender === 'user' && styles.chatBubbleTextUser]}>{msg.text}</Text>
                                  </View>
                                ))
                              )}
                            </ScrollView>
                            <View style={styles.chatInputContainer}>
                              <TextInput
                                style={styles.chatInput}
                                placeholder="Type a message..."
                                value={whatsappInput}
                                onChangeText={setWhatsappInput}
                                onSubmitEditing={handleWhatsappMessage}
                              />
                              <TouchableOpacity style={[styles.chatSendButton, { backgroundColor: '#25D366' }]} onPress={handleWhatsappMessage}>
                                <Icon name="send" size={20} color="#fff" />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.chatInfo}>
                              <Text style={styles.chatInfoTitle}>WhatsApp Number</Text>
                              <Text style={styles.chatInfoNumber}>+234 800 INSURE</Text>
                            </View>
                          </View>
                        )}

                        {activeTab === 'telegram' && (
                          <View style={styles.chatContainer}>
                            <View style={styles.chatHeader}>
                              <Icon name="telegram" size={24} color="#0088cc" />
                              <Text style={styles.chatTitle}>Telegram Bot</Text>
                              <View style={styles.statusDot} />
                              <Text style={styles.statusText}>Demo Mode</Text>
                            </View>
                            <ScrollView style={styles.chatMessages}>
                              {telegramMessages.length === 0 ? (
                                <View style={styles.chatEmpty}>
                                  <Icon name="telegram" size={48} color="#ccc" />
                                  <Text style={styles.chatEmptyText}>Start a conversation</Text>
                                  <Text style={styles.chatEmptyHint}>Try typing "/start"</Text>
                                </View>
                              ) : (
                                telegramMessages.map((msg, idx) => (
                                  <View key={idx} style={[styles.chatBubble, msg.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot]}>
                                    <Text style={[styles.chatBubbleText, msg.sender === 'user' && styles.chatBubbleTextUser]}>{msg.text}</Text>
                                  </View>
                                ))
                              )}
                            </ScrollView>
                            <View style={styles.chatInputContainer}>
                              <TextInput
                                style={styles.chatInput}
                                placeholder="Type a message..."
                                value={telegramInput}
                                onChangeText={setTelegramInput}
                                onSubmitEditing={handleTelegramMessage}
                              />
                              <TouchableOpacity style={[styles.chatSendButton, { backgroundColor: '#0088cc' }]} onPress={handleTelegramMessage}>
                                <Icon name="send" size={20} color="#fff" />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.chatInfo}>
                              <Text style={styles.chatInfoTitle}>Bot Username</Text>
                              <Text style={styles.chatInfoNumber}>@InsurePortalBot</Text>
                            </View>
                          </View>
                        )}

                        {activeTab === 'claims' && renderQuickClaims()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 6,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  productsGrid: {
    padding: 16,
    gap: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  productDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  productDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  featuresList: {
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  parametricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  parametricText: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 6,
    fontWeight: '500',
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  getStartedText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
  },
  enrollmentContainer: {
    padding: 16,
  },
  enrollmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  enrollmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#2563eb',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#2563eb',
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  liteKycBadge: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  liteKycText: {
    marginLeft: 12,
    flex: 1,
  },
  liteKycTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  liteKycSubtitle: {
    fontSize: 12,
    color: '#15803d',
    marginTop: 4,
  },
  coverageOptions: {
    gap: 12,
  },
  coverageOption: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  coverageOptionPopular: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  coverageOptionContent: {
    alignItems: 'center',
  },
  coverageAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  coveragePremium: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  popularBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  popularText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  parametricInfo: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  parametricInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  parametricInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
  },
  parametricInfoText: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 12,
  },
  thresholdGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  thresholdItem: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    minWidth: 90,
  },
  thresholdLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginTop: 6,
  },
  thresholdValue: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 20,
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  paymentOptionText: {
    marginLeft: 14,
  },
  paymentOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  paymentOptionDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  activateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  prevButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  prevButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  ussdContainer: {
    padding: 16,
  },
  ussdTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  ussdSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 16,
  },
  ussdScreen: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    minHeight: 200,
    padding: 16,
  },
  ussdPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  ussdPlaceholderText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  ussdPlaceholderHint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  ussdMessages: {
    maxHeight: 200,
  },
  ussdMessage: {
    color: '#4ade80',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 4,
  },
  ussdMessageUser: {
    color: '#fff',
  },
  ussdInputContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  ussdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'monospace',
    backgroundColor: '#fff',
  },
  ussdSendButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  ussdSendText: {
    color: '#fff',
    fontWeight: '500',
  },
  ussdResetButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  ussdResetText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  networkCodes: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  networkCodesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  networkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  networkItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  networkName: {
    fontSize: 14,
    fontWeight: '700',
  },
  networkCode: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  claimsContainer: {
    padding: 16,
  },
  claimsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  claimsSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 20,
  },
  claimsSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  claimStep: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  claimStepIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#eff6ff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  claimStepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  claimStepDesc: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  parametricClaimsInfo: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  parametricClaimsText: {
    marginLeft: 12,
    flex: 1,
  },
  parametricClaimsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  parametricClaimsDesc: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 4,
  },
  fileClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
  },
  fileClaimText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  underwritingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  underwritingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  underwritingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  underwritingFactors: {
    marginTop: 16,
    width: '100%',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  factorText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  runAssessmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  runAssessmentText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  underwritingResults: {
    marginTop: 16,
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  factorsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  factorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  factorName: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    marginLeft: 8,
  },
  factorValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  approvalCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  premiumDisplay: {
    alignItems: 'center',
    marginTop: 12,
  },
  basePremium: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  adjustedPremium: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  discountText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  chatContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
  },
  chatMessages: {
    height: 300,
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  chatEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  chatEmptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  chatEmptyHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  chatBubbleUser: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleBot: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 14,
    color: '#111827',
  },
  chatBubbleTextUser: {
    color: '#fff',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  chatInfoTitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  chatInfoNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
});
