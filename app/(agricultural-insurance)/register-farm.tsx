import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router } from 'expo-router';

const SOIL_TYPES = ['Loamy', 'Sandy', 'Clay', 'Silty', 'Peaty', 'Chalky'];
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export default function RegisterFarmScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Form data
  const [farmName, setFarmName] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [soilType, setSoilType] = useState('');
  const [irrigation, setIrrigation] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showSoilDropdown, setShowSoilDropdown] = useState(false);

  const validateStep1 = () => {
    if (!farmName.trim()) {
      Alert.alert('Required', 'Please enter farm name');
      return false;
    }
    if (!state) {
      Alert.alert('Required', 'Please select state');
      return false;
    }
    if (!lga.trim()) {
      Alert.alert('Required', 'Please enter LGA');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (!latitude || isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid', 'Please enter valid latitude (-90 to 90)');
      return false;
    }
    if (!longitude || isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert('Invalid', 'Please enter valid longitude (-180 to 180)');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const size = parseFloat(farmSize);
    
    if (!farmSize || isNaN(size) || size <= 0 || size > 1000) {
      Alert.alert('Invalid', 'Please enter farm size (0.1 - 1000 hectares)');
      return false;
    }
    if (!soilType) {
      Alert.alert('Required', 'Please select soil type');
      return false;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      Alert.alert('Invalid', 'Please enter valid phone number');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // In production: POST to API
      const farmData = {
        farmer_id: 'USR001', // From auth context
        farm_name: farmName,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address,
          state,
          lga,
        },
        farm_size_hectares: parseFloat(farmSize),
        soil_type: soilType.toLowerCase(),
        irrigation_available: irrigation,
        phone_number: phoneNumber,
        email: email || undefined,
      };

      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Success',
        'Farm registered successfully! You can now apply for insurance.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to register farm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View className="gap-4">
      <Text className="text-xl font-bold text-foreground mb-2">Farm Information</Text>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Farm Name *</Text>
        <TextInput
          value={farmName}
          onChangeText={setFarmName}
          placeholder="e.g., Green Valley Farm"
          placeholderTextColor={colors.muted}
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">State *</Text>
        <TouchableOpacity
          onPress={() => setShowStateDropdown(!showStateDropdown)}
          className="rounded-xl px-4 py-3 bg-surface border border-border"
        >
          <Text className={state ? 'text-foreground' : 'text-muted'}>
            {state || 'Select state'}
          </Text>
        </TouchableOpacity>
        {showStateDropdown && (
          <ScrollView className="max-h-48 mt-2 rounded-xl bg-surface border border-border">
            {NIGERIAN_STATES.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  setState(s);
                  setShowStateDropdown(false);
                }}
                className="px-4 py-3 border-b border-border"
              >
                <Text className="text-foreground">{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Local Government Area (LGA) *
        </Text>
        <TextInput
          value={lga}
          onChangeText={setLga}
          placeholder="e.g., Ikeja"
          placeholderTextColor={colors.muted}
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Address (Optional)</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Street address or landmark"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={2}
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="gap-4">
      <Text className="text-xl font-bold text-foreground mb-2">GPS Location</Text>
      <Text className="text-sm text-muted mb-4">
        Enter your farm's GPS coordinates. You can use Google Maps to find these.
      </Text>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Latitude *</Text>
        <TextInput
          value={latitude}
          onChangeText={setLatitude}
          placeholder="e.g., 6.5244"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
        <Text className="text-xs text-muted mt-1">Range: -90 to 90</Text>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Longitude *</Text>
        <TextInput
          value={longitude}
          onChangeText={setLongitude}
          placeholder="e.g., 3.3792"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
        <Text className="text-xs text-muted mt-1">Range: -180 to 180</Text>
      </View>

      <View className="rounded-xl bg-primary/10 p-4 mt-4">
        <Text className="text-sm text-primary font-semibold mb-2">💡 How to find GPS coordinates:</Text>
        <Text className="text-sm text-foreground">
          1. Open Google Maps{'\n'}
          2. Long press on your farm location{'\n'}
          3. Tap the coordinates at the bottom{'\n'}
          4. Copy and paste here
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View className="gap-4">
      <Text className="text-xl font-bold text-foreground mb-2">Farm Details</Text>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Farm Size (Hectares) *</Text>
        <TextInput
          value={farmSize}
          onChangeText={setFarmSize}
          placeholder="e.g., 5.5"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
        <Text className="text-xs text-muted mt-1">Range: 0.1 - 1000 hectares</Text>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Soil Type *</Text>
        <TouchableOpacity
          onPress={() => setShowSoilDropdown(!showSoilDropdown)}
          className="rounded-xl px-4 py-3 bg-surface border border-border"
        >
          <Text className={soilType ? 'text-foreground' : 'text-muted'}>
            {soilType || 'Select soil type'}
          </Text>
        </TouchableOpacity>
        {showSoilDropdown && (
          <View className="mt-2 rounded-xl bg-surface border border-border">
            {SOIL_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => {
                  setSoilType(type);
                  setShowSoilDropdown(false);
                }}
                className="px-4 py-3 border-b border-border"
              >
                <Text className="text-foreground">{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Irrigation</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => setIrrigation(true)}
            className={`flex-1 rounded-xl py-3 border ${
              irrigation ? 'bg-primary border-primary' : 'bg-surface border-border'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                irrigation ? 'text-background' : 'text-foreground'
              }`}
            >
              Available
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIrrigation(false)}
            className={`flex-1 rounded-xl py-3 border ${
              !irrigation ? 'bg-primary border-primary' : 'bg-surface border-border'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                !irrigation ? 'text-background' : 'text-foreground'
              }`}
            >
              Not Available
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Phone Number *</Text>
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="+234 xxx xxx xxxx"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Email (Optional)</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          className="rounded-xl px-4 py-3 bg-surface border border-border text-foreground"
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Register Farm</Text>
          <Text className="mt-2 text-base text-muted">Step {step} of 3</Text>
        </View>

        {/* Progress Bar */}
        <View className="px-4 py-4 bg-background">
          <View className="flex-row gap-2">
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                className={`flex-1 h-2 rounded-full ${
                  s <= step ? 'bg-primary' : 'bg-surface'
                }`}
              />
            ))}
          </View>
        </View>

        {/* Form Content */}
        <View className="px-4 py-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>

        {/* Navigation Buttons */}
        <View className="px-4 pb-8 gap-3">
          {step > 1 && (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              disabled={loading}
              className="rounded-2xl py-4 bg-surface border border-border items-center"
            >
              <Text className="text-base font-semibold text-foreground">← Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            disabled={loading}
            className="rounded-2xl py-4 bg-primary items-center"
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-base font-semibold text-background">
                {step === 3 ? 'Register Farm' : 'Next →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
