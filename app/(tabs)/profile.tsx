import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const menuItems = [
    {
      title: 'Account',
      items: [
        { icon: '👤', label: 'Personal Information', route: '/(profile)/edit' },
        { icon: '🔒', label: 'Security Settings', route: '/(profile)/security' },
        { icon: '🔔', label: 'Notifications', route: '/(profile)/notifications' },
      ],
    },
    {
      title: 'Verification',
      items: [
        { icon: '✅', label: 'KYC Verification', route: '/(profile)/kyc' },
        { icon: '📄', label: 'KYC Status', route: '/(profile)/kyc-status' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: '❓', label: 'Help & Support', route: '/(profile)/help' },
        { icon: 'ℹ️', label: 'About', route: '/(profile)/about' },
      ],
    },
  ];

  const getKYCStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-success/20 text-success';
      case 'pending':
        return 'bg-warning/20 text-warning';
      case 'rejected':
        return 'bg-error/20 text-error';
      default:
        return 'bg-muted/20 text-muted';
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Profile' }} />

      <ScrollView className="flex-1">
        {/* Profile Header */}
        <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
          <View className="items-center mb-4">
            <View className="bg-primary rounded-full w-20 h-20 items-center justify-center mb-3">
              <Text className="text-white text-3xl font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-foreground">
              {user?.first_name} {user?.last_name}
            </Text>
            <Text className="text-muted">{user?.email}</Text>
          </View>

          {/* KYC Status Badge */}
          <View className={`px-4 py-2 rounded-full self-center ${getKYCStatusColor(user?.kyc_status || 'pending')}`}>
            <Text className="font-medium text-sm">
              KYC: {user?.kyc_status || 'pending'}
            </Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-6">
            <Text className="text-lg font-bold text-foreground mb-3">{section.title}</Text>
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  onPress={() => router.push(item.route as any)}
                  className={`flex-row items-center justify-between p-4 ${
                    itemIndex < section.items.length - 1 ? 'border-b border-border' : ''
                  }`}
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{item.icon}</Text>
                    <Text className="text-foreground font-medium">{item.label}</Text>
                  </View>
                  <Text className="text-muted">›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-error/10 border border-error rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">Logout</Text>
        </TouchableOpacity>

        <Text className="text-muted text-center text-sm mb-6">Version 1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
