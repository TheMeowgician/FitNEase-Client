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
        name="[id]"
        options={{
          title: 'Workout Details',
        }}
      />
      <Stack.Screen
        name="session"
        options={{
          headerShown: false, // Hide header for immersive workout experience
          gestureEnabled: false, // Prevent interrupting workout
        }}
      />
      <Stack.Screen
        name="session/[sessionId]"
        options={{
          title: 'Workout Session',
          headerShown: false, // Hide header for immersive workout experience
          gestureEnabled: false, // Prevent interrupting workout
        }}
      />
      <Stack.Screen
        name="session/group/[groupId]"
        options={{
          title: 'Group Workout',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="planning/recommended"
        options={{
          title: 'Recommended Workouts',
        }}
      />
      <Stack.Screen
        name="planning/create"
        options={{
          title: 'Create Workout',
        }}
      />
    </Stack>
  );
}