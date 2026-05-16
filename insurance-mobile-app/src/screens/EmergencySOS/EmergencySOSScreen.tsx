import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Vibration,
} from 'react-native';

interface EmergencyService {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const EmergencySOSScreen: React.FC = () => {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [emergencyType, setEmergencyType] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  const emergencyServices: EmergencyService[] = [
    {
      id: 'medical',
      name: 'Medical Emergency',
      icon: '🏥',
      description: 'Ambulance, hospital admission',
    },
    {
      id: 'accident',
      name: 'Vehicle Accident',
      icon: '🚗',
      description: 'Tow service, police report',
    },
    {
      id: 'property',
      name: 'Property Emergency',
      icon: '🏠',
      description: 'Fire, flood, break-in',
    },
    {
      id: 'general',
      name: 'General Emergency',
      icon: '🆘',
      description: '24/7 support line',
    },
  ];

  const emergencyContacts = [
    { name: 'Adebayo Okonkwo', phone: '+234 801 234 5678', relationship: 'Spouse' },
    { name: 'Chioma Okonkwo', phone: '+234 802 345 6789', relationship: 'Sister' },
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isEmergencyActive && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
        Vibration.vibrate(100);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [isEmergencyActive, countdown]);

  const handleEmergencyActivate = (type: string) => {
    Alert.alert(
      'Activate Emergency SOS?',
      'This will alert emergency services and notify your emergency contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'destructive',
          onPress: () => {
            setEmergencyType(type);
            setIsEmergencyActive(true);
            setCountdown(5);
            Vibration.vibrate([0, 200, 100, 200]);
          },
        },
      ]
    );
  };

  const cancelEmergency = () => {
    setIsEmergencyActive(false);
    setEmergencyType(null);
    setCountdown(5);
  };

  if (isEmergencyActive) {
    return (
      <SafeAreaView style={styles.emergencyContainer}>
        <View style={styles.emergencyContent}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyTitle}>Emergency SOS Activated</Text>
          <Text style={styles.emergencySubtitle}>
            {emergencyType === 'medical' && 'Contacting emergency medical services...'}
            {emergencyType === 'accident' && 'Dispatching roadside assistance...'}
            {emergencyType === 'property' && 'Alerting emergency response team...'}
            {emergencyType === 'general' && 'Connecting to 24/7 support...'}
          </Text>

          {countdown > 0 ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownLabel}>seconds until services contacted</Text>
            </View>
          ) : (
            <View style={styles.helpOnWayContainer}>
              <Text style={styles.helpOnWayIcon}>✓</Text>
              <Text style={styles.helpOnWayText}>Help is on the way!</Text>
              <Text style={styles.helpOnWaySubtext}>Stay calm and stay on the line</Text>
            </View>
          )}

          <View style={styles.statusList}>
            <View style={styles.statusItem}>
              <Text style={styles.statusIcon}>📍</Text>
              <Text style={styles.statusText}>Location shared with emergency services</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusIcon}>👥</Text>
              <Text style={styles.statusText}>Emergency contacts being notified</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusIcon}>📄</Text>
              <Text style={styles.statusText}>Claim auto-initiated</Text>
            </View>
          </View>

          <View style={styles.emergencyButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEmergency}>
              <Text style={styles.cancelButtonText}>Cancel Emergency</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton}>
              <Text style={styles.callButtonText}>📞 Call Hotline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.subtitle}>Quick access to emergency services</Text>
        </View>

        {/* Emergency Services */}
        <View style={styles.servicesGrid}>
          {emergencyServices.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleEmergencyActivate(service.id)}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
              <View style={styles.sosButton}>
                <Text style={styles.sosButtonText}>SOS</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          {emergencyContacts.map((contact, index) => (
            <View key={index} style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelationship}>{contact.relationship}</Text>
              </View>
              <TouchableOpacity style={styles.callContactButton}>
                <Text style={styles.callContactIcon}>📞</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addContactButton}>
            <Text style={styles.addContactText}>+ Add Emergency Contact</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Info */}
        <View style={styles.quickInfoGrid}>
          <View style={[styles.quickInfoCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.quickInfoIcon}>📞</Text>
            <Text style={[styles.quickInfoTitle, { color: '#1E40AF' }]}>24/7 Hotline</Text>
            <Text style={[styles.quickInfoValue, { color: '#1E40AF' }]}>+234 1 234 5678</Text>
          </View>
          <View style={[styles.quickInfoCard, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.quickInfoIcon}>🚑</Text>
            <Text style={[styles.quickInfoTitle, { color: '#065F46' }]}>Avg Response</Text>
            <Text style={[styles.quickInfoValue, { color: '#065F46' }]}>15 minutes</Text>
          </View>
        </View>
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
    backgroundColor: '#DC2626',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#FECACA',
    marginTop: 4,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  sosButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  contactRelationship: {
    fontSize: 12,
    color: '#6B7280',
  },
  callContactButton: {
    padding: 8,
  },
  callContactIcon: {
    fontSize: 20,
  },
  addContactButton: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addContactText: {
    color: '#6B7280',
    fontSize: 14,
  },
  quickInfoGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  quickInfoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickInfoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickInfoTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickInfoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Emergency Active Styles
  emergencyContainer: {
    flex: 1,
    backgroundColor: '#FEE2E2',
  },
  emergencyContent: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  emergencySubtitle: {
    fontSize: 16,
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 24,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  countdownLabel: {
    fontSize: 14,
    color: '#991B1B',
  },
  helpOnWayContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  helpOnWayIcon: {
    fontSize: 48,
    color: '#10B981',
    marginBottom: 8,
  },
  helpOnWayText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#065F46',
  },
  helpOnWaySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusList: {
    width: '100%',
    marginBottom: 24,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#991B1B',
  },
  emergencyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
  },
  callButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmergencySOSScreen;
