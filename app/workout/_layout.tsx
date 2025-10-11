import { Stack } from 'expo-router';
import { COLORS } from '../../constants/colors';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.NEUTRAL.WHITE,
        },
        headerTintColor: COLORS.SECONDARY[900],
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: COLORS.NEUTRAL.WHITE,
        },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen
        name="session"
        options={{
          headerShown: false, // Hide header for immersive workout experience
          gestureEnabled: false, // Prevent interrupting workout
        }}
      />
      <Stack.Screen
        name="group-lobby"
        options={{
          title: 'Group Workout Lobby',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}