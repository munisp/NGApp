import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router } from 'expo-router';

interface School {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  verificationStatus: string;
}

export default function RegisterStudentScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    grade: '',
    schoolSearch: '',
    studentId: '',
    guardianRelationship: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const grades = [
    'Nursery 1', 'Nursery 2', 'Nursery 3',
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
    'JSS 1', 'JSS 2', 'JSS 3',
    'SSS 1', 'SSS 2', 'SSS 3',
  ];

  const relationships = [
    'Father', 'Mother', 'Guardian', 'Uncle', 'Aunt', 'Grandparent', 'Other',
  ];

  const searchSchools = async (query: string) => {
    if (query.length < 3) {
      setSchools([]);
      return;
    }

    try {
      setSearchingSchools(true);
      // In production: const response = await fetch(`/api/v1/schools/search?q=${query}`);
      
      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setSchools([
        {
          id: '1',
          name: 'Lagos International School',
          address: '123 Victoria Island',
          city: 'Lagos',
          state: 'Lagos',
          verificationStatus: 'verified',
        },
        {
          id: '2',
          name: 'St. Mary\'s Primary School',
          address: '456 Ikeja',
          city: 'Lagos',
          state: 'Lagos',
          verificationStatus: 'verified',
        },
        {
          id: '3',
          name: 'Federal Government College',
          address: '789 Yaba',
          city: 'Lagos',
          state: 'Lagos',
          verificationStatus: 'verified',
        },
      ].filter(school => 
        school.name.toLowerCase().includes(query.toLowerCase()) ||
        school.city.toLowerCase().includes(query.toLowerCase())
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to search schools');
    } finally {
      setSearchingSchools(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      // Validate date format (DD/MM/YYYY)
      const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19|20)\d\d$/;
      if (!dateRegex.test(formData.dateOfBirth)) {
        newErrors.dateOfBirth = 'Invalid date format (DD/MM/YYYY)';
      } else {
        // Check if student is between 3 and 25 years old
        const [day, month, year] = formData.dateOfBirth.split('/').map(Number);
        const birthDate = new Date(year, month - 1, day);
        const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 3 || age > 25) {
          newErrors.dateOfBirth = 'Student must be between 3 and 25 years old';
        }
      }
    }

    if (!formData.grade) {
      newErrors.grade = 'Grade is required';
    }

    if (!selectedSchool) {
      newErrors.school = 'Please select a school';
    }

    if (!formData.studentId.trim()) {
      newErrors.studentId = 'Student ID is required';
    }

    if (!formData.guardianRelationship) {
      newErrors.guardianRelationship = 'Relationship is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    try {
      setLoading(true);

      // In production: POST to /api/v1/students
      const studentData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        grade: formData.grade,
        schoolId: selectedSchool!.id,
        studentId: formData.studentId,
        guardianRelationship: formData.guardianRelationship,
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Success',
        `${formData.firstName} ${formData.lastName} has been registered successfully!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to register student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-base text-primary">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Register Student</Text>
          <Text className="mt-2 text-base text-muted">
            Add your child's details to get started with school fees installment
          </Text>
        </View>

        {/* Student Information */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Student Information</Text>

          {/* First Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">First Name *</Text>
            <TextInput
              className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                errors.firstName ? 'border-error' : 'border-border'
              }`}
              placeholder="Enter first name"
              placeholderTextColor={colors.muted}
              value={formData.firstName}
              onChangeText={(text) => {
                setFormData({ ...formData, firstName: text });
                if (errors.firstName) {
                  setErrors({ ...errors, firstName: '' });
                }
              }}
            />
            {errors.firstName && (
              <Text className="mt-1 text-xs text-error">{errors.firstName}</Text>
            )}
          </View>

          {/* Last Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Last Name *</Text>
            <TextInput
              className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                errors.lastName ? 'border-error' : 'border-border'
              }`}
              placeholder="Enter last name"
              placeholderTextColor={colors.muted}
              value={formData.lastName}
              onChangeText={(text) => {
                setFormData({ ...formData, lastName: text });
                if (errors.lastName) {
                  setErrors({ ...errors, lastName: '' });
                }
              }}
            />
            {errors.lastName && (
              <Text className="mt-1 text-xs text-error">{errors.lastName}</Text>
            )}
          </View>

          {/* Date of Birth */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Date of Birth *</Text>
            <TextInput
              className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                errors.dateOfBirth ? 'border-error' : 'border-border'
              }`}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.muted}
              value={formData.dateOfBirth}
              keyboardType="numeric"
              maxLength={10}
              onChangeText={(text) => {
                // Auto-format date as user types
                let formatted = text.replace(/[^0-9]/g, '');
                if (formatted.length >= 2) {
                  formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                }
                if (formatted.length >= 5) {
                  formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                }
                setFormData({ ...formData, dateOfBirth: formatted });
                if (errors.dateOfBirth) {
                  setErrors({ ...errors, dateOfBirth: '' });
                }
              }}
            />
            {errors.dateOfBirth && (
              <Text className="mt-1 text-xs text-error">{errors.dateOfBirth}</Text>
            )}
          </View>

          {/* Grade */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Grade *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row gap-2">
                {grades.map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    onPress={() => {
                      setFormData({ ...formData, grade });
                      if (errors.grade) {
                        setErrors({ ...errors, grade: '' });
                      }
                    }}
                    className={`px-4 py-2 rounded-full border ${
                      formData.grade === grade
                        ? 'bg-primary border-primary'
                        : 'bg-surface border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        formData.grade === grade ? 'text-background' : 'text-foreground'
                      }`}
                    >
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {errors.grade && (
              <Text className="mt-1 text-xs text-error">{errors.grade}</Text>
            )}
          </View>

          {/* Student ID */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Student ID *</Text>
            <TextInput
              className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                errors.studentId ? 'border-error' : 'border-border'
              }`}
              placeholder="Enter student ID from school"
              placeholderTextColor={colors.muted}
              value={formData.studentId}
              onChangeText={(text) => {
                setFormData({ ...formData, studentId: text });
                if (errors.studentId) {
                  setErrors({ ...errors, studentId: '' });
                }
              }}
            />
            {errors.studentId && (
              <Text className="mt-1 text-xs text-error">{errors.studentId}</Text>
            )}
            <Text className="mt-1 text-xs text-muted">
              This ID will be verified with the school
            </Text>
          </View>
        </View>

        {/* School Selection */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">School *</Text>

          {selectedSchool ? (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {selectedSchool.name}
                  </Text>
                  <Text className="mt-1 text-sm text-muted">
                    {selectedSchool.address}, {selectedSchool.city}, {selectedSchool.state}
                  </Text>
                  {selectedSchool.verificationStatus === 'verified' && (
                    <View className="mt-2 self-start px-2 py-1 rounded-full bg-success/20">
                      <Text className="text-xs font-semibold text-success">✓ Verified</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedSchool(null);
                    if (errors.school) {
                      setErrors({ ...errors, school: '' });
                    }
                  }}
                  className="ml-2 px-3 py-1 rounded-full bg-error/20"
                >
                  <Text className="text-xs font-semibold text-error">Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput
                className="px-4 py-3 rounded-2xl bg-surface border border-border text-base text-foreground mb-3"
                placeholder="Search for school by name or location..."
                placeholderTextColor={colors.muted}
                value={formData.schoolSearch}
                onChangeText={(text) => {
                  setFormData({ ...formData, schoolSearch: text });
                  searchSchools(text);
                }}
              />

              {searchingSchools && (
                <View className="items-center py-4">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}

              {schools.length > 0 && (
                <View className="gap-2">
                  {schools.map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      onPress={() => {
                        setSelectedSchool(school);
                        setFormData({ ...formData, schoolSearch: '' });
                        setSchools([]);
                        if (errors.school) {
                          setErrors({ ...errors, school: '' });
                        }
                      }}
                      className="rounded-2xl bg-surface p-4 border border-border"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-foreground">
                            {school.name}
                          </Text>
                          <Text className="mt-1 text-sm text-muted">
                            {school.address}, {school.city}, {school.state}
                          </Text>
                        </View>
                        {school.verificationStatus === 'verified' && (
                          <View className="ml-2 px-2 py-1 rounded-full bg-success/20">
                            <Text className="text-xs font-semibold text-success">✓</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {formData.schoolSearch.length >= 3 && !searchingSchools && schools.length === 0 && (
                <View className="rounded-2xl bg-surface p-6 border border-border items-center">
                  <Text className="text-base text-muted text-center">
                    No schools found. Try a different search term.
                  </Text>
                </View>
              )}
            </>
          )}

          {errors.school && (
            <Text className="mt-1 text-xs text-error">{errors.school}</Text>
          )}
        </View>

        {/* Guardian Relationship */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Your Relationship *</Text>
          <View className="flex-row flex-wrap gap-2">
            {relationships.map((relationship) => (
              <TouchableOpacity
                key={relationship}
                onPress={() => {
                  setFormData({ ...formData, guardianRelationship: relationship });
                  if (errors.guardianRelationship) {
                    setErrors({ ...errors, guardianRelationship: '' });
                  }
                }}
                className={`px-4 py-2 rounded-full border ${
                  formData.guardianRelationship === relationship
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    formData.guardianRelationship === relationship
                      ? 'text-background'
                      : 'text-foreground'
                  }`}
                >
                  {relationship}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.guardianRelationship && (
            <Text className="mt-1 text-xs text-error">{errors.guardianRelationship}</Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          className={`rounded-2xl py-4 items-center ${
            loading ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-background">Register Student</Text>
          )}
        </TouchableOpacity>

        {/* Info Box */}
        <View className="mt-6 rounded-2xl bg-surface p-4 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">
            📋 What happens next?
          </Text>
          <Text className="text-xs text-muted leading-relaxed">
            After registration, we'll verify the student details with the school. This usually takes 1-2 business days. Once verified, you can apply for school fees installment plans.
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
