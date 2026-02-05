import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

export default function PaymentsScreen() {
  const router = useRouter();

  const paymentActions = [
    {
      icon: '💸',
      title: 'Send Money',
      description: 'Transfer to any account',
      route: '/(payment)/send',
      color: 'bg-primary',
    },
    {
      icon: '📥',
      title: 'Receive Money',
      description: 'Generate QR code',
      route: '/(payment)/receive',
      color: 'bg-success',
    },
    {
      icon: '💳',
      title: 'Payment Methods',
      description: 'Manage your payment methods',
      route: '/(payment)/methods',
      color: 'bg-surface border border-border',
    },
  ];

  const quickActions = [
    { icon: '📊', label: 'Payment History', route: '/(account)/transactions' },
    { icon: '🔄', label: 'Recurring Payments', route: '/(payment)/recurring' },
    { icon: '📱', label: 'Mobile Money', route: '/(payment)/mobile-money' },
    { icon: '🏦', label: 'Bank Transfer', route: '/(payment)/bank-transfer' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payments' }} />

      <ScrollView className="flex-1">
        {/* Main Actions */}
        <Text className="text-2xl font-bold text-foreground mb-4">Quick Actions</Text>
        <View className="gap-3 mb-6">
          {paymentActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(action.route as any)}
              className={`${action.color} rounded-2xl p-6`}
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center">
                <Text className="text-4xl mr-4">{action.icon}</Text>
                <View className="flex-1">
                  <Text
                    className={`text-xl font-bold mb-1 ${
                      action.color.includes('primary') || action.color.includes('success')
                        ? 'text-white'
                        : 'text-foreground'
                    }`}
                  >
                    {action.title}
                  </Text>
                  <Text
                    className={`text-sm ${
                      action.color.includes('primary') || action.color.includes('success')
                        ? 'text-white/80'
                        : 'text-muted'
                    }`}
                  >
                    {action.description}
                  </Text>
                </View>
                <Text
                  className={
                    action.color.includes('primary') || action.color.includes('success')
                      ? 'text-white'
                      : 'text-muted'
                  }
                >
                  ›
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* More Options */}
        <Text className="text-lg font-bold text-foreground mb-3">More Options</Text>
        <View className="bg-surface rounded-xl border border-border overflow-hidden">
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                // For now, show coming soon for unimplemented features
                if (!['/(account)/transactions', '/(payment)/methods'].includes(action.route)) {
                  alert('Coming Soon');
                } else {
                  router.push(action.route as any);
                }
              }}
              className={`flex-row items-center justify-between p-4 ${
                index < quickActions.length - 1 ? 'border-b border-border' : ''
              }`}
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">{action.icon}</Text>
                <Text className="text-foreground font-medium">{action.label}</Text>
              </View>
              <Text className="text-muted">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Tips */}
        <View className="bg-surface rounded-xl p-4 mt-6 border border-border">
          <Text className="text-foreground font-semibold mb-2">💡 Payment Tips</Text>
          <Text className="text-muted text-sm mb-2">
            • Always verify recipient details before sending money
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Save frequent recipients for faster transfers
          </Text>
          <Text className="text-muted text-sm">
            • Enable biometric authentication for secure payments
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
