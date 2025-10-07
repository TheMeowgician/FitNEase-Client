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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';

import { useAuth } from '../../contexts/AuthContext';
import { contentService, TabataWorkout } from '../../services/microservices/contentService';
import { trackingService } from '../../services/microservices/trackingService';
import { TabataWorkoutSession } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS } from '../../constants/colors';

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
  const { workoutId, type, sessionData } = params;

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
    };
  }, []);

  useEffect(() => {
    if (sessionState.status === 'running') {
      startTimer();
    } else {
      clearInterval(intervalRef.current!);
    }

    return () => clearInterval(intervalRef.current!);
  }, [sessionState.status]);

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
        const totalCalories = tabataSession ? tabataSession.estimated_calories : (workout?.estimated_calories_burned || 0);
        const totalMinutes = tabataSession ? tabataSession.total_duration_minutes : (workout?.total_duration_minutes || 1);
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

  const startSession = () => {
    setSessionStartTime(new Date());
    setSessionState(prev => ({ ...prev, status: 'running' }));
  };

  const pauseSession = () => {
    setSessionState(prev => ({ ...prev, status: 'paused' }));
  };

  const resumeSession = () => {
    setSessionState(prev => ({ ...prev, status: 'running' }));
  };

  const exitSession = async () => {
    try {
      if (sessionStartTime) {
        // Use session_id for new Tabata sessions, or workoutId for old format
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

        // Save partial session data
        await trackingService.createWorkoutSession({
          workoutId: sessionId,
          startTime: sessionStartTime,
          endTime: new Date(),
          duration: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000 / 60), // minutes
          caloriesBurned: Math.floor(sessionState.caloriesBurned),
          completed: false,
          notes: `Session ended early - ${tabataSession ? `${sessionState.currentExercise + 1}/${tabataSession.exercises.length} exercises completed` : 'Partial workout'}`
        });
      }
    } catch (error) {
      console.error('Error saving partial session:', error);
    }
    router.back();
  };

  const completeSession = async () => {
    try {
      if (sessionStartTime) {
        // Use session_id for new Tabata sessions, or workoutId for old format
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

        await trackingService.createWorkoutSession({
          workoutId: sessionId,
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
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={sessionState.status === 'ready' ? router.back : handleBackPress}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
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

        {/* Circular Timer - Apple Style */}
        <View style={styles.timerSection}>
          <Text style={styles.phaseText}>{getPhaseText()}</Text>


          <View style={styles.circularTimerContainer}>
            {/* Background Circle */}
            <View style={styles.circularTimerBackground} />

            {/* Progress Circle - Fills clockwise as time passes */}
            <View style={styles.circularProgressWrapper}>
              <View style={[
                styles.circularTimerProgressLeft,
                {
                  transform: [{
                    rotate: `${Math.min(((1 - sessionState.timeRemaining / (
                      sessionState.phase === 'work' ? 20 :
                      sessionState.phase === 'rest' ? 10 :
                      sessionState.phase === 'roundRest' ? 60 :
                      sessionState.phase === 'prepare' ? 10 :
                      10
                    )) * 360), 180)}deg`
                  }]
                }
              ]} />
              <View style={[
                styles.circularTimerProgressRight,
                {
                  opacity: ((1 - sessionState.timeRemaining / (
                    sessionState.phase === 'work' ? 20 :
                    sessionState.phase === 'rest' ? 10 :
                    sessionState.phase === 'roundRest' ? 60 :
                    sessionState.phase === 'prepare' ? 10 :
                    10
                  )) * 360) > 180 ? 1 : 0,
                  transform: [{
                    rotate: `${Math.max(((1 - sessionState.timeRemaining / (
                      sessionState.phase === 'work' ? 20 :
                      sessionState.phase === 'rest' ? 10 :
                      sessionState.phase === 'roundRest' ? 60 :
                      sessionState.phase === 'prepare' ? 10 :
                      10
                    )) * 360) - 180, 0)}deg`
                  }]
                }
              ]} />
            </View>

            {/* Timer Text */}
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>{sessionState.timeRemaining}</Text>
              <Text style={styles.timerLabel}>seconds</Text>
            </View>
          </View>

          {/* Current Exercise Name */}
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>
              {getCurrentExercise()?.exercise_name || 'Get Ready'}
            </Text>
            {sessionState.phase !== 'prepare' && getCurrentExercise() && (
              <Text style={styles.exerciseDetail}>
                Target: {(getCurrentExercise() as any)?.target_muscle_group || 'Full Body'}
              </Text>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={24} color="white" />
            <Text style={styles.statValue}>{Math.floor(sessionState.caloriesBurned)}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={24} color="white" />
            <Text style={styles.statValue}>
              {formatTime((sessionStartTime ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000) : 0))}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={24} color="white" />
            <Text style={styles.statValue}>--</Text>
            <Text style={styles.statLabel}>Heart Rate</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {sessionState.status === 'ready' && (
            <TouchableOpacity style={styles.primaryButton} onPress={startSession}>
              <Ionicons name="play" size={32} color={getPhaseColor()} />
              <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>START WORKOUT</Text>
            </TouchableOpacity>
          )}

          {sessionState.status === 'running' && (
            <TouchableOpacity style={styles.primaryButton} onPress={pauseSession}>
              <Ionicons name="pause" size={32} color={getPhaseColor()} />
              <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>PAUSE</Text>
            </TouchableOpacity>
          )}

          {sessionState.status === 'paused' && (
            <View style={styles.pausedControls}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resumeSession}>
                <Ionicons name="play" size={24} color="white" />
                <Text style={styles.secondaryButtonText}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={exitSession}>
                <Ionicons name="stop" size={24} color="white" />
                <Text style={styles.secondaryButtonText}>END</Text>
              </TouchableOpacity>
            </View>
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
          <View style={styles.nextExerciseContainer}>
            <Text style={styles.nextExerciseLabel}>NEXT EXERCISE</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 56,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  phaseText: {
    fontSize: 15,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 3,
    opacity: 0.9,
    marginBottom: 36,
  },
  circularTimerContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  circularTimerBackground: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 12,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  circularProgressWrapper: {
    position: 'absolute',
    width: 280,
    height: 280,
  },
  circularTimerProgressLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 12,
    borderColor: 'transparent',
    borderTopColor: 'white',
    borderRightColor: 'white',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-90deg' }],
  },
  circularTimerProgressRight: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 12,
    borderColor: 'transparent',
    borderTopColor: 'white',
    borderRightColor: 'white',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '90deg' }],
  },
  timerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 72,
    fontFamily: FONTS.BOLD,
    color: 'white',
    textAlign: 'center',
    lineHeight: 72,
  },
  timerLabel: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: 'white',
    opacity: 0.8,
    marginTop: 4,
    letterSpacing: 1,
  },
  exerciseInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  exerciseName: {
    fontSize: 26,
    fontFamily: FONTS.BOLD,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  exerciseDetail: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: 'white',
    opacity: 0.85,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: 'white',
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controlsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 160,
  },
  primaryButtonText: {
    fontSize: 17,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  pausedControls: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    minWidth: 140,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  nextExerciseContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 12,
  },
  nextExerciseLabel: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: 'white',
    opacity: 0.7,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nextExerciseName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});