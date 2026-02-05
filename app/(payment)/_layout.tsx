import { Stack } from 'expo-router';

export default function PaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="send"
        options={{
          title: 'Send Money',
        }}
      />
      <Stack.Screen
        name="receive"
        options={{
          title: 'Receive Money',
        }}
      />
      <Stack.Screen
        name="methods"
        options={{
          title: 'Payment Methods',
        }}
      />
      <Stack.Screen
        name="add-method"
        options={{
          title: 'Add Payment Method',
        }}
      />
      <Stack.Screen
        name="confirm"
        options={{
          title: 'Confirm Payment',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="receipt"
        options={{
          title: 'Payment Receipt',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
