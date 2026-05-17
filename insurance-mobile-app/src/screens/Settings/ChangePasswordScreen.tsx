import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { Button } from '../../components';
import { spacing, typography, theme } from '../../utils/theme';
import { t } from '../../services/i18n';

export default function ChangePasswordScreen({ navigation }: any) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiClient.post('/auth/change-password', data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert(
        'Success',
        'Your password has been changed successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to change password. Please try again.';
      Alert.alert('Error', message);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one special character (!@#$%^&*)';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      changePasswordMutation.mutate({ currentPassword, newPassword });
    }
  };

  const getPasswordStrength = (): { label: string; color: string; progress: number } => {
    if (!newPassword) return { label: '', color: theme.colors.border, progress: 0 };

    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (newPassword.length >= 12) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[!@#$%^&*]/.test(newPassword)) strength++;

    if (strength <= 2) return { label: 'Weak', color: theme.colors.error, progress: 0.25 };
    if (strength <= 4) return { label: 'Medium', color: theme.colors.warning, progress: 0.5 };
    if (strength <= 5) return { label: 'Strong', color: theme.colors.success, progress: 0.75 };
    return { label: 'Very Strong', color: theme.colors.success, progress: 1 };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.change_password')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>
          Choose a strong password that you don't use for other accounts.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            label="Current Password"
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              setErrors({ ...errors, currentPassword: '' });
            }}
            secureTextEntry={!showCurrentPassword}
            mode="outlined"
            error={!!errors.currentPassword}
            right={
              <TextInput.Icon
                icon={showCurrentPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              />
            }
          />
          {errors.currentPassword && (
            <Text style={styles.errorText}>{errors.currentPassword}</Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setErrors({ ...errors, newPassword: '' });
            }}
            secureTextEntry={!showNewPassword}
            mode="outlined"
            error={!!errors.newPassword}
            right={
              <TextInput.Icon
                icon={showNewPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowNewPassword(!showNewPassword)}
              />
            }
          />
          {errors.newPassword && (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          )}
          {newPassword && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthProgress,
                    { width: `${passwordStrength.progress * 100}%`, backgroundColor: passwordStrength.color },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                {passwordStrength.label}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors({ ...errors, confirmPassword: '' });
            }}
            secureTextEntry={!showConfirmPassword}
            mode="outlined"
            error={!!errors.confirmPassword}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}
        </View>

        <View style={styles.requirements}>
          <Text style={styles.requirementsTitle}>Password Requirements:</Text>
          <RequirementItem met={newPassword.length >= 8} text="At least 8 characters" />
          <RequirementItem met={/[A-Z]/.test(newPassword)} text="One uppercase letter" />
          <RequirementItem met={/[a-z]/.test(newPassword)} text="One lowercase letter" />
          <RequirementItem met={/[0-9]/.test(newPassword)} text="One number" />
          <RequirementItem met={/[!@#$%^&*]/.test(newPassword)} text="One special character (!@#$%^&*)" />
        </View>

        <Button
          title="Change Password"
          onPress={handleSubmit}
          loading={changePasswordMutation.isPending}
          disabled={changePasswordMutation.isPending}
          fullWidth
          style={styles.submitButton}
        />
      </ScrollView>
    </View>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.requirementItem}>
      <Icon
        name={met ? 'check-circle' : 'circle-outline'}
        size={16}
        color={met ? theme.colors.success : theme.colors.textSecondary}
      />
      <Text style={[styles.requirementText, met && styles.requirementMet]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  description: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.small,
    color: theme.colors.error,
    marginTop: spacing.xs,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  strengthProgress: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    ...typography.small,
    fontWeight: '600',
    width: 80,
  },
  requirements: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  requirementsTitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  requirementText: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginLeft: spacing.sm,
  },
  requirementMet: {
    color: theme.colors.success,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
});
