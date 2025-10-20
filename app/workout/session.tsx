import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  StatusBar,
  Vibration,
  AppState,
  AppStateStatus,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../contexts/AuthContext';
import { contentService, TabataWorkout } from '../../services/microservices/contentService';
import { trackingService } from '../../services/microservices/trackingService';
import { socialService } from '../../services/microservices/socialService';
import { reverbService } from '../../services/reverbService';
import { TabataWorkoutSession } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS } from '../../constants/colors';
import { useLobbyStore } from '../../stores/lobbyStore';

type SessionPhase = 'prepare' | 'work' | 'rest' | 'roundRest' | 'complete';
type SessionStatus = 'ready' | 'running' | 'paused' | 'completed';

interface SessionState {
  currentRound: number;
  currentSet: number;
  currentExercise: number;
  phase: SessionPhase;
  status: SessionStatus;
  timeRemaining: number;
  totalTime: number;
  caloriesBurned: number;
}

export default function WorkoutSessionScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { workoutId, type, sessionData, initiatorId, groupId } = params;

  const [workout, setWorkout] = useState<TabataWorkout | null>(null);
  const [tabataSession, setTabataSession] = useState<TabataWorkoutSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    currentRound: 0,
    currentSet: 0,
    currentExercise: 0,
    phase: 'prepare',
    status: 'ready',
    timeRemaining: 10, // 10 second preparation
    totalTime: 0,
    caloriesBurned: 0,
  });

  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const appState = useRef(AppState.currentState);
  const isInitiator = user?.id.toString() === initiatorId;

  // Debug logging for button visibility
  console.log('🎮 [SESSION] Button visibility check:', {
    type: type,
    isGroupTabata: type === 'group_tabata',
    userId: user?.id,
    userIdAsString: user?.id.toString(),
    initiatorId: initiatorId,
    initiatorIdType: typeof initiatorId,
    isInitiator: isInitiator,
    comparisonResult: user?.id.toString() === initiatorId,
    sessionStatus: sessionState.status,
    shouldShowPause: sessionState.status === 'running' && (type !== 'group_tabata' || isInitiator),
    shouldShowAutoFinish: __DEV__ && sessionState.status === 'running' && (type !== 'group_tabata' || isInitiator)
  });

  useEffect(() => {
    loadWorkout();
    setupAudio();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      backHandler.remove();
      appStateSubscription?.remove();
      clearInterval(intervalRef.current!);
      if (sound) {
        sound.unloadAsync();
      }

      // Unsubscribe from session channel
      if (type === 'group_tabata' && tabataSession) {
        reverbService.unsubscribe(`private-session.${tabataSession.session_id}`);
      }
    };
  }, []);

  // Subscribe to session channel after tabataSession is loaded
  useEffect(() => {
    if (type === 'group_tabata' && tabataSession) {
      console.log('🏃 Group workout detected - setting up session subscription and auto-starting...');

      // Subscribe to session channel for pause/resume events
      setupSessionSubscription();

      // Auto-start after a short delay
      setTimeout(() => {
        startSession();
      }, 100);
    }
  }, [tabataSession]);

  useEffect(() => {
    // SERVER-AUTHORITATIVE: For group workouts, server controls timer
    // Only start client-side timer for solo workouts
    if (type === 'group_tabata') {
      console.log('🎮 [SERVER-AUTH] Group workout - using server timer');
      return; // Server sends ticks, no client timer needed
    }

    // Solo workout - use client-side timer
    if (sessionState.status === 'running') {
      startTimer();
    } else {
      clearInterval(intervalRef.current!);
    }

    return () => clearInterval(intervalRef.current!);
  }, [sessionState.status, type]);

  const loadWorkout = async () => {
    try {
      // Check if we have a generated Tabata session (new format)
      if (sessionData) {
        const session: TabataWorkoutSession = JSON.parse(sessionData as string);
        setTabataSession(session);
        setSessionState(prev => ({
          ...prev,
          totalTime: session.total_duration_minutes * 60, // Convert minutes to seconds
        }));
        console.log(`✅ Loaded Tabata session with ${session.exercises.length} exercises`);
        return;
      }

      // Fallback to old workout ID format
      if (!workoutId) {
        Alert.alert('Error', 'No workout specified');
        router.back();
        return;
      }

      const workoutData = await contentService.getWorkout(workoutId as string);
      if (workoutData) {
        setWorkout(workoutData as any);
        setSessionState(prev => ({
          ...prev,
          totalTime: workoutData.total_duration_minutes * 60,
        }));
      } else {
        Alert.alert('Error', 'Workout not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading workout:', error);
      Alert.alert('Error', 'Failed to load workout');
      router.back();
    }
  };

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (error) {
      console.log('Audio setup error:', error);
    }
  };

  const setupSessionSubscription = () => {
    if (!tabataSession) return;

    const sessionId = tabataSession.session_id;
    console.log('📡 [SERVER-AUTH] Subscribing to server-authoritative timer:', sessionId);

    reverbService.subscribeToPrivateChannel(`session.${sessionId}`, {
      onEvent: (eventName, data) => {
        console.log('📨 Session event received:', eventName, data);

        // SERVER-AUTHORITATIVE TIMER: Listen to server ticks (single source of truth)
        if (eventName === 'SessionTick') {
          // Server sends timer update every second
          // NO client-side timer needed - server is truth!
          setSessionState(prev => ({
            ...prev,
            timeRemaining: data.time_remaining,
            phase: data.phase,
            currentExercise: data.current_exercise,
            currentSet: data.current_set,
            currentRound: data.current_round,
            caloriesBurned: data.calories_burned,
            status: data.status, // Server controls status too
          }));
          return; // Don't process other events
        }

        if (eventName === 'WorkoutPaused') {
          console.log(`⏸️ Workout paused by ${data.paused_by_name}`);

          // INSTANT PAUSE: Pause IMMEDIATELY for all clients (like in games)
          // This prevents the "delay then jump" visual glitch
          setSessionState(prev => {
            // CLIENT-SIDE PREDICTION with LATENCY COMPENSATION
            // The pause event took time to arrive, so we need to adjust the time
            let adjustedTimeRemaining = prev.timeRemaining;

            if (data.session_state && data.session_state.time_remaining !== null) {
              // Calculate how far off we are from the server state
              const serverTime = data.session_state.time_remaining;
              const localTime = prev.timeRemaining;
              const timeDrift = localTime - serverTime;

              console.log('🔄 [SYNC] Latency compensation:', {
                serverTime,
                localTime,
                timeDrift,
                willAdjust: Math.abs(timeDrift) > 2 // Only adjust if drift > 2 seconds
              });

              // If drift is significant (>2 seconds), use server time
              // If drift is small (<2 seconds), use local time for smooth experience
              if (Math.abs(timeDrift) > 2) {
                adjustedTimeRemaining = serverTime;
              } else {
                // Small drift - use local time to avoid visual jump
                adjustedTimeRemaining = localTime;
              }

              return {
                ...prev,
                status: 'paused',
                timeRemaining: adjustedTimeRemaining,
                phase: data.session_state.phase || prev.phase,
                currentExercise: data.session_state.current_exercise ?? prev.currentExercise,
                currentSet: data.session_state.current_set ?? prev.currentSet,
                currentRound: data.session_state.current_round ?? prev.currentRound,
                caloriesBurned: data.session_state.calories_burned ?? prev.caloriesBurned,
              };
            }

            // Fallback: just pause at current time
            return { ...prev, status: 'paused' };
          });
        } else if (eventName === 'WorkoutResumed') {
          console.log(`▶️ Workout resumed by ${data.resumed_by_name}`);

          // INSTANT RESUME: Resume IMMEDIATELY for all clients
          // Sync to exact server state to ensure perfect synchronization
          setSessionState(prev => {
            let adjustedTimeRemaining = prev.timeRemaining;

            if (data.session_state && data.session_state.time_remaining !== null) {
              // Use server time for exact sync
              adjustedTimeRemaining = data.session_state.time_remaining;

              console.log('▶️ [RESUME] Syncing and resuming from server state:', {
                serverTime: data.session_state.time_remaining,
                localTime: prev.timeRemaining,
                willUseServerTime: true
              });

              return {
                ...prev,
                status: 'running',
                timeRemaining: adjustedTimeRemaining,
                phase: data.session_state.phase || prev.phase,
                currentExercise: data.session_state.current_exercise ?? prev.currentExercise,
                currentSet: data.session_state.current_set ?? prev.currentSet,
                currentRound: data.session_state.current_round ?? prev.currentRound,
                caloriesBurned: data.session_state.calories_burned ?? prev.caloriesBurned,
              };
            }

            console.log('▶️ [RESUME] Resuming from current position:', prev.timeRemaining);
            return { ...prev, status: 'running' };
          });
        } else if (eventName === 'WorkoutStopped') {
          console.log(`🛑 Workout stopped by ${data.stopped_by_name}`);
          // Clear AsyncStorage and lobby state
          clearLobbyAndStorage();

          // Navigate immediately to group screen (don't wait for user to dismiss alert)
          if (groupId) {
            console.log('🏠 [WORKOUT STOPPED] Navigating to group screen:', groupId);
            router.replace(`/groups/${groupId}`);
          } else {
            console.log('🏠 [WORKOUT STOPPED] No group ID, going back');
            router.back();
          }

          // Show alert after navigation (non-blocking)
          setTimeout(() => {
            Alert.alert(
              'Workout Ended',
              `The workout has been stopped by ${data.stopped_by_name}.`,
              [{ text: 'OK' }]
            );
          }, 500);
        } else if (eventName === 'MemberLeftSession') {
          console.log(`👋 Member left session: ${data.member_name}`);
          // Show toast notification that member left
          Alert.alert(
            'Member Left',
            `${data.member_name} has left the workout session.`,
            [{ text: 'OK' }],
            { cancelable: true }
          );
        } else if (eventName === 'WorkoutCompleted') {
          console.log(`✅ Workout finished by ${data.initiatorName}`);
          // Complete the workout for this member
          setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
          setTimeout(() => completeSession(), 100);
        }
      },
    });
  };

  const playSound = async (type: 'start' | 'rest' | 'complete') => {
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        // You would add actual sound files here
        type === 'start' ? require('../../assets/sounds/start.mp3') :
        type === 'rest' ? require('../../assets/sounds/rest.mp3') :
        require('../../assets/sounds/complete.mp3')
      );
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.log('Sound play error:', error);
      // Fallback to vibration
      Vibration.vibrate(type === 'complete' ? [0, 500, 200, 500] : 200);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - resume if needed
    }
    appState.current = nextAppState;
  };

  const handleBackPress = () => {
    if (sessionState.status === 'running') {
      // For group workouts, only initiator can pause - skip pause for non-initiators
      if (type === 'group_tabata' && !isInitiator) {
        // Non-initiator trying to exit - show confirm dialog without pausing
        Alert.alert(
          'Leave Workout',
          'Are you sure you want to leave this workout? You will exit the session.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: exitSession }
          ]
        );
        return true;
      }

      // Solo workout or group initiator - pause then show exit dialog
      pauseSession();
      Alert.alert(
        'Exit Workout',
        'Are you sure you want to exit this workout? Your progress will be lost.',
        [
          { text: 'Continue', onPress: resumeSession },
          { text: 'Exit', style: 'destructive', onPress: exitSession }
        ]
      );
      return true;
    }
    return false;
  };

  const startTimer = () => {
    clearInterval(intervalRef.current!);
    intervalRef.current = setInterval(() => {
      setSessionState(prev => {
        if (prev.timeRemaining <= 1) {
          return handlePhaseComplete(prev);
        }
        // Calculate calories burned per second
        const totalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300; // Default 300 if not set
        const totalMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32; // Default 32 mins
        const caloriesPerSecond = totalCalories / totalMinutes / 60;

        return {
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
          caloriesBurned: prev.caloriesBurned + caloriesPerSecond
        };
      });
    }, 1000);
  };

  const handlePhaseComplete = (currentState: SessionState): SessionState => {
    const { phase, currentRound, currentSet, currentExercise } = currentState;

    switch (phase) {
      case 'prepare':
        playSound('start');
        return {
          ...currentState,
          phase: 'work',
          timeRemaining: 20, // 20 seconds work
        };

      case 'work':
        playSound('rest');
        if (currentSet >= 7) { // 8 sets completed (0-7)
          // Determine total exercises (new Tabata session or old workout format)
          const totalExercises = tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);

          if (currentExercise >= totalExercises - 1) {
            // Workout complete
            playSound('complete');
            return {
              ...currentState,
              phase: 'complete',
              status: 'completed',
              timeRemaining: 0,
            };
          } else {
            // Move to next exercise with round rest (60 seconds between exercises)
            return {
              ...currentState,
              phase: 'roundRest',
              timeRemaining: 60, // 1 minute rest between exercises (Tabata standard)
              currentExercise: currentExercise + 1,
              currentSet: 0,
            };
          }
        } else {
          // Regular rest between sets
          return {
            ...currentState,
            phase: 'rest',
            timeRemaining: 10, // 10 seconds rest
          };
        }

      case 'rest':
        playSound('start');
        return {
          ...currentState,
          phase: 'work',
          timeRemaining: 20,
          currentSet: currentSet + 1,
        };

      case 'roundRest':
        playSound('start');
        return {
          ...currentState,
          phase: 'work',
          timeRemaining: 20,
          currentRound: currentRound + 1,
        };

      default:
        return currentState;
    }
  };

  /**
   * Clear lobby state and AsyncStorage
   */
  const clearLobbyAndStorage = async () => {
    if (!tabataSession || !groupId || !user) return;

    const sessionId = tabataSession.session_id;
    const storageKey = `activeLobby_group_${groupId}_user_${user.id}`;

    console.log('🗑️ [CLEANUP] Clearing lobby and storage', {
      sessionId,
      groupId,
      storageKey
    });

    try {
      // Clear AsyncStorage
      await AsyncStorage.removeItem(storageKey);
      console.log('✅ [CLEANUP] AsyncStorage cleared');

      // Unsubscribe from session channel (prevent receiving pause/resume/stop events after leaving)
      reverbService.unsubscribe(`private-session.${sessionId}`);
      console.log('✅ [CLEANUP] Unsubscribed from session channel');

      // Unsubscribe from lobby channel (uses private- prefix)
      reverbService.unsubscribe(`private-lobby.${sessionId}`);
      console.log('✅ [CLEANUP] Unsubscribed from lobby channel');

      // Clear lobby from global store
      const store = useLobbyStore.getState();
      store.clearLobby();
      console.log('✅ [CLEANUP] Lobby cleared from global store');
    } catch (error) {
      console.error('❌ [CLEANUP] Failed to clear lobby/storage:', error);
    }
  };

  const startSession = () => {
    setSessionStartTime(new Date());
    setSessionState(prev => ({ ...prev, status: 'running' }));
  };

  const pauseSession = async () => {
    console.log('⏸️ [PAUSE] Pause button pressed');
    // For group workouts, only initiator can pause
    if (type === 'group_tabata') {
      if (!isInitiator) {
        Alert.alert('Notice', 'Only the workout initiator can pause the session.');
        return;
      }

      console.log('⏸️ [SERVER-AUTH] Sending pause to server');
      // Server-authoritative: Just tell server to pause
      // Server will pause instantly and broadcast to all clients
      if (tabataSession) {
        try {
          await socialService.pauseWorkout(tabataSession.session_id);
          console.log('✅ [SERVER-AUTH] Pause request sent to server');
        } catch (error) {
          console.error('❌ [PAUSE] Failed to pause:', error);
          Alert.alert('Error', 'Failed to pause workout');
        }
      }
    } else {
      // Solo workout - pause immediately
      console.log('⏸️ [PAUSE] Solo workout - pausing immediately');
      setSessionState(prev => ({ ...prev, status: 'paused' }));
    }
  };

  const resumeSession = async () => {
    console.log('▶️ [RESUME] Resume button pressed');
    // For group workouts, only initiator can resume
    if (type === 'group_tabata') {
      if (!isInitiator) {
        Alert.alert('Notice', 'Only the workout initiator can resume the session.');
        return;
      }

      console.log('▶️ [SERVER-AUTH] Sending resume to server');
      // Server-authoritative: Just tell server to resume
      // Server will resume instantly and continue broadcasting ticks
      if (tabataSession) {
        try {
          await socialService.resumeWorkout(tabataSession.session_id);
          console.log('✅ [SERVER-AUTH] Resume request sent to server');
        } catch (error) {
          console.error('❌ [RESUME] Failed to resume:', error);
          Alert.alert('Error', 'Failed to resume workout');
        }
      }
    } else {
      // Solo workout - resume immediately
      console.log('▶️ [RESUME] Solo workout - resuming immediately');
      setSessionState(prev => ({ ...prev, status: 'running' }));
    }
  };

  const stopGroupSession = async () => {
    console.log('🛑 [STOP] Stop button pressed');
    if (!isInitiator) {
      Alert.alert('Notice', 'Only the workout initiator can stop the session for everyone.');
      return;
    }

    Alert.alert(
      'Stop Workout for All',
      'Are you sure you want to stop the workout for all members? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop for All',
          style: 'destructive',
          onPress: async () => {
            // Broadcast stop to all members
            if (tabataSession) {
              try {
                console.log('🛑 [STOP] Broadcasting stop to all members');
                await socialService.stopWorkout(tabataSession.session_id);
                console.log('✅ [STOP] Stop broadcasted successfully');
              } catch (error) {
                console.error('❌ [STOP] Failed to broadcast stop:', error);
              }
            }

            // Clear local storage and state
            await clearLobbyAndStorage();

            // Navigate to group screen
            if (groupId) {
              console.log('🏠 [STOP] Navigating to group screen:', groupId);
              router.replace(`/groups/${groupId}`);
            } else {
              console.log('🛑 [STOP] Exiting session for initiator');
              router.back();
            }
          }
        }
      ]
    );
  };

  const exitSession = async () => {
    console.log('❌ [EXIT] Exit session called');

    try {
      if (sessionStartTime && user) {
        // Use session_id for new Tabata sessions, or workoutId for old format
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

        // Save partial session data
        await trackingService.createWorkoutSession({
          workoutId: sessionId,
          userId: Number(user.id),
          sessionType: type === 'group_tabata' ? 'group' : 'individual',
          startTime: sessionStartTime,
          endTime: new Date(),
          duration: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000 / 60), // minutes
          caloriesBurned: Math.floor(sessionState.caloriesBurned),
          completed: false,
          notes: `Session ended early - ${tabataSession ? `${sessionState.currentExercise + 1}/${tabataSession.exercises.length} exercises completed` : 'Partial workout'}`
        });
      }

      // For group workouts, leave lobby and clean up
      if (type === 'group_tabata' && tabataSession && user) {
        try {
          console.log('👋 [EXIT] Leaving lobby and notifying session members...');

          // Leave the lobby (removes user from lobby members list)
          // Backend automatically broadcasts member left event to LOBBY channel
          await socialService.leaveLobbyV2(tabataSession.session_id);
          console.log('✅ [EXIT] Left lobby successfully');

          // Clear local storage and state
          await clearLobbyAndStorage();
          console.log('✅ [EXIT] Cleanup completed');
        } catch (error) {
          console.error('❌ [EXIT] Failed to leave lobby:', error);
        }
      }
    } catch (error) {
      console.error('❌ [EXIT] Error saving partial session:', error);
    }

    // Navigate to groups screen for group workouts, otherwise go back
    if (type === 'group_tabata' && groupId) {
      console.log('🏠 [EXIT] Navigating to group screen:', groupId);
      router.replace(`/groups/${groupId}`);
    } else {
      router.back();
    }
  };

  const completeSession = async () => {
    try {
      if (sessionStartTime && user) {
        // Use session_id for new Tabata sessions, or workoutId for old format
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

        await trackingService.createWorkoutSession({
          workoutId: sessionId,
          userId: Number(user.id),
          sessionType: type === 'group_tabata' ? 'group' : 'individual',
          startTime: sessionStartTime,
          endTime: new Date(),
          duration: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000 / 60),
          caloriesBurned: Math.floor(sessionState.caloriesBurned),
          completed: true,
          notes: tabataSession
            ? `Completed ${tabataSession.exercises.length}-exercise Tabata workout (${tabataSession.difficulty_level} level)`
            : 'Tabata workout completed'
        });
      }

      const sessionSummary = tabataSession
        ? `${tabataSession.total_exercises} exercises • ${tabataSession.total_duration_minutes} min`
        : 'Full workout';

      Alert.alert(
        'Workout Complete! 🎉',
        `Great job! You burned approximately ${Math.floor(sessionState.caloriesBurned)} calories.\n\n${sessionSummary}`,
        [
          { text: 'Done', onPress: () => router.back() }
        ]
      );
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Session saved locally', 'Your workout data will sync when connection is restored.');
      router.back();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    switch (sessionState.phase) {
      case 'prepare': return '#3B82F6';
      case 'work': return '#EF4444';
      case 'rest': return '#10B981';
      case 'roundRest': return '#F59E0B';
      case 'complete': return '#8B5CF6';
      default: return COLORS.PRIMARY[600];
    }
  };

  const getPhaseText = () => {
    switch (sessionState.phase) {
      case 'prepare': return 'GET READY';
      case 'work': return 'WORK';
      case 'rest': return 'REST';
      case 'roundRest': return 'ROUND BREAK';
      case 'complete': return 'COMPLETE';
      default: return '';
    }
  };

  const getCurrentExercise = () => {
    if (tabataSession) {
      return tabataSession.exercises[sessionState.currentExercise];
    }
    if (!workout || !workout.rounds) return null;
    return workout.rounds[sessionState.currentExercise];
  };

  const getWorkoutName = () => {
    return tabataSession ? tabataSession.session_name : workout?.workout_name || 'Tabata Workout';
  };

  const getTotalExercises = () => {
    return tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);
  };

  if (!workout && !tabataSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: getPhaseColor() }]} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={getPhaseColor()} />

      {/* Top Bar with Close Button */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.workoutBadge}>
            <Ionicons name="fitness" size={14} color="white" />
            <Text style={styles.workoutBadgeText}>TABATA</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={sessionState.status === 'ready' ? router.back : handleBackPress}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progress</Text>
            <Text style={styles.progressPercentage}>
              {Math.round(((sessionState.currentExercise * 8 + sessionState.currentSet) / (getTotalExercises() * 8)) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((sessionState.currentExercise * 8 + sessionState.currentSet) / (getTotalExercises() * 8)) * 100}%`
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Exercise {sessionState.currentExercise + 1} of {getTotalExercises()} • Set {sessionState.currentSet + 1} of 8
          </Text>
        </View>

        {/* Phase Badge */}
        <View style={styles.phaseBadge}>
          <Text style={styles.phaseText}>{getPhaseText()}</Text>
        </View>

        {/* Circular Timer - Apple Style */}
        <View style={styles.timerSection}>
          <View style={styles.circularTimerContainer}>
            {/* Outer Glow Effect */}
            <View style={styles.timerGlowOuter} />
            <View style={styles.timerGlowMiddle} />

            {/* Background Circle */}
            <View style={styles.circularTimerBackground} />

            {/* Progress Dots Ring - Smooth filling animation */}
            <View style={styles.progressDotsContainer}>
              {Array.from({ length: 60 }).map((_, index) => {
                const totalDuration =
                  sessionState.phase === 'work' ? 20 :
                  sessionState.phase === 'rest' ? 10 :
                  sessionState.phase === 'roundRest' ? 60 :
                  sessionState.phase === 'prepare' ? 10 :
                  10;

                const progress = (1 - sessionState.timeRemaining / totalDuration) * 60;
                const isActive = index < progress;
                const angle = (index * 6) - 90; // 360/60 = 6 degrees per dot, start from top
                const radius = 108; // Distance from center
                const x = 120 + radius * Math.cos(angle * Math.PI / 180);
                const y = 120 + radius * Math.sin(angle * Math.PI / 180);

                return (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      {
                        left: x - 3,
                        top: y - 3,
                        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.15)',
                        transform: [{ scale: isActive ? 1.2 : 1 }],
                        shadowOpacity: isActive ? 0.8 : 0,
                      }
                    ]}
                  />
                );
              })}
            </View>

            {/* Inner Circle - Creates the ring effect */}
            <View style={styles.timerInnerCircle} />

            {/* Timer Text */}
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>{sessionState.timeRemaining}</Text>
              <Text style={styles.timerLabel}>seconds</Text>
            </View>
          </View>

        </View>

        {/* Current Exercise Card */}
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseCardHeader}>
            <Ionicons name="barbell" size={18} color="white" />
            <Text style={styles.exerciseCardTitle}>Current Exercise</Text>
          </View>
          <Text style={styles.exerciseName}>
            {getCurrentExercise()?.exercise_name || 'Get Ready'}
          </Text>
          {sessionState.phase !== 'prepare' && getCurrentExercise() && (
            <View style={styles.exerciseMetaContainer}>
              <View style={styles.exerciseMeta}>
                <Ionicons name="body" size={14} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.exerciseMetaText}>
                  {(getCurrentExercise() as any)?.target_muscle_group || 'Full Body'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="flame" size={20} color="white" />
            </View>
            <Text style={styles.statValue}>{Math.floor(sessionState.caloriesBurned) || 0}</Text>
            <Text style={styles.statLabel}>Calories Burned</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time" size={20} color="white" />
            </View>
            <Text style={styles.statValue}>
              {formatTime((sessionStartTime ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000) : 0))}
            </Text>
            <Text style={styles.statLabel}>Time Elapsed</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {sessionState.status === 'ready' && type !== 'group_tabata' && (
            <TouchableOpacity style={styles.primaryButton} onPress={startSession}>
              <Ionicons name="play" size={32} color={getPhaseColor()} />
              <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>START WORKOUT</Text>
            </TouchableOpacity>
          )}

          {sessionState.status === 'ready' && type === 'group_tabata' && (
            <View style={styles.preparingContainer}>
              <ActivityIndicator size="large" color={getPhaseColor()} />
              <Text style={[styles.preparingText, { color: getPhaseColor() }]}>
                Get Ready! Starting in {sessionState.timeRemaining}s...
              </Text>
            </View>
          )}

          {/* Only show pause button for initiator in group workouts, or always for solo workouts */}
          {sessionState.status === 'running' && (type !== 'group_tabata' || isInitiator) && (
            <TouchableOpacity style={styles.primaryButton} onPress={pauseSession}>
              <Ionicons name="pause" size={32} color={getPhaseColor()} />
              <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>PAUSE</Text>
            </TouchableOpacity>
          )}

          {/* Show waiting message for non-initiators during running state */}
          {sessionState.status === 'running' && type === 'group_tabata' && !isInitiator && (
            <View style={styles.waitingContainer}>
              <Ionicons name="people" size={24} color="white" />
              <Text style={styles.waitingText}>Synced with group</Text>
            </View>
          )}

          {/* Only show resume/stop buttons for initiator in group workouts, or always for solo workouts */}
          {sessionState.status === 'paused' && (type !== 'group_tabata' || isInitiator) && (
            <View style={styles.pausedControls}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resumeSession}>
                <Ionicons name="play" size={24} color="white" />
                <Text style={styles.secondaryButtonText}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={type === 'group_tabata' ? stopGroupSession : exitSession}>
                <Ionicons name="stop" size={24} color="white" />
                <Text style={styles.secondaryButtonText}>{type === 'group_tabata' ? 'STOP FOR ALL' : 'END'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show paused message for non-initiators */}
          {sessionState.status === 'paused' && type === 'group_tabata' && !isInitiator && (
            <View style={styles.waitingContainer}>
              <Ionicons name="pause-circle" size={32} color="white" />
              <Text style={styles.waitingText}>Paused by host</Text>
              <Text style={styles.waitingSubtext}>Waiting to resume...</Text>
            </View>
          )}

          {/* Auto Finish Button - DEV ONLY for testing - Only for group initiator or solo workouts */}
          {__DEV__ && sessionState.status === 'running' && (type !== 'group_tabata' || isInitiator) && (
            <TouchableOpacity
              style={[styles.secondaryButton, {
                backgroundColor: 'rgba(251, 146, 60, 0.25)',
                borderColor: 'rgba(251, 146, 60, 0.4)',
                marginTop: 12,
                maxWidth: '100%',
              }]}
              onPress={async () => {
                if (type === 'group_tabata' && tabataSession) {
                  // For group workouts, broadcast finish to all members
                  try {
                    console.log('🏁 [AUTO FINISH] Broadcasting finish to all members');
                    console.log('🏁 [AUTO FINISH] Session ID:', tabataSession.session_id);
                    await socialService.finishWorkout(tabataSession.session_id);
                    console.log('✅ [AUTO FINISH] Finish broadcasted successfully');
                    // Complete locally as well
                    setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
                    setTimeout(() => completeSession(), 100);
                  } catch (error) {
                    console.error('❌ [AUTO FINISH] Failed to broadcast finish:', error);
                    Alert.alert('Error', 'Failed to finish workout for all members');
                  }
                } else {
                  // Solo workout - finish immediately
                  setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
                  setTimeout(() => completeSession(), 100);
                }
              }}
            >
              <Ionicons name="flash" size={24} color="#F59E0B" />
              <Text style={[styles.secondaryButtonText, { color: '#F59E0B' }]}>
                {type === 'group_tabata' ? 'FINISH FOR ALL (TEST)' : 'AUTO FINISH (TEST)'}
              </Text>
            </TouchableOpacity>
          )}

          {sessionState.status === 'completed' && (
            <TouchableOpacity style={styles.primaryButton} onPress={completeSession}>
              <Ionicons name="checkmark" size={32} color={getPhaseColor()} />
              <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>COMPLETE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Next Exercise Preview */}
        {sessionState.status === 'running' && sessionState.currentExercise < getTotalExercises() - 1 && (
          <View style={styles.nextExerciseCard}>
            <View style={styles.nextExerciseHeader}>
              <Ionicons name="arrow-forward-circle" size={16} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.nextExerciseLabel}>UP NEXT</Text>
            </View>
            <Text style={styles.nextExerciseName}>
              {tabataSession
                ? tabataSession.exercises[sessionState.currentExercise + 1]?.exercise_name
                : workout?.rounds[sessionState.currentExercise + 1]?.exercise_name}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: FONTS.REGULAR,
    color: 'white',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 60,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  workoutBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  progressCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    color: 'white',
    opacity: 0.9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressPercentage: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    opacity: 0.85,
    letterSpacing: 0.3,
  },
  phaseBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  phaseText: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  circularTimerContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  timerGlowOuter: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  timerGlowMiddle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circularTimerBackground: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressDotsContainer: {
    position: 'absolute',
    width: 240,
    height: 240,
  },
  progressDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
  },
  timerInnerCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  timerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  timerText: {
    fontSize: 64,
    fontFamily: FONTS.BOLD,
    color: 'white',
    textAlign: 'center',
    lineHeight: 76,
    includeFontPadding: false,
  },
  timerLabel: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: 'white',
    opacity: 0.85,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  exerciseCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  exerciseCardTitle: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: 'white',
    opacity: 0.85,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  exerciseName: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: 'white',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  exerciseMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  exerciseMetaText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    letterSpacing: 0.2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    opacity: 0.85,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  controlsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 180,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  preparingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 220,
  },
  preparingText: {
    fontSize: 15,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.3,
    marginTop: 12,
    textAlign: 'center',
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 220,
  },
  waitingText: {
    fontSize: 15,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.3,
    marginTop: 8,
    textAlign: 'center',
  },
  waitingSubtext: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: 'white',
    opacity: 0.85,
    letterSpacing: 0.2,
    marginTop: 6,
    textAlign: 'center',
  },
  pausedControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    maxWidth: 160,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.3,
    marginLeft: 6,
  },
  nextExerciseCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  nextExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  nextExerciseLabel: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: 'white',
    opacity: 0.85,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nextExerciseName: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    letterSpacing: 0.2,
  },
});