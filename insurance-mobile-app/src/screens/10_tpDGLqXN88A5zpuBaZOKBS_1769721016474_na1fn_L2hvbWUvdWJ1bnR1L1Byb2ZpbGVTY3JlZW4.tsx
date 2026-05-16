import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Appbar,
  TextInput,
  Button,
  Text,
  ActivityIndicator,
  Avatar,
  useTheme,
  Card,
  HelperText,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

// --- MOCK DEPENDENCIES START (Simulating imports from '@/services/api' and '@/utils/theme') ---

// 1. Mock Theme Reference from '@/utils/theme'
const theme = {
  ...useTheme(),
  colors: {
    ...useTheme().colors,
    primary: '#007AFF', // A typical insurance app primary color
    accent: '#FF9500',
    success: '#34C759',
    error: '#FF3B30',
    background: '#F2F2F7',
    surface: '#FFFFFF',
  },
};

// 2. Mock User Profile Type
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  kycStatus: 'Verified' | 'Pending' | 'Rejected';
  profilePhotoUrl?: string;
}

// 3. Mock tRPC Client Reference from '@/services/api'
const trpc = {
  user: {
    getProfile: {
      useQuery: (options?: { enabled?: boolean }) => {
        const [data, setData] = useState<UserProfile | undefined>(undefined);
        const [isLoading, setIsLoading] = useState(true);
        const [isError, setIsError] = useState(false);

        const refetch = useCallback(async () => {
          setIsLoading(true);
          setIsError(false);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
          if (Math.random() > 0.1) { // 90% success rate
            setData({
              id: 'user-123',
              firstName: 'Alex',
              lastName: 'Johnson',
              email: 'alex.johnson@example.com',
              phone: '555-1234',
              kycStatus: Math.random() > 0.5 ? 'Verified' : 'Pending',
              profilePhotoUrl: Math.random() > 0.3 ? 'https://i.pravatar.cc/150?img=68' : undefined,
            });
            setIsLoading(false);
          } else {
            setIsError(true);
            setIsLoading(false);
          }
        }, []);

        React.useEffect(() => {
          if (options?.enabled !== false) {
            refetch();
          }
        }, [refetch, options?.enabled]);

        return { data, isLoading, isError, refetch, isRefetching: isLoading };
      },
    },
    updateProfile: {
      useMutation: () => {
        const [isLoading, setIsLoading] = useState(false);
        const [isError, setIsError] = useState(false);
        const [isSuccess, setIsSuccess] = useState(false);

        const mutate = useCallback(async (variables: Partial<UserProfile>) => {
          setIsLoading(true);
          setIsError(false);
          setIsSuccess(false);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
          if (Math.random() > 0.1) { // 90% success rate
            setIsSuccess(true);
            setIsLoading(false);
            return { success: true, message: 'Profile updated successfully!' };
          } else {
            setIsError(true);
            setIsLoading(false);
            throw new Error('Failed to update profile. Please try again.');
          }
        }, []);

        return { mutate, isLoading, isError, isSuccess, reset: () => { setIsLoading(false); setIsError(false); setIsSuccess(false); } };
      },
    },
    uploadPhoto: {
      useMutation: () => {
        const [isLoading, setIsLoading] = useState(false);
        const [isError, setIsError] = useState(false);
        const [isSuccess, setIsSuccess] = useState(false);
        const [data, setData] = useState<{ url: string } | undefined>(undefined);

        const mutate = useCallback(async (file: any) => {
          setIsLoading(true);
          setIsError(false);
          setIsSuccess(false);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
          if (Math.random() > 0.1) {
            const newUrl = 'https://i.pravatar.cc/150?img=' + Math.floor(Math.random() * 70);
            setData({ url: newUrl });
            setIsSuccess(true);
            setIsLoading(false);
            return { success: true, url: newUrl };
          } else {
            setIsError(true);
            setIsLoading(false);
            throw new Error('Photo upload failed.');
          }
        }, []);

        return { mutate, isLoading, isError, isSuccess, reset: () => { setIsLoading(false); setIsError(false); setIsSuccess(false); }, data };
      },
    },
    deletePhoto: {
      useMutation: () => {
        const [isLoading, setIsLoading] = useState(false);
        const [isError, setIsError] = useState(false);
        const [isSuccess, setIsSuccess] = useState(false);

        const mutate = useCallback(async () => {
          setIsLoading(true);
          setIsError(false);
          setIsSuccess(false);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
          if (Math.random() > 0.1) {
            setIsSuccess(true);
            setIsLoading(false);
            return { success: true };
          } else {
            setIsError(true);
            setIsLoading(false);
            throw new Error('Failed to delete photo.');
          }
        }, []);

        return { mutate, isLoading, isError, isSuccess, reset: () => { setIsLoading(false); setIsError(false); setIsSuccess(false); } };
      },
    },
  },
};

// 4. Mock Toast Notification
const showToast = (message: string, type: 'success' | 'error' | 'info') => {
  Alert.alert(type.toUpperCase(), message);
};

// 5. Mock Image Picker (for photo upload)
const mockImagePicker = {
  launchImageLibrary: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { uri: 'file://mock/path/to/new/photo.jpg', name: 'new_photo.jpg', type: 'image/jpeg' };
  },
};

// --- MOCK DEPENDENCIES END ---

const ProfileScreen: React.FC = () => {
  // Use the mock theme
  const { colors } = theme;
  // Mock navigation hook
  const navigation = useNavigation();

  // 1. Data Fetching (Read Operation)
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError, refetch, isRefetching } = trpc.user.getProfile.useQuery();

  // 2. Data Update (Update Operation)
  const { mutate: updateProfile, isLoading: isUpdating, isError: isUpdateError, isSuccess: isUpdateSuccess, reset: resetUpdate } = trpc.user.updateProfile.useMutation();

  // 3. Photo Upload (Create/Update Photo Operation)
  const { mutate: uploadPhoto, isLoading: isUploading, isError: isUploadError, isSuccess: isUploadSuccess, reset: resetUpload, data: uploadData } = trpc.user.uploadPhoto.useMutation();

  // 4. Photo Delete (Delete Photo Operation)
  const { mutate: deletePhoto, isLoading: isDeleting, isError: isDeleteError, isSuccess: isDeleteSuccess, reset: resetDelete } = trpc.user.deletePhoto.useMutation();

  // Local state for form fields
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [validationErrors, setValidationErrors] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  // Effect to populate form when profile data is loaded
  React.useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
      });
      setPhotoUrl(profile.profilePhotoUrl);
    }
  }, [profile]);

  // Effect to handle mutation success/error and refetch
  React.useEffect(() => {
    if (isUpdateSuccess) {
      showToast('Profile updated successfully!', 'success');
      refetch();
      resetUpdate();
    }
    if (isUpdateError) {
      showToast('Failed to save changes.', 'error');
      resetUpdate();
    }
    if (isUploadSuccess) {
      showToast('Profile photo uploaded!', 'success');
      // Use the URL returned from the mock mutation
      setPhotoUrl(uploadData?.url);
      refetch();
      resetUpload();
    }
    if (isUploadError) {
      showToast('Photo upload failed.', 'error');
      resetUpload();
    }
    if (isDeleteSuccess) {
      showToast('Profile photo removed!', 'success');
      setPhotoUrl(undefined);
      refetch();
      resetDelete();
    }
    if (isDeleteError) {
      showToast('Failed to remove photo.', 'error');
      resetDelete();
    }
  }, [isUpdateSuccess, isUpdateError, isUploadSuccess, isUploadError, isDeleteSuccess, isDeleteError, refetch, resetUpdate, resetUpload, resetDelete, uploadData]);

  const handleInputChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error on change
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    let isValid = true;
    const errors = { firstName: '', lastName: '', phone: '' };

    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required.';
      isValid = false;
    }
    if (!form.lastName.trim()) {
      errors.lastName = 'Last name is required.';
      isValid = false;
    }
    if (!/^\d{3}-\d{4}$/.test(form.phone.trim())) { // Simple phone format validation
      errors.phone = 'Phone must be in 555-1234 format.';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSave = () => {
    if (validateForm()) {
      updateProfile(form);
    } else {
      showToast('Please correct the errors in the form.', 'error');
    }
  };

  const handlePhotoUpload = async () => {
    try {
      // Mock launching image library
      const result = await mockImagePicker.launchImageLibrary();
      if (result && result.uri) {
        // Simulate file object for tRPC mutation
        uploadPhoto({ file: result });
      }
    } catch (error) {
      showToast('Image selection cancelled or failed.', 'error');
    }
  };

  const handlePhotoDelete = () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePhoto() },
      ]
    );
  };

  const kycColor = useMemo(() => {
    switch (profile?.kycStatus) {
      case 'Verified':
        return colors.success;
      case 'Pending':
        return colors.accent;
      case 'Rejected':
        return colors.error;
      default:
        return colors.text;
    }
  }, [profile?.kycStatus, colors]);

  const isFormLoading = isProfileLoading || isUpdating || isUploading || isDeleting;

  const renderContent = () => {
    if (isProfileLoading && !profile) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10 }}>Loading Profile...</Text>
        </View>
      );
    }

    if (isProfileError) {
      return (
        <View style={styles.centered}>
          <Text style={{ color: colors.error, textAlign: 'center' }}>
            Failed to load profile.
          </Text>
          <Button mode="contained" onPress={refetch} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      );
    }

    if (!profile) {
      return (
        <View style={styles.centered}>
          <Text>No profile data available.</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.photoContainer}>
            <Avatar.Image
              size={100}
              source={photoUrl ? { uri: photoUrl } : { uri: 'https://via.placeholder.com/150/007AFF/FFFFFF?text=A' }}
              style={{ backgroundColor: colors.surface }}
            />
            <View style={styles.photoButtons}>
              <Button
                mode="outlined"
                onPress={handlePhotoUpload}
                loading={isUploading}
                disabled={isFormLoading}
                icon="camera"
                style={styles.photoButton}
              >
                {photoUrl ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {photoUrl && (
                <Button
                  mode="text"
                  onPress={handlePhotoDelete}
                  loading={isDeleting}
                  disabled={isFormLoading}
                  icon="delete"
                  color={colors.error}
                  style={styles.photoButton}
                >
                  Remove
                </Button>
              )}
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="KYC Status" />
          <Card.Content>
            <Text style={[styles.kycStatus, { color: kycColor }]}>
              {profile.kycStatus}
            </Text>
            <Text style={styles.kycDetail}>
              {profile.kycStatus === 'Verified'
                ? 'Your identity has been successfully verified.'
                : 'Please complete the verification process.'}
            </Text>
            {profile.kycStatus !== 'Verified' && (
              <Button mode="contained" style={styles.kycButton} onPress={() => navigation.navigate('KYC_FLOW' as never)}>
                Start Verification
              </Button>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Personal Information" />
          <Card.Content>
            <TextInput
              label="First Name"
              value={form.firstName}
              onChangeText={text => handleInputChange('firstName', text)}
              mode="outlined"
              style={styles.input}
              disabled={isFormLoading}
              error={!!validationErrors.firstName}
            />
            <HelperText type="error" visible={!!validationErrors.firstName}>
              {validationErrors.firstName}
            </HelperText>

            <TextInput
              label="Last Name"
              value={form.lastName}
              onChangeText={text => handleInputChange('lastName', text)}
              mode="outlined"
              style={styles.input}
              disabled={isFormLoading}
              error={!!validationErrors.lastName}
            />
            <HelperText type="error" visible={!!validationErrors.lastName}>
              {validationErrors.lastName}
            </HelperText>

            <TextInput
              label="Email (Read-Only)"
              value={profile.email}
              mode="outlined"
              style={styles.input}
              disabled={true}
            />

            <TextInput
              label="Phone Number (555-1234)"
              value={form.phone}
              onChangeText={text => handleInputChange('phone', text)}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              disabled={isFormLoading}
              error={!!validationErrors.phone}
            />
            <HelperText type="error" visible={!!validationErrors.phone}>
              {validationErrors.phone}
            </HelperText>

            <Button
              mode="contained"
              onPress={handleSave}
              loading={isUpdating}
              disabled={isFormLoading}
              style={styles.saveButton}
            >
              Save Changes
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header>
        <Appbar.Content title="My Profile" />
        <Appbar.Action icon="cog" onPress={() => navigation.navigate('Settings' as never)} />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isProfileLoading}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  retryButton: {
    marginTop: 15,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  photoButtons: {
    marginLeft: 20,
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  photoButton: {
    marginVertical: 4,
  },
  input: {},
  saveButton: {
    marginTop: 16,
  },
  kycStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  kycDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  kycButton: {
    alignSelf: 'flex-start',
  }
});

export default ProfileScreen;
