import { Stack } from 'expo-router';
import { COLORS } from '../../constants/colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.NEUTRAL.WHITE,
        },
        animation: 'slide_from_right',
        gestureEnabled: false, // Prevent back gesture during onboarding
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role-selection" />
      <Stack.Screen name="fitness-assessment" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}