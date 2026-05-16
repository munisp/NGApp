import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface InsuranceCard {
  id: string;
  type: string;
  policyNumber: string;
  holderName: string;
  coverageAmount: string;
  validTo: string;
  status: 'active' | 'expiring' | 'expired';
  color: string;
  icon: string;
}

const DigitalWalletScreen: React.FC = () => {
  const [selectedCard, setSelectedCard] = useState<string>('1');

  const insuranceCards: InsuranceCard[] = [
    {
      id: '1',
      type: 'Health Insurance',
      policyNumber: 'HLT-2026-001234',
      holderName: 'Adebayo Okonkwo',
      coverageAmount: '₦5,000,000',
      validTo: 'Dec 31, 2026',
      status: 'active',
      color: '#EF4444',
      icon: '❤️',
    },
    {
      id: '2',
      type: 'Auto Insurance',
      policyNumber: 'AUT-2026-005678',
      holderName: 'Adebayo Okonkwo',
      coverageAmount: '₦3,000,000',
      validTo: 'Mar 14, 2027',
      status: 'active',
      color: '#3B82F6',
      icon: '🚗',
    },
    {
      id: '3',
      type: 'Property Insurance',
      policyNumber: 'PRP-2025-009012',
      holderName: 'Adebayo Okonkwo',
      coverageAmount: '₦25,000,000',
      validTo: 'May 31, 2026',
      status: 'expiring',
      color: '#10B981',
      icon: '🏠',
    },
  ];

  const selectedCardData = insuranceCards.find((c) => c.id === selectedCard);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#D1FAE5', text: '#065F46', label: 'Active' };
      case 'expiring':
        return { bg: '#FEF3C7', text: '#92400E', label: 'Expiring Soon' };
      case 'expired':
        return { bg: '#FEE2E2', text: '#991B1B', label: 'Expired' };
      default:
        return { bg: '#E5E7EB', text: '#374151', label: 'Unknown' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Digital Wallet</Text>
          <Text style={styles.subtitle}>Your insurance cards, always with you</Text>
        </View>

        {/* Card Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardCarousel}
        >
          {insuranceCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.cardPreview,
                { backgroundColor: card.color },
                selectedCard === card.id && styles.cardPreviewSelected,
              ]}
              onPress={() => setSelectedCard(card.id)}
            >
              <Text style={styles.cardPreviewIcon}>{card.icon}</Text>
              <Text style={styles.cardPreviewType}>{card.type}</Text>
              <Text style={styles.cardPreviewNumber}>{card.policyNumber}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selected Card Detail */}
        {selectedCardData && (
          <View style={[styles.cardDetail, { backgroundColor: selectedCardData.color }]}>
            <View style={styles.cardDetailHeader}>
              <View>
                <Text style={styles.cardDetailProvider}>InsurePortal</Text>
                <Text style={styles.cardDetailType}>{selectedCardData.type}</Text>
              </View>
              <Text style={styles.cardDetailIcon}>{selectedCardData.icon}</Text>
            </View>

            <View style={styles.cardDetailNumber}>
              <Text style={styles.cardDetailNumberLabel}>Policy Number</Text>
              <Text style={styles.cardDetailNumberValue}>{selectedCardData.policyNumber}</Text>
            </View>

            <View style={styles.cardDetailRow}>
              <View style={styles.cardDetailCol}>
                <Text style={styles.cardDetailLabel}>Policyholder</Text>
                <Text style={styles.cardDetailValue}>{selectedCardData.holderName}</Text>
              </View>
              <View style={styles.cardDetailCol}>
                <Text style={styles.cardDetailLabel}>Coverage</Text>
                <Text style={styles.cardDetailValue}>{selectedCardData.coverageAmount}</Text>
              </View>
            </View>

            <View style={styles.cardDetailFooter}>
              <View>
                <Text style={styles.cardDetailLabel}>Valid Until</Text>
                <Text style={styles.cardDetailValue}>{selectedCardData.validTo}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBadge(selectedCardData.status).bg }]}>
                <Text style={[styles.statusText, { color: getStatusBadge(selectedCardData.status).text }]}>
                  {getStatusBadge(selectedCardData.status).label}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionIcon}>📱</Text>
            <Text style={styles.quickActionLabel}>Show QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionIcon}>📥</Text>
            <Text style={styles.quickActionLabel}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionIcon}>📤</Text>
            <Text style={styles.quickActionLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionIcon}>📞</Text>
            <Text style={styles.quickActionLabel}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Verification Info */}
        <View style={styles.verificationCard}>
          <View style={styles.verificationIcon}>
            <Text style={styles.verificationIconText}>✓</Text>
          </View>
          <View style={styles.verificationContent}>
            <Text style={styles.verificationTitle}>Coverage Verified</Text>
            <Text style={styles.verificationText}>
              This digital card is valid proof of insurance for hospitals, police checkpoints, and other verification points.
            </Text>
          </View>
        </View>

        {/* Add to Wallet Buttons */}
        <View style={styles.walletButtons}>
          <TouchableOpacity style={[styles.walletButton, { backgroundColor: '#000000' }]}>
            <Text style={styles.walletButtonIcon}>🍎</Text>
            <Text style={styles.walletButtonText}>Add to Apple Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.walletButton, { backgroundColor: '#4285F4' }]}>
            <Text style={styles.walletButtonIcon}>📱</Text>
            <Text style={styles.walletButtonText}>Add to Google Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Expiring Warning */}
        {selectedCardData?.status === 'expiring' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Policy Expiring Soon</Text>
              <Text style={styles.warningText}>
                Your policy expires on {selectedCardData.validTo}. Renew now to maintain coverage.
              </Text>
            </View>
            <TouchableOpacity style={styles.renewButton}>
              <Text style={styles.renewButtonText}>Renew</Text>
            </TouchableOpacity>
          </View>
        )}
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
  header: {
    padding: 20,
    backgroundColor: '#2563EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    marginTop: 4,
  },
  cardCarousel: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  cardPreview: {
    width: 140,
    height: 90,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  cardPreviewSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardPreviewIcon: {
    fontSize: 20,
  },
  cardPreviewType: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  cardPreviewNumber: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  cardDetail: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cardDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardDetailProvider: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  cardDetailType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  cardDetailIcon: {
    fontSize: 32,
  },
  cardDetailNumber: {
    marginBottom: 20,
  },
  cardDetailNumberLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  cardDetailNumberValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginTop: 4,
  },
  cardDetailRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  cardDetailCol: {
    flex: 1,
  },
  cardDetailLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  cardDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  cardDetailFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  verificationCard: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  verificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  verificationIconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 18,
  },
  walletButtons: {
    paddingHorizontal: 16,
    gap: 12,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  walletButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  walletButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  warningText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  renewButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  renewButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});

export default DigitalWalletScreen;
