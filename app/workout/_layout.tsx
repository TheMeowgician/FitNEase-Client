import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { reverbService } from '../../services/reverbService';
import { useLobbyStore } from '../../stores/lobbyStore';

export default function WorkoutLayout() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const pathname = usePathname();
  const hasNavigatedToSessionRef = useRef<Set<string>>(new Set());
  // CRITICAL: Always-fresh pathname ref for async closures (handleAppStateChange,
  // checkForMissedWorkoutStart, Zustand subscriber). Using `pathname` directly in
  // those closures captures a stale value from when the closure was created.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    // Monitor app state changes to check for missed workout starts
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user?.id]);

  // Subscribe to lobby store changes globally
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up global lobby state listener for background monitoring...');

    // Subscribe to lobby store state changes
    const unsubscribe = useLobbyStore.subscribe((state) => {
      // Check current lobby for workout start
      const lobbyState = state.currentLobby;
      if (!lobbyState) return;

      const sessionId = lobbyState.session_id;
      const status = lobbyState.status;

      // Check if workout started and we haven't navigated yet for this session
      if ((status === 'in_progress' || status === 'starting') && !hasNavigatedToSessionRef.current.has(sessionId)) {
          // CRITICAL: Use pathnameRef.current (always fresh) instead of closure `pathname`
          // (stale — captured when useEffect last ran, not when subscriber fires)
          const currentPath = pathnameRef.current;
          const isOnSessionScreen = currentPath?.includes('/workout/session');
          const isOnLobbyScreen = currentPath?.includes('/workout/group-lobby');

          if (!isOnSessionScreen && !isOnLobbyScreen) {
            console.log('🚨 BACKGROUND WORKOUT START DETECTED!', {
              sessionId,
              status,
              currentPath,
              membersCount: lobbyState.members?.length
            });

            // Check if user is in this lobby
            const isUserInLobby = lobbyState.members?.some((m: any) => m.user_id === Number(user.id));

            if (isUserInLobby) {
              console.log('✅ User is in lobby - navigating to session...');
              navigateToSession(lobbyState);
              hasNavigatedToSessionRef.current.add(sessionId);
            }
        } else if (isOnLobbyScreen) {
          // User is on lobby screen - let the lobby screen handle navigation
          console.log('✅ User on lobby screen - let lobby handle navigation');
        }
      }
    });

    return () => {
      console.log('🔕 Cleaning up global lobby state listener');
      unsubscribe();
    };
  }, [user?.id, pathname]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log('📱 App state changed:', appState.current, '->', nextAppState);

    // When app comes to foreground, check if workout started while in background
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App returned to foreground - checking for missed workout starts...');
      await checkForMissedWorkoutStart();
    }

    appState.current = nextAppState;
  };

  const navigateToSession = (lobbyState: any) => {
    try {
      // Transform workout data to session format
      const workoutSession = {
        session_id: lobbyState.session_id,
        session_name: `Group Tabata Workout`,
        difficulty_level: lobbyState.workout_data?.group_analysis?.fitness_level_range === 'homogeneous' ? 'intermediate' : 'intermediate',
        total_exercises: lobbyState.workout_data?.exercises?.length || 0,
        total_duration_minutes: lobbyState.workout_data?.tabata_structure?.total_duration_minutes || 0,
        estimated_calories: lobbyState.workout_data?.exercises?.reduce((sum: number, ex: any) => sum + (ex.estimated_calories_burned || 0), 0) || 0,
        exercises: lobbyState.workout_data?.exercises || [],
        created_at: new Date().toISOString(),
      };

      console.log('🚀 Navigating to workout session:', {
        sessionId: lobbyState.session_id,
        groupId: lobbyState.group_id,
        initiatorId: lobbyState.initiator_id
      });

      // Navigate to workout session
      router.push({
        pathname: '/workout/session',
        params: {
          type: 'group_tabata',
          sessionData: JSON.stringify(workoutSession),
          initiatorId: lobbyState.initiator_id.toString(),
          groupId: lobbyState.group_id.toString(),
        },
      });
    } catch (error) {
      console.error('❌ Error navigating to session:', error);
    }
  };

  const checkForMissedWorkoutStart = async () => {
    if (!user) return;

    // CRITICAL FIX: Don't navigate if already on session or lobby screen.
    // Without this, permission dialogs (e.g. Agora camera) cause inactive→active
    // app state transition, which triggers this function and pushes a DUPLICATE
    // session screen on top of the existing one.
    const currentPath = pathnameRef.current;
    if (currentPath?.includes('/workout/session') || currentPath?.includes('/workout/group-lobby')) {
      console.log('📱 Already on workout screen, skipping missed workout check:', currentPath);
      return;
    }

    try {
      // Check all group lobbies for active sessions
      const keys = await AsyncStorage.getAllKeys();
      const lobbyKeys = keys.filter(key => key.startsWith(`activeLobby_group_`) && key.endsWith(`_user_${user.id}`));

      console.log('🔍 Found active lobby keys:', lobbyKeys);

      for (const key of lobbyKeys) {
        const lobbyData = await AsyncStorage.getItem(key);
        if (!lobbyData) continue;

        const parsedData = JSON.parse(lobbyData);
        const { sessionId, groupId, status, timestamp } = parsedData;

        // Check if lobby data is fresh (less than 1 hour old)
        const isStale = Date.now() - timestamp > 3600000;
        if (isStale) {
          console.log('🗑️ Removing stale lobby data:', key);
          await AsyncStorage.removeItem(key);
          continue;
        }

        console.log('🔍 Checking lobby session:', { sessionId, groupId, status });

        // Get current lobby state from store
        const lobbyState = useLobbyStore.getState().currentLobby;

        // Only process if this is the current lobby session
        if (lobbyState && lobbyState.session_id === sessionId && (lobbyState.status === 'in_progress' || lobbyState.status === 'starting')) {
          console.log('🚨 MISSED WORKOUT START! Navigating to session...');

          // Mark this session as navigated (prevents subscriber from duplicating)
          hasNavigatedToSessionRef.current.add(sessionId);

          // Transform workout data to session format
          const workoutSession = {
            session_id: lobbyState.session_id,
            session_name: `Group Tabata Workout`,
            difficulty_level: lobbyState.workout_data?.group_analysis?.fitness_level_range === 'homogeneous' ? 'intermediate' : 'intermediate',
            total_exercises: lobbyState.workout_data?.exercises?.length || 0,
            total_duration_minutes: lobbyState.workout_data?.tabata_structure?.total_duration_minutes || 0,
            estimated_calories: lobbyState.workout_data?.exercises?.reduce((sum: number, ex: any) => sum + (ex.estimated_calories_burned || 0), 0) || 0,
            exercises: lobbyState.workout_data?.exercises || [],
            created_at: new Date().toISOString(),
          };

          // Navigate to workout session
          router.push({
            pathname: '/workout/session',
            params: {
              type: 'group_tabata',
              sessionData: JSON.stringify(workoutSession),
              initiatorId: lobbyState.initiator_id.toString(),
              groupId: lobbyState.group_id.toString(),
            },
          });

          break; // Only navigate once
        }
      }
    } catch (error) {
      console.error('❌ Error checking for missed workout starts:', error);
    }
  };

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
      <Stack.Screen
        name="lobby-workout-preview"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="exercise-rating"
        options={{
          headerShown: false, // Hide header for seamless rating experience
          gestureEnabled: false, // Prevent swiping back to workout
        }}
      />
      <Stack.Screen
        name="workout-detail"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
