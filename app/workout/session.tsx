import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  StatusBar,
  AppState,
  AppStateStatus,
  ScrollView,
  ActivityIndicator,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useReverb } from '../../contexts/ReverbProvider';
import { useLobby } from '../../contexts/LobbyContext';
import { contentService, TabataWorkout } from '../../services/microservices/contentService';
import { trackingService } from '../../services/microservices/trackingService';
import { socialService } from '../../services/microservices/socialService';
import { progressionService } from '../../services/microservices/progressionService';
import { reverbService } from '../../services/reverbService';
import { agoraService } from '../../services/agoraService';
import { TabataWorkoutSession } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS } from '../../constants/colors';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useProgressStore } from '../../stores/progressStore';
import ProgressUpdateModal from '../../components/ProgressUpdateModal';
import AgoraVideoCall from '../../components/video/AgoraVideoCall';
import ExerciseDemoModal from '../../components/workout/ExerciseDemoModal';
import MemberLeftToast from '../../components/workout/MemberLeftToast';
import MemberDisconnectedToast from '../../components/workout/MemberDisconnectedToast';
import MemberReconnectedToast from '../../components/workout/MemberReconnectedToast';
import { hasExerciseDemo } from '../../constants/exerciseDemos';

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

// Phase colors — defined outside component so they can be referenced for interpolation
const PHASE_COLORS: Record<string, string> = {
  prepare: '#3B82F6',
  work: '#EF4444',
  rest: '#10B981',
  roundRest: '#F59E0B',
  complete: '#8B5CF6',
  default: '#3B82F6',
};

export default function WorkoutSessionScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const { refreshGroupSubscriptions } = useReverb();
  const { refreshAfterWorkout } = useProgressStore();
  const { clearActiveLobbyLocal, clearActiveSession } = useLobby();
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
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const phaseStartTimeRef = useRef<number>(Date.now());
  const phaseDurationRef = useRef<number>(10); // Default 10 seconds
  const currentPhaseRef = useRef<SessionPhase>('prepare'); // Track current phase for solo workouts
  const lastServerTickRef = useRef<number>(Date.now()); // Track last server tick time
  const lastServerTimeRef = useRef<number>(0); // Track last server time_remaining value
  // Server state refs for group workouts - interval timer is the SINGLE writer to React state
  // This eliminates the dual-writer conflict that caused timer blinking
  const serverStateRef = useRef({
    phase: 'prepare' as SessionPhase,
    exercise: 0,
    set: 0,
    round: 0,
    status: 'ready' as SessionStatus,
    calories: 0,
  });
  const wasAutoFinished = useRef<boolean>(false); // Track if AUTO FINISH button was used
  const lastCountdownBeepRef = useRef<number>(-1); // Track last countdown beep to avoid duplicates
  const halfwayPlayedRef = useRef<boolean>(false); // Track if halfway sound played this phase
  const appState = useRef(AppState.currentState);
  const [isInitiator, setIsInitiator] = useState(user?.id.toString() === initiatorId);

  // Background cross-fade: two color layers, animate the new one from 0→1 opacity
  // Using opacity (not color interpolation) lets us use useNativeDriver: true (GPU thread)
  const bgFadeAnim = useRef(new Animated.Value(1)).current;
  const [fromBgColor, setFromBgColor] = useState<string>(PHASE_COLORS.prepare);
  const [toBgColor, setToBgColor] = useState<string>(PHASE_COLORS.prepare);

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressBeforeStats, setProgressBeforeStats] = useState<any>(null);
  const [progressAfterStats, setProgressAfterStats] = useState<any>(null);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<any>(null);

  // Exercise demo modal state
  const [showDemoModal, setShowDemoModal] = useState(false);

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

  // Member left / disconnected / reconnected toast state
  // Each uses { name, key } so React always sees a new object (key increments), forcing re-render.
  // Queues batch rapid events (e.g. 5 members disconnect within 2s) into a single toast.
  const [memberLeft, setMemberLeft] = useState<{ name: string; key: number } | null>(null);
  const [memberDisconnected, setMemberDisconnected] = useState<{ name: string; key: number } | null>(null);
  const [memberReconnected, setMemberReconnected] = useState<{ name: string; key: number } | null>(null);
  const toastKeyRef = useRef(0);
  const leftQueueRef = useRef<string[]>([]);
  const leftBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectQueueRef = useRef<string[]>([]);
  const disconnectBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectQueueRef = useRef<string[]>([]);
  const reconnectBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentlyLeftMembersRef = useRef<Set<number>>(new Set());
  const disconnectedMembersRef = useRef<Map<number, string>>(new Map()); // userId → userName
  const memberNamesRef = useRef<Map<number, string>>(new Map()); // Cached userId → userName at subscription time
  const presenceGraceUntilRef = useRef<number>(0); // Ignore presence events until this timestamp

  // Helper: batch names into readable string ("John", "John and Jane", "John, Jane, and 3 others")
  const formatNames = (names: string[]) => {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names[0]}, ${names[1]}, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`;
  };

  // Helper: queue a name and flush after a batch window, showing a combined toast
  const queueToast = (
    name: string,
    queueRef: React.MutableRefObject<string[]>,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setter: (val: { name: string; key: number }) => void,
  ) => {
    queueRef.current.push(name);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const names = [...queueRef.current];
      queueRef.current = [];
      timerRef.current = null;
      if (names.length === 0) return;
      toastKeyRef.current += 1;
      setter({ name: formatNames(names), key: toastKeyRef.current });
    }, 2000); // 2s batch window — collects rapid events into one toast
  };

  // Self-disconnect detection state (current user's own connection)
  const [selfDisconnected, setSelfDisconnected] = useState(false);
  const [selfReconnecting, setSelfReconnecting] = useState(false);
  const selfDisconnectedRef = useRef(false); // Mirror of selfDisconnected for use in timer interval
  // Keep ref in sync with state (ref is readable inside setInterval without stale closures)
  useEffect(() => { selfDisconnectedRef.current = selfDisconnected; }, [selfDisconnected]);
  const isDisconnectNavigatingRef = useRef(false); // Guard against double navigation
  const syncSequenceRef = useRef(0); // Monotonic counter to discard stale sync responses

  // Draggable video position
  const pan = useRef(new Animated.ValueXY({ x: Dimensions.get('window').width - 170, y: Dimensions.get('window').height - 320 })).current;
  const isDragging = useRef(false);

  // PanResponder for draggable video
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Let children handle taps (buttons)
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Only claim gesture when actually dragging (> 5px movement)
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
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

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      backHandler.remove();
      appStateSubscription?.remove();

      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Unsubscribe from session and presence channels
      if (type === 'group_tabata' && tabataSession) {
        reverbService.unsubscribe(`private-session.${tabataSession.session_id}`);
        reverbService.unsubscribe(`presence-lobby.${tabataSession.session_id}`);
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

  // Monitor WebSocket connection state for group workouts.
  // Handles: re-subscribing after reconnect, showing disconnect banner,
  // and navigating home when connection is permanently lost.
  useEffect(() => {
    if (type !== 'group_tabata' || !tabataSession) return;

    const removeListener = reverbService.onConnectionStateChange((state) => {
      if (state === 'connected') {
        console.log('🔄 [SESSION] WebSocket reconnected — re-subscribing session channels');

        // CRITICAL ORDER: Refresh tick ref FIRST to prevent auto-complete race condition.
        // Without this, the interval timer could see selfDisconnectedRef=false (cleared below)
        // + stale lastServerTickRef (minutes old) and falsely trigger auto-complete
        // in the brief window before syncSessionFromServer() completes.
        lastServerTickRef.current = Date.now();

        setupSessionSubscription();
        setSelfDisconnected(false);
        setSelfReconnecting(false);

        // Actively fetch current session state from server to sync.
        // Without this, the client stays stuck with stale data from before disconnect
        // (wrong timer, wrong phase, wrong set) and waits passively for the next server tick.
        syncSessionFromServer();
      } else if (state === 'disconnected' || state === 'reconnecting') {
        console.log('⚠️ [SESSION] Connection lost — showing reconnecting banner');
        setSelfDisconnected(true);
        setSelfReconnecting(true);
      } else if (state === 'max_retries_reached') {
        console.log('❌ [SESSION] Max retries reached — navigating to home');
        setSelfDisconnected(true);
        setSelfReconnecting(false);
        handleConnectionLost();
      }
    });

    return () => removeListener();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabataSession]);

  // Instant network detection via NetInfo for group workouts.
  // NetInfo fires within 1-2 seconds of WiFi loss (vs 15-30s for WebSocket heartbeat).
  // This gives the disconnected user immediate feedback AND notifies the server
  // so other members get a fast disconnect toast.
  useEffect(() => {
    if (type !== 'group_tabata' || !tabataSession) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false || state.isInternetReachable === false) {
        console.log('📡 [SESSION/NetInfo] Network lost — showing disconnect banner immediately');
        setSelfDisconnected(true);
        setSelfReconnecting(true);
      } else if (state.isConnected && state.isInternetReachable && selfDisconnected) {
        // Network restored — WebSocket reconnect handler will clear the banner
        // when it fires 'connected', but log it here for visibility
        console.log('📡 [SESSION/NetInfo] Network restored — waiting for WebSocket reconnect');
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabataSession, selfDisconnected]);

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

  // Animate background color on every phase change (prepare→work→rest→complete)
  // Pattern: render the OLD color as base layer, fade the NEW color in on top.
  // Pure opacity animation → useNativeDriver: true → runs on GPU, no JS jank.
  const currentBgColorRef = useRef<string>(PHASE_COLORS.prepare);
  const prevPhaseRef = useRef<SessionPhase>(sessionState.phase);
  useEffect(() => {
    const newColor = PHASE_COLORS[sessionState.phase] ?? PHASE_COLORS.default;

    if (prevPhaseRef.current === sessionState.phase) {
      // Initial mount — set colors directly with no animation
      currentBgColorRef.current = newColor;
      setFromBgColor(newColor);
      setToBgColor(newColor);
      bgFadeAnim.setValue(1);
      return;
    }
    prevPhaseRef.current = sessionState.phase;

    const fromColor = currentBgColorRef.current;
    currentBgColorRef.current = newColor;

    // Set from=previous color (base), to=new color (overlay fades in)
    setFromBgColor(fromColor);
    setToBgColor(newColor);
    bgFadeAnim.setValue(0);
    Animated.timing(bgFadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true, // opacity on native driver = smooth GPU animation
    }).start();
  }, [sessionState.phase]);

  // Animated fade-in for the COMPLETE button when workout ends
  const completionFade = useRef(new Animated.Value(0)).current;
  const prevStatusRef = useRef<SessionStatus>(sessionState.status);
  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && sessionState.status === 'completed') {
      completionFade.setValue(0);
      Animated.timing(completionFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
    prevStatusRef.current = sessionState.status;
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

        // Persist active session to AsyncStorage for reconnect support
        if (type === 'group_tabata' && user) {
          try {
            const activeSessionKey = `activeSession_user_${user.id}`;
            await AsyncStorage.setItem(activeSessionKey, JSON.stringify({
              sessionId: session.session_id,
              groupId: groupId,
              sessionData: sessionData as string,
              initiatorId: initiatorId as string,
              type: type,
              startedAt: Date.now(),
            }));
            console.log('💾 [SESSION] Saved active session to AsyncStorage for reconnect');
          } catch (storageError) {
            console.error('⚠️ [SESSION] Failed to save active session:', storageError);
          }
        }

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

  const setupSessionSubscription = () => {
    if (!tabataSession) return;

    const sessionId = tabataSession.session_id;
    console.log('📡 [SERVER-AUTH] Subscribing to server-authoritative timer:', sessionId);

    reverbService.subscribeToPrivateChannel(`session.${sessionId}`, {
      onEvent: (eventName, data) => {
        console.log('📨 Session event received:', eventName, data);

        // SERVER SYNC: Server ticks update REFS ONLY
        // The interval timer is the SINGLE writer to React state (eliminates blinking)
        if (eventName === 'SessionTick') {
          // Update time refs for smooth interpolation
          lastServerTickRef.current = Date.now();
          lastServerTimeRef.current = data.time_remaining;

          // Update server state refs (interval reads these to sync React state)
          serverStateRef.current = {
            phase: data.phase,
            exercise: data.current_exercise,
            set: data.current_set,
            round: data.current_round,
            status: data.status,
            calories: data.calories_burned || 0,
          };

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
        } else if (eventName === 'WorkoutCompleted') {
          console.log(`✅ Workout finished by ${data.initiatorName}`);
          // Set status to completed with smooth transition
          transitionToCompleted();
        }
      },
    });

    // Subscribe to lobby channel for member left events
    // MemberLeft broadcasts on lobby.{sessionId}, not session.{sessionId}
    reverbService.subscribeToPrivateChannel(`lobby.${sessionId}`, {
      onEvent: (eventName, data) => {
        if (eventName === 'member.left' && Number(data.user_id) !== Number(user?.id)) {
          console.log(`👋 Member left workout: ${data.user_name}`);
          const leftMemberId = Number(data.user_id);
          // Track intentional leave so presence member_removed doesn't show duplicate toast
          recentlyLeftMembersRef.current.add(leftMemberId);
          // Also cache the name from the backend event (always has the correct username)
          if (data.user_name) {
            memberNamesRef.current.set(leftMemberId, data.user_name);
          }
          queueToast(data.user_name, leftQueueRef, leftBatchTimerRef, setMemberLeft);
        }

        // Handle initiator role transfer during active workout
        // When the initiator leaves, the backend transfers the role and auto-resumes if paused
        if (eventName === 'initiator.transferred') {
          const newInitiatorId = Number(data.new_initiator_id);
          if (newInitiatorId === Number(user?.id)) {
            console.log('👑 [SESSION] You are now the workout initiator');
            setIsInitiator(true);
            alert.info('You are now the leader', 'You can now control the workout (pause, stop, finish).');
          }
        }
      },
    });

    // Subscribe to presence channel for disconnect/reconnect detection
    // When a member's WebSocket connection drops (app crash, network loss),
    // Pusher fires member_removed automatically — no API call needed.
    // When they reconnect, Pusher fires member_added.
    //
    // GRACE PERIOD: Only on initial subscription (workout start), not on reconnects.
    // When the workout starts, all members transition from group-lobby to session screen.
    // During this transition each member briefly leaves and rejoins the presence channel
    // (group-lobby unmounts → unsubscribe, session mounts → subscribe).
    // Without a grace period, these transitions would trigger false disconnect/reconnect toasts.
    //
    // On reconnect (setupSessionSubscription called again), we do NOT reset the grace period.
    // If we did, rapid WiFi flickers would keep extending the grace window and suppress
    // all real disconnect/reconnect toasts indefinitely.
    if (presenceGraceUntilRef.current === 0) {
      presenceGraceUntilRef.current = Date.now() + 8000; // 8s grace for everyone to settle
    }

    // Helper: cache a member name with Number() key to avoid string/number mismatch in Map
    const cacheMemberName = (id: any, name: string) => {
      const numId = Number(id);
      if (numId && name) {
        memberNamesRef.current.set(numId, name);
      }
    };

    // Cache member names NOW from the Zustand store while it still has data.
    // Use Number() on user_id to ensure consistent Map key types (backend may send string or number).
    const storeSnapshot = useLobbyStore.getState();
    if (storeSnapshot.currentLobby?.members?.length) {
      for (const m of storeSnapshot.currentLobby.members) {
        cacheMemberName(m.user_id, m.user_name);
      }
      console.log(`📋 [SESSION] Cached ${memberNamesRef.current.size} member names from Zustand store`);
    }

    // Fallback: if Zustand store had no members (cleared during transition), fetch from backend.
    // This runs async during the 8s grace period, so names will be ready before real events arrive.
    if (memberNamesRef.current.size === 0) {
      console.log('⚠️ [SESSION] Zustand store had no members, fetching from backend...');
      socialService.getLobbyStateV2(sessionId).then(response => {
        const members = response?.data?.lobby_state?.members;
        if (members?.length) {
          for (const m of members) {
            cacheMemberName(m.user_id, m.user_name);
          }
          console.log(`📋 [SESSION] Cached ${memberNamesRef.current.size} member names from backend API`);
        }
      }).catch(err => {
        console.warn('⚠️ [SESSION] Failed to fetch member names from backend:', err?.message);
      });
    }

    reverbService.subscribeToPresence(`lobby.${sessionId}`, {
      onLeaving: (member: any) => {
        // Ignore presence events during grace period (lobby → session transition)
        if (Date.now() < presenceGraceUntilRef.current) return;

        const memberId = Number(member?.id || member?.user_id || 0);
        if (!memberId || memberId === Number(user?.id || 0)) return;

        // Resolve member name early (before the delay) so we capture the info
        // from the Pusher auth payload while it's still available in the event object.
        const resolvedName =
          memberNamesRef.current.get(memberId) ||
          member?.info?.name ||
          member?.info?.user_name ||
          useLobbyStore.getState().currentLobby?.members?.find((m: any) => Number(m.user_id) === memberId)?.user_name ||
          'A member';

        // Delay processing by 400ms to let the member.left custom event arrive first.
        // On slow networks the two events (presence member_removed + member.left broadcast)
        // race each other. Giving member.left a 400ms head-start prevents showing a false
        // "disconnected" toast for users who intentionally left the session.
        setTimeout(() => {
          // Skip if this member intentionally left (already handled by member.left toast)
          if (recentlyLeftMembersRef.current.has(memberId)) {
            console.log(`ℹ️ [SESSION] Member ${memberId} left intentionally, skipping disconnect toast`);
            recentlyLeftMembersRef.current.delete(memberId);
            return;
          }

          // Track as disconnected so we can show "reconnected" if they come back
          disconnectedMembersRef.current.set(memberId, resolvedName);

          console.log(`📡 [SESSION] Member disconnected: ${resolvedName} (${memberId})`);
          queueToast(resolvedName, disconnectQueueRef, disconnectBatchTimerRef, setMemberDisconnected);
        }, 400);
      },
      onJoining: (member: any) => {
        // Ignore presence events during grace period (lobby → session transition)
        if (Date.now() < presenceGraceUntilRef.current) return;

        const memberId = Number(member?.id || member?.user_id || 0);
        if (!memberId || memberId === Number(user?.id || 0)) return;

        // Only show "reconnected" toast if this member was previously disconnected
        const previousName = disconnectedMembersRef.current.get(memberId);
        if (previousName) {
          disconnectedMembersRef.current.delete(memberId);
          console.log(`📡 [SESSION] Member reconnected: ${previousName} (${memberId})`);
          queueToast(previousName, reconnectQueueRef, reconnectBatchTimerRef, setMemberReconnected);
        }
      },
    });
  };

  /**
   * Play workout sound alert
   * RESEARCH REQUIREMENT: Sound alerts for workout transitions (Chapter 1, line 117)
   * @param type - Type of sound alert to play
   */
  const playSound = async (type: 'start' | 'rest' | 'complete' | 'next' | 'round' | 'countdown' | 'countdown_go' | 'halfway') => {
    // Sound effects disabled for now
    return;
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground — check if connection was lost while backgrounded
      if (type === 'group_tabata') {
        const connState = useConnectionStore.getState();
        if (!connState.isConnected) {
          console.log('⚠️ [SESSION] App resumed but WebSocket is disconnected');
          setSelfDisconnected(true);
          setSelfReconnecting(connState.connectionState === 'reconnecting');
        } else {
          // WebSocket is connected but we may have missed ticks while backgrounded.
          // Sync from server to catch up on phase/set/round/timer changes.
          console.log('🔄 [SESSION] App resumed with WebSocket connected — syncing from server');
          lastServerTickRef.current = Date.now(); // Prevent stale auto-complete
          syncSessionFromServer();
        }
      }
    }
    appState.current = nextAppState;
  };

  /**
   * Fetch current workout state from the server and sync all local state.
   * Called on WebSocket reconnect to catch up after a network disruption.
   * Updates serverStateRef, lastServerTimeRef, lastServerTickRef, and sessionState
   * so the timer, phase, set, and round all match the server immediately.
   */
  const syncSessionFromServer = async () => {
    if (!tabataSession) return;

    // Increment sequence so we can detect stale responses from earlier calls.
    // If WiFi flickers, multiple syncs fire — only the latest should apply.
    const mySequence = ++syncSequenceRef.current;

    try {
      console.log('🔄 [SESSION] Fetching current session state from server... (seq:', mySequence, ')');
      const serverState = await socialService.getSessionState(tabataSession.session_id);

      // Discard if a newer sync was started while we were waiting for this response
      if (mySequence !== syncSequenceRef.current) {
        console.log('⚠️ [SESSION] Stale sync response (seq:', mySequence, 'current:', syncSequenceRef.current, ') — discarding');
        return;
      }

      console.log('🔄 [SESSION] Server state received:', serverState);

      // If server says workout is completed/stopped, transition to complete
      if (serverState.status === 'completed' || serverState.status === 'stopped') {
        console.log('🔄 [SESSION] Server says workout is finished — transitioning to complete');
        transitionToCompleted();
        return;
      }

      // Update all server refs so the interval timer reads fresh data
      const now = Date.now();
      lastServerTickRef.current = now;
      lastServerTimeRef.current = serverState.time_remaining;
      serverStateRef.current = {
        phase: serverState.phase as SessionPhase,
        exercise: serverState.current_exercise,
        set: serverState.current_set,
        round: serverState.current_round,
        status: serverState.status as SessionStatus,
        calories: serverState.calories_burned || 0,
      };

      // Force-update React state immediately (don't wait for next interval tick)
      // This clears the stale "0 timer / COMPLETE button" instantly
      setSessionState(prev => ({
        ...prev,
        timeRemaining: serverState.time_remaining,
        phase: serverState.phase as SessionPhase,
        currentExercise: serverState.current_exercise,
        currentSet: serverState.current_set,
        currentRound: serverState.current_round,
        status: serverState.status as SessionStatus,
        caloriesBurned: serverState.calories_burned || prev.caloriesBurned,
      }));

      console.log('✅ [SESSION] Synced to server state:', {
        phase: serverState.phase,
        time_remaining: serverState.time_remaining,
        set: serverState.current_set,
        round: serverState.current_round,
        exercise: serverState.current_exercise,
        status: serverState.status,
      });
    } catch (err) {
      console.warn('⚠️ [SESSION] Failed to fetch session state from server:', err);
      // Not critical — next server tick will sync us anyway
    }
  };

  /**
   * Handle permanent connection loss during group workout.
   * Saves partial progress (best effort), then navigates home.
   * Does NOT clear activeSession from AsyncStorage — this allows
   * GlobalLobbyIndicator to show "Rejoin Workout" when connection returns.
   */
  const handleConnectionLost = async () => {
    if (isDisconnectNavigatingRef.current) return;
    isDisconnectNavigatingRef.current = true;

    console.log('🔌 [SESSION] Handling permanent connection loss...');

    // Stop local timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Best-effort save of partial progress (may fail if no network)
    try {
      if (sessionStartTime && user) {
        const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);
        const actualDurationSeconds = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        const actualDurationMinutes = Math.max(1, Math.round(actualDurationSeconds / 60));
        const estimatedTotalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
        const totalWorkoutMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
        const totalWorkoutSeconds = totalWorkoutMinutes * 60;
        const calculatedCalories = (actualDurationSeconds / totalWorkoutSeconds) * estimatedTotalCalories;
        const accurateCaloriesBurned = Math.max(1, Math.ceil(calculatedCalories));

        const totalExercises = tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);
        const totalSets = totalExercises * 8;
        const completedSets = sessionState.currentExercise * 8 + sessionState.currentSet;
        const actualCompletionPercentage = Math.round((completedSets / totalSets) * 100);

        if (completedSets > 0) {
          await trackingService.createWorkoutSession({
            workoutId: sessionId,
            userId: Number(user.id),
            sessionType: type === 'group_tabata' ? 'group' : 'individual',
            groupId: groupId ? Number(groupId) : null,
            startTime: sessionStartTime,
            endTime: new Date(),
            duration: actualDurationMinutes,
            caloriesBurned: accurateCaloriesBurned,
            completionPercentage: actualCompletionPercentage,
            completed: false,
          });
          console.log('💾 [SESSION] Saved partial progress before disconnect navigation');
        }
      }
    } catch (err) {
      console.warn('⚠️ [SESSION] Could not save partial progress (no network):', err);
    }

    // Navigate to home — GlobalLobbyIndicator will show "Rejoin" when connection returns
    router.replace('/(tabs)');
  };

  const handleBackPress = () => {
    // If video is in fullscreen, minimize it instead of leaving the workout
    if (isVideoFullScreen) {
      setIsVideoFullScreen(false);
      return true;
    }

    // For group workouts, non-initiators can leave at any time (running or paused)
    if (type === 'group_tabata' && !isInitiator && (sessionState.status === 'running' || sessionState.status === 'paused')) {
      const completedCount = sessionState.currentExercise;
      const message = completedCount > 0
        ? `You've completed ${completedCount} exercise${completedCount > 1 ? 's' : ''}. Would you like to save your progress and rate the completed exercises?`
        : 'Are you sure you want to leave this workout? You will exit the session.';

      alert.confirm(
        'Leave Workout',
        message,
        completedCount > 0 ? exitAndRate : exitSession,
        undefined,
        completedCount > 0 ? 'Save & Rate' : 'Leave',
        'Cancel'
      );
      return true;
    }

    if (sessionState.status === 'running') {
      // Solo workout or group initiator - pause then show exit dialog
      pauseSession();

      // Calculate completed exercises for the message
      const completedCount = sessionState.currentExercise;
      const message = completedCount > 0
        ? `You've completed ${completedCount} exercise${completedCount > 1 ? 's' : ''}. Would you like to save your progress and rate the completed exercises?`
        : 'Are you sure you want to exit this workout? Your progress will not be saved.';

      alert.confirm(
        'Exit Workout',
        message,
        completedCount > 0 ? exitAndRate : exitSession,
        resumeSession,
        completedCount > 0 ? 'Save & Rate' : 'Exit',
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

    // For group workouts, initialize server refs from current state
    // so interpolation works correctly before the first server tick arrives
    if (type === 'group_tabata') {
      lastServerTimeRef.current = sessionState.timeRemaining;
      lastServerTickRef.current = Date.now();
      serverStateRef.current = {
        phase: sessionState.phase,
        exercise: sessionState.currentExercise,
        set: sessionState.currentSet,
        round: sessionState.currentRound,
        status: sessionState.status,
        calories: sessionState.caloriesBurned,
      };
    }

    // SINGLE-WRITER TIMER: Only this interval writes to React state
    // For GROUP workouts: reads from server refs, interpolates smoothly
    // For SOLO workouts: client-authoritative countdown
    intervalRef.current = setInterval(() => {
      const now = Date.now();

      setSessionState(prev => {
        let newTimeRemaining: number;
        // Track the active phase for sound logic (group reads from server refs)
        let activePhase: SessionPhase = prev.phase;

        if (type === 'group_tabata') {
          // GROUP WORKOUTS: Smooth interpolation from server refs
          // This interval is the ONLY writer to React state - no blinking

          // Guard: never overwrite a completed state — transitionToCompleted() may have fired
          // between the last server tick and this interval tick
          if (prev.status === 'completed') return prev;

          const elapsedMs = now - lastServerTickRef.current;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          newTimeRemaining = Math.max(0, lastServerTimeRef.current - elapsedSeconds);

          // Read latest server state from refs
          const srv = serverStateRef.current;
          activePhase = srv.phase;

          // Detect stale server: no ticks for 5+ seconds while timer at 0
          // This handles the case where host clicks "Finish for All" but
          // WorkoutCompleted event doesn't reach non-host clients
          // CRITICAL: Skip if user is disconnected — stale ticks during WiFi loss
          // would falsely trigger auto-complete. The workout is still running on server.
          const timeSinceLastTick = now - lastServerTickRef.current;
          if (newTimeRemaining === 0 && timeSinceLastTick > 5000 && prev.status === 'running' && !selfDisconnectedRef.current) {
            console.log('🔄 [SESSION] Server stopped ticking with time at 0 - auto-completing workout');
            playSound('complete');
            return {
              ...prev,
              timeRemaining: 0,
              phase: 'complete',
              status: 'completed',
            };
          }

          // Only update React state if something actually changed
          const timeChanged = newTimeRemaining !== prev.timeRemaining;
          const phaseChanged = srv.phase !== prev.phase;
          const exerciseChanged = srv.exercise !== prev.currentExercise;
          const setChanged = srv.set !== prev.currentSet;
          const roundChanged = srv.round !== prev.currentRound;
          const statusChanged = srv.status !== prev.status;

          if (!timeChanged && !phaseChanged && !exerciseChanged && !setChanged && !roundChanged && !statusChanged) {
            return prev; // Nothing changed, skip re-render
          }

          // Play phase transition sounds when server changes phase
          if (phaseChanged) {
            if (srv.phase === 'work' && (prev.phase === 'rest' || prev.phase === 'prepare')) playSound('start');
            else if (srv.phase === 'work' && prev.phase === 'roundRest') playSound('next');
            else if (srv.phase === 'rest') playSound('rest');
            else if (srv.phase === 'roundRest') playSound('round');
            else if (srv.phase === 'complete') playSound('complete');
            halfwayPlayedRef.current = false;
            lastCountdownBeepRef.current = -1;
          }

          // Calculate calories
          const totalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
          const totalMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
          const caloriesPerSecond = totalCalories / totalMinutes / 60;

          return {
            ...prev,
            timeRemaining: newTimeRemaining,
            phase: srv.phase,
            currentExercise: srv.exercise,
            currentSet: srv.set,
            currentRound: srv.round,
            status: srv.status,
            caloriesBurned: srv.calories > 0 ? srv.calories : prev.caloriesBurned + (timeChanged ? caloriesPerSecond : 0),
          };
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

        // SOLO WORKOUT SOUNDS (group sounds handled above with phase transitions)
        // Play halfway sound at 10 seconds during work phase (20 sec work / 2 = 10)
        if (activePhase === 'work' && Math.ceil(newTimeRemaining) === 10 && !halfwayPlayedRef.current) {
          halfwayPlayedRef.current = true;
          playSound('halfway');
        }

        // Reset halfway ref when starting new phase
        if (newTimeRemaining > 15) {
          halfwayPlayedRef.current = false;
        }

        // Play countdown sounds at 3, 2, 1 during work and prepare phases
        if ((activePhase === 'work' || activePhase === 'prepare') && newTimeRemaining <= 3 && newTimeRemaining > 0) {
          const countdownSecond = Math.ceil(newTimeRemaining);
          if (countdownSecond !== lastCountdownBeepRef.current && countdownSecond > 0) {
            lastCountdownBeepRef.current = countdownSecond;
            if (countdownSecond === 1) {
              playSound('countdown_go'); // "GO!" sound at 1 second
            } else {
              playSound('countdown'); // Beep at 3, 2
            }
          }
        } else if (newTimeRemaining > 3) {
          // Reset countdown ref when time is above 3
          lastCountdownBeepRef.current = -1;
        }

        // Calculate calories burned per second (solo workouts)
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
    // CRITICAL: Tear down Agora video call immediately before any async cleanup
    // This ensures video stops on ALL exit paths (complete, exit, stop, WorkoutStopped)
    setShowVideoCall(false);
    setAgoraCredentials(null);
    setIsVideoFullScreen(false);

    if (!tabataSession || !groupId || !user) return;

    const sessionId = tabataSession.session_id;
    const storageKey = `activeLobby_group_${groupId}_user_${user.id}`;

    console.log('🗑️ [CLEANUP] Clearing lobby and storage', {
      sessionId,
      groupId,
      storageKey
    });

    try {
      // Clear lobby AsyncStorage
      await AsyncStorage.removeItem(storageKey);
      console.log('✅ [CLEANUP] Lobby AsyncStorage cleared');

      // Clear active session AsyncStorage (reconnect data)
      const activeSessionKey = `activeSession_user_${user.id}`;
      await AsyncStorage.removeItem(activeSessionKey);
      console.log('✅ [CLEANUP] Active session AsyncStorage cleared');

      // Unsubscribe from session channel (prevent receiving pause/resume/stop events after leaving)
      reverbService.unsubscribe(`private-session.${sessionId}`);
      console.log('✅ [CLEANUP] Unsubscribed from session channel');

      // Unsubscribe from lobby channel (uses private- prefix)
      reverbService.unsubscribe(`private-lobby.${sessionId}`);
      console.log('✅ [CLEANUP] Unsubscribed from lobby channel');

      // Unsubscribe from presence channel (disconnect detection)
      reverbService.unsubscribe(`presence-lobby.${sessionId}`);
      console.log('✅ [CLEANUP] Unsubscribed from presence channel');

      // Clear lobby from global store (Zustand)
      const store = useLobbyStore.getState();
      store.clearLobby();
      console.log('✅ [CLEANUP] Lobby cleared from global store');

      // Clear LobbyContext in-memory state (activeLobby → null)
      // CRITICAL: Without this, GlobalLobbyIndicator stays visible because
      // isInLobby (from LobbyContext) remains true even after Zustand/AsyncStorage are cleared
      await clearActiveLobbyLocal();
      clearActiveSession();
      console.log('✅ [CLEANUP] LobbyContext state cleared');
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

        // Calculate actual completion percentage based on exercises and sets completed
        const totalExercises = tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);
        const totalSets = totalExercises * 8; // 8 sets per exercise in Tabata
        const completedSets = sessionState.currentExercise * 8 + sessionState.currentSet;
        const actualCompletionPercentage = Math.round((completedSets / totalSets) * 100);

        console.log('❌ [EXIT] Partial session stats:', {
          actualDurationSeconds,
          actualDurationMinutes,
          accurateCaloriesBurned,
          currentExercise: sessionState.currentExercise,
          currentSet: sessionState.currentSet,
          totalExercises,
          completedSets,
          totalSets,
          completionPercentage: actualCompletionPercentage
        });

        // Skip saving if user quit before completing a single set — no meaningful data to record
        if (completedSets === 0) {
          console.log('❌ [EXIT] No sets completed — skipping session save');
        } else {
        // Save partial session data with ACTUAL completion percentage
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
          completionPercentage: actualCompletionPercentage, // Pass actual completion percentage
          notes: `Session ended early - ${tabataSession ? `${sessionState.currentExercise + 1}/${tabataSession.exercises.length} exercises, set ${sessionState.currentSet + 1}/8` : 'Partial workout'} (${actualCompletionPercentage}% complete, ${actualDurationMinutes}min)`
        });
        } // end else (completedSets > 0)
      }

      // For group workouts, leave lobby and clean up.
      // IMPORTANT: cleanup runs unconditionally even if the leave API fails or times out.
      // On a slow network, leaveLobbyV2 may not reach the backend — that's acceptable:
      // other users will see a "disconnected" toast from the presence channel instead
      // of "left", which is a fine fallback. The critical thing is that we always clean
      // up channels and storage so the app ends up in a consistent state.
      if (type === 'group_tabata' && tabataSession && user) {
        console.log('👋 [EXIT] Leaving lobby and notifying session members...');
        try {
          // Race against a 5s timeout so we don't block the UI on a dead connection
          await Promise.race([
            socialService.leaveLobbyV2(tabataSession.session_id),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('leave_timeout')), 5000)
            ),
          ]);
          console.log('✅ [EXIT] Left lobby successfully');
        } catch (error: any) {
          console.warn('⚠️ [EXIT] Leave API failed/timed out:', error?.message,
            '— continuing with local cleanup (others will see disconnect toast)');
        }
        // Always clean up regardless of whether the leave API succeeded
        await clearLobbyAndStorage();
        console.log('✅ [EXIT] Cleanup completed');
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

  /**
   * Exit session early but save progress and navigate to rating page
   * for completed exercises only (exercises that had all 8 sets done)
   *
   * IMPORTANT FOR ML: Partial ratings still feed into collaborative filtering!
   */
  const exitAndRate = async () => {
    console.log('📊 [EXIT & RATE] Starting exit with rating flow...');

    try {
      if (!sessionStartTime || !user) {
        console.error('❌ [EXIT & RATE] Missing session start time or user');
        router.back();
        return;
      }

      // Use session_id for new Tabata sessions, or workoutId for old format
      const sessionId = tabataSession ? tabataSession.session_id : (workoutId as string);

      // Calculate ACTUAL duration and calories for partial session
      const actualDurationSeconds = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
      const actualDurationMinutes = Math.max(1, Math.round(actualDurationSeconds / 60));
      const estimatedTotalCalories = tabataSession?.estimated_calories || workout?.estimated_calories_burned || 300;
      const totalWorkoutMinutes = tabataSession?.total_duration_minutes || workout?.total_duration_minutes || 32;
      const totalWorkoutSeconds = totalWorkoutMinutes * 60;
      const calculatedCalories = (actualDurationSeconds / totalWorkoutSeconds) * estimatedTotalCalories;
      const accurateCaloriesBurned = Math.max(1, Math.ceil(calculatedCalories));

      // Calculate completion percentage based on exercises and sets completed
      const totalExercises = tabataSession ? tabataSession.exercises.length : (workout?.rounds.length || 1);
      const totalSets = totalExercises * 8;
      const completedSets = sessionState.currentExercise * 8 + sessionState.currentSet;
      const actualCompletionPercentage = Math.round((completedSets / totalSets) * 100);

      // IMPORTANT: Only count fully completed exercises (all 8 sets done)
      const completedExerciseCount = sessionState.currentExercise;

      console.log('📊 [EXIT & RATE] Partial session stats:', {
        actualDurationSeconds,
        actualDurationMinutes,
        accurateCaloriesBurned,
        currentExercise: sessionState.currentExercise,
        currentSet: sessionState.currentSet,
        completedExerciseCount,
        totalExercises,
        completionPercentage: actualCompletionPercentage
      });

      // STEP 1: Fetch BEFORE stats for progress modal
      console.log('📊 [EXIT & RATE] Fetching progression data BEFORE saving...');
      const [beforeProgress, beforeHistory] = await Promise.all([
        progressionService.getProgress(parseInt(user.id)).catch(() => null),
        trackingService.getWorkoutHistory(user.id).catch(() => []),
      ]);

      const beforeStats = {
        workouts: beforeHistory.length,
        calories: beforeHistory.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
        minutes: beforeHistory.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
        activeDays: new Set(beforeHistory.map((w: any) => new Date(w.date).toDateString())).size,
        currentStreak: 0,
        scoreProgress: beforeProgress?.progress_percentage || 0,
        nextLevel: progressionService.getFitnessLevelName(beforeProgress?.next_level || 'intermediate'),
      };

      // STEP 2: Save partial session data
      console.log('💾 [EXIT & RATE] Saving partial workout session...');
      const savedSession = await trackingService.createWorkoutSession({
        workoutId: sessionId,
        userId: Number(user.id),
        sessionType: type === 'group_tabata' ? 'group' : 'individual',
        groupId: groupId ? Number(groupId) : null,
        startTime: sessionStartTime,
        endTime: new Date(),
        duration: actualDurationMinutes,
        caloriesBurned: accurateCaloriesBurned,
        completed: false, // Partial completion
        completionPercentage: actualCompletionPercentage,
        notes: `Partial workout - ${completedExerciseCount}/${totalExercises} exercises completed (${actualCompletionPercentage}% complete, ${actualDurationMinutes}min)`
      });

      const databaseSessionId = savedSession.session_id;
      console.log('✅ [EXIT & RATE] Partial session saved:', { databaseSessionId });

      // STEP 3: Fetch AFTER stats for progress modal
      console.log('📊 [EXIT & RATE] Fetching progression data AFTER saving...');
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

      // STEP 4: Prepare ONLY completed exercises for rating
      // An exercise is "completed" if currentExercise index is greater than that exercise's index
      // This means all 8 sets of that exercise were finished
      const completedExercises = tabataSession
        ? tabataSession.exercises.slice(0, completedExerciseCount).map((ex: any) => ({
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            target_muscle_group: ex.target_muscle_group,
            completed: true,
          }))
        : [];

      console.log('📝 [EXIT & RATE] Completed exercises to rate:', completedExercises.length);

      // For group workouts, clean up lobby and subscriptions.
      // Same guaranteed-cleanup pattern as exitSession: always run clearLobbyAndStorage
      // even if the leave API fails or times out (see exitSession for rationale).
      if (type === 'group_tabata' && tabataSession && user) {
        console.log('👋 [EXIT & RATE] Leaving lobby and cleaning up...');
        try {
          await Promise.race([
            socialService.leaveLobbyV2(tabataSession.session_id),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('leave_timeout')), 5000)
            ),
          ]);
          console.log('✅ [EXIT & RATE] Left lobby successfully');
        } catch (error: any) {
          console.warn('⚠️ [EXIT & RATE] Leave API failed/timed out:', error?.message);
        }
        await clearLobbyAndStorage();
        console.log('✅ [EXIT & RATE] Cleanup completed');
      }

      // STEP 5: Navigate to exercise rating screen with completed exercises
      console.log('🎯 [EXIT & RATE] Navigating to exercise rating...');
      router.push({
        pathname: '/workout/exercise-rating',
        params: {
          sessionId: String(databaseSessionId),
          workoutId: workoutId ? String(workoutId) : '',
          exercises: JSON.stringify(completedExercises),
          beforeStats: JSON.stringify(beforeStats),
          afterStats: JSON.stringify(afterStats),
          workoutData: JSON.stringify({
            duration: actualDurationMinutes,
            calories: accurateCaloriesBurned,
            isPartial: true, // Flag for UI to know this is partial
          }),
        },
      });

      console.log('✅ [EXIT & RATE] Exit with rating flow completed');

    } catch (error) {
      console.error('❌ [EXIT & RATE] Error:', error);
      alert.error('Error', 'Failed to save workout progress. Please try again.');

      // On error, just go back
      if (type === 'group_tabata' && groupId) {
        router.replace(`/groups/${groupId}`);
      } else {
        router.back();
      }
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
        completionPercentage: 100, // Fully completed workout
        notes: tabataSession
          ? `Completed ${tabataSession.exercises.length}-exercise Tabata workout (${tabataSession.difficulty_level} level) - ${finalDurationMinutes}min${wasAutoFinished.current ? ' [AUTO FINISH]' : ''}`
          : `Tabata workout completed - ${finalDurationMinutes}min${wasAutoFinished.current ? ' [AUTO FINISH]' : ''}`,
        // Include exercises so backend saves them to user_exercise_history
        exercises: tabataSession?.exercises?.map((ex: any) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          target_muscle_group: ex.target_muscle_group,
        })) || [],
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

      // Clear lobby state and storage (prevents floating lobby indicator after session ends)
      await clearLobbyAndStorage();

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

      // Clear lobby state on error too (prevents floating lobby indicator)
      await clearLobbyAndStorage();

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

  // Smooth transition to completed state — animates layout changes (buttons swapping, etc.)
  const transitionToCompleted = () => {
    // Tear down video immediately when workout ends (covers all exit paths that go through here)
    setShowVideoCall(false);
    setAgoraCredentials(null);
    setIsVideoFullScreen(false);

    // Update server state refs so the interval timer doesn't overwrite the completed state
    // on its next tick (the interval reads serverStateRef, not React state)
    serverStateRef.current = {
      ...serverStateRef.current,
      status: 'completed',
      phase: 'complete',
    };

    setSessionState(prev => ({ ...prev, status: 'completed', phase: 'complete' }));
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
    <SafeAreaView style={[styles.container, { backgroundColor: fromBgColor }]} edges={['top', 'bottom']}>
      {/* Animated new-phase color overlay — fades in on top of the previous phase color */}
      <Animated.View
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: toBgColor, opacity: bgFadeAnim }}
        pointerEvents="none"
      />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
            {/* View Demo Button - with smart matching + category fallback */}
            {(() => {
              const exercise = getCurrentExercise();
              const exerciseName = exercise?.exercise_name;
              const muscleGroup = (exercise as any)?.target_muscle_group;
              const hasDemoResult = exerciseName ? hasExerciseDemo(exerciseName, muscleGroup) : false;
              console.log('🎬 [DEMO CHECK]', {
                exerciseName,
                muscleGroup,
                hasDemo: hasDemoResult,
                phase: sessionState.phase
              });
              return hasDemoResult ? (
                <TouchableOpacity
                  style={styles.viewDemoButton}
                  onPress={() => setShowDemoModal(true)}
                >
                  <Ionicons name="play-circle" size={16} color="white" />
                  <Text style={styles.viewDemoButtonText}>Demo</Text>
                </TouchableOpacity>
              ) : null;
            })()}
          </View>
          <Text style={styles.exerciseName}>
            {getCurrentExercise()?.exercise_name || 'Get Ready'}
          </Text>
          {sessionState.phase !== 'prepare' && getCurrentExercise() && (
            <View style={styles.exerciseMetaContainer}>
              <View style={styles.exerciseMeta}>
                <Ionicons name="body" size={14} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.exerciseMetaText}>
                  {((getCurrentExercise() as any)?.target_muscle_group || 'Full Body').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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

                // Set status to completed IMMEDIATELY (optimistic) so UI transitions instantly
                // Don't wait for the HTTP round-trip — that only affects other members via WebSocket
                transitionToCompleted();

                if (type === 'group_tabata' && tabataSession) {
                  // Broadcast finish to all members in background
                  try {
                    console.log('🏁 [AUTO FINISH] Broadcasting finish to all members');
                    await socialService.finishWorkout(tabataSession.session_id);
                    console.log('✅ [AUTO FINISH] Finish broadcasted successfully');
                  } catch (error) {
                    console.error('❌ [AUTO FINISH] Failed to broadcast finish:', error);
                    alert.error('Error', 'Failed to notify other members. Your workout is still complete.');
                  }
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
            <Animated.View style={{ opacity: completionFade, width: '100%' }}>
              <TouchableOpacity style={styles.primaryButton} onPress={completeSession}>
                <Ionicons name="checkmark" size={32} color={getPhaseColor()} />
                <Text style={[styles.primaryButtonText, { color: getPhaseColor() }]}>COMPLETE</Text>
              </TouchableOpacity>
            </Animated.View>
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

      {/* Exercise Demo Modal */}
      <ExerciseDemoModal
        visible={showDemoModal}
        exerciseName={getCurrentExercise()?.exercise_name || ''}
        targetMuscleGroup={(getCurrentExercise() as any)?.target_muscle_group}
        onClose={() => setShowDemoModal(false)}
      />

      {/* Floating Video Call - Single Animated.View to prevent unmount on mode switch */}
      {showVideoCall && agoraCredentials && (
        <Animated.View
          style={
            isVideoFullScreen
              ? styles.fullScreenVideoContainer
              : [
                  styles.floatingVideoContainer,
                  { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
                ]
          }
          {...(isVideoFullScreen ? {} : panResponder.panHandlers)}
        >
          <AgoraVideoCall
            sessionId={tabataSession?.session_id || ''}
            userId={agoraCredentials.uid}
            channelName={agoraCredentials.channelName}
            token={agoraCredentials.token}
            appId={agoraCredentials.appId}
            onLeave={handleLeaveVideoCall}
            onMinimize={isVideoFullScreen ? handleMinimizeVideo : undefined}
            onExpand={!isVideoFullScreen ? handleExpandVideo : undefined}
            compact={!isVideoFullScreen}
          />
        </Animated.View>
      )}

      {/* Self-Disconnect Banner (current user's own connection lost) */}
      {type === 'group_tabata' && selfDisconnected && (
        <View style={styles.connectionLostBanner}>
          {selfReconnecting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.connectionLostText}>Reconnecting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-offline" size={20} color="#FFFFFF" />
              <Text style={styles.connectionLostText}>Connection lost — returning to home...</Text>
            </>
          )}
        </View>
      )}

      {/* Member Left Toast — key forces remount on repeated/batched events */}
      <MemberLeftToast
        key={`left-${memberLeft?.key || 0}`}
        memberName={memberLeft?.name || ''}
        visible={!!memberLeft}
        onDismiss={() => setMemberLeft(null)}
      />

      {/* Member Disconnected Toast — key forces remount on repeated/batched events */}
      <MemberDisconnectedToast
        key={`disc-${memberDisconnected?.key || 0}`}
        memberName={memberDisconnected?.name || ''}
        visible={!!memberDisconnected}
        onDismiss={() => setMemberDisconnected(null)}
      />

      {/* Member Reconnected Toast — key forces remount on repeated/batched events */}
      <MemberReconnectedToast
        key={`recon-${memberReconnected?.key || 0}`}
        memberName={memberReconnected?.name || ''}
        visible={!!memberReconnected}
        onDismiss={() => setMemberReconnected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  connectionLostBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  connectionLostText: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: '#FFFFFF',
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
    flex: 1,
  },
  viewDemoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  viewDemoButtonText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
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
  fullScreenVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#000',
  },
});