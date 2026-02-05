import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import {
  FinancialAdvisor,
  AdvisorMatch,
  UserProfile,
  Consultation,
  ConsultationSlot,
  loadAdvisors,
  loadUserProfile,
  saveUserProfile,
  matchAdvisors,
  loadConsultations,
  bookConsultation,
  cancelConsultation,
  getFeeStructureLabel,
  calculateEstimatedFee,
  getMatchScoreColor,
  getMatchScoreLabel,
  generateAvailableSlots,
} from "@/utils/advisor-matching";

export default function AdvisorMatchingScreen() {
  const colors = useColors();
  const [matches, setMatches] = useState<AdvisorMatch[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<FinancialAdvisor | null>(null);
  const [availableSlots, setAvailableSlots] = useState<ConsultationSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ConsultationSlot | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({
    goals: [],
  });

  const goalOptions = ["retirement", "estate", "tax", "investment", "debt", "budgeting"];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const loadedProfile = await loadUserProfile();
      setProfile(loadedProfile);

      if (loadedProfile) {
        const loadedMatches = await matchAdvisors(loadedProfile);
        setMatches(loadedMatches);
      }

      const loadedConsultations = await loadConsultations();
      setConsultations(loadedConsultations);
    } catch (error) {
      console.error("Failed to load advisor matching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!profileForm.netWorth || !profileForm.location || !profileForm.country) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }

      if (!profileForm.goals || profileForm.goals.length === 0) {
        Alert.alert("Error", "Please select at least one financial goal");
        return;
      }

      const newProfile: UserProfile = {
        netWorth: profileForm.netWorth,
        goals: profileForm.goals,
        location: profileForm.location,
        country: profileForm.country,
        preferredFeeStructure: profileForm.preferredFeeStructure,
        maxFee: profileForm.maxFee,
      };

      await saveUserProfile(newProfile);
      await loadData();
      setShowProfileModal(false);
      Alert.alert("Success", "Profile saved and advisors matched!");
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert("Error", "Failed to save profile");
    }
  }

  async function handleViewAdvisor(advisor: FinancialAdvisor) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setSelectedAdvisor(advisor);
      const slots = await generateAvailableSlots(advisor.id);
      setAvailableSlots(slots);
      setShowAdvisorModal(true);
    } catch (error) {
      console.error("Failed to view advisor:", error);
    }
  }

  async function handleBookConsultation() {
    try {
      if (!selectedAdvisor || !selectedSlot) {
        Alert.alert("Error", "Please select a time slot");
        return;
      }

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const consultation: Consultation = {
        id: Date.now().toString(),
        advisorId: selectedAdvisor.id,
        slotId: selectedSlot.id,
        userId: "user-1", // In real app, get from auth
        date: selectedSlot.date,
        duration: selectedSlot.duration,
        type: selectedSlot.type,
        status: "scheduled",
      };

      await bookConsultation(consultation);
      await loadData();
      setShowBookingModal(false);
      setShowAdvisorModal(false);
      setSelectedSlot(null);
      Alert.alert("Success", "Consultation booked successfully!");
    } catch (error) {
      console.error("Failed to book consultation:", error);
      Alert.alert("Error", "Failed to book consultation");
    }
  }

  async function handleCancelConsultation(consultationId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      Alert.alert("Cancel Consultation", "Are you sure you want to cancel this consultation?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            await cancelConsultation(consultationId);
            await loadData();
            Alert.alert("Success", "Consultation cancelled");
          },
        },
      ]);
    } catch (error) {
      console.error("Failed to cancel consultation:", error);
    }
  }

  function toggleGoal(goal: string) {
    const currentGoals = profileForm.goals || [];
    if (currentGoals.includes(goal)) {
      setProfileForm({
        ...profileForm,
        goals: currentGoals.filter((g) => g !== goal),
      });
    } else {
      setProfileForm({
        ...profileForm,
        goals: [...currentGoals, goal],
      });
    }
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading advisor matches...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Financial Advisor Matching</Text>
            <Text className="text-sm text-muted">Find the right advisor for your goals</Text>
          </View>

          {/* Profile Card */}
          {profile ? (
            <View className="bg-primary rounded-2xl p-4">
              <Text className="text-sm text-white opacity-80 mb-2">Your Profile</Text>
              <Text className="text-lg font-semibold text-white mb-1">
                Net Worth: ${profile.netWorth.toLocaleString()}
              </Text>
              <Text className="text-sm text-white opacity-90 mb-1">
                Location: {profile.location}, {profile.country}
              </Text>
              <Text className="text-sm text-white opacity-90">
                Goals: {profile.goals.join(", ")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setProfileForm(profile);
                  setShowProfileModal(true);
                }}
                className="bg-white rounded-lg p-2 items-center mt-3"
                style={{ opacity: 0.9 }}
              >
                <Text className="text-primary text-sm font-semibold">Update Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowProfileModal(true)}
              className="bg-primary rounded-2xl p-6 items-center"
            >
              <Text className="text-white text-lg font-semibold">Create Your Profile</Text>
              <Text className="text-white text-sm opacity-80 mt-1">
                Get personalized advisor recommendations
              </Text>
            </TouchableOpacity>
          )}

          {/* Matched Advisors */}
          {matches.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Recommended Advisors ({matches.length})
              </Text>
              {matches.map((match) => (
                <View
                  key={match.advisor.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">
                        {match.advisor.name}
                      </Text>
                      <Text className="text-sm text-muted">{match.advisor.firm}</Text>
                      <Text className="text-xs text-muted mt-1">
                        {match.advisor.location}, {match.advisor.country}
                      </Text>
                    </View>
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: getMatchScoreColor(match.matchScore) }}
                    >
                      <Text className="text-white text-xs font-bold">
                        {match.matchScore}% Match
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-sm text-foreground">⭐ {match.advisor.rating}/5.0</Text>
                    <Text className="text-sm text-muted">
                      ({match.advisor.reviewCount} reviews)
                    </Text>
                    <Text className="text-sm text-muted">•</Text>
                    <Text className="text-sm text-muted">
                      {match.advisor.yearsExperience} years
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-1 mb-3">
                    {match.advisor.certifications.map((cert) => (
                      <View
                        key={cert}
                        className="bg-primary rounded-full px-2 py-1"
                        style={{ opacity: 0.2 }}
                      >
                        <Text className="text-xs font-medium text-foreground">{cert}</Text>
                      </View>
                    ))}
                  </View>

                  <Text className="text-sm text-muted mb-2">{match.advisor.bio}</Text>

                  <View className="bg-background rounded-xl p-3 mb-3">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Why this match:
                    </Text>
                    {match.matchReasons.map((reason, index) => (
                      <Text key={index} className="text-xs text-muted">
                        • {reason}
                      </Text>
                    ))}
                  </View>

                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm text-muted">
                      {getFeeStructureLabel(match.advisor.feeStructure)}
                    </Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {calculateEstimatedFee(match.advisor, profile?.netWorth || 0)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleViewAdvisor(match.advisor)}
                    className="bg-primary rounded-xl p-3 items-center"
                  >
                    <Text className="text-white font-semibold">View Profile & Book</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Scheduled Consultations */}
          {consultations.filter((c) => c.status === "scheduled").length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Scheduled Consultations
              </Text>
              {consultations
                .filter((c) => c.status === "scheduled")
                .map((consultation) => {
                  const advisor = matches.find(
                    (m) => m.advisor.id === consultation.advisorId
                  )?.advisor;
                  return (
                    <View
                      key={consultation.id}
                      className="bg-surface rounded-2xl p-4 border border-border"
                    >
                      <Text className="text-base font-semibold text-foreground mb-1">
                        {advisor?.name || "Advisor"}
                      </Text>
                      <Text className="text-sm text-muted mb-2">{advisor?.firm}</Text>
                      <View className="gap-1 mb-3">
                        <Text className="text-sm text-foreground">
                          📅 {new Date(consultation.date).toLocaleDateString()}
                        </Text>
                        <Text className="text-sm text-foreground">
                          🕐 {new Date(consultation.date).toLocaleTimeString()}
                        </Text>
                        <Text className="text-sm text-foreground">
                          ⏱️ {consultation.duration} minutes
                        </Text>
                        <Text className="text-sm text-foreground">
                          {consultation.type === "video"
                            ? "📹 Video Call"
                            : consultation.type === "phone"
                            ? "📞 Phone Call"
                            : "🏢 In Person"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCancelConsultation(consultation.id)}
                        className="bg-error rounded-lg p-2 items-center"
                        style={{ opacity: 0.8 }}
                      >
                        <Text className="text-white text-sm font-medium">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Your Profile</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Net Worth ($)</Text>
                  <TextInput
                    value={profileForm.netWorth?.toString()}
                    onChangeText={(text) =>
                      setProfileForm({ ...profileForm, netWorth: parseFloat(text) || 0 })
                    }
                    placeholder="100000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">City</Text>
                  <TextInput
                    value={profileForm.location}
                    onChangeText={(text) => setProfileForm({ ...profileForm, location: text })}
                    placeholder="Lagos"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Country</Text>
                  <TextInput
                    value={profileForm.country}
                    onChangeText={(text) => setProfileForm({ ...profileForm, country: text })}
                    placeholder="Nigeria"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Financial Goals</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {goalOptions.map((goal) => (
                      <TouchableOpacity
                        key={goal}
                        onPress={() => toggleGoal(goal)}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor: (profileForm.goals || []).includes(goal)
                            ? colors.primary
                            : colors.surface,
                          borderColor: (profileForm.goals || []).includes(goal)
                            ? colors.primary
                            : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: (profileForm.goals || []).includes(goal)
                              ? "#FFFFFF"
                              : colors.foreground,
                          }}
                        >
                          {goal}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => setShowProfileModal(false)}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Save & Match</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Advisor Detail Modal */}
      <Modal visible={showAdvisorModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedAdvisor && (
                <View className="gap-4">
                  <Text className="text-2xl font-bold text-foreground">
                    {selectedAdvisor.name}
                  </Text>
                  <Text className="text-base text-muted">{selectedAdvisor.firm}</Text>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Contact</Text>
                    <Text className="text-sm text-muted">📞 {selectedAdvisor.phone}</Text>
                    <Text className="text-sm text-muted">📧 {selectedAdvisor.email}</Text>
                    {selectedAdvisor.website && (
                      <Text className="text-sm text-primary">{selectedAdvisor.website}</Text>
                    )}
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Specializations</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {selectedAdvisor.specializations.map((spec) => (
                        <View
                          key={spec}
                          className="bg-primary rounded-full px-3 py-1"
                          style={{ opacity: 0.2 }}
                        >
                          <Text className="text-xs font-medium text-foreground">{spec}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setShowAdvisorModal(false);
                      setShowBookingModal(true);
                    }}
                    className="bg-success rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Book Consultation</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowAdvisorModal(false)}
                    className="bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Booking Modal */}
      <Modal visible={showBookingModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Select Time Slot</Text>

                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    onPress={() => setSelectedSlot(slot)}
                    className="rounded-xl p-4 border"
                    style={{
                      backgroundColor:
                        selectedSlot?.id === slot.id ? colors.primary : colors.surface,
                      borderColor: selectedSlot?.id === slot.id ? colors.primary : colors.border,
                      opacity: slot.booked ? 0.5 : 1,
                    }}
                    disabled={slot.booked}
                  >
                    <Text
                      className="text-base font-semibold mb-1"
                      style={{
                        color: selectedSlot?.id === slot.id ? "#FFFFFF" : colors.foreground,
                      }}
                    >
                      {new Date(slot.date).toLocaleDateString()}
                    </Text>
                    <Text
                      className="text-sm"
                      style={{
                        color: selectedSlot?.id === slot.id ? "#FFFFFF" : colors.muted,
                      }}
                    >
                      {new Date(slot.date).toLocaleTimeString()} • {slot.duration} min •{" "}
                      {slot.type}
                    </Text>
                    {slot.booked && (
                      <Text className="text-xs text-error mt-1">Already booked</Text>
                    )}
                  </TouchableOpacity>
                ))}

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowBookingModal(false);
                      setSelectedSlot(null);
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleBookConsultation}
                    className="flex-1 bg-success rounded-xl p-4 items-center"
                    disabled={!selectedSlot}
                    style={{ opacity: selectedSlot ? 1 : 0.5 }}
                  >
                    <Text className="text-white font-semibold">Confirm Booking</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
