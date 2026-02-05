import React, { useState, useEffect } from 'react';
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

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  schoolName: string;
}

interface Application {
  id: string;
  studentName: string;
  schoolName: string;
  totalAmount: number;
  installmentAmount: number;
  numberOfInstallments: number;
  status: string;
  paidInstallments: number;
  totalOutstanding: number;
}

export default function SchoolFeesScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // In production, fetch from API
      // const studentsData = await fetch('/api/v1/students/guardian/{guardianId}');
      // const applicationsData = await fetch('/api/v1/applications/guardian/{guardianId}');
      
      // Mock data for demonstration
      setStudents([
        {
          id: '1',
          firstName: 'Chioma',
          lastName: 'Okafor',
          grade: 'JSS 2',
          schoolName: 'Lagos International School',
        },
        {
          id: '2',
          firstName: 'Emeka',
          lastName: 'Okafor',
          grade: 'Primary 5',
          schoolName: 'St. Mary\'s Primary School',
        },
      ]);

      setApplications([
        {
          id: '1',
          studentName: 'Chioma Okafor',
          schoolName: 'Lagos International School',
          totalAmount: 450000,
          installmentAmount: 50000,
          numberOfInstallments: 9,
          status: 'approved',
          paidInstallments: 3,
          totalOutstanding: 300000,
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const searchSchools = async (query: string) => {
    if (query.length < 3) {
      setSchools([]);
      return;
    }

    try {
      setSearchingSchools(true);
      // In production, fetch from API
      // const response = await fetch(`/api/v1/schools/search?q=${query}`);
      
      // Mock data
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
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to search schools');
    } finally {
      setSearchingSchools(false);
    }
  };

  const handleRegisterStudent = () => {
    router.push('/(school-fees)/register-student');
  };

  const handleApplyForInstallment = (studentId: string) => {
    router.push({
      pathname: '/(school-fees)/apply',
      params: { studentId },
    });
  };

  const handleViewApplication = (applicationId: string) => {
    router.push({
      pathname: '/(school-fees)/application-details',
      params: { applicationId },
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading school fees data...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">School Fees</Text>
          <Text className="mt-2 text-base text-muted">
            Pay school fees in installments with 0-12% interest
          </Text>
        </View>

        {/* Summary Cards */}
        <View className="mb-6 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-sm text-muted">Total Students</Text>
            <Text className="mt-1 text-2xl font-bold text-foreground">
              {students.length}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-sm text-muted">Active Plans</Text>
            <Text className="mt-1 text-2xl font-bold text-primary">
              {applications.filter(a => a.status === 'approved').length}
            </Text>
          </View>
        </View>

        {/* Students Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-semibold text-foreground">My Students</Text>
            <TouchableOpacity
              onPress={handleRegisterStudent}
              className="px-4 py-2 rounded-full bg-primary"
            >
              <Text className="text-sm font-semibold text-background">+ Add Student</Text>
            </TouchableOpacity>
          </View>

          {students.length === 0 ? (
            <View className="rounded-2xl bg-surface p-6 border border-border items-center">
              <Text className="text-base text-muted text-center">
                No students registered yet. Add a student to get started.
              </Text>
            </View>
          ) : (
            students.map((student) => (
              <View
                key={student.id}
                className="mb-3 rounded-2xl bg-surface p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground">
                      {student.firstName} {student.lastName}
                    </Text>
                    <Text className="mt-1 text-sm text-muted">{student.schoolName}</Text>
                    <Text className="mt-1 text-sm text-muted">Grade: {student.grade}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleApplyForInstallment(student.id)}
                    className="px-4 py-2 rounded-full bg-primary"
                  >
                    <Text className="text-sm font-semibold text-background">Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Active Applications Section */}
        {applications.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-semibold text-foreground mb-3">
              Active Payment Plans
            </Text>

            {applications.map((app) => (
              <TouchableOpacity
                key={app.id}
                onPress={() => handleViewApplication(app.id)}
                className="mb-3 rounded-2xl bg-surface p-4 border border-border"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {app.studentName}
                    </Text>
                    <Text className="mt-1 text-sm text-muted">{app.schoolName}</Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      app.status === 'approved'
                        ? 'bg-success/20'
                        : app.status === 'pending'
                        ? 'bg-warning/20'
                        : 'bg-error/20'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        app.status === 'approved'
                          ? 'text-success'
                          : app.status === 'pending'
                          ? 'text-warning'
                          : 'text-error'
                      }`}
                    >
                      {app.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-xs text-muted">Total Fee</Text>
                    <Text className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(app.totalAmount)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted">Installment</Text>
                    <Text className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(app.installmentAmount)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted">Outstanding</Text>
                    <Text className="mt-1 text-sm font-semibold text-primary">
                      {formatCurrency(app.totalOutstanding)}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 pt-3 border-t border-border">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      {app.paidInstallments} of {app.numberOfInstallments} paid
                    </Text>
                    <View className="flex-1 mx-3 h-2 rounded-full bg-border overflow-hidden">
                      <View
                        className="h-full bg-success"
                        style={{
                          width: `${(app.paidInstallments / app.numberOfInstallments) * 100}%`,
                        }}
                      />
                    </View>
                    <Text className="text-xs font-semibold text-foreground">
                      {Math.round((app.paidInstallments / app.numberOfInstallments) * 100)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search Schools Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-3">
            Search Schools
          </Text>

          <View className="rounded-2xl bg-surface border border-border overflow-hidden">
            <TextInput
              className="px-4 py-3 text-base text-foreground"
              placeholder="Search by school name or location..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                searchSchools(text);
              }}
            />
          </View>

          {searchingSchools && (
            <View className="mt-3 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {schools.length > 0 && (
            <View className="mt-3">
              {schools.map((school) => (
                <View
                  key={school.id}
                  className="mb-2 rounded-2xl bg-surface p-4 border border-border"
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
                        <Text className="text-xs font-semibold text-success">✓ Verified</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* How It Works Section */}
        <View className="mb-6 rounded-2xl bg-surface p-6 border border-border">
          <Text className="text-lg font-semibold text-foreground mb-4">How It Works</Text>

          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Text className="text-sm font-bold text-background">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Register Student</Text>
                <Text className="mt-1 text-xs text-muted">
                  Add your child's details and select their school
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Text className="text-sm font-bold text-background">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Apply for Installment</Text>
                <Text className="mt-1 text-xs text-muted">
                  Choose payment plan (2-12 months) with flexible down payment
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Text className="text-sm font-bold text-background">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Get Approved</Text>
                <Text className="mt-1 text-xs text-muted">
                  Instant approval for most applications
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <Text className="text-sm font-bold text-background">4</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Pay Monthly</Text>
                <Text className="mt-1 text-xs text-muted">
                  Automatic reminders and easy payment options
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Interest Rates Section */}
        <View className="mb-6 rounded-2xl bg-surface p-6 border border-border">
          <Text className="text-lg font-semibold text-foreground mb-4">Interest Rates</Text>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">2-3 months</Text>
              <Text className="text-sm font-semibold text-success">0% interest</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">4-6 months</Text>
              <Text className="text-sm font-semibold text-foreground">5% interest</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">7-9 months</Text>
              <Text className="text-sm font-semibold text-foreground">8% interest</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">10-12 months</Text>
              <Text className="text-sm font-semibold text-foreground">12% interest</Text>
            </View>
          </View>

          <View className="mt-4 pt-4 border-t border-border">
            <Text className="text-xs text-muted">
              * Platform service fee: 1.5% of total fee
            </Text>
            <Text className="text-xs text-muted mt-1">
              * Late payment fee: 1% per week (max 10%)
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
