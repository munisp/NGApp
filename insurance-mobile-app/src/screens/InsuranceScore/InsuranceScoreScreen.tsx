import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface CoverageGap {
  type: string;
  name: string;
  severity: 'critical' | 'moderate' | 'low';
  description: string;
  recommendation: string;
}

interface ScoreBreakdown {
  category: string;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

const InsuranceScoreScreen: React.FC = () => {
  const [overallScore] = useState(72);
  const [scoreBreakdown] = useState<ScoreBreakdown[]>([
    { category: 'Health Coverage', score: 85, status: 'excellent' },
    { category: 'Life Protection', score: 60, status: 'fair' },
    { category: 'Asset Protection', score: 75, status: 'good' },
    { category: 'Income Protection', score: 45, status: 'poor' },
    { category: 'Family Coverage', score: 80, status: 'good' },
  ]);

  const [coverageGaps] = useState<CoverageGap[]>([
    {
      type: 'disability',
      name: 'Disability Insurance',
      severity: 'critical',
      description: 'No income protection if unable to work',
      recommendation: 'Add disability coverage to protect 60-70% of income',
    },
    {
      type: 'life',
      name: 'Life Insurance Gap',
      severity: 'moderate',
      description: 'Coverage below recommended levels',
      recommendation: 'Increase to 10x annual income',
    },
  ]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      excellent: '#10B981',
      good: '#3B82F6',
      fair: '#F59E0B',
      poor: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      critical: { bg: '#FEE2E2', text: '#DC2626' },
      moderate: { bg: '#FEF3C7', text: '#D97706' },
      low: { bg: '#FEF9C3', text: '#CA8A04' },
    };
    return colors[severity] || colors.moderate;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>My Insurance Score</Text>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNumber, { color: getScoreColor(overallScore) }]}>
              {overallScore}
            </Text>
            <Text style={styles.scoreMax}>out of 100</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(overallScore) }]}>
            <Text style={styles.scoreBadgeText}>
              {overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : 'Needs Attention'}
            </Text>
          </View>
          <Text style={styles.scoreComparison}>
            Better than 65% of similar profiles
          </Text>
        </View>

        {/* Score Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          {scoreBreakdown.map((item) => (
            <View key={item.category} style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownCategory}>{item.category}</Text>
                <View style={styles.breakdownRight}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.breakdownScore}>{item.score}%</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${item.score}%`, backgroundColor: getStatusColor(item.status) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Coverage Gaps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coverage Gaps</Text>
          {coverageGaps.map((gap) => {
            const colors = getSeverityColor(gap.severity);
            return (
              <View key={gap.type} style={[styles.gapCard, { backgroundColor: colors.bg }]}>
                <View style={styles.gapHeader}>
                  <Text style={[styles.gapName, { color: colors.text }]}>{gap.name}</Text>
                  <View style={[styles.severityBadge, { borderColor: colors.text }]}>
                    <Text style={[styles.severityText, { color: colors.text }]}>
                      {gap.severity.charAt(0).toUpperCase() + gap.severity.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.gapDescription}>{gap.description}</Text>
                <Text style={styles.gapRecommendation}>{gap.recommendation}</Text>
                <TouchableOpacity style={[styles.fixButton, { backgroundColor: colors.text }]}>
                  <Text style={styles.fixButtonText}>Fix This Gap</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Achievements</Text>
          <View style={styles.achievementsGrid}>
            <View style={[styles.achievementCard, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.achievementIcon}>✓</Text>
              <Text style={[styles.achievementTitle, { color: '#065F46' }]}>Health Protected</Text>
            </View>
            <View style={[styles.achievementCard, { backgroundColor: '#DBEAFE' }]}>
              <Text style={styles.achievementIcon}>🚗</Text>
              <Text style={[styles.achievementTitle, { color: '#1E40AF' }]}>Safe Driver</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Improve My Score</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scoreCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 12,
    color: '#6B7280',
  },
  scoreBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  scoreBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scoreComparison: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownCategory: {
    fontSize: 14,
    color: '#374151',
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  breakdownScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    width: 40,
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  gapCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gapName: {
    fontSize: 16,
    fontWeight: '600',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  gapDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  gapRecommendation: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  fixButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  fixButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  achievementsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  ctaButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default InsuranceScoreScreen;
