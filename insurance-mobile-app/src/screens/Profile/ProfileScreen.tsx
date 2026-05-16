import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Text, Button, Avatar, TextInput, Divider, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { spacing, typography, theme } from '../../utils/theme';

interface KYCStatus {
  nin: { verified: boolean; value?: string };
  bvn: { verified: boolean; value?: string };
  address: { verified: boolean; value?: string };
  document: { verified: boolean; type?: string };
}

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedPhone, setEditedPhone] = useState('');

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.get(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => profileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update profile');
    },
  });

  const profile = profileData?.data || {
    name: user?.name || 'User',
    email: user?.email || '',
    phone: '+234 XXX XXX XXXX',
    dateJoined: new Date().toISOString(),
    kycStatus: {
      nin: { verified: true, value: '12345678901' },
      bvn: { verified: true, value: '22345678901' },
      address: { verified: true, value: '15 Victoria Island, Lagos' },
      document: { verified: true, type: "Driver's License" },
    },
  };

  const kycStatus: KYCStatus = profile.kycStatus;
  const kycComplete = Object.values(kycStatus).every((item: any) => item.verified);

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      name: editedName,
      phone: editedPhone,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const renderKYCItem = (label: string, item: { verified: boolean; value?: string; type?: string }) => (
    <View style={styles.kycItem}>
      <View style={styles.kycInfo}>
        <Icon
          name={item.verified ? 'check-circle' : 'alert-circle'}
          size={20}
          color={item.verified ? theme.colors.success : theme.colors.warning}
        />
        <View style={styles.kycText}>
          <Text style={styles.kycLabel}>{label}</Text>
          {item.verified && (
            <Text style={styles.kycValue}>
              {item.value || item.type || 'Verified'}
            </Text>
          )}
        </View>
      </View>
      {!item.verified && (
        <Button mode="text" compact onPress={() => {}}>
          Verify
        </Button>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text
          size={80}
          label={profile.name.charAt(0).toUpperCase()}
          style={styles.avatar}
        />
        <Text style={styles.userName}>{profile.name}</Text>
        <Text style={styles.userEmail}>{profile.email}</Text>
        <Chip
          icon={kycComplete ? 'check-circle' : 'alert-circle'}
          style={[styles.kycChip, kycComplete ? styles.kycComplete : styles.kycIncomplete]}
          textStyle={{ color: kycComplete ? '#166534' : '#92400e' }}
        >
          {kycComplete ? 'KYC Verified' : 'KYC Incomplete'}
        </Chip>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>Personal Information</Title>
            {!isEditing && (
              <Button mode="text" onPress={() => setIsEditing(true)} compact>
                Edit
              </Button>
            )}
          </View>

          {isEditing ? (
            <>
              <TextInput
                label="Full Name"
                value={editedName}
                onChangeText={setEditedName}
                style={styles.input}
                mode="outlined"
              />
              <TextInput
                label="Phone Number"
                value={editedPhone || profile.phone}
                onChangeText={setEditedPhone}
                style={styles.input}
                mode="outlined"
                keyboardType="phone-pad"
              />
              <View style={styles.editActions}>
                <Button
                  mode="outlined"
                  onPress={() => setIsEditing(false)}
                  style={styles.editButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveProfile}
                  loading={updateProfileMutation.isPending}
                  style={styles.editButton}
                >
                  Save
                </Button>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Icon name="account" size={20} color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{profile.name}</Text>
                </View>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.infoRow}>
                <Icon name="email" size={20} color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{profile.email}</Text>
                </View>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.infoRow}>
                <Icon name="phone" size={20} color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{profile.phone}</Text>
                </View>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>KYC Verification</Title>
          <Text style={styles.kycDescription}>
            Complete your KYC verification to access all features
          </Text>
          
          {renderKYCItem('National ID (NIN)', kycStatus.nin)}
          <Divider style={styles.divider} />
          {renderKYCItem('Bank Verification (BVN)', kycStatus.bvn)}
          <Divider style={styles.divider} />
          {renderKYCItem('Address Verification', kycStatus.address)}
          <Divider style={styles.divider} />
          {renderKYCItem('ID Document', kycStatus.document)}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Settings</Title>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('NotificationSettings')}>
            <Icon name="bell" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Notification Preferences</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('ChangePassword')}>
            <Icon name="lock" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Change Password</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('BiometricSettings')}>
            <Icon name="fingerprint" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Biometric Login</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('LanguageSettings')}>
            <Icon name="translate" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Language</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Support</Title>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
            <Icon name="help-circle" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Help Center</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
            <Icon name="message-text" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Contact Support</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
            <Icon name="file-document" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Terms of Service</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
            <Icon name="shield-check" size={24} color={theme.colors.primary} />
            <Text style={styles.settingText}>Privacy Policy</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          icon="logout"
          textColor={theme.colors.error}
        >
          Sign Out
        </Button>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginBottom: spacing.md,
  },
  userName: {
    ...typography.h2,
    color: theme.colors.text,
  },
  userEmail: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  kycChip: {
    marginTop: spacing.md,
  },
  kycComplete: {
    backgroundColor: '#dcfce7',
  },
  kycIncomplete: {
    backgroundColor: '#fef3c7',
  },
  card: {
    margin: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: theme.colors.surface,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  editButton: {
    minWidth: 100,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: theme.colors.text,
    marginTop: spacing.xs,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  kycDescription: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.md,
  },
  kycItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  kycInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  kycText: {
    marginLeft: spacing.md,
  },
  kycLabel: {
    ...typography.body,
    color: theme.colors.text,
  },
  kycValue: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingText: {
    ...typography.body,
    color: theme.colors.text,
    flex: 1,
    marginLeft: spacing.md,
  },
  actions: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  logoutButton: {
    width: '100%',
    borderColor: theme.colors.error,
  },
  version: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.md,
  },
});
