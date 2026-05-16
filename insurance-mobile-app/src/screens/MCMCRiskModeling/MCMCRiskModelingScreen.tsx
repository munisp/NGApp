import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface StakeholderBenefit {
  role: string;
  icon: string;
  color: string;
  description: string;
  example: string;
}

const metrics = {
  modelAccuracy: 94,
  premiumOptimization: 12,
  fraudDetection: 87,
  confidenceLevel: 'High',
};

const stakeholderBenefits: StakeholderBenefit[] = [
  {
    role: 'Underwriters',
    icon: 'account-check',
    color: '#3b82f6',
    description: 'Get risk scores with confidence ranges to make faster, more accurate decisions.',
    example: '"This applicant has 85-92% chance of being low risk"',
  },
  {
    role: 'Pricing Team',
    icon: 'calculator',
    color: '#22c55e',
    description: 'Set competitive premiums with built-in safety margins based on uncertainty.',
    example: '"Recommended premium: ₦125K-₦150K range"',
  },
  {
    role: 'Claims Team',
    icon: 'alert-triangle',
    color: '#8b5cf6',
    description: 'Prioritize fraud investigations with probability scores and confidence levels.',
    example: '"High confidence: 78% likely fraudulent"',
  },
  {
    role: 'Finance Team',
    icon: 'piggy-bank',
    color: '#f97316',
    description: 'Set reserves with credible intervals for regulatory compliance and planning.',
    example: '"Reserve needed: ₦38M-₦53M (95% confident)"',
  },
];

const analysisSteps = [
  {
    step: 1,
    title: 'Collect Applicant Data',
    description: 'System gathers all relevant information from the application',
    data: [
      { label: 'Farm Size', value: '50 hectares' },
      { label: 'Crop Type', value: 'Maize' },
      { label: 'Location', value: 'Oyo State' },
      { label: 'Experience', value: '8 years' },
    ],
  },
  {
    step: 2,
    title: 'Retrieve Historical Context',
    description: 'Query similar policies and claims from Delta Lake tables',
    stats: [
      { label: 'Similar Policies', value: '1,247' },
      { label: 'Historical Claims', value: '156' },
      { label: 'Avg Claim Rate', value: '12.5%' },
    ],
  },
  {
    step: 3,
    title: 'Run Statistical Sampling',
    description: 'Generate 10,000 samples to estimate risk distribution',
    stats: [
      { label: 'Samples', value: '10,000' },
      { label: 'Burn-in', value: '1,000' },
      { label: 'Convergence', value: 'Achieved' },
    ],
  },
  {
    step: 4,
    title: 'Calculate Risk Assessment',
    description: 'Compute posterior distribution and confidence intervals',
    results: {
      riskScore: '23%',
      confidenceRange: '18-28%',
      confidenceLevel: '95%',
      recommendation: 'Approve',
    },
  },
];

export default function MCMCRiskModelingScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'application' | 'product'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Smart Risk Intelligence</Text>
          <Text style={styles.subtitle}>AI-powered risk analysis with confidence ranges</Text>
        </View>
        <TouchableOpacity
          style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
          onPress={runAnalysis}
          disabled={isAnalyzing}
        >
          <Icon
            name={isAnalyzing ? 'loading' : 'refresh'}
            size={16}
            color="#ffffff"
          />
          <Text style={styles.analyzeButtonText}>
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {isAnalyzing && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Analyzing risk patterns...</Text>
              <Text style={styles.progressPercent}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressSubtext}>
              Processing historical data to generate confidence intervals...
            </Text>
          </View>
        )}

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#3b82f6' }]}>
              <Icon name="target" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.metricValue, { color: '#1e40af' }]}>{metrics.modelAccuracy}%</Text>
            <Text style={styles.metricLabel}>Model Accuracy</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#22c55e' }]}>
              <Icon name="currency-ngn" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.metricValue, { color: '#166534' }]}>+{metrics.premiumOptimization}%</Text>
            <Text style={styles.metricLabel}>Premium Optimization</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#8b5cf6' }]}>
              <Icon name="shield-check" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.metricValue, { color: '#6b21a8' }]}>{metrics.fraudDetection}%</Text>
            <Text style={styles.metricLabel}>Fraud Detection</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#f97316' }]}>
              <Icon name="check-circle" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.metricValue, { color: '#c2410c' }]}>{metrics.confidenceLevel}</Text>
            <Text style={styles.metricLabel}>Confidence Level</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          {['overview', 'application', 'product'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'application' ? 'New Application' : tab === 'product' ? 'New Product' : 'Overview'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Helps Your Team</Text>
            {stakeholderBenefits.map((benefit, index) => (
              <View
                key={index}
                style={[styles.benefitCard, { borderLeftColor: benefit.color }]}
              >
                <View style={styles.benefitHeader}>
                  <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '20' }]}>
                    <Icon name={benefit.icon} size={24} color={benefit.color} />
                  </View>
                  <Text style={styles.benefitRole}>{benefit.role}</Text>
                </View>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
                <View style={[styles.benefitExample, { backgroundColor: benefit.color + '10' }]}>
                  <Text style={[styles.benefitExampleText, { color: benefit.color }]}>
                    {benefit.example}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>What Makes This Different?</Text>
              <View style={styles.comparisonItem}>
                <View style={styles.comparisonBadge}>
                  <Text style={styles.comparisonBadgeText}>Old</Text>
                </View>
                <View style={styles.comparisonContent}>
                  <Text style={styles.comparisonLabel}>Traditional Approach</Text>
                  <Text style={styles.comparisonValue}>"The expected claim amount is ₦98,500"</Text>
                  <Text style={styles.comparisonNote}>No indication of how confident this estimate is</Text>
                </View>
              </View>
              <View style={styles.comparisonArrow}>
                <Icon name="arrow-down" size={24} color="#9ca3af" />
              </View>
              <View style={[styles.comparisonItem, styles.comparisonItemNew]}>
                <View style={[styles.comparisonBadge, styles.comparisonBadgeNew]}>
                  <Text style={[styles.comparisonBadgeText, { color: '#22c55e' }]}>New</Text>
                </View>
                <View style={styles.comparisonContent}>
                  <Text style={[styles.comparisonLabel, { color: '#166534' }]}>Smart Risk Intelligence</Text>
                  <Text style={[styles.comparisonValue, { color: '#22c55e' }]}>
                    "The expected claim amount is ₦78K-₦125K (95% confident)"
                  </Text>
                  <Text style={[styles.comparisonNote, { color: '#22c55e' }]}>
                    You know the range and how confident the model is
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'application' && (
          <View style={styles.section}>
            <View style={styles.applicationHeader}>
              <View>
                <Text style={styles.applicationTitle}>New Application: Crop Insurance</Text>
                <Text style={styles.applicationSubtitle}>
                  Applicant: Adebayo Farms Ltd | Oyo State | Maize (50 ha)
                </Text>
              </View>
              <View style={styles.processingBadge}>
                <Text style={styles.processingBadgeText}>Processing</Text>
              </View>
            </View>

            <Text style={styles.pipelineTitle}>Analysis Pipeline</Text>
            {analysisSteps.map((step, index) => (
              <View key={index} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.step}</Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>
                </View>
                {step.data && (
                  <View style={styles.stepDataGrid}>
                    {step.data.map((item, i) => (
                      <View key={i} style={styles.stepDataItem}>
                        <Text style={styles.stepDataLabel}>{item.label}:</Text>
                        <Text style={styles.stepDataValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {step.stats && (
                  <View style={styles.stepStatsGrid}>
                    {step.stats.map((stat, i) => (
                      <View key={i} style={styles.stepStatItem}>
                        <Text style={styles.stepStatValue}>{stat.value}</Text>
                        <Text style={styles.stepStatLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {step.results && (
                  <View style={styles.resultsCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Risk Score:</Text>
                      <Text style={styles.resultValue}>{step.results.riskScore}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Confidence Range:</Text>
                      <Text style={styles.resultValue}>{step.results.confidenceRange}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Confidence Level:</Text>
                      <Text style={styles.resultValue}>{step.results.confidenceLevel}</Text>
                    </View>
                    <View style={styles.recommendationBadge}>
                      <Icon name="check-circle" size={20} color="#22c55e" />
                      <Text style={styles.recommendationText}>
                        Recommendation: {step.results.recommendation}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'product' && (
          <View style={styles.section}>
            <View style={styles.productHeader}>
              <Icon name="fish" size={32} color="#3b82f6" />
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>New Product: Aquaculture Insurance</Text>
                <Text style={styles.productSubtitle}>
                  Bayesian updating as data accumulates over time
                </Text>
              </View>
            </View>

            <Text style={styles.evolutionTitle}>How Confidence Evolves Over Time</Text>
            
            <View style={styles.timelineCard}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineMonth}>Month 1 (Launch)</Text>
                  <Text style={styles.timelineRange}>Loss Ratio: 35-85%</Text>
                  <Text style={styles.timelineNote}>Wide range - limited data</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: '100%', backgroundColor: '#ef4444' }]} />
                  </View>
                </View>
              </View>
              
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineMonth}>Month 6</Text>
                  <Text style={styles.timelineRange}>Loss Ratio: 42-68%</Text>
                  <Text style={styles.timelineNote}>Narrowing with more claims data</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: '65%', backgroundColor: '#f97316' }]} />
                  </View>
                </View>
              </View>
              
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineMonth}>Month 12</Text>
                  <Text style={styles.timelineRange}>Loss Ratio: 48-58%</Text>
                  <Text style={styles.timelineNote}>High confidence after full year</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: '35%', backgroundColor: '#22c55e' }]} />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.insightCard}>
              <Icon name="lightbulb" size={24} color="#f59e0b" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Key Insight</Text>
                <Text style={styles.insightText}>
                  As more data accumulates, the confidence intervals narrow, giving you more precise
                  risk estimates. This is the power of Bayesian updating - the model learns and
                  improves over time.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  progressCard: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 13,
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  benefitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitRole: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  benefitDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 10,
  },
  benefitExample: {
    padding: 10,
    borderRadius: 8,
  },
  benefitExampleText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  comparisonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  comparisonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  comparisonItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  comparisonItemNew: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  comparisonBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  comparisonBadgeNew: {
    backgroundColor: '#dcfce7',
  },
  comparisonBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  comparisonContent: {
    flex: 1,
  },
  comparisonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  comparisonValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  comparisonNote: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
  },
  comparisonArrow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  applicationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e40af',
  },
  applicationSubtitle: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  processingBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  processingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  pipelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  stepDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  stepDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepDataItem: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
  },
  stepDataLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  stepDataValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 4,
  },
  stepStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stepStatItem: {
    alignItems: 'center',
    backgroundColor: '#faf5ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  stepStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7c3aed',
  },
  stepStatLabel: {
    fontSize: 10,
    color: '#8b5cf6',
    marginTop: 2,
  },
  resultsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 13,
    color: '#166534',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  recommendationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  recommendationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginLeft: 8,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  productInfo: {
    marginLeft: 12,
    flex: 1,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e40af',
  },
  productSubtitle: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
  },
  evolutionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  timelineRange: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
  },
  timelineNote: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 8,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    color: '#a16207',
    lineHeight: 18,
  },
});
