import { Stack } from 'expo-router';
import { useColors } from '@/hooks/use-colors';

export default function SettingsLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="webhooks"
        options={{
          title: 'Webhook Monitoring',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
