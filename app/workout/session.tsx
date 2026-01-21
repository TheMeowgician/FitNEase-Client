import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  StatusBar,
  Vibration,
  AppState,
  AppStateStatus,
  ScrollView,
  ActivityIndicator,
  Modal,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useReverb } from '../../contexts/ReverbProvider';
import { contentService, TabataWorkout } from '../../services/microservices/contentService';
import { trackingService } from '../../services/microservices/trackingService';
import { socialService } from '../../services/microservices/socialService';
import { progressionService } from '../../services/microservices/progressionService';
import { reverbService } from '../../services/reverbService';
import { agoraService } from '../../services/agoraService';
import { TabataWorkoutSession } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS } from '../../constants/colors';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useProgressStore } from '../../stores/progressStore';
import ProgressUpdateModal from '../../components/ProgressUpdateModal';
import AgoraVideoCall from '../../components/video/AgoraVideoCall';

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
  const alert = useAlert();
  const { refreshGroupSubscriptions } = useReverb();
  const { refreshAfterWorkout } = useProgressStore();
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
  const phaseStartTimeRef = useRef<number>(Date.now());
  const phaseDurationRef = useRef<number>(10); // Default 10 seconds
  const currentPhaseRef = useRef<SessionPhase>('prepare'); // Track current phase for solo workouts
  const lastServerTickRef = useRef<number>(Date.now()); // Track last server tick time
  const lastServerTimeRef = useRef<number>(0); // Track last server time_remaining value
  const serverTickTimeoutRef = useRef<NodeJS.Timeout | number | null>(null); // Debounce server ticks
  const lastDisplayedTimeRef = useRef<number>(-1); // Track last displayed time to avoid redundant updates
  const wasAutoFinished = useRef<boolean>(false); // Track if AUTO FINISH button was used
  const appState = useRef(AppState.currentState);
  const isInitiator = user?.id.toString() === initiatorId;

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressBeforeStats, setProgressBeforeStats] = useState<any>(null);
  const [progressAfterStats, setProgressAfterStats] = useState<any>(null);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<any>(null);

  // Video call state
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [agoraCredentials, setAgoraCredentials] = useState<{
    token: string;
    channelName: string;
    appId: string;
    uid: number;
  } | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isVideoFullScreen, setIsVideoFullScreen] = useState(false);

  // Draggable video position
  const pan = useRef(new Animated.ValueXY({ x: Dimensions.get('window').width - 170, y: Dimensions.get('window').height - 320 })).current;
  const isDragging = useRef(false);

  // PanResponder for draggable video
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isVideoFullScreen, // Only allow drag in compact mode
      onMoveShouldSetPanResponder: () => !isVideoFullScreen,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        isDragging.current = false;
        pan.flattenOffset();

        // Get current position
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        console.log('📹 [DRAG] Release position:', { currentX, currentY });

        // Screen dimensions
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const videoWidth = 150;
        const videoHeight = 200;

        // Apply boundaries
        let finalX = currentX;
        let finalY = currentY;

        // Horizontal boundaries
        const minX = 20;
        const maxX = screenWidth - videoWidth - 20;
        if (finalX < minX) finalX = minX;
        if (finalX > maxX) finalX = maxX;

        // Vertical boundaries
        const minY = 80; // Below status bar
        const maxY = screenHeight - videoHeight - 120; // Above controls
        if (finalY < minY) finalY = minY;
        if (finalY > maxY) finalY = maxY;

        // Snap to nearest corner with LARGER threshold
        const snapThreshold = 150; // Increased from 100
        const distanceToLeft = finalX - minX;
        const distanceToRight = maxX - finalX;
        const distanceToTop = finalY - minY;
        const distanceToBottom = maxY - finalY;

        console.log('📹 [DRAG] Distances:', {
          left: distanceToLeft,
          right: distanceToRight,
          top: distanceToTop,
          bottom: distanceToBottom,
          threshold: snapThreshold,
        });

        let didSnap = false;

        // Snap horizontally if close to edge
        if (distanceToLeft < snapThreshold) {
          finalX = minX;
          didSnap = true;
          console.log('📹 [SNAP] Snapped to LEFT edge');
        } else if (distanceToRight < snapThreshold) {
          finalX = maxX;
          didSnap = true;
          console.log('📹 [SNAP] Snapped to RIGHT edge');
        }

        // Snap vertically if close to edge
        if (distanceToTop < snapThreshold) {
          finalY = minY;
          didSnap = true;
          console.log('📹 [SNAP] Snapped to TOP edge');
        } else if (distanceToBottom < snapThreshold) {
          finalY = maxY;
          didSnap = true;
          console.log('📹 [SNAP] Snapped to BOTTOM edge');
        }

        console.log('📹 [DRAG] Final position:', { finalX, finalY, didSnap });

        // Animate to final position with snap
        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
      },
    })
  ).current;

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

      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

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
    // ALL workouts (solo AND group) now use client-side prediction for smooth timer
    // Group workouts will sync to server ticks to correct drift
    if (sessionState.status === 'running') {
      startTimer();
    } else {
      // Clear timer when not running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
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
        alert.error('Error', 'No workout specified', () => router.back());
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
        alert.error('Error', 'Workout not found', () => router.back());
      }
    } catch (error) {
      console.error('Error loading workout:', error);
      alert.error('Error', 'Failed to load workout', () => router.back());
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

        // SERVER SYNC: Server sends ticks for synchronization
        // For GROUP workouts: Server is SINGLE SOURCE OF TRUTH (no local timer)
        // For SOLO workouts: Local timer with server correction (if implemented)
        if (eventName === 'SessionTick') {
          // DEBOUNCE: When multiple ticks arrive in a burst, only process the LATEST one
          // Clear any pending tick updates
          if (serverTickTimeoutRef.current) {
            clearTimeout(serverTickTimeoutRef.current);
          }

          // Schedule tick processing after a small delay (50ms)
          // If another tick arrives within 50ms, this will be cancelled and the new one processed instead
          serverTickTimeoutRef.current = setTimeout(() => {
            setSessionState(prev => {
              // CRITICAL: Ignore SessionTick when paused or completed
              // Pause/Resume events control the exact sync time
              // Completed status prevents stale ticks from restarting countdown
              if (prev.status === 'paused' || prev.status === 'completed') {
                console.log('⏸️ [TICK IGNORED] Ignoring SessionTick - workout not running', {
                  status: prev.status,
                  serverTime: data.time_remaining
                });
                return prev;
              }

              const serverTime = data.time_remaining;

              // ALWAYS use server time for group workouts - this is the ONLY source of truth
              // No drift tolerance, no prediction, perfect sync across all devices
              console.log('🔄 [SERVER TICK] Using server time as single source of truth', {
                serverTime,
                phase: data.phase
              });

              // Record server tick time for smooth interpolation
              lastServerTickRef.current = Date.now();
              lastServerTimeRef.current = serverTime;
              lastDisplayedTimeRef.current = serverTime; // Reset displayed time

              // Calculate calories client-side for accuracy (server may send 0)
              // Don't overwrite with server value if it's less than current
              const serverCalories = data.calories_burned || 0;
              const clientCalories = prev.caloriesBurned;
              const caloriesBurned = serverCalories > 0 ? serverCalories : clientCalories;

              return {
                ...prev,
                timeRemaining: serverTime,
                phase: data.phase,
                currentExercise: data.current_exercise,
                currentSet: data.current_set,
                currentRound: data.current_round,
                caloriesBurned: caloriesBurned,
                status: data.status,
              };
            });
          }, 50); // 50ms debounce window

          return; // Don't process other events
        }

        if (eventName === 'WorkoutPaused') {
          console.log(`⏸️ Workout paused by ${data.paused_by_name}`);

          // CRITICAL: When pausing, ALL clients MUST show EXACT same time
          // No drift tolerance - force sync to server authoritative time
          setSessionState(prev => {
            if (data.session_state && data.session_state.time_remaining !== null) {
              const serverTime = data.session_state.time_remaining;
              const localTime = prev.timeRemaining;
              const drift = Math.abs(serverTime - localTime);

              console.log('⏸️ [PAUSE SYNC] Force syncing to server time (ALL clients must match):', {
                serverTime,
                localTime,
                drift,
                action: 'FORCE_SYNC_TO_SERVER'
              });

              // Record server tick time for interpolation
              lastServerTickRef.current = Date.now();
              lastServerTimeRef.current = serverTime;

              // ALWAYS use server time on pause - no drift tolerance
              // This ensures all users see the exact same paused time
              return {
                ...prev,
                status: 'paused',
                timeRemaining: serverTime, // FORCE server time
                phase: data.session_state.phase || prev.phase,
                currentExercise: data.session_state.current_exercise ?? prev.currentExercise,
                currentSet: data.session_state.current_set ?? prev.currentSet,
                currentRound: data.session_state.current_round ?? prev.currentRound,
                caloriesBurned: data.session_state.calories_burned ?? prev.caloriesBurned,
              };
            }

            // Fallback: just pause at current time
            console.log('⚠️ [PAUSE] No server state provided, pausing at current time');
            return { ...prev, status: 'paused' };
          });
        } else if (eventName === 'WorkoutResumed') {
          console.log(`▶️ Workout resumed by ${data.resumed_by_name}`);

          // CRITICAL: When resuming, ALL clients MUST start from EXACT same time
          // Reset phase timer to ensure synchronized countdown
          setSessionState(prev => {
            if (data.session_state && data.session_state.time_remaining !== null) {
              const serverTime = data.session_state.time_remaining;
              const localTime = prev.timeRemaining;
              const drift = Math.abs(serverTime - localTime);

              console.log('▶️ [RESUME SYNC] Force syncing to server time:', {
                serverTime,
                localTime,
                drift,
                action: 'FORCE_SYNC_TO_SERVER'
              });

              // Record server tick time for interpolation (group workouts don't use phase timer)
              lastServerTickRef.current = Date.now();
              lastServerTimeRef.current = serverTime;

              // ALWAYS use server time on resume - no drift tolerance
              // This ensures all users resume from the exact same point
              return {
                ...prev,
                status: 'running',
                timeRemaining: serverTime, // FORCE server time
                phase: data.session_state.phase || prev.phase,
                currentExercise: data.session_state.current_exercise ?? prev.currentExercise,
                currentSet: data.session_state.current_set ?? prev.currentSet,
                currentRound: data.session_state.current_round ?? prev.currentRound,
                caloriesBurned: data.session_state.calories_burned ?? prev.caloriesBurned,
              };
            }

            console.log('⚠️ [RESUME] No server state provided, resuming from current position:', prev.timeRemaining);
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
            alert.info(
              'Workout Ended',
              `The workout has been stopped by ${data.stopped_by_name}.`
            );
          }, 500);
        } else if (eventName === 'MemberLeftSession') {
          console.log(`👋 Member left session: ${data.member_name}`);
          // Show toast notification that member left
          alert.info(
            'Member Left',
            `${data.member_name} has left the workout session.`
          );
        } else if (eventName === 'WorkoutCompleted') {
          console.log(`✅ Workout finished by ${data.initiatorName}`);
          // Set status to completed - user must click COMPLETE button to save and exit
          setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
        }
      },
    });
  };

  /**
   * Play workout sound alert
   * RESEARCH REQUIREMENT: Sound alerts for workout transitions (Chapter 1, line 117)
   * @param type - Type of sound alert to play
   */
  const playSound = async (type: 'start' | 'rest' | 'complete' | 'next' | 'round') => {
    try {
      // Load appropriate sound file based on type
      let soundFile;
      switch (type) {
        case 'start':
          soundFile = require('../../assets/sounds/start.mp3');
          break;
        case 'rest':
          soundFile = require('../../assets/sounds/rest.mp3');
          break;
        case 'complete':
          soundFile = require('../../assets/sounds/complete.mp3');
          break;
        case 'next':
          soundFile = require('../../assets/sounds/next.mp3');
          break;
        case 'round':
          soundFile = require('../../assets/sounds/round.mp3');
          break;
        default:
          soundFile = require('../../assets/sounds/start.mp3');
      }

      const { sound: newSound } = await Audio.Sound.createAsync(soundFile);

      // Set volume (future: get from settings)
      await newSound.setVolumeAsync(1.0);

      setSound(newSound);
      await newSound.playAsync();

      console.log(`🔊 [SOUND] Played ${type} alert`);
    } catch (error) {
      console.log(`❌ [SOUND] Error playing ${type} sound:`, error);

      // Fallback to vibration with different patterns for each type
      const vibrationPatterns: Record<typeof type, number | number[]> = {
        start: [0, 100],                    // Single short beep
        rest: [0, 200],                     // Single medium beep
        complete: [0, 500, 200, 500],       // Double long beeps
        next: [0, 100, 100, 100],           // Two quick beeps
        round: [0, 300, 100, 300],          // Two medium beeps
      };

      Vibration.vibrate(vibrationPatterns[type] || 200);
      console.log(`📳 [VIBRATION] Fallback vibration for ${type}`);
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
        alert.confirm(
          'Leave Workout',
          'Are you sure you want to leave this workout? You will exit the session.',
          exitSession,
          undefined,
          'Leave',
          'Cancel'
        );
        return true;
      }

      // Solo workout or group initiator - pause then show exit dialog
      pauseSession();
      alert.confirm(
        'Exit Workout',
        'Are you sure you want to exit this workout? Your progress will be lost.',
        exitSession,
        resumeSession,
        'Exit',
        'Continue'
      );
      return true;
    }
    return false;
  };

  const startTimer = () => {
    // Clear any existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Record phase start time for drift correction (solo workouts)
    phaseStartTimeRef.current = Date.now();

    // Set initial phase duration based on current phase (for solo workouts)
    const getCurrentPhaseDuration = () => {
      switch (sessionState.phase) {
        case 'prepare': return 10;
        case 'work': return 20;
        case 'rest': return 10;
        case 'roundRest': return 60;
        default: return 10;
      }
    };
    phaseDurationRef.current = getCurrentPhaseDuration();

    // Initialize current phase ref for solo workouts
    currentPhaseRef.current = sessionState.phase;

    // SMOOTH TIMER WITH SERVER SYNC FOR GROUP WORKOUTS
    // CLIENT-ONLY TIMER FOR SOLO WORKOUTS
    intervalRef.current = setInterval(() => {
      const now = Date.now();

      setSessionState(prev => {
        let newTimeRemaining: number;

        if (type === 'group_tabata') {
          // GROUP WORKOUTS: Interpolate between server ticks for smooth display
          // Server is STILL the single source of truth - we just display smoothly
          const elapsedMs = now - lastServerTickRef.current;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          newTimeRemaining = Math.max(0, lastServerTimeRef.current - elapsedSeconds);

          // OPTIMIZATION: Only update state if the displayed second has actually changed
          // This prevents redundant re-renders and ensures smooth countdown
          if (newTimeRemaining === lastDisplayedTimeRef.current) {
            return prev; // No change, don't update state
          }

          // Log when we actually update the display
          console.log('⏱️ [INTERPOLATION UPDATE]', {
            from: lastDisplayedTimeRef.current,
            to: newTimeRemaining,
            elapsedMs,
            serverTime: lastServerTimeRef.current
          });

          lastDisplayedTimeRef.current = newTimeRemaining;

          // Don't handle phase transitions locally - server controls everything
          // Just display the interpolated time
        } else {
          // SOLO WORKOUTS: Client is authoritative, use phase timer

          // CRITICAL FIX: Detect if phase changed (from handlePhaseComplete)
          // If phase changed, reset timer refs to prevent rapid transitions
          if (prev.phase !== currentPhaseRef.current) {
            console.log('🔄 [PHASE CHANGE DETECTED]', {
              from: currentPhaseRef.current,
              to: prev.phase,
              resetingTimer: true
            });

            // Update current phase ref
            currentPhaseRef.current = prev.phase;

            // Reset phase start time to NOW
            phaseStartTimeRef.current = now;

            // Update phase duration for new phase
            const newPhaseDuration =
              prev.phase === 'prepare' ? 10 :
              prev.phase === 'work' ? 20 :
              prev.phase === 'rest' ? 10 :
              prev.phase === 'roundRest' ? 60 :
              10;
            phaseDurationRef.current = newPhaseDuration;

            // Use the timeRemaining from the new phase state
            newTimeRemaining = prev.timeRemaining;
          } else {
            // Normal timer countdown - phase hasn't changed
            const elapsedMs = now - phaseStartTimeRef.current;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            newTimeRemaining = Math.max(0, phaseDurationRef.current - elapsedSeconds);

            if (newTimeRemaining <= 0) {
              // Phase complete - handle transition (solo workouts only)
              return handlePhaseComplete(prev);
            }
          }
        }

        // Calculate calories burned per second
        const totalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
        const totalMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
        const caloriesPerSecond = totalCalories / totalMinutes / 60;

        return {
          ...prev,
          timeRemaining: newTimeRemaining,
          caloriesBurned: prev.caloriesBurned + caloriesPerSecond
        };
      });
    }, 100); // Update every 100ms for smooth display
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
        if (currentSet >= 7) { // 8 sets completed (0-7)
          // Determine total exercises (new Tabata session or old workout format)
          const totalExercises = tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);

          if (currentExercise >= totalExercises - 1) {
            // Workout complete - play completion sound
            playSound('complete');
            return {
              ...currentState,
              phase: 'complete',
              status: 'completed',
              timeRemaining: 0,
            };
          } else {
            // Round complete (8 sets done) - play round complete sound
            playSound('round');
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
          // Regular rest between sets - play rest sound
          playSound('rest');
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
        // Play "next exercise" sound to indicate new exercise starting
        playSound('next');
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
        alert.info('Notice', 'Only the workout initiator can pause the session.');
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
          alert.error('Error', 'Failed to pause workout');
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
        alert.info('Notice', 'Only the workout initiator can resume the session.');
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
          alert.error('Error', 'Failed to resume workout');
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
      alert.info('Notice', 'Only the workout initiator can stop the session for everyone.');
      return;
    }

    alert.confirm(
      'Stop Workout for All',
      'Are you sure you want to stop the workout for all members? This cannot be undone.',
      async () => {
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
      },
      undefined,
      'Stop for All',
      'Cancel'
    );
  };

  const exitSession = async () => {
    console.log('❌ [EXIT] Exit session called');

    try {
      if (sessionStartTime && user) {
        // Use session_id for new Tabata sessions, or workoutId for old format
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

        // Calculate ACTUAL duration and calories for partial session (same logic as complete)
        const actualDurationSeconds = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        const actualDurationMinutes = Math.max(1, Math.round(actualDurationSeconds / 60));
        const estimatedTotalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
        const totalWorkoutMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
        const totalWorkoutSeconds = totalWorkoutMinutes * 60;
        const calculatedCalories = (actualDurationSeconds / totalWorkoutSeconds) * estimatedTotalCalories;
        // CRITICAL: Ensure minimum 1 calorie for any workout (use Math.ceil to round up)
        const accurateCaloriesBurned = Math.max(1, Math.ceil(calculatedCalories));

        console.log('❌ [EXIT] Partial session stats:', {
          actualDurationSeconds,
          actualDurationMinutes,
          accurateCaloriesBurned,
          currentExercise: sessionState.currentExercise,
          totalExercises: tabataSession?.exercises.length
        });

        // Save partial session data
        await trackingService.createWorkoutSession({
          workoutId: sessionId,
          userId: Number(user.id),
          sessionType: type === 'group_tabata' ? 'group' : 'individual',
          groupId: groupId ? Number(groupId) : null, // Include group ID for group workouts
          startTime: sessionStartTime,
          endTime: new Date(),
          duration: actualDurationMinutes,
          caloriesBurned: accurateCaloriesBurned,
          completed: false,
          notes: `Session ended early - ${tabataSession ? `${sessionState.currentExercise + 1}/${tabataSession.exercises.length} exercises completed` : 'Partial workout'} (${actualDurationMinutes}min)`
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
      console.log('💾 [COMPLETE] ========== Starting Workout Completion ==========');

      if (!sessionStartTime || !user) {
        console.error('❌ [COMPLETE] Missing session start time or user');
        router.back();
        return;
      }

      // STEP 1: Fetch BEFORE stats
      console.log('📊 [COMPLETE] Fetching progression data BEFORE saving...');
      const [beforeProgress, beforeHistory] = await Promise.all([
        progressionService.getProgress(parseInt(user.id)).catch(() => null),
        trackingService.getWorkoutHistory(user.id).catch(() => []),
      ]);

      const beforeStats = {
        workouts: beforeHistory.length,
        calories: beforeHistory.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
        minutes: beforeHistory.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
        activeDays: new Set(beforeHistory.map((w: any) => new Date(w.date).toDateString())).size,
        currentStreak: 0, // We'll get this from engagement service later if needed
        scoreProgress: beforeProgress?.progress_percentage || 0,
        nextLevel: progressionService.getFitnessLevelName(beforeProgress?.next_level || 'intermediate'),
      };

      console.log('📊 [COMPLETE] Before stats:', beforeStats);

      // STEP 2: Calculate workout stats
      const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);
      const actualDurationSeconds = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
      const estimatedTotalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
      const totalWorkoutMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
      const totalWorkoutSeconds = totalWorkoutMinutes * 60;

      // Determine if using FULL stats or ACTUAL stats
      // GROUP WORKOUTS: Always use FULL stats (all participants get same credit)
      // SOLO WORKOUTS: Use ACTUAL stats (based on time actually spent)
      let finalDurationMinutes: number;
      let finalCaloriesBurned: number;

      const isGroupWorkout = type === 'group_tabata';
      const shouldUseFullStats = isGroupWorkout || wasAutoFinished.current;

      if (shouldUseFullStats) {
        // GROUP WORKOUT or AUTO FINISH: Use FULL workout stats
        finalDurationMinutes = totalWorkoutMinutes;
        finalCaloriesBurned = estimatedTotalCalories;
        console.log('🏁 [COMPLETE] Using FULL stats:', {
          reason: isGroupWorkout ? 'GROUP_WORKOUT' : 'AUTO_FINISH',
          duration: finalDurationMinutes,
          calories: finalCaloriesBurned,
        });
      } else {
        // SOLO WORKOUT (natural completion): Use ACTUAL stats
        finalDurationMinutes = Math.max(1, Math.round(actualDurationSeconds / 60));
        const calculatedCalories = (actualDurationSeconds / totalWorkoutSeconds) * estimatedTotalCalories;
        finalCaloriesBurned = Math.max(1, Math.ceil(calculatedCalories));
        console.log('✅ [COMPLETE] Using ACTUAL stats (solo workout):', {
          actualSeconds: actualDurationSeconds,
          duration: finalDurationMinutes,
          calories: finalCaloriesBurned,
        });
      }

      // STEP 3: Save workout session
      console.log('💾 [COMPLETE] Saving workout session to tracking service...');
      const savedSession = await trackingService.createWorkoutSession({
        workoutId: sessionId,
        userId: Number(user.id),
        sessionType: type === 'group_tabata' ? 'group' : 'individual',
        groupId: groupId ? Number(groupId) : null, // Include group ID for group workouts
        startTime: sessionStartTime,
        endTime: new Date(),
        duration: finalDurationMinutes,
        caloriesBurned: finalCaloriesBurned,
        completed: true,
        notes: tabataSession
          ? `Completed ${tabataSession.exercises.length}-exercise Tabata workout (${tabataSession.difficulty_level} level) - ${finalDurationMinutes}min${wasAutoFinished.current ? ' [AUTO FINISH]' : ''}`
          : `Tabata workout completed - ${finalDurationMinutes}min${wasAutoFinished.current ? ' [AUTO FINISH]' : ''}`
      });

      // CRITICAL: Capture the database session_id for rating submissions
      const databaseSessionId = savedSession.session_id;

      console.log('✅ [COMPLETE] Workout session saved successfully', {
        databaseSessionId,
        workoutId: sessionId,
      });

      if (!databaseSessionId) {
        console.error('⚠️ [COMPLETE] Warning: No database session_id received from backend!');
      }

      // STEP 4: Fetch AFTER stats
      console.log('📊 [COMPLETE] Fetching progression data AFTER saving...');
      // Small delay to let backend process the new workout
      await new Promise(resolve => setTimeout(resolve, 500));

      const [afterProgress, afterHistory] = await Promise.all([
        progressionService.getProgress(parseInt(user.id)).catch(() => null),
        trackingService.getWorkoutHistory(user.id).catch(() => []),
      ]);

      const afterStats = {
        workouts: afterHistory.length,
        calories: afterHistory.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
        minutes: afterHistory.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
        activeDays: new Set(afterHistory.map((w: any) => new Date(w.date).toDateString())).size,
        currentStreak: 0,
        scoreProgress: afterProgress?.progress_percentage || 0,
        nextLevel: progressionService.getFitnessLevelName(afterProgress?.next_level || 'intermediate'),
      };

      console.log('📊 [COMPLETE] After stats:', afterStats);

      // STEP 5: Navigate to exercise rating screen
      console.log('🎯 [COMPLETE] Preparing exercise rating navigation...');

      // Prepare exercises list for rating screen
      const exercisesToRate = tabataSession ? tabataSession.exercises.map((ex: any) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        target_muscle_group: ex.target_muscle_group,
        completed: true,
      })) : [];

      console.log('📝 [COMPLETE] Exercises to rate:', exercisesToRate.length);

      // Navigate to exercise rating screen with all necessary data
      router.push({
        pathname: '/workout/exercise-rating',
        params: {
          sessionId: String(databaseSessionId), // CRITICAL: Use database session_id, not workout identifier
          workoutId: workoutId ? String(workoutId) : '',
          exercises: JSON.stringify(exercisesToRate),
          beforeStats: JSON.stringify(beforeStats),
          afterStats: JSON.stringify(afterStats),
          workoutData: JSON.stringify({
            duration: finalDurationMinutes,
            calories: finalCaloriesBurned,
          }),
        },
      });

      console.log('✅ [COMPLETE] Navigating to exercise rating screen');
      console.log('💾 [COMPLETE] ========== Workout Completion Finished ==========');

    } catch (error) {
      console.error('❌ [COMPLETE] ========== Error During Workout Completion ==========');
      console.error('❌ [COMPLETE] Error:', error);

      // On error, still try to navigate back
      alert.error('Error', 'Failed to save workout. Please try again.');

      // Refresh subscriptions and navigate
      try {
        await refreshGroupSubscriptions();
      } catch (refreshError) {
        console.error('❌ [COMPLETE] Failed to refresh subscriptions:', refreshError);
      }

      router.back();
    }
  };

  // Handler for when progress modal closes
  const handleProgressModalClose = async () => {
    setShowProgressModal(false);

    try {
      // Refresh progress store for dashboard and progress page
      if (user?.id) {
        console.log('🔄 [MODAL CLOSE] Refreshing progress store...');
        await refreshAfterWorkout(user.id);
        console.log('✅ [MODAL CLOSE] Progress store refreshed');
      }

      // Refresh group subscriptions
      console.log('🔄 [MODAL CLOSE] Refreshing group subscriptions...');
      await refreshGroupSubscriptions();
      console.log('✅ [MODAL CLOSE] Group subscriptions refreshed');

      // Small delay to ensure subscriptions are established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate back
      console.log('🔙 [MODAL CLOSE] Navigating back to previous screen');
      router.back();
    } catch (error) {
      console.error('❌ [MODAL CLOSE] Error:', error);
      // Navigate back anyway
      router.back();
    }
  };

  // Handler for enabling video call
  const handleEnableVideoCall = async () => {
    if (!tabataSession || !user) {
      alert.error('Error', 'Cannot start video call - missing session or user data');
      return;
    }

    try {
      setIsLoadingVideo(true);
      console.log('📹 [VIDEO] Requesting Agora token...');

      // Request Agora token from backend
      const tokenData = await agoraService.getToken(
        tabataSession.session_id,
        Number(user.id)
      );

      console.log('✅ [VIDEO] Agora token received:', {
        channelName: tokenData.channel_name,
        appId: tokenData.app_id,
        uid: tokenData.uid,
      });

      setAgoraCredentials({
        token: tokenData.token,
        channelName: tokenData.channel_name,
        appId: tokenData.app_id,
        uid: tokenData.uid,
      });

      setShowVideoCall(true);
      setIsLoadingVideo(false);
    } catch (error) {
      console.error('❌ [VIDEO] Failed to get Agora token:', error);
      setIsLoadingVideo(false);
      alert.error('Error', 'Failed to start video call. Please try again.');
    }
  };

  // Handler for leaving video call
  const handleLeaveVideoCall = () => {
    setShowVideoCall(false);
    setAgoraCredentials(null);
    setIsVideoFullScreen(false);
  };

  // Handler for expanding video to full-screen
  const handleExpandVideo = () => {
    setIsVideoFullScreen(true);
  };

  // Handler for minimizing video back to PiP
  const handleMinimizeVideo = () => {
    setIsVideoFullScreen(false);
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

      {/* Top Bar with Video and Close Button */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.workoutBadge}>
            <Ionicons name="fitness" size={14} color="white" />
            <Text style={styles.workoutBadgeText}>TABATA</Text>
          </View>
          <View style={styles.topBarButtons}>
            {/* Video Call Button - Only show for group workouts */}
            {type === 'group_tabata' && sessionState.status === 'running' && (
              <TouchableOpacity
                style={[styles.videoButton, showVideoCall && styles.videoButtonActive]}
                onPress={showVideoCall ? handleLeaveVideoCall : handleEnableVideoCall}
                disabled={isLoadingVideo}
              >
                {isLoadingVideo ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons
                    name={showVideoCall ? 'videocam' : 'videocam-outline'}
                    size={20}
                    color="white"
                  />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={sessionState.status === 'ready' ? router.back : handleBackPress}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
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
                // Mark that auto finish was used (for saving full stats later)
                wasAutoFinished.current = true;

                if (type === 'group_tabata' && tabataSession) {
                  // For group workouts, broadcast finish to all members
                  try {
                    console.log('🏁 [AUTO FINISH] Broadcasting finish to all members');
                    console.log('🏁 [AUTO FINISH] Session ID:', tabataSession.session_id);
                    await socialService.finishWorkout(tabataSession.session_id);
                    console.log('✅ [AUTO FINISH] Finish broadcasted successfully');

                    // Set status to completed - user must click COMPLETE button to see progress update
                    setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
                  } catch (error) {
                    console.error('❌ [AUTO FINISH] Failed to broadcast finish:', error);
                    alert.error('Error', 'Failed to finish workout for all members');
                  }
                } else {
                  // Solo workout - set status to completed, user must click COMPLETE
                  setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
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

      {/* Progress Update Modal */}
      {showProgressModal && progressBeforeStats && progressAfterStats && completedWorkoutData && (
        <ProgressUpdateModal
          visible={showProgressModal}
          onClose={handleProgressModalClose}
          beforeStats={progressBeforeStats}
          afterStats={progressAfterStats}
          workoutData={completedWorkoutData}
        />
      )}

      {/* Floating Video Call - Render once with dynamic wrapper */}
      {showVideoCall && agoraCredentials && (
        isVideoFullScreen ? (
          // Full-screen modal wrapper
          <Modal
            visible={true}
            transparent={false}
            animationType="fade"
            onRequestClose={handleMinimizeVideo}
          >
            <View style={{ flex: 1 }}>
              <AgoraVideoCall
                key="agora-video-stable"
                sessionId={tabataSession?.session_id || ''}
                userId={agoraCredentials.uid}
                channelName={agoraCredentials.channelName}
                token={agoraCredentials.token}
                appId={agoraCredentials.appId}
                onLeave={handleLeaveVideoCall}
                onMinimize={handleMinimizeVideo}
                compact={false}
              />
            </View>
          </Modal>
        ) : (
          // PiP floating window
          <Animated.View
            style={[
              styles.floatingVideoContainer,
              {
                transform: [{ translateX: pan.x }, { translateY: pan.y }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <AgoraVideoCall
              key="agora-video-stable"
              sessionId={tabataSession?.session_id || ''}
              userId={agoraCredentials.uid}
              channelName={agoraCredentials.channelName}
              token={agoraCredentials.token}
              appId={agoraCredentials.appId}
              onLeave={handleLeaveVideoCall}
              onExpand={handleExpandVideo}
              compact={true}
            />
          </Animated.View>
        )
      )}
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
  topBarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  videoButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    borderColor: 'rgba(34, 197, 94, 0.6)',
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
  floatingVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
});