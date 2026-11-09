import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="shoot/[id]" options={{ contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="review" options={{ contentStyle: { backgroundColor: '#000' }, gestureEnabled: false }} />
        <Stack.Screen
          name="about"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
      </Stack>
    </>
  );
}
