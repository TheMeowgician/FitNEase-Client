import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  StatusBar,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAlert } from '../../contexts/AlertContext';
import { useLobbyStore, selectCurrentLobby, selectLobbyMembers, selectAreAllMembersReady, selectIsLobbyInitiator, selectUnreadMessageCount, selectLeftSessionId } from '../../stores/lobbyStore';
import { useReadyCheckStore, selectIsReadyCheckActive, selectReadyCheckResult } from '../../stores/readyCheckStore';
import { useVotingStore, selectIsVotingActive, selectVotingResult, selectMemberVotes, selectVotingExpiresAt, selectVotingAlternatives } from '../../stores/votingStore';
import { useConnectionStore, selectConnectionState } from '../../stores/connectionStore';
import { useAuth } from '../../contexts/AuthContext';
import { useLobby } from '../../contexts/LobbyContext';
import { useReverb } from '../../contexts/ReverbProvider';
import { reverbService } from '../../services/reverbService';
import { socialService } from '../../services/microservices/socialService';
import { contentService, Exercise } from '../../services/microservices/contentService';
import { Avatar } from '../../components/ui/Avatar';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import LobbyChat from '../../components/groups/LobbyChat';
import { UserProfilePreviewModal } from '../../components/groups/UserProfilePreviewModal';
import { AnimatedExerciseReveal } from '../../components/lobby/AnimatedExerciseReveal';
import { ExerciseSwapModal } from '../../components/workout/ExerciseSwapModal';

/**
 * Group Lobby Screen
 *
 * Features:
 * - Real-time WebSocket lobby updates
 * - Member list with status (waiting/ready)
 * - Presence indicators (online/offline)
 * - Initiator controls (kick members)
 * - Ready/Not Ready toggle
 * - Start workout (initiator only, all ready)
 * - Leave lobby with cleanup
 * - Event handlers for all lobby events
 */
export default function GroupLobbyScreen() {
  const params = useLocalSearchParams<{
    sessionId: string;
    groupId: string;
    workoutData: string;
    initiatorId: string;
    isCreatingLobby: string;
    joinedViaInvite?: string;
  }>();

  const { sessionId, groupId, workoutData, initiatorId, isCreatingLobby, joinedViaInvite } = params;

  // Auth & Lobby Context
  const { user: currentUser } = useAuth();
  const alert = useAlert();
  const { saveLobbySession, clearActiveLobbyLocal } = useLobby();

  // Safe area insets for modal
  const insets = useSafeAreaInsets();

  // Stores - ALL subscriptions at the top to prevent re-subscription issues
  const currentLobby = useLobbyStore(selectCurrentLobby);
  const lobbyMembers = useLobbyStore(selectLobbyMembers);
  const unreadMessageCount = useLobbyStore(selectUnreadMessageCount);
  const leftSessionId = useLobbyStore(selectLeftSessionId);
  const isLoading = useLobbyStore((state) => state.isLoading);
  const allMembersReady = useLobbyStore(selectAreAllMembersReady);
  const connectionState = useConnectionStore(selectConnectionState);

  // Global online users and real connection status from Reverb context
  // NOTE: connectionStore.isConnected is never updated (no caller sets it to true),
  // so we use isConnected from ReverbProvider which IS correctly maintained.
  const { onlineUsers, refreshGroupSubscriptions, isConnected } = useReverb();
  const setLobbyState = useLobbyStore((state) => state.setLobbyState);
  const updateMemberStatus = useLobbyStore((state) => state.updateMemberStatus);
  const addMember = useLobbyStore((state) => state.addMember);
  const removeMember = useLobbyStore((state) => state.removeMember);
  const addChatMessage = useLobbyStore((state) => state.addChatMessage);
  const setChatOpen = useLobbyStore((state) => state.setChatOpen);
  const clearLobby = useLobbyStore((state) => state.clearLobby);
  const clearLeftSession = useLobbyStore((state) => state.clearLeftSession);
  const setLoading = useLobbyStore((state) => state.setLoading);

  // Ready Check store
  const isReadyCheckActive = useReadyCheckStore(selectIsReadyCheckActive);
  const readyCheckResult = useReadyCheckStore(selectReadyCheckResult);
  const startReadyCheck = useReadyCheckStore((state) => state.startReadyCheck);
  const setReadyCheckResult = useReadyCheckStore((state) => state.setResult);
  const clearReadyCheck = useReadyCheckStore((state) => state.clearReadyCheck);

  // Voting store
  const isVotingActive = useVotingStore(selectIsVotingActive);
  const votingResult = useVotingStore(selectVotingResult);
  const memberVotes = useVotingStore(selectMemberVotes);
  const votingExpiresAt = useVotingStore(selectVotingExpiresAt);
  const votingAlternatives = useVotingStore(selectVotingAlternatives);
  const startVoting = useVotingStore((state) => state.startVoting);
  const submitVote = useVotingStore((state) => state.submitVote);
  const completeVoting = useVotingStore((state) => state.completeVoting);
  const clearVoting = useVotingStore((state) => state.clearVoting);
  const getVoteCounts = useVotingStore((state) => state.getVoteCounts);
  const hasUserVoted = useVotingStore((state) => state.hasUserVoted);

  // Local state
  const [isReady, setIsReady] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStartingReadyCheck, setIsStartingReadyCheck] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<Set<number>>(new Set());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedLobbyMember, setSelectedLobbyMember] = useState<any>(null);
  const [showMemberPreview, setShowMemberPreview] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [groupOnlineMembers, setGroupOnlineMembers] = useState<Set<number>>(new Set());
  const [exerciseDetails, setExerciseDetails] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isWorkoutDetailsExpanded, setIsWorkoutDetailsExpanded] = useState(false);
  const [alternativePool, setAlternativePool] = useState<any[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votingTimeRemaining, setVotingTimeRemaining] = useState<number>(0);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedExerciseForSwap, setSelectedExerciseForSwap] = useState<{ index: number; exercise: any } | null>(null);
  const [isSwappingExercise, setIsSwappingExercise] = useState(false);

  // Vote bottom sheet animation (matches WorkoutSetModal pattern)
  const [voteSheetVisible, setVoteSheetVisible] = useState(false);
  const votingBackdropOpacity = useRef(new Animated.Value(0)).current;
  const votingSlideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Fullscreen reveal overlay — fires for ALL lobby members when exercises first arrive.
  // Entrance: starts at the workout section's EXACT screen bounds (measured via ref),
  // scales/slides up to cover the whole screen. Exit: reverses to the same bounds.
  // Using measured bounds means initiator and non-initiators see identical animations —
  // no pre-expansion phase that could shift the workout section before the overlay appears.
  const [isFullscreenRevealVisible, setIsFullscreenRevealVisible] = useState(false);
  const fullscreenOpacity    = useRef(new Animated.Value(0)).current;
  const fullscreenScale      = useRef(new Animated.Value(0.6)).current;
  const fullscreenTranslateY = useRef(new Animated.Value(200)).current;
  // Ref to the workout section View — used for measure() to get its exact screen bounds
  const workoutSectionRef = useRef<any>(null);
  // Stores the measured entrance/exit transform values so hide() uses the same target as show()
  const workoutSectionFrameRef = useRef({ translateY: 200, scale: 0.6 });
  // Prevents replaying the reveal on re-entry; resets whenever exercises are cleared
  const hasPlayedRevealRef = useRef(false);
  // Prevents handleRevealComplete from firing more than once per reveal cycle
  const hasCalledRevealCompleteRef = useRef(false);

  // Check if current user can customize (mentor or advanced fitness level)
  const currentUserMember = lobbyMembers.find(m => m.user_id === parseInt(currentUser?.id || '0'));
  const canUserCustomize = currentUserMember?.user_role === 'mentor' ||
                           currentUserMember?.fitness_level === 'advanced';

  // Check if ANY member in lobby can customize (for showing customize vote counts)
  const hasCustomizableMembers = lobbyMembers.some(
    m => m.user_role === 'mentor' || m.fitness_level === 'advanced'
  );

  // Determine if current user is the designated customizer (separate from initiator)
  // customizer_id is set by backend when voting completes with "customize" result
  // Falls back to initiator for backward compatibility
  const customizerId = currentLobby?.customizer_id || currentLobby?.workout_data?.customizer_id;
  const isCustomizer = customizerId
    ? parseInt(currentUser?.id || '0') === customizerId
    : isInitiator; // fallback for backward compatibility
  const customizerName = customizerId
    ? lobbyMembers.find(m => m.user_id === customizerId)?.user_name || 'Unknown'
    : null;

  const hasJoinedRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  // Holds voting data until the exercise reveal animation finishes
  const pendingVotingDataRef = useRef<{ exercises: any[]; alternatives: any[] } | null>(null);
  // Prevents forceCompleteVoting from being called more than once per voting session.
  // Without this, the 1-second timer fires the call every second after timeout, causing
  // repeated "No active voting found" errors once the backend has already resolved it.
  const hasForceCompletedVotingRef = useRef(false);
  const isLobbyDeletedRef = useRef(false); // Track if LobbyDeleted event was received (blocks further actions)
  const isMinimizedRef = useRef(false); // Track if user minimized (to explore app while staying in lobby)
  const isWorkoutStartedRef = useRef(false); // Track if WorkoutStarted fired (don't leave lobby on unmount)
  const isMountedRef = useRef(true); // Track if component is still mounted
  const sessionIdRef = useRef<string | null>(null); // Track sessionId for cleanup
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const groupPresenceChannelRef = useRef<any>(null);
  const userChannelRef = useRef<any>(null);
  // Track pending exercise swap for WebSocket confirmation (handles HTTP timeout but WebSocket success)
  const pendingSwapRef = useRef<{ slotIndex: number; exerciseId: number; confirmed: boolean } | null>(null);

  // Check if current user is initiator
  // IMPORTANT: This syncs with currentLobby.initiator_id (which updates via WebSocket)
  // instead of just the URL parameter (which is static)
  useEffect(() => {
    if (currentUser && currentLobby) {
      const isUserInitiator = parseInt(currentUser.id) === currentLobby.initiator_id;
      setIsInitiator(isUserInitiator);
      console.log('👑 [INITIATOR CHECK] Updated initiator status:', {
        userId: currentUser.id,
        lobbyInitiatorId: currentLobby.initiator_id,
        isInitiator: isUserInitiator
      });
    }
  }, [currentUser, currentLobby?.initiator_id]);

  // Check if exercises have been generated
  const hasExercises = currentLobby?.workout_data?.exercises?.length > 0;

  // Check if all members are ready AND exercises exist AND minimum 2 members present
  // This prevents starting a group workout alone
  const canStartWorkout = isInitiator && allMembersReady && lobbyMembers.length >= 2 && hasExercises;

  // Check if ready check can be started (any member, no active ready check, no exercises yet)
  const canStartReadyCheck = !isReadyCheckActive && !hasExercises && lobbyMembers.length >= 2 && !isGenerating;

  /**
   * Watch for ready check completion — the ONLY trigger for auto-generating exercises.
   *
   * Safety checks:
   * 1. readyCheckResult must be explicitly 'success' (set by ReadyCheckComplete backend event).
   *    This prevents the allMembersReady selector from accidentally triggering generation
   *    when leftover 'ready' statuses remain after a failed/incomplete ready check.
   * 2. Cross-checks that every current lobby member actually responded 'accepted' in THIS
   *    ready check. Guards against the race condition where a member joins AFTER the ready
   *    check starts: the backend only tracks members present at start time, so it can fire
   *    success even though the late joiner never responded.
   */
  useEffect(() => {
    if (readyCheckResult !== 'success' || !isInitiator || hasExercises || isGenerating) return;
    if (isCleaningUpRef.current || !isMountedRef.current) return;

    // Read fresh state directly from stores (avoids stale closure values)
    const freshMembers = useLobbyStore.getState().currentLobby?.members ?? [];
    const responses = useReadyCheckStore.getState().responses;

    const allCurrentMembersAccepted =
      freshMembers.length >= 2 &&
      freshMembers.every((m) => responses[m.user_id]?.response === 'accepted');

    if (!allCurrentMembersAccepted) {
      // A member joined after the ready check started — backend fired success for the
      // original subset but the full current roster hasn't agreed. Clear the stale
      // result and prompt the user to start a fresh check.
      console.warn('⚠️ [READY CHECK] Success event received but not all current lobby members responded. Clearing.');
      clearReadyCheck();
      setIsReady(false);
      addChatMessage({
        message_id: `system-${Date.now()}-rc-incomplete`,
        user_id: null,
        user_name: 'System',
        message: 'A member joined while the ready check was running. Please start a new ready check to include everyone.',
        timestamp: Math.floor(Date.now() / 1000),
        is_system_message: true,
      });
      return;
    }

    console.log('🎯 [READY CHECK] All members confirmed ready — generating exercises...');
    autoGenerateExercises(freshMembers.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyCheckResult, isInitiator, hasExercises, isGenerating]);

  /**
   * Voting countdown timer
   * Updates every second while voting is active
   */
  useEffect(() => {
    if (!isVotingActive || !votingExpiresAt) {
      // Reset force-complete guard when a voting session ends so the next one works
      hasForceCompletedVotingRef.current = false;
      setVotingTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((votingExpiresAt - now) / 1000));
      setVotingTimeRemaining(remaining);

      // Auto-complete voting on timeout (initiator only).
      // Guard: only fire ONCE — the interval keeps running every second after remaining=0,
      // so without this ref the backend gets hammered and returns "No active voting found".
      if (remaining === 0 && isInitiator && !hasForceCompletedVotingRef.current) {
        hasForceCompletedVotingRef.current = true;
        console.log('[VOTING] Timeout reached, forcing completion (once)');

        // Retry helper: on 404 the cache may have JUST expired (tight TTL race).
        // We retry up to 3 times with a 5-second gap. If all fail and the vote sheet
        // is still showing, force-clear the UI as a last resort so nobody is stuck.
        const tryForceComplete = async (retriesLeft: number) => {
          try {
            await socialService.forceCompleteVoting(sessionId);
            console.log('[VOTING] Force complete succeeded');
          } catch (err: any) {
            const notFound = err?.message?.includes('No active voting found');
            if (notFound) {
              // If VotingComplete already arrived (isActive went false), we're done.
              if (!useVotingStore.getState().isActive) {
                console.log('[VOTING] Voting already resolved — OK');
                return;
              }
              if (retriesLeft > 0) {
                console.warn(`[VOTING] 404 but vote still active — retrying in 5s (${retriesLeft} left)`);
                setTimeout(() => tryForceComplete(retriesLeft - 1), 5000);
              } else {
                // All retries exhausted, backend cache is gone. The VotingComplete event
                // will never fire. Clear the UI on this device so at least the initiator
                // is unblocked. Non-initiators are handled by their own safety valve.
                console.error('[VOTING] Force complete failed 3×, clearing vote UI (initiator)');
                clearVoting();
              }
            } else {
              console.error('[VOTING] Force complete failed:', err);
            }
          }
        };

        tryForceComplete(3);
      }
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isVotingActive, votingExpiresAt, isInitiator, sessionId]);

  /**
   * Non-initiator vote sheet safety valve.
   *
   * If the backend's voting cache expired before forceCompleteVoting was called (too-short
   * TTL) or the VotingComplete WebSocket event was simply dropped, the non-initiator's vote
   * sheet stays open indefinitely — they have no way to force-complete it themselves.
   *
   * This effect sets a timer for (expiresAt + 30 s) from now. If the vote sheet is STILL
   * showing at that point, we self-clear it so the device is no longer stuck.
   *
   * 30 s = 3× the initiator's retry cycle (3 retries × 5 s) + generous margin.
   */
  useEffect(() => {
    if (!isVotingActive || !votingExpiresAt || isInitiator) return;

    const msUntilSafetyFires = Math.max(votingExpiresAt - Date.now() + 30000, 30000);

    const safetyTimer = setTimeout(() => {
      if (useVotingStore.getState().isActive) {
        console.warn('[VOTING] Safety valve: VotingComplete never received — clearing vote UI');
        clearVoting();
      }
    }, msUntilSafetyFires);

    return () => clearTimeout(safetyTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVotingActive, votingExpiresAt, isInitiator]);

  /**
   * When voting starts and the fullscreen reveal overlay is still visible (which can happen
   * on slow devices where the reveal animation takes longer than the initiator's), dismiss
   * the overlay immediately so the vote sheet is not hidden behind it.
   *
   * Root cause: reveal animation takes up to ~7s per exercise-set. The initiator finishes
   * first, calls startVoting, and the VotingStarted event reaches other devices while they
   * are still mid-animation. The vote sheet opens at zIndex < overlay → invisible.
   */
  useEffect(() => {
    if (isVotingActive && isFullscreenRevealVisible) {
      console.log('[VOTING] Voting started while overlay is visible — fast-dismissing overlay');
      // Mark as handled so the reveal doesn't re-trigger or re-call handleRevealComplete
      hasPlayedRevealRef.current = true;
      hasCalledRevealCompleteRef.current = true;
      hideFullscreenReveal(); // collapse overlay without calling onRevealComplete callback
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVotingActive]);

  /**
   * Vote bottom sheet animation — matches WorkoutSetModal:
   * backdrop fades in + sheet springs up on open, both animate out on close
   */
  useEffect(() => {
    const screenHeight = Dimensions.get('window').height;
    if (isVotingActive) {
      setVoteSheetVisible(true);
      votingBackdropOpacity.setValue(0);
      votingSlideAnim.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(votingBackdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(votingSlideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 150,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(votingBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(votingSlideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setVoteSheetVisible(false));
    }
  }, [isVotingActive]);

  /**
   * Non-initiator state reconciler — single source of truth fallback.
   *
   * Polls getLobbyStateV2 every 3 s for the entire time the non-initiator
   * is in the lobby without exercises. Does NOT require readyCheckResult to
   * be 'success' first, because the non-initiator may have missed
   * ReadyCheckComplete entirely (confirmed root cause of stuck-lobby bug).
   *
   * Stops when:
   *   a) exercises appear (via this poll or via WebSocket), or
   *   b) voting is already active (VotingStarted arrived via WebSocket), or
   *   c) 3-minute safety cap is reached.
   *
   * When exercises are found via poll, setReadyCheckResult('success') is called
   * to keep downstream state consistent.
   */
  useEffect(() => {
    if (isInitiator || hasExercises || !sessionId) return;
    if (isCleaningUpRef.current || !isMountedRef.current) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 120; // 120 × 1.5 s = 3-minute safety cap

    const pollInterval = setInterval(async () => {
      if (isCleaningUpRef.current || !isMountedRef.current) {
        clearInterval(pollInterval);
        return;
      }

      // Stop if WebSocket already delivered VotingStarted (vote sheet open)
      if (useVotingStore.getState().isActive) {
        console.log('[EXERCISE POLL] Voting active — stopping poll');
        clearInterval(pollInterval);
        return;
      }

      // Stop if exercises landed via WebSocket while we were waiting
      if ((useLobbyStore.getState().currentLobby?.workout_data?.exercises?.length ?? 0) > 0) {
        console.log('[EXERCISE POLL] Exercises arrived via WebSocket — stopping poll');
        clearInterval(pollInterval);
        return;
      }

      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        console.log('[EXERCISE POLL] Safety cap reached — stopping poll');
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await socialService.getLobbyStateV2(sessionId);
        if (!isMountedRef.current || isCleaningUpRef.current) {
          clearInterval(pollInterval);
          return;
        }

        const lobbyState = response?.data?.lobby_state;
        const exercisesInState = (lobbyState?.workout_data?.exercises?.length ?? 0) > 0;
        const activeVoting = lobbyState?.active_voting;

        if (exercisesInState || activeVoting) {
          console.log('[EXERCISE POLL] State recovered via HTTP poll', { exercisesInState, hasVoting: !!activeVoting });
          setLobbyState(lobbyState);
          // Keep readyCheckResult consistent — exercises exist means ready check succeeded
          setReadyCheckResult('success');
          if (activeVoting && !useVotingStore.getState().isActive) {
            const av = activeVoting;
            startVoting({
              sessionId: av.session_id || sessionId,
              votingId: av.voting_id,
              initiatorId: av.initiator_id,
              initiatorName: av.initiator_name || '',
              members: av.members || [],
              exercises: av.exercises || [],
              alternativePool: av.alternative_pool || [],
              timeoutSeconds: av.timeout_seconds,
              expiresAt: av.expires_at,
            });
          }
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.warn('[EXERCISE POLL] Poll failed (non-critical):', err);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitiator, hasExercises, sessionId]);

  /**
   * Non-initiator voting recovery poll.
   *
   * After exercises arrive, the initiator starts voting shortly after.
   * If the non-initiator misses the VotingStarted WebSocket event (silent
   * drop — no reconnect fires, so reconnect recovery won't help), this
   * effect polls getLobbyStateV2 every 3 s for up to 30 s watching for
   * active_voting. Once found it calls startVoting() to open the vote sheet.
   *
   * Stops automatically when:
   *   a) VotingStarted arrives via WebSocket (isVotingActive becomes true), or
   *   b) active_voting found via poll, or
   *   c) 30 s elapsed (voting window is 60 s; 30 s is enough to detect it).
   */
  useEffect(() => {
    if (!hasExercises || isInitiator || isVotingActive || !sessionId) return;
    if (isCleaningUpRef.current || !isMountedRef.current) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 × 1.5 s = 30 s

    const pollInterval = setInterval(async () => {
      if (isCleaningUpRef.current || !isMountedRef.current) {
        clearInterval(pollInterval);
        return;
      }

      // Stop if WebSocket delivered VotingStarted while we were waiting
      if (useVotingStore.getState().isActive) {
        console.log('[VOTING POLL] VotingStarted arrived via WebSocket — stopping poll');
        clearInterval(pollInterval);
        return;
      }

      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        console.log('[VOTING POLL] 30 s elapsed — no active voting found (voting may not have started yet)');
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await socialService.getLobbyStateV2(sessionId);
        if (!isMountedRef.current || isCleaningUpRef.current) {
          clearInterval(pollInterval);
          return;
        }

        const av = response?.data?.lobby_state?.active_voting;
        if (av && !useVotingStore.getState().isActive) {
          console.log('[VOTING POLL] Recovered missed VotingStarted via HTTP poll');
          startVoting({
            sessionId: av.session_id || sessionId,
            votingId: av.voting_id,
            initiatorId: av.initiator_id,
            initiatorName: av.initiator_name || '',
            members: av.members || [],
            exercises: av.exercises || [],
            alternativePool: av.alternative_pool || [],
            timeoutSeconds: av.timeout_seconds,
            expiresAt: av.expires_at,
          });
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.warn('[VOTING POLL] Poll failed (non-critical):', err);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExercises, isInitiator, isVotingActive, sessionId]);

  /**
   * Reconnect recovery for missed VotingStarted events.
   *
   * When the WebSocket briefly drops and reconnects, any VotingStarted event
   * broadcast during the outage is silently lost. On reconnect we poll
   * getLobbyStateV2 which now includes active_voting in its response (backend
   * always attaches it when a voting session is live in the Redis cache).
   *
   * Flow: reconnect detected → 2 s delay (let WS settle, catch up-stream events)
   *       → if still not in voting, poll HTTP → recover via startVoting()
   *
   * The 2-second delay is intentional: VotingStarted may arrive over the
   * re-established socket just milliseconds after connected fires, so we give
   * it a chance to beat the HTTP call and avoid a redundant double-trigger.
   */
  useEffect(() => {
    if (!sessionId || !hasExercises) return;

    const removeListener = reverbService.onConnectionStateChange((state) => {
      if (state !== 'connected') return;

      // Give WebSocket time to deliver any in-flight events before falling back to HTTP
      const pollTimer = setTimeout(async () => {
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        if (useVotingStore.getState().isActive) return; // already recovered via WS

        console.log('[VOTING RECOVERY] Reconnected — polling lobby state for active voting');
        try {
          const response = await socialService.getLobbyStateV2(sessionId);
          if (!isMountedRef.current || isCleaningUpRef.current) return;

          const av = response?.data?.lobby_state?.active_voting;
          if (av && !useVotingStore.getState().isActive) {
            console.log('[VOTING RECOVERY] Active voting found via HTTP poll — recovering');
            startVoting({
              sessionId: av.session_id || sessionId,
              votingId: av.voting_id,
              initiatorId: av.initiator_id,
              initiatorName: av.initiator_name || '',
              members: av.members || [],
              exercises: av.exercises || [],
              alternativePool: av.alternative_pool || [],
              timeoutSeconds: av.timeout_seconds,
              expiresAt: av.expires_at,
            });
          } else {
            console.log('[VOTING RECOVERY] No active voting found after reconnect — all good');
          }
        } catch (err) {
          console.warn('[VOTING RECOVERY] HTTP poll failed (non-critical):', err);
        }
      }, 2000);

      return () => clearTimeout(pollTimer);
    });

    return () => removeListener();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hasExercises]);

  /**
   * Periodic lobby state sync — catches missed WebSocket events.
   *
   * WebSocket events (LobbyStateChanged, MemberJoined) can be lost due to
   * network timing, subscription lag, or brief disconnects. Without recovery,
   * a client that misses an event will show a stale member list forever.
   *
   * This effect polls the server every 10 seconds and updates the store ONLY
   * when the server's member count differs from the local count, avoiding
   * unnecessary re-renders. Stops polling during cleanup/unmount.
   */
  useEffect(() => {
    // Wait until lobby is initialized (lobbyMembers > 0 means store has been populated)
    if (!sessionId || lobbyMembers.length === 0) return;

    const syncInterval = setInterval(async () => {
      if (isCleaningUpRef.current || !isMountedRef.current) return;

      try {
        const response = await socialService.getLobbyStateV2(sessionId);
        if (!isMountedRef.current || isCleaningUpRef.current) return;

        const serverState = response?.data?.lobby_state;
        if (!serverState?.members || serverState.members.length === 0) return;

        const localLobby = useLobbyStore.getState().currentLobby;
        const localMembers = localLobby?.members;
        const localCount = localMembers?.length || 0;
        const serverCount = serverState.members.length;

        // 1. Member count changed
        const countChanged = localCount !== serverCount;

        // 2. Same count but different people (A left + B joined simultaneously)
        let compositionChanged = false;
        if (!countChanged && localMembers) {
          const localIds = new Set(localMembers.map((m: { user_id: number }) => m.user_id));
          compositionChanged = serverState.members.some((m: { user_id: number }) => !localIds.has(m.user_id));
        }

        // 3. Missed initiator transfer, customizer change, or status change
        const metadataChanged =
          localLobby?.initiator_id !== serverState.initiator_id ||
          localLobby?.customizer_id !== serverState.customizer_id ||
          localLobby?.status !== serverState.status;

        if (countChanged || compositionChanged || metadataChanged) {
          console.log('[LOBBY SYNC] State mismatch — syncing', {
            countChanged, compositionChanged, metadataChanged,
            local: localCount, server: serverCount,
          });
          setLobbyState(serverState);
        }
      } catch {
        // Non-critical — next interval will retry
      }
    }, 10000);

    return () => clearInterval(syncInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, lobbyMembers.length > 0]);

  /**
   * Initialize lobby on mount
   */
  // Track sessionId in ref for cleanup
  useEffect(() => {
    sessionIdRef.current = sessionId || null;
  }, [sessionId]);

  useEffect(() => {
    // Prevent double initialization
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    initializeLobby();

    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      // CRITICAL: Only call leave API if user did NOT minimize the lobby
      // If minimized, user wants to explore the app while staying in the lobby
      const leaveOnUnmount = async () => {
        const currentSessionId = sessionIdRef.current;

        // If user minimized, DON'T leave the lobby
        // IMPORTANT: Keep the private-lobby channel subscribed for ready check events!
        // Only unsubscribe from presence channel (user is no longer "present" on screen)
        if (isMinimizedRef.current) {
          console.log('📦 [UNMOUNT] User minimized lobby, keeping lobby active');
          // DON'T unsubscribe from private-lobby channel - ReadyCheckHandler needs it!
          // Only unsubscribe from presence channel
          if (presenceChannelRef.current) {
            reverbService.unsubscribe(`presence-lobby.${currentSessionId}`);
            presenceChannelRef.current = null;
            console.log('📦 [UNMOUNT] Unsubscribed from presence channel only');
          }
          // Reset refs for next time
          hasJoinedRef.current = false;
          hasInitializedRef.current = false;
          return; // DON'T call cleanup() or leave API
        }

        // If workout started, DON'T leave the lobby or kill the subscription
        // Users are transitioning to session screen, not leaving
        // Keeps private-lobby channel alive for session.tsx member left toast
        if (isWorkoutStartedRef.current) {
          console.log('🏋️ [UNMOUNT] Workout started, skipping leave API and keeping lobby channel alive');
          // Only unsubscribe from presence channel (no longer viewing lobby screen)
          if (presenceChannelRef.current) {
            reverbService.unsubscribe(`presence-lobby.${currentSessionId}`);
            presenceChannelRef.current = null;
          }
          hasJoinedRef.current = false;
          hasInitializedRef.current = false;
          return; // DON'T call cleanup() or leave API
        }

        // User didn't minimize - they left the lobby (back button, swipe, etc.)
        if (currentSessionId && !isCleaningUpRef.current) {
          try {
            console.log('🚪 [UNMOUNT] Component unmounting, calling leave API...');
            await socialService.leaveLobbyV2(currentSessionId);
            console.log('✅ [UNMOUNT] Successfully left lobby on backend');
          } catch (error) {
            console.error('❌ [UNMOUNT] Error leaving lobby:', error);
            // Continue cleanup even if API fails
          }
        }
        await cleanup();
      };

      leaveOnUnmount();
    };
  }, []);

  // NOTE: The allMembersReady auto-generation trigger was removed.
  // Exercise generation is exclusively driven by readyCheckResult === 'success'
  // (the useEffect above). Using allMembersReady as a trigger caused Bug 2:
  // when a user left after a failed/incomplete ready check, the remaining members
  // still had 'ready' status so allMembersReady became true and exercises generated
  // without any successful ready check having occurred.

  /**
   * Clear exercises when member count drops below 2
   * This prevents showing stale exercises when a user leaves
   */
  useEffect(() => {
    // Guard against updates during cleanup
    if (isCleaningUpRef.current) return;

    const memberCount = lobbyMembers.length;

    // If member count drops below 2, clear all workout state (exercises, voting, ready check)
    // This resets the lobby to a clean "waiting" state for when a new member joins
    if (memberCount < 2) {
      // Clear voting result (removes "Group accepted the recommended workout!" banner)
      if (votingResult) {
        console.log('🧹 [LOBBY] Member count dropped below 2, clearing voting state');
        clearVoting();
      }

      // Clear ready check state so a fresh ready check can be started
      if (readyCheckResult) {
        console.log('🧹 [LOBBY] Member count dropped below 2, clearing ready check state');
        clearReadyCheck();
        setIsReady(false);
      }

      // Clear exercises
      if (hasExercises) {
        console.log('🧹 [LOBBY] Member count dropped below 2, clearing exercises');
        setExerciseDetails([]);

        // Also clear from lobby state if user is initiator
        if (isInitiator && currentLobby?.session_id && !isCleaningUpRef.current) {
          console.log('🧹 [LOBBY] Clearing exercises from backend (initiator)');
          socialService.updateWorkoutDataV2(currentLobby.session_id, {
            workout_format: 'tabata',
            exercises: []
          }).catch(err => {
            if (!isCleaningUpRef.current) {
              console.error('❌ Failed to clear exercises from backend:', err);
            }
          });
        }
      }
    }
  }, [lobbyMembers.length, hasExercises, votingResult, readyCheckResult, isInitiator, currentLobby?.session_id]);

  /**
   * Fetch full exercise details when exercises are generated
   * Uses useMemo to create stable exercise IDs string for dependency
   */
  const exerciseIdsString = React.useMemo(() => {
    if (!currentLobby?.workout_data?.exercises || currentLobby.workout_data.exercises.length === 0) {
      return '';
    }
    const ids = currentLobby.workout_data.exercises.map((ex: any) => ex.exercise_id || ex.id);
    return ids.sort((a: number, b: number) => a - b).join(','); // Sort for stability
  }, [currentLobby?.workout_data?.exercises]);

  useEffect(() => {
    const fetchExerciseDetails = async () => {
      // If no exercise IDs, clear details
      if (!exerciseIdsString) {
        setExerciseDetails([]);
        return;
      }

      setIsLoadingExercises(true);
      try {
        const exerciseIds = exerciseIdsString.split(',').map(Number);
        console.log('📥 [FETCH EXERCISES] Fetching details for', exerciseIds.length, 'exercises:', exerciseIds);

        const detailsPromises = exerciseIds.map((id: number) => contentService.getExercise(String(id)));
        // allSettled so a single slow/failed exercise doesn't wipe out the rest
        const results = await Promise.allSettled(detailsPromises);
        const validDetails = results
          .filter((r): r is PromiseFulfilledResult<Exercise> => r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value);
        setExerciseDetails(validDetails);

        const failCount = results.length - validDetails.length;
        if (failCount > 0) {
          console.warn(`⚠️ [FETCH EXERCISES] ${failCount}/${results.length} exercise detail(s) failed to load`);
        }
        console.log('✅ [FETCH EXERCISES] Loaded', validDetails.length, 'exercise details');
      } catch (error) {
        console.error('❌ [FETCH EXERCISES] Error fetching exercise details:', error);
        setExerciseDetails([]);
      } finally {
        setIsLoadingExercises(false);
      }
    };

    fetchExerciseDetails();
  }, [exerciseIdsString]); // STABLE DEPENDENCY - only changes when IDs actually change

  const initializeLobby = async () => {
    // CRITICAL: Reset refs on initialization to handle component reuse
    // This ensures a fresh start when the user is re-invited to a lobby they left
    // NOTE: Only reset if this is a fresh join via invitation (not a stale cleanup state)
    if (joinedViaInvite === 'true') {
      console.log('🔄 [INIT] Resetting refs for re-invitation to lobby');
      isCleaningUpRef.current = false;
      isLobbyDeletedRef.current = false;
      hasJoinedRef.current = false;
      hasInitializedRef.current = false;
      isMountedRef.current = true;
    }

    // CRITICAL: Prevent re-initialization if cleanup is in progress
    // This prevents the lobby from being re-saved after leaving
    if (isCleaningUpRef.current) {
      console.log('🛡️ [INIT] Skipping initialization - cleanup in progress');
      return;
    }

    // CRITICAL: Check if lobby was deleted (event received during race condition)
    if (isLobbyDeletedRef.current) {
      console.log('🛡️ [INIT] Skipping initialization - lobby was deleted');
      return;
    }

    // CRITICAL: Check if we just left this lobby (Zustand flag persists across component mounts)
    // This prevents the lobby indicator from reappearing after leaving
    // EXCEPTION: If user explicitly accepted an invitation, allow re-joining
    if (leftSessionId && leftSessionId === sessionId && joinedViaInvite !== 'true') {
      console.log('🛡️ [INIT] Skipping initialization - just left this lobby:', sessionId);
      // Clear the left session marker and navigate back
      clearLeftSession();
      router.back();
      return;
    }

    // If user is re-joining via invitation, clear the leftSessionId marker
    if (leftSessionId && leftSessionId === sessionId && joinedViaInvite === 'true') {
      console.log('🔄 [INIT] Clearing leftSessionId - user accepted re-invitation');
      clearLeftSession();
    }

    if (!sessionId || !currentUser) {
      console.error('❌ Missing sessionId or user');
      router.back();
      return;
    }

    // Check if returning from minimized state (Zustand store already has the lobby)
    const existingLobby = useLobbyStore.getState().currentLobby;
    const isReturningFromMinimized = existingLobby &&
      existingLobby.session_id === sessionId &&
      existingLobby.members?.some((m: any) => m.user_id === parseInt(currentUser.id));

    if (isReturningFromMinimized) {
      console.log('📦 [INIT] Returning from minimized state, refreshing lobby state');

      // Reset animation refs so reveal doesn't fire on stale Zustand data
      // while we fetch fresh state. The `!hasJoinedRef.current` guard in the
      // reveal effect also prevents premature firing.
      hasPlayedRevealRef.current = false;
      hasCalledRevealCompleteRef.current = false;

      try {
        // Re-subscribe to channels first
        subscribeToChannels();

        // Fetch fresh state to catch up on any missed updates while minimized
        const response = await socialService.getLobbyStateV2(sessionId);

        if (response.status !== 'success' || !response.data) {
          console.log('⚠️ [INIT] Lobby no longer exists, cleaning up');
          await cleanup();
          router.back();
          return;
        }

        const freshLobbyState = response.data.lobby_state;

        // Validate lobby is still valid
        if (freshLobbyState.status === 'completed' ||
            !freshLobbyState.members ||
            freshLobbyState.members.length === 0) {
          console.log('⚠️ [INIT] Lobby is no longer valid after refresh');
          await cleanup();
          router.back();
          return;
        }

        // Update store with fresh state
        setLobbyState(freshLobbyState);
        hasJoinedRef.current = true;
        console.log('✅ [INIT] Lobby state refreshed after returning from minimize');
        return;
      } catch (error) {
        console.error('❌ [INIT] Error refreshing lobby state:', error);
        await cleanup();
        router.back();
        return;
      }
    }

    try {
      setLoading(true);

      // REAL-TIME FIRST APPROACH:
      // 1. Subscribe to WebSocket FIRST (before any API calls)
      // 2. LobbyStateChanged event will provide the initial state
      // 3. Only call API if we need to CREATE or JOIN the lobby in the database

      console.log('🔌 [REAL-TIME] Subscribing to WebSocket channels first...');
      subscribeToChannels();

      // If creating lobby, call API to create it in the database
      if (isCreatingLobby === 'true') {
        const workoutDataParsed = workoutData ? JSON.parse(workoutData) : null;

        console.log('📤 [REAL-TIME] Creating lobby in database...');
        const response = await socialService.createLobbyV2(
          parseInt(groupId),
          workoutDataParsed
        );

        if (response.status !== 'success' || !response.data) {
          throw new Error('Failed to create lobby');
        }

        console.log('✅ [REAL-TIME] Lobby created');

        const createdLobbyState = response.data.lobby_state;

        // CRITICAL: Validate created lobby (edge case: race condition with deletion)
        if (isLobbyDeletedRef.current ||
            createdLobbyState.status === 'completed' ||
            !createdLobbyState.members ||
            createdLobbyState.members.length === 0) {
          console.log('⚠️ [INIT] Created lobby is invalid, aborting:', {
            status: createdLobbyState.status,
            memberCount: createdLobbyState.members?.length || 0,
            isLobbyDeleted: isLobbyDeletedRef.current,
          });
          router.back();
          return;
        }

        // Set initial state from API response (safety net for race conditions)
        // WebSocket will handle all future updates
        setLobbyState(createdLobbyState);
      } else {
        // Lobby already exists - check if we need to join
        const isUserInitiator = initiatorId === currentUser.id;
        const alreadyJoined = joinedViaInvite === 'true';

        if (isUserInitiator || alreadyJoined) {
          // Initiator or user who already joined via invitation
          // Fetch current state once, then rely on WebSocket for updates
          console.log(
            alreadyJoined
              ? '✅ [REAL-TIME] Already joined via invitation, fetching initial state...'
              : '✅ [REAL-TIME] User is initiator, fetching initial state...'
          );

          const response = await socialService.getLobbyStateV2(sessionId);

          if (response.status !== 'success' || !response.data) {
            throw new Error('Failed to get lobby state');
          }

          const lobbyState = response.data.lobby_state;

          // CRITICAL: Validate lobby is still active (not deleted during race condition)
          // Check for completed status, 0 members, or lobby deleted flag
          if (isLobbyDeletedRef.current ||
              lobbyState.status === 'completed' ||
              !lobbyState.members ||
              lobbyState.members.length === 0) {
            console.log('⚠️ [INIT] Lobby is no longer valid, aborting initialization:', {
              status: lobbyState.status,
              memberCount: lobbyState.members?.length || 0,
              isLobbyDeleted: isLobbyDeletedRef.current,
            });
            router.back();
            return;
          }

          // Set initial state - WebSocket will handle all future updates
          setLobbyState(lobbyState);
        } else {
          // Not initiator and didn't join via invitation - join the lobby now
          console.log('📤 [REAL-TIME] Joining lobby in database...');
          const response = await socialService.joinLobbyV2(sessionId);

          if (response.status !== 'success' || !response.data) {
            throw new Error('Failed to join lobby');
          }

          console.log('✅ [REAL-TIME] Joined lobby');

          const joinedLobbyState = response.data.lobby_state;

          // CRITICAL: Validate lobby is still active after joining
          if (isLobbyDeletedRef.current ||
              joinedLobbyState.status === 'completed' ||
              !joinedLobbyState.members ||
              joinedLobbyState.members.length === 0) {
            console.log('⚠️ [INIT] Joined lobby is no longer valid, aborting:', {
              status: joinedLobbyState.status,
              memberCount: joinedLobbyState.members?.length || 0,
              isLobbyDeleted: isLobbyDeletedRef.current,
            });
            router.back();
            return;
          }

          // Set initial state from API response (safety net for race conditions)
          // WebSocket will handle all future updates
          setLobbyState(joinedLobbyState);
        }
      }

      // CRITICAL: Final check before saving - lobby could have been deleted during async operations
      if (isLobbyDeletedRef.current) {
        console.log('🛡️ [INIT] Lobby was deleted during initialization, skipping save');
        router.back();
        return;
      }

      // Save active lobby to AsyncStorage (for crash recovery)
      await saveActiveLobbyToStorage();

      hasJoinedRef.current = true;
    } catch (error) {
      console.error('❌ Error initializing lobby:', error);
      alert.error('Error', 'Failed to join lobby. Please try again.', () => router.back());
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save active lobby to AsyncStorage for crash recovery
   */
  const saveActiveLobbyToStorage = async () => {
    // CRITICAL: Don't save if cleanup is in progress or lobby was deleted
    // This prevents the lobby indicator from reappearing after leaving
    if (isCleaningUpRef.current) {
      console.log('🛡️ [SAVE] Skipping save - cleanup in progress');
      return;
    }

    if (isLobbyDeletedRef.current) {
      console.log('🛡️ [SAVE] Skipping save - lobby was deleted');
      return;
    }

    if (!sessionId || !groupId || !currentUser) return;

    // Get current lobby state from store to validate
    const lobbyState = useLobbyStore.getState().currentLobby;

    // CRITICAL: Don't save if lobby is invalid (completed, no members, etc.)
    if (!lobbyState ||
        lobbyState.status === 'completed' ||
        !lobbyState.members ||
        lobbyState.members.length === 0) {
      console.log('🛡️ [SAVE] Skipping save - lobby is invalid:', {
        hasLobbyState: !!lobbyState,
        status: lobbyState?.status,
        memberCount: lobbyState?.members?.length || 0,
      });
      return;
    }

    try {
      // Get group name from currentLobby if available
      const groupName = `Group ${groupId}`; // Fallback name

      // Use LobbyContext to save lobby session
      await saveLobbySession(sessionId, groupId, groupName);
    } catch (error) {
      console.error('❌ Error saving lobby to storage:', error);
    }
  };

  /**
   * Subscribe to WebSocket channels
   */
  const subscribeToChannels = () => {
    // CRITICAL: Don't subscribe if cleanup is in progress or lobby was deleted
    if (isCleaningUpRef.current) {
      console.log('🛡️ [SUBSCRIBE] Skipping subscription - cleanup in progress');
      return;
    }

    if (isLobbyDeletedRef.current) {
      console.log('🛡️ [SUBSCRIBE] Skipping subscription - lobby was deleted');
      return;
    }

    if (!sessionId) {
      console.error('❌ Cannot subscribe to channels: sessionId is missing');
      return;
    }

    console.log('🔌 Subscribing to WebSocket channels for session:', sessionId);
    console.log('🔍 reverbService available:', !!reverbService);
    console.log('🔍 subscribeToLobby method available:', typeof reverbService.subscribeToLobby);

    try {
      // Subscribe to lobby channel for events
      console.log('🔌 Calling subscribeToLobby...');
      channelRef.current = reverbService.subscribeToLobby(sessionId, {
      onLobbyStateChanged: (data: any) => {
        // ALWAYS update Zustand store even when unmounted (global state, safe to call)
        // This ensures the global listener in _layout.tsx can detect workout starts
        // when the user has minimized the lobby screen
        if (data?.lobby_state) {
          setLobbyState(data.lobby_state);
        }

        // Guard React state/UI updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) {
          console.log('📊 [REAL-TIME] Lobby state updated in store (component unmounted)');
          return;
        }
        console.log('📊 [REAL-TIME] Lobby state changed:', data);

        // Recovery: if backend reports active_voting but our local store missed VotingStarted,
        // reconstruct the voting state now. This handles the case where LobbyStateChanged
        // fires (e.g. a member joins/leaves) while we're stuck mid-voting-wait.
        const av = data?.lobby_state?.active_voting;
        if (av && !useVotingStore.getState().isActive) {
          console.log('[VOTING RECOVERY] Detected active_voting in LobbyStateChanged — recovering missed VotingStarted');
          startVoting({
            sessionId: av.session_id || sessionId,
            votingId: av.voting_id,
            initiatorId: av.initiator_id,
            initiatorName: av.initiator_name || '',
            members: av.members || [],
            exercises: av.exercises || [],
            alternativePool: av.alternative_pool || [],
            timeoutSeconds: av.timeout_seconds,
            expiresAt: av.expires_at,
          });
        }
      },
      // NOTE: Individual events like MemberJoined, MemberLeft, MemberStatusUpdated are kept
      // for system chat messages only. State updates come from LobbyStateChanged above.
      onMemberJoined: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('👤 [REAL-TIME] Member joined:', data);

        // Update member list from full lobby_state if available (primary path)
        // Falls back to addMember for immediate UI update if LobbyStateChanged was missed
        if (data?.lobby_state) {
          setLobbyState(data.lobby_state);
        } else if (data?.member) {
          addMember({
            user_id: data.member.user_id,
            user_name: data.member.user_name,
            status: data.member.status || 'waiting',
            joined_at: data.member.joined_at || Math.floor(Date.now() / 1000),
          });
        }

        if (data?.member) {
          addChatMessage({
            message_id: `system-${Date.now()}`,
            user_id: null,
            user_name: 'System',
            message: `${data.member.user_name} joined the lobby`,
            timestamp: Math.floor(Date.now() / 1000),
            is_system_message: true,
          });
        }
      },
      onMemberLeft: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('👤 [REAL-TIME] Member left:', data);

        // If a ready check had COMPLETED (result set, isActive=false) but was never
        // cleared, clean it up now. The backend handles active ready checks by
        // broadcasting ReadyCheckCancelled (which clears the store via onReadyCheckCancelled).
        // This handles the residual case: ready check finished (success or failed) and
        // then a member later leaves — without this, readyCheckResult stays set and
        // could re-fire the generation useEffect on future state changes.
        const rcState = useReadyCheckStore.getState();
        if (!rcState.isActive && rcState.result !== null) {
          clearReadyCheck();
          setIsReady(false);
          console.log('🧹 [MEMBER LEFT] Cleared completed ready check state (team changed)');
        }

        // Add system chat message (don't update state - LobbyStateChanged handles it)
        if (data?.user_id) {
          addChatMessage({
            message_id: `system-${Date.now()}`,
            user_id: null,
            user_name: 'System',
            message: `${data.user_name || 'A member'} left the lobby`,
            timestamp: Math.floor(Date.now() / 1000),
            is_system_message: true,
          });
        }
      },
      onMemberStatusUpdated: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('✅ [REAL-TIME] Member status updated:', data);
        // State update handled by LobbyStateChanged event
        // This event is kept for potential future use (analytics, etc.)
      },
      onLobbyMessageSent: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('💬 Message received:', data);
        // The data object IS the message, not data.message
        if (data?.message_id) {
          addChatMessage(data);
        }
      },
      onWorkoutStarted: (data: any) => {
        // ALWAYS update Zustand store status to 'in_progress' (even when unmounted)
        // This allows GlobalLobbyIndicator to detect workout start when user minimized lobby
        const currentStoreState = useLobbyStore.getState().currentLobby;
        if (currentStoreState && currentStoreState.status !== 'in_progress') {
          setLobbyState({ ...currentStoreState, status: 'in_progress' });
          console.log('📊 [REAL-TIME] Updated Zustand store status to in_progress');
        }

        // Guard against React state/UI updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) {
          console.log('🏋️ [REAL-TIME] WorkoutStarted received while unmounted - Zustand updated, GlobalLobbyIndicator will handle navigation');
          return;
        }
        console.log('🏋️ Workout started!', data);

        // Mark that workout started - prevents unmount cleanup from calling leaveLobbyV2
        // and broadcasting false member.left events during lobby-to-session transition
        isWorkoutStartedRef.current = true;

        // IMPORTANT: Access lobby store directly to get the LATEST state
        // Don't use currentLobby from closure as it may be stale
        const freshLobbyState = useLobbyStore.getState().currentLobby;

        console.log('🔍 Fresh lobby state:', {
          hasLobby: !!freshLobbyState,
          hasWorkoutData: !!freshLobbyState?.workout_data,
          exerciseCount: freshLobbyState?.workout_data?.exercises?.length || 0,
          currentInitiatorId: freshLobbyState?.initiator_id
        });

        // Get workout data from fresh lobby state (which has the generated exercises)
        // The backend WorkoutStarted event doesn't include full workout_data
        const workoutDataToUse = freshLobbyState?.workout_data || data.workout_data;

        if (!workoutDataToUse || !workoutDataToUse.exercises || workoutDataToUse.exercises.length === 0) {
          console.error('❌ No workout data available for session!', {
            hasWorkoutDataToUse: !!workoutDataToUse,
            hasExercises: !!workoutDataToUse?.exercises,
            exerciseLength: workoutDataToUse?.exercises?.length,
            dataFromEvent: data,
            freshLobbyState: freshLobbyState
          });
          alert.error('Error', 'No workout data available. Please try generating exercises first.');
          return;
        }

        console.log('✅ Using workout data with', workoutDataToUse.exercises.length, 'exercises');

        // Transform workout_data into TabataWorkoutSession format
        // The session screen expects a full TabataWorkoutSession object
        const tabataSession = {
          session_id: sessionId,
          session_name: `Group Workout - ${freshLobbyState?.group_id || groupId}`,
          difficulty_level: 'intermediate', // Default for group workouts
          total_exercises: workoutDataToUse.exercises.length,
          total_duration_minutes: workoutDataToUse.exercises.length * 4, // 4 min per exercise (Tabata standard)
          estimated_calories: workoutDataToUse.exercises.reduce(
            (sum: number, ex: any) => sum + (ex.estimated_calories_burned || 0),
            0
          ),
          exercises: workoutDataToUse.exercises,
          created_at: new Date().toISOString(),
        };

        console.log('✅ Created TabataWorkoutSession:', {
          session_id: tabataSession.session_id,
          total_exercises: tabataSession.total_exercises,
          total_duration_minutes: tabataSession.total_duration_minutes,
        });

        // CRITICAL FIX: Use CURRENT initiator_id from lobby state, not the original URL param
        // This ensures the pause button shows for the correct user after role transfer
        const currentInitiatorId = freshLobbyState?.initiator_id?.toString() || initiatorId;

        console.log('🎯 [INITIATOR FIX] Passing initiator ID to session:', {
          currentInitiatorId: currentInitiatorId,
          fromLobbyState: freshLobbyState?.initiator_id,
          originalUrlParam: initiatorId,
          usingCorrectValue: currentInitiatorId === freshLobbyState?.initiator_id?.toString()
        });

        // Navigate to workout session
        // IMPORTANT: The session screen expects 'sessionData' parameter, not 'workoutData'
        // IMPORTANT: Must pass initiatorId so session screen knows who can pause/stop
        router.replace({
          pathname: '/workout/session',
          params: {
            sessionData: JSON.stringify(tabataSession),
            type: 'group_tabata',
            isGroup: 'true',
            initiatorId: currentInitiatorId,  // Pass CURRENT initiator ID (after any role transfers)
            groupId: groupId,                  // Pass group ID for reference
          },
        });
      },
      onLobbyDeleted: (data: any) => {
        // CRITICAL: Set deleted flag FIRST to prevent any further initialization or saves
        // This flag is checked in initializeLobby, saveActiveLobbyToStorage, and subscribeToChannels
        isLobbyDeletedRef.current = true;
        console.log('🗑️ [LOBBY DELETED] Setting isLobbyDeletedRef=true, reason:', data.reason);

        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;

        alert.info('Lobby Closed', data.reason || 'The lobby has been closed.', () => {
          cleanup();
          router.back();
        });
      },
      onMemberKicked: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('⚠️ [REAL-TIME] Member kicked:', data);
        // NOTE: The kicked user receives this event on their PERSONAL channel (private-user.{id})
        // NOT on the lobby channel. So this handler only processes OTHER users being kicked.
        if (data?.kicked_user_id) {
          // Add system chat message (don't update state - LobbyStateChanged handles it)
          addChatMessage({
            message_id: `system-${Date.now()}`,
            user_id: null,
            user_name: 'System',
            message: `${data.kicked_user_name || 'A member'} was removed from the lobby`,
            timestamp: Math.floor(Date.now() / 1000),
            is_system_message: true,
          });
        }
      },
      onInitiatorRoleTransferred: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('👑 [REAL-TIME] Initiator role transferred:', data);
        // NOTE: isInitiator state is automatically updated by the useEffect watching currentLobby.initiator_id
        // No manual state update needed here - LobbyStateChanged event updates the store

        // Add system chat message
        addChatMessage({
          message_id: `system-${Date.now()}`,
          user_id: null,
          user_name: 'System',
          message: `${data.new_initiator_name || 'A member'} is now the lobby leader`,
          timestamp: Math.floor(Date.now() / 1000),
          is_system_message: true,
        });
      },
      // Ready Check Event Handlers
      onReadyCheckStarted: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('🔔 [REAL-TIME] Ready check started:', data);

        // Start ready check in store - this will show the modal globally
        startReadyCheck({
          sessionId: data.session_id || sessionId,
          groupId: groupId,
          groupName: currentLobby?.group_id ? `Group ${currentLobby.group_id}` : 'Workout Lobby',
          initiatorId: data.initiator_id,
          initiatorName: data.initiator_name || 'Host',
          members: data.members || lobbyMembers.map((m) => ({
            user_id: m.user_id,
            user_name: m.user_name,
          })),
          timeoutSeconds: data.timeout_seconds || 25,
          serverExpiresAt: data.expires_at,
        });
      },
      onReadyCheckResponse: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('📝 [REAL-TIME] Ready check response:', data);

        // Update response in store
        const updateResponse = useReadyCheckStore.getState().updateResponse;
        updateResponse(data.user_id, data.response);

        if (data.response === 'accepted') {
          // Update member status to 'ready' in lobby store
          updateMemberStatus(data.user_id, 'ready');
          // Keep local ready state in sync for the current user
          if (currentUser && data.user_id === parseInt(currentUser.id)) {
            setIsReady(true);
          }
        } else if (data.response === 'declined') {
          // Show immediately in chat so everyone knows who declined.
          // The backend also fires ReadyCheckComplete(success=false) right after,
          // but this per-response message is more descriptive.
          const declinerName = data.user_name || `User #${data.user_id}`;
          addChatMessage({
            message_id: `system-${Date.now()}-rc-decline-${data.user_id}`,
            user_id: null,
            user_name: 'System',
            message: `${declinerName} is not ready — ready check failed.`,
            timestamp: Math.floor(Date.now() / 1000),
            is_system_message: true,
          });
        }
      },
      onReadyCheckComplete: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('🏁 [REAL-TIME] Ready check complete:', data);

        // Set result in store — exercise generation is handled by the
        // readyCheckResult useEffect (not here), which also validates that
        // all current lobby members responded before generating.
        setReadyCheckResult(data.success ? 'success' : 'failed');

        if (data.success) {
          // Update all members' lobby status to 'ready' so the UI reflects it
          lobbyMembers.forEach(member => {
            updateMemberStatus(member.user_id, 'ready');
          });
          setIsReady(true);
        } else {
          // Show in chat if failed for a reason OTHER than decline
          // (decline is already shown by onReadyCheckResponse above).
          // The 'timeout' case has no per-user event, so we handle it here.
          if (data.reason === 'timeout') {
            addChatMessage({
              message_id: `system-${Date.now()}-rc-timeout`,
              user_id: null,
              user_name: 'System',
              message: 'Ready check timed out — not all members responded in time.',
              timestamp: Math.floor(Date.now() / 1000),
              is_system_message: true,
            });
          }
        }
      },
      onReadyCheckCancelled: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('❌ [REAL-TIME] Ready check cancelled:', data);

        // Clear ready check store and reset local ready state.
        // The backend sends this when: (a) initiator cancels manually,
        // (b) a member joins mid-check, or (c) a member leaves mid-check.
        clearReadyCheck();
        setIsReady(false);
      },
      // Voting events
      onVotingStarted: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('[REAL-TIME] Voting started:', data);
        console.log('[REAL-TIME] Alternatives received:', data.alternative_pool?.length || 0);
        console.log('[REAL-TIME] Alternative data sample:', JSON.stringify((data.alternative_pool || []).slice(0, 2)));

        // Start voting in store
        startVoting({
          sessionId: data.session_id,
          votingId: data.voting_id,
          initiatorId: data.initiator_id,
          initiatorName: data.initiator_name,
          members: data.members,
          exercises: data.exercises,
          alternativePool: data.alternative_pool || [],
          timeoutSeconds: data.timeout_seconds,
          expiresAt: data.expires_at,
        });
      },
      onVoteSubmitted: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('[REAL-TIME] Vote submitted:', data);

        // Update vote in store
        submitVote(data.user_id, data.user_name, data.vote);
      },
      onVotingComplete: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('[REAL-TIME] Voting complete:', data);

        // Complete voting in store (includes customizer_id from backend)
        completeVoting({
          result: data.result,
          reason: data.reason,
          finalVotes: data.final_votes,
          acceptCount: data.accept_count,
          customizeCount: data.customize_count,
          finalExercises: data.final_exercises,
          customizerId: data.customizer_id ?? null,
        });

        // Update lobby state with customizer_id if customize won
        if (data.result === 'customize' && data.customizer_id) {
          const latestLobby = useLobbyStore.getState().currentLobby;
          if (latestLobby) {
            setLobbyState({
              ...latestLobby,
              customizer_id: data.customizer_id,
            });
          }
        }
      },
      // Exercise swap event (during group customization)
      onExerciseSwapped: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('[REAL-TIME] Exercise swapped:', data);

        // Mark pending swap as confirmed (handles case where HTTP times out but WebSocket succeeds)
        if (pendingSwapRef.current &&
            pendingSwapRef.current.slotIndex === data.slot_index &&
            pendingSwapRef.current.exerciseId === data.new_exercise?.exercise_id) {
          console.log('[REAL-TIME] Pending swap confirmed via WebSocket');
          pendingSwapRef.current.confirmed = true;
        }

        // Update exercise details with the swapped exercise
        if (data.slot_index !== undefined && data.new_exercise) {
          setExerciseDetails((prev) => {
            const updated = [...prev];
            if (updated[data.slot_index]) {
              updated[data.slot_index] = {
                ...updated[data.slot_index],
                ...data.new_exercise,
              };
            }
            return updated;
          });

          // Show feedback to non-initiator users
          if (currentUser && parseInt(currentUser.id) !== data.swapped_by) {
            alert.info(
              'Exercise Changed',
              `${data.swapped_by_name} swapped "${data.old_exercise?.exercise_name}" with "${data.new_exercise?.exercise_name}"`
            );
          }
        }
      },
      // Exercise reorder event (during group customization)
      onExercisesReordered: (data: any) => {
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('[REAL-TIME] Exercises reordered:', data);

        if (data.updated_exercises && Array.isArray(data.updated_exercises)) {
          setExerciseDetails((prev) => {
            // Map backend exercise data onto full exercise details
            return data.updated_exercises.map((serverEx: any, idx: number) => {
              // Find matching full exercise detail from our local state
              const fullDetail = prev.find((e) => e.exercise_id === serverEx.exercise_id);
              return fullDetail ? { ...fullDetail, ...serverEx } : serverEx;
            });
          });

          // Show feedback to non-customizer users
          if (currentUser && parseInt(currentUser.id) !== data.reordered_by) {
            alert.info('Exercises Reordered', `${data.reordered_by_name} reordered the exercises`);
          }
        }
      },
    });

      console.log('✅ Subscribed to lobby channel');
      console.log('🔌 Calling subscribeToPresence...');

      // Subscribe to presence channel for lobby-specific tracking
      // Note: Online indicators use global presence (onlineUsers from useReverb)
      // This channel tracks who's actively viewing this specific lobby screen
      presenceChannelRef.current = reverbService.subscribeToPresence(`lobby.${sessionId}`, {
        onHere: (members: any[]) => {
          // Guard against updates during cleanup
          if (isCleaningUpRef.current || !isMountedRef.current) return;
          console.log('👥 Members here:', members);
          const memberIds = new Set((members || []).map((m) => m.user_id));
          setOnlineMembers(memberIds);
        },
        onJoining: (member: any) => {
          // Guard against updates during cleanup
          if (isCleaningUpRef.current || !isMountedRef.current) return;
          console.log('✅ Member joining:', member);
          if (member?.user_id) {
            setOnlineMembers((prev) => new Set([...prev, member.user_id]));
          }
        },
        onLeaving: (member: any) => {
          // Guard against updates during cleanup
          if (isCleaningUpRef.current || !isMountedRef.current) return;
          console.log('❌ Member leaving:', member);
          if (member?.user_id) {
            setOnlineMembers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(member.user_id);
              return newSet;
            });
          }
        },
      });

      console.log('✅ Subscribed to presence channel');

      // Subscribe to user's personal channel for kick notifications
      if (currentUser) {
        console.log('🔌 Subscribing to user channel for user:', currentUser.id);
        userChannelRef.current = reverbService.subscribeToUserChannel(currentUser.id, {
          onMemberKicked: (data: any) => {
            // Guard against updates during cleanup
            if (isCleaningUpRef.current || !isMountedRef.current) return;
            console.log('🚫 YOU HAVE BEEN KICKED from lobby:', data);
            alert.warning(
              'Removed from Lobby',
              data.message || 'You have been removed from the lobby.',
              () => {
                cleanup();
                router.back();
              }
            );
          },
        });
        console.log('✅ Subscribed to user channel');
      }

      console.log('✅ Subscribed to all lobby channels');
    } catch (error) {
      console.error('❌ Error subscribing to channels:', error);
      throw error;
    }
  };

  /**
   * Toggle ready status
   */
  const handleToggleReady = async () => {
    if (!sessionId || !currentUser || isTogglingReady) return;

    setIsTogglingReady(true);
    const newStatus = isReady ? 'waiting' : 'ready';

    // Optimistic update - update UI immediately
    setIsReady(!isReady);
    updateMemberStatus(parseInt(currentUser.id), newStatus);

    try {
      const response = await socialService.updateLobbyStatusV2(sessionId, newStatus);

      if (response.status !== 'success') {
        // Revert on failure
        setIsReady(isReady);
        updateMemberStatus(parseInt(currentUser.id), isReady ? 'ready' : 'waiting');
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      // Revert on error
      setIsReady(isReady);
      updateMemberStatus(parseInt(currentUser.id), isReady ? 'ready' : 'waiting');
      alert.error('Error', 'Failed to update status. Please try again.');
    } finally {
      setIsTogglingReady(false);
    }
  };

  /**
   * Leave lobby
   */
  const handleLeaveLobby = () => {
    alert.confirm(
      'Leave Lobby',
      'Are you sure you want to leave the lobby?',
      async () => {
        await leaveLobby();
      },
      undefined,
      'Leave',
      'Cancel'
    );
  };

  const leaveLobby = async () => {
    if (!sessionId || isLeaving) return;

    setIsLeaving(true);
    // NOTE: Do NOT set isCleaningUpRef.current here - let cleanup() handle it
    // Setting it here would cause cleanup() to return early without doing anything

    try {
      console.log('📤 [LEAVE] Calling leaveLobbyV2 API...');
      await socialService.leaveLobbyV2(sessionId);
      console.log('✅ [LEAVE] Successfully left lobby on backend');
    } catch (error) {
      console.error('❌ [LEAVE] Error leaving lobby:', error);
      // Continue with cleanup even if API fails
    }

    // Always cleanup regardless of API success/failure
    await cleanup();
    router.back();
    setIsLeaving(false);
  };

  /**
   * Minimize lobby to explore the app while waiting
   * User stays in the lobby, GlobalLobbyIndicator will show
   */
  const handleMinimizeLobby = () => {
    console.log('📦 [MINIMIZE] User minimizing lobby to explore app');
    isMinimizedRef.current = true; // Mark as minimized so unmount doesn't call leave API
    router.back();
  };

  /**
   * Load group members for inviting
   */
  const loadGroupMembers = async () => {
    if (!groupId) return;

    setIsLoadingMembers(true);
    try {
      const response = await socialService.getGroupMembers(groupId, 1, 50);

      if (response && response.members) {
        // Filter out members who are already in the lobby
        const lobbyMemberIds = new Set(lobbyMembers.map(m => m.user_id));
        const availableMembers = response.members.filter(
          (member: any) => !lobbyMemberIds.has(parseInt(member.userId))
        );
        setGroupMembers(availableMembers);
      }
    } catch (error) {
      console.error('❌ Error loading group members:', error);
      alert.error('Error', 'Failed to load group members.');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  /**
   * Subscribe to group presence for online status
   */
  const subscribeToGroupPresence = () => {
    if (!groupId) return;

    console.log('🟢 Getting existing group presence channel for group:', groupId);

    try {
      // Get the existing presence channel that was created in ReverbProvider
      // instead of creating a new subscription
      const existingChannel = (reverbService as any).pusher?.channel(`presence-group.${groupId}`);

      if (existingChannel) {
        console.log('✅ Found existing group presence channel, reusing it');
        groupPresenceChannelRef.current = existingChannel;

        // Bind to presence events on the existing channel
        existingChannel.bind('pusher:subscription_succeeded', (members: any) => {
          console.log('👥 Group members online (RAW):', JSON.stringify(members, null, 2));
          const membersList = Object.keys(members.members || {}).map(id => parseInt(id));
          console.log('👥 Processed member IDs:', membersList);
          setGroupOnlineMembers(new Set(membersList));
        });

        existingChannel.bind('pusher:member_added', (member: any) => {
          console.log('✅ Group member joining (RAW):', JSON.stringify(member, null, 2));
          const userId = parseInt(member.id);
          console.log('✅ Extracted user ID:', userId);
          if (userId) {
            setGroupOnlineMembers((prev) => {
              const newSet = new Set([...prev, userId]);
              console.log('✅ Updated online members:', Array.from(newSet));
              return newSet;
            });
          }
        });

        existingChannel.bind('pusher:member_removed', (member: any) => {
          console.log('❌ Group member leaving (RAW):', JSON.stringify(member, null, 2));
          const userId = parseInt(member.id);
          console.log('❌ Extracted user ID:', userId);
          if (userId) {
            setGroupOnlineMembers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(userId);
              console.log('❌ Updated online members:', Array.from(newSet));
              return newSet;
            });
          }
        });

        // Get current members immediately
        const currentMembers = existingChannel.members;
        if (currentMembers) {
          const membersList = Object.keys(currentMembers.members || {}).map(id => parseInt(id));
          console.log('👥 Current members from existing channel:', membersList);
          setGroupOnlineMembers(new Set(membersList));
        }
      } else {
        console.log('⚠️ No existing group presence channel found, creating new subscription');
        groupPresenceChannelRef.current = reverbService.subscribeToPresence(
          `group.${groupId}`,
        {
          onHere: (members: any[]) => {
            console.log('👥 Group members online (RAW):', JSON.stringify(members, null, 2));
            const memberIds = new Set((members || []).map((m) => {
              const userId = parseInt(m.user_id || m.id);
              console.log('Processing member:', m, '-> userId:', userId);
              return userId;
            }));
            console.log('👥 Processed member IDs:', Array.from(memberIds));
            setGroupOnlineMembers(memberIds);
          },
          onJoining: (member: any) => {
            console.log('✅ Group member joining (RAW):', JSON.stringify(member, null, 2));
            const userId = parseInt(member.user_id || member.id);
            console.log('✅ Extracted user ID:', userId);
            if (userId) {
              setGroupOnlineMembers((prev) => {
                const newSet = new Set([...prev, userId]);
                console.log('✅ Updated online members:', Array.from(newSet));
                return newSet;
              });
            }
          },
          onLeaving: (member: any) => {
            console.log('❌ Group member leaving (RAW):', JSON.stringify(member, null, 2));
            const userId = parseInt(member.user_id || member.id);
            console.log('❌ Extracted user ID:', userId);
            if (userId) {
              setGroupOnlineMembers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                console.log('❌ Updated online members:', Array.from(newSet));
                return newSet;
              });
            }
          },
        }
        );

        console.log('✅ Created new group presence subscription');
      }

      console.log('✅ Group presence channel ready');
    } catch (error) {
      console.error('❌ Error accessing group presence:', error);
    }
  };

  /**
   * Open invite modal (now available to all users)
   */
  const handleInviteMembers = async () => {
    setIsInviteModalOpen(true);

    // Subscribe to group presence if not already subscribed
    if (!groupPresenceChannelRef.current) {
      subscribeToGroupPresence();
    }

    await loadGroupMembers();
  };

  /**
   * Toggle member selection
   */
  const toggleMemberSelection = (userId: number) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  /**
   * Send invitations
   *
   * Edge cases handled:
   * - 409 "already has a pending invitation": user was already invited (e.g.
   *   from a previous "Invite All"). Treat as success — invite exists, no action needed.
   * - 409 "already in this lobby": user joined between modal-open and send.
   *   Also treated as success.
   * - 429 rate limit: bail out of the loop immediately and show a clear message.
   *   No point sending more — all subsequent attempts will also be rate-limited.
   */
  const handleSendInvitations = async () => {
    if (selectedMembers.size === 0) {
      alert.warning('No Members Selected', 'Please select at least one member to invite.');
      return;
    }

    setIsInviting(true);
    try {
      // Send invitations sequentially to avoid race conditions on slow networks
      // (parallel sends can trigger simultaneous stale-lobby cleanup for the same user)
      const allResults: Array<{ userId: number; success: boolean; error?: string; userName?: string }> = [];
      let rateLimitHit = false;

      for (const userId of Array.from(selectedMembers)) {
        try {
          await socialService.inviteMemberToLobbyV2(
            sessionId,
            userId,
            parseInt(groupId),
            currentLobby?.workout_data || { workout_format: 'tabata', exercises: [] }
          );
          allResults.push({ userId, success: true });
        } catch (error: any) {
          const msg: string = error.message || '';

          // 409 "already has a pending invitation" — invitation already exists,
          // treat as success so it doesn't show as a failure to the initiator.
          // 409 "already in this lobby" — user joined between modal open and send.
          if (msg.includes('already has a pending invitation') || msg.includes('already in this lobby')) {
            allResults.push({ userId, success: true });
            continue;
          }

          // 429 rate limit — bail immediately. All remaining users would also
          // fail since the quota is exhausted for this hour.
          if (msg.includes('Too many invitations') || msg.includes('maximum of 20')) {
            rateLimitHit = true;
            allResults.push({ userId, success: false, error: msg, userName: getMemberName(userId) });
            break;
          }

          allResults.push({ userId, success: false, error: error.message, userName: getMemberName(userId) });
        }
      }

      // Count successes and failures
      const successful = allResults.filter(r => r.success);
      const failed = allResults.filter(r => !r.success);

      console.log('📊 Invitation results:', {
        total: selectedMembers.size,
        attempted: allResults.length,
        successful: successful.length,
        failed: failed.length,
        rateLimitHit,
        failedDetails: failed.map(f => ({ userId: f.userId, userName: f.userName, error: f.error }))
      });

      // Rate limit hit — show specific message so user knows to wait
      if (rateLimitHit) {
        const sentCount = successful.length;
        alert.error(
          'Invite Limit Reached',
          `${sentCount > 0 ? `${sentCount} invitation(s) sent. ` : ''}` +
          `You've reached the invitation limit (20/hour). Please wait before inviting more members.`
        );
        return;
      }

      // Show appropriate message
      if (successful.length === selectedMembers.size) {
        // All succeeded (includes those already-pending — invite exists either way)
        alert.success(
          'Invitations Sent',
          `Successfully invited ${successful.length} member(s) to the lobby.`,
          () => {
            setIsInviteModalOpen(false);
            setSelectedMembers(new Set());
          }
        );
      } else if (successful.length > 0) {
        // Some succeeded, some failed
        const failedUsers = failed.map(f => f.userName || `User ${f.userId}`).join(', ');
        const hasLobbyError = failed.some(f => f.error?.includes('already in another lobby'));

        alert.warning(
          'Partial Success',
          `${successful.length} invitation(s) sent successfully.\n\n` +
          `Failed to invite: ${failedUsers}\n\n` +
          `${hasLobbyError ? 'Note: Some users may have a stale lobby session. Ask them to restart their app if they\'re not actually in a lobby.' : ''}`,
          () => {
            setIsInviteModalOpen(false);
            setSelectedMembers(new Set());
          }
        );
      } else {
        // All failed
        const firstError = failed[0]?.error || 'Unknown error';
        const hasLobbyError = firstError.includes('already in another lobby');
        const failedUserNames = failed.map(f => f.userName || `User ${f.userId}`).join(', ');

        alert.error(
          'Invitation Failed',
          hasLobbyError
            ? `Unable to invite ${failedUserNames}.\n\nThe backend reports they are in another lobby. This may be a stale session.\n\nSolution: Ask them to:\n1. Restart their app\n2. Check if they're actually in a lobby and leave it first`
            : `Failed to invite ${failedUserNames}. Please try again.`
        );
      }
    } catch (error) {
      console.error('❌ Error sending invitations:', error);
      alert.error('Error', 'Failed to send invitations. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  /**
   * Get member name by userId from groupMembers
   */
  const getMemberName = (userId: number): string => {
    const member = groupMembers.find(m => parseInt(m.userId) === userId);
    return member?.username || `User ${userId}`;
  };

  /**
   * Transfer role (initiator only)
   */
  const handleTransferRole = (userId: number, userName: string) => {
    if (!isInitiator) return;

    alert.confirm(
      'Transfer Leader Role',
      `Transfer the leader role to ${userName}? You will become a regular member.`,
      async () => {
        try {
          console.log('👑 Transferring initiator role to:', userName);
          await socialService.transferInitiatorRoleV2(sessionId, userId);

          // Real-time updates will be handled by WebSocket listener
          // No need to manually update state - the broadcast will trigger it
          console.log('✅ Role transfer initiated successfully');
        } catch (error) {
          console.error('❌ Error transferring role:', error);
          alert.error('Error', 'Failed to transfer leader role. Please try again.');
        }
      },
      undefined,
      'Transfer',
      'Cancel'
    );
  };

  /**
   * Kick member (initiator only)
   */
  const handleKickMember = (userId: number, userName: string) => {
    if (!isInitiator) return;

    alert.confirm(
      'Remove Member',
      `Remove ${userName} from the lobby?`,
      async () => {
        try {
          console.log('🚫 Removing member from lobby:', userName);
          await socialService.kickMemberFromLobbyV2(sessionId, userId);

          // Real-time updates will be handled by WebSocket listener
          // The member will be removed from the list automatically via broadcast
          console.log('✅ Member removed successfully');
        } catch (error) {
          console.error('❌ Error kicking member:', error);
          alert.error('Error', 'Failed to remove member. Please try again.');
        }
      },
      undefined,
      'Remove',
      'Cancel'
    );
  };

  /**
   * Auto-generate exercises when ALL members are ready (minimum 2 users)
   */
  const autoGenerateExercises = async (totalMemberCount: number) => {
    // Safety guards (should already be checked by useEffect, but double-check)
    if (!isInitiator || totalMemberCount < 2 || isGenerating || hasExercises) {
      return;
    }

    console.log('🎯 Auto-generating exercises for', totalMemberCount, 'members (all ready)');
    setIsGenerating(true);

    try {
      // Get all user IDs from lobby members
      const userIds = lobbyMembers.map(member => member.user_id);

      console.log('📤 Calling ML group recommendations for users:', userIds);

      // Import ML service
      const { mlService } = await import('../../services/microservices/mlService');

      // Call ML group recommendations API with alternatives for voting
      const response = await mlService.getGroupWorkoutRecommendations(userIds, {
        workout_format: 'tabata',
        include_alternatives: true,
        num_alternatives: 6
      });

      if (response?.success && response?.workout?.exercises) {
        console.log('✅ Generated', response.workout.exercises.length, 'exercises');
        const alternatives = response.workout.alternative_pool || [];
        console.log('✅ Generated', alternatives.length, 'alternatives for voting');
        console.log('📋 [DEBUG] Alternatives data:', JSON.stringify(alternatives.slice(0, 2)));

        // Store alternatives for voting
        setAlternativePool(alternatives);

        // If no alternatives from ML, warn but continue
        if (alternatives.length === 0) {
          console.warn('⚠️ [ML] No alternatives returned. Exercise database may have limited data.');
        }

        // Check if user is still in lobby before updating (race condition prevention)
        if (isLeaving || !isMountedRef.current || isCleaningUpRef.current) {
          console.log('⚠️ User left lobby or component unmounted, skipping workout data update');
          return;
        }

        // Update lobby with generated exercises via backend (V2 API)
        await socialService.updateWorkoutDataV2(sessionId, {
          workout_format: 'tabata',
          exercises: response.workout.exercises
        });

        console.log('✅ Exercises saved to lobby successfully');

        // Store voting data — triggerVoting fires after the reveal animation completes
        // via onRevealComplete on AnimatedExerciseReveal (not a hardcoded timeout)
        pendingVotingDataRef.current = {
          exercises: response.workout.exercises,
          alternatives,
        };
      } else {
        throw new Error('No exercises generated');
      }
    } catch (error) {
      console.error('❌ Error auto-generating exercises:', error);
      alert.warning('Notice', 'Could not generate personalized workout. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Trigger voting via backend API (initiator only)
   * Voting only occurs if there's at least one mentor/advanced user in the lobby.
   * If no mentor/advanced exists, skip voting and use recommended exercises directly.
   */
  const triggerVoting = async (exercises: any[], alternatives: any[]) => {
    if (!isInitiator || !sessionId || isVotingActive) {
      console.log('[VOTING] Skipping trigger - not initiator or already active');
      return;
    }

    // Check if any mentor or advanced user exists in the lobby
    const hasCustomizableUser = lobbyMembers.some(
      m => m.user_role === 'mentor' || m.fitness_level === 'advanced'
    );

    if (!hasCustomizableUser) {
      console.log('[VOTING] Skipping voting - no mentor/advanced users in lobby');
      console.log('[VOTING] Using recommended exercises directly (no customization available)');
      // No voting needed - exercises are already saved, workout can start
      return;
    }

    console.log('[VOTING] Triggering voting (mentor/advanced user present in lobby)');

    try {
      const response = await socialService.startVoting(sessionId, {
        exercises,
        alternative_pool: alternatives,
        timeout_seconds: 60,
      });

      if (response.status !== 'success') {
        console.error('[VOTING] Failed to start voting:', response);
      } else {
        console.log('[VOTING] Voting started successfully:', response.data);
      }
    } catch (error) {
      console.error('[VOTING] Error starting voting:', error);
    }
  };

  /**
   * Submit vote (accept or customize)
   */
  const handleVoteSubmit = async (vote: 'accept' | 'customize') => {
    if (!sessionId || !currentUser || isSubmittingVote) return;

    // Check if already voted
    if (hasUserVoted(parseInt(currentUser.id))) {
      console.log('[VOTING] User already voted');
      return;
    }

    setIsSubmittingVote(true);

    try {
      const response = await socialService.submitVote(sessionId, { vote });

      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to submit vote');
      }

      console.log('[VOTING] Vote submitted:', vote);
    } catch (error: any) {
      console.error('[VOTING] Error submitting vote:', error);
      // "No active voting found" means the backend already completed voting
      // (its 60s timer fired or all members voted) and we missed VotingComplete.
      // The safety valve will clean up the UI — showing an alert is confusing
      // and wrong since this is not a user error.
      const alreadyDone = error?.message?.includes('No active voting found');
      if (!alreadyDone) {
        alert.error('Error', 'Failed to submit vote. Please try again.');
      } else {
        console.warn('[VOTING] Vote submit: voting already completed on backend — safety valve will clean up');
      }
    } finally {
      setIsSubmittingVote(false);
    }
  };

  /**
   * Open swap modal for an exercise (customizer only)
   */
  const handleOpenSwapModal = (index: number, exercise: any) => {
    if (!isCustomizer) {
      alert.info('Customizer Only', 'Only the designated customizer can swap exercises.');
      return;
    }
    setSelectedExerciseForSwap({ index, exercise });
    setShowSwapModal(true);
  };

  /**
   * Handle exercise swap (initiator only)
   * This is called when the user confirms a swap in the ExerciseSwapModal
   *
   * Note: Sometimes HTTP response fails but WebSocket confirms success.
   * We track pending swaps and check WebSocket confirmation before showing errors.
   */
  const handleExerciseSwap = async (newExercise: any) => {
    if (!isCustomizer || !sessionId || !selectedExerciseForSwap || isSwappingExercise) return;

    setIsSwappingExercise(true);

    // Track this pending swap for WebSocket confirmation
    pendingSwapRef.current = {
      slotIndex: selectedExerciseForSwap.index,
      exerciseId: newExercise.exercise_id,
      confirmed: false,
    };

    try {
      const response = await socialService.swapExercise(sessionId, {
        slot_index: selectedExerciseForSwap.index,
        new_exercise: {
          exercise_id: newExercise.exercise_id,
          exercise_name: newExercise.exercise_name,
          difficulty_level: newExercise.difficulty_level,
          target_muscle_group: newExercise.target_muscle_group,
          default_duration_seconds: newExercise.default_duration_seconds,
          estimated_calories_burned: newExercise.estimated_calories_burned,
          equipment_needed: newExercise.equipment_needed,
          exercise_category: newExercise.exercise_category,
        },
      });

      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to swap exercise');
      }

      console.log('[CUSTOMIZATION] Exercise swapped successfully via HTTP');

      // Clear pending swap
      pendingSwapRef.current = null;

      // Close modal
      setShowSwapModal(false);
      setSelectedExerciseForSwap(null);

      // Show success feedback
      alert.success('Exercise Swapped', `Swapped to "${newExercise.exercise_name}"`);
    } catch (error) {
      // Don't log error yet - wait to check if WebSocket confirmed success

      // Wait briefly for WebSocket confirmation (in case HTTP failed but backend succeeded)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if WebSocket confirmed the swap despite HTTP error
      if (pendingSwapRef.current?.confirmed) {
        // WebSocket confirmed - this is actually a success, just log as info
        console.log('[CUSTOMIZATION] Swap succeeded (confirmed via WebSocket, HTTP response failed)');

        // Clear pending swap
        pendingSwapRef.current = null;

        // Close modal
        setShowSwapModal(false);
        setSelectedExerciseForSwap(null);

        // Show success feedback
        alert.success('Exercise Swapped', `Swapped to "${newExercise.exercise_name}"`);
      } else {
        // WebSocket also didn't confirm - NOW log as error since it truly failed
        console.error('[CUSTOMIZATION] Exercise swap failed (both HTTP and WebSocket):', error);
        pendingSwapRef.current = null;
        alert.error('Error', 'Failed to swap exercise. Please try again.');
      }
    } finally {
      setIsSwappingExercise(false);
    }
  };

  /**
   * Handle exercise reorder via drag-and-drop
   * Called when user finishes dragging an exercise to a new position.
   * Uses optimistic update: reorders locally first, then syncs with backend.
   */
  const handleExerciseReorder = async (fromIndex: number, toIndex: number) => {
    if (!isCustomizer || !sessionId || isSwappingExercise) return;

    // Save previous order for rollback on failure
    const previousOrder = [...exerciseDetails];

    // Optimistic local reorder
    const reordered = [...exerciseDetails];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setExerciseDetails(reordered);

    // Build new_order array: maps new positions to old indices
    // e.g., if we moved index 2 to index 0 in a 4-item list:
    // original: [A, B, C, D] (indices 0,1,2,3)
    // result:   [C, A, B, D] → new_order = [2, 0, 1, 3]
    const newOrder: number[] = reordered.map((exercise) => {
      return previousOrder.findIndex((prev) => prev.exercise_id === exercise.exercise_id);
    });

    try {
      const response = await socialService.reorderExercises(sessionId, newOrder);

      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to reorder exercises');
      }

      console.log('[CUSTOMIZATION] Exercises reordered successfully');
    } catch (error) {
      console.error('[CUSTOMIZATION] Reorder failed, reverting:', error);
      // Revert to previous order
      setExerciseDetails(previousOrder);
      alert.error('Error', 'Failed to reorder exercises. Please try again.');
    }
  };

  /**
   * Start workout (initiator only)
   */
  const handleStartWorkout = async () => {
    if (!canStartWorkout || isStarting) return;

    setIsStarting(true);

    try {
      const response = await socialService.startWorkoutV2(sessionId);

      if (response.status !== 'success') {
        throw new Error('Failed to start workout');
      }

      // WorkoutStarted event will trigger navigation
    } catch (error) {
      console.error('❌ Error starting workout:', error);
      alert.error('Error', 'Failed to start workout. Please try again.');
      setIsStarting(false);
    }
  };

  /**
   * Start a ready check (any member can start)
   * This sends a ready check modal to ALL lobby members
   * They have 25 seconds to accept or decline
   * If all accept, exercises are auto-generated (by initiator only to prevent duplicates)
   */
  const handleStartReadyCheck = async () => {
    console.log('🔔 [READY CHECK] handleStartReadyCheck called:', {
      userId: currentUser?.id,
      username: currentUser?.username,
      isInitiator,
      isStartingReadyCheck,
      isReadyCheckActive,
      canStartReadyCheck,
      lobbyMemberCount: lobbyMembers.length,
    });

    if (isStartingReadyCheck || isReadyCheckActive) {
      console.log('⚠️ [READY CHECK] Blocked: already starting or active');
      return;
    }

    // Need at least 2 members for a ready check
    if (lobbyMembers.length < 2) {
      alert.warning('Not Enough Members', 'You need at least 2 members to start a ready check.');
      return;
    }

    setIsStartingReadyCheck(true);

    try {
      console.log('🔔 [READY CHECK] Starting ready check for lobby:', sessionId);

      // Call backend to start ready check
      // This will broadcast ReadyCheckStarted event to all members
      await socialService.startReadyCheckV2(sessionId, 25);

      console.log('✅ [READY CHECK] Ready check started successfully');
    } catch (error: any) {
      console.error('❌ [READY CHECK] Failed to start ready check:', error);

      // If backend doesn't support ready check yet, simulate locally
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('⚠️ [READY CHECK] Backend not ready, simulating locally...');

        // Simulate ready check start locally
        if (currentUser) {
          startReadyCheck({
            sessionId: sessionId,
            groupId: groupId,
            groupName: currentLobby?.group_id ? `Group ${currentLobby.group_id}` : 'Workout Lobby',
            initiatorId: parseInt(currentUser.id),
            initiatorName: currentUser.username || 'Host',
            members: lobbyMembers.map((m) => ({
              user_id: m.user_id,
              user_name: m.user_name,
            })),
            timeoutSeconds: 25,
          });
        }
      } else {
        alert.error('Error', 'Failed to start ready check. Please try again.');
      }
    } finally {
      setIsStartingReadyCheck(false);
    }
  };

  /**
   * Comprehensive cleanup on unmount, leave, kick, or delete
   *
   * CRITICAL: Order matters to prevent race conditions:
   * 1. First unsubscribe from all channels (stop receiving events)
   * 2. Small delay to ensure unsubscribe completes
   * 3. Clear state stores (Zustand first, then LobbyContext)
   * 4. Refresh group subscriptions
   */
  const cleanup = async () => {
    // Guard against duplicate cleanup calls
    if (isCleaningUpRef.current) {
      console.log('🛡️ [CLEANUP] Already cleaning up, skipping duplicate call');
      return;
    }

    // CRITICAL: Set this flag FIRST to block any incoming WebSocket events
    isCleaningUpRef.current = true;
    console.log('🧹 [CLEANUP] Starting comprehensive cleanup...');

    try {
      // STEP 1: Unsubscribe from ALL channels FIRST (stop receiving events)
      console.log('🧹 [CLEANUP] Step 1: Unsubscribing from all channels...');

      if (channelRef.current) {
        reverbService.unsubscribe(`private-lobby.${sessionId}`);
        channelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from lobby channel');
      }

      if (presenceChannelRef.current) {
        reverbService.unsubscribe(`presence-lobby.${sessionId}`);
        presenceChannelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from presence channel');
      }

      if (groupPresenceChannelRef.current) {
        reverbService.unsubscribe(`presence-group.${groupId}`);
        groupPresenceChannelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from group presence channel');
      }

      if (userChannelRef.current && currentUser) {
        reverbService.unsubscribe(`private-user.${currentUser.id}`);
        userChannelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from user channel');
      }

      // STEP 2: Small delay to ensure unsubscribe messages are processed
      // This prevents any in-flight WebSocket events from updating state
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('🧹 [CLEANUP] Step 2: Unsubscribe delay complete');

      // STEP 3: Clear Zustand store FIRST (in-memory, fast)
      // Pass sessionId to mark this lobby as "just left" to prevent re-initialization
      clearLobby(sessionId);
      console.log('🧹 [CLEANUP] Step 3: Cleared Zustand lobby store, marked session as left:', sessionId);

      // STEP 4: Clear LobbyContext (includes AsyncStorage - slower)
      await clearActiveLobbyLocal();
      console.log('🧹 [CLEANUP] Step 4: Cleared LobbyContext and AsyncStorage');

      // STEP 5: Refresh group subscriptions to receive new invitations
      console.log('🧹 [CLEANUP] Step 5: Refreshing group subscriptions...');
      await refreshGroupSubscriptions();
      console.log('✅ [CLEANUP] Group subscriptions refreshed');

      // STEP 6: Reset initialization refs
      hasJoinedRef.current = false;
      hasInitializedRef.current = false;
      console.log('🧹 [CLEANUP] Step 6: Reset refs');

      console.log('✅ [CLEANUP] Cleanup complete');
    } catch (error) {
      console.error('❌ [CLEANUP] Cleanup failed:', error);
    }
    // NOTE: Do NOT reset isCleaningUpRef.current = false here
    // Once cleanup starts, this component instance should never accept more events
  };

  /**
   * Measure the workout section's exact screen position, then scale+slide the
   * fullscreen overlay from those exact bounds to cover the whole screen.
   * Works identically for every user — no pre-expansion phase.
   */
  const showFullscreenReveal = (retryCount = 0) => {
    // Guard: don't start if component is unmounting or already cleaning up
    if (!isMountedRef.current || isCleaningUpRef.current) return;

    // Guard: if voting is already active by the time we reach here (VotingStarted arrived
    // in the ~1s async gap between hasExercises becoming true and measure() completing),
    // skip the overlay entirely. The useEffect([isVotingActive]) can only dismiss an
    // overlay that's already visible — it cannot pre-empt this async path.
    if (useVotingStore.getState().isActive) {
      console.log('[REVEAL] Skipping overlay — VotingStarted already arrived');
      hasPlayedRevealRef.current = true;
      hasCalledRevealCompleteRef.current = true;
      return;
    }

    workoutSectionRef.current?.measure(
      (_x: number, _y: number, _w: number, h: number, _px: number, py: number) => {
        // Guard again inside async callback — component may have unmounted between the
        // measure() call and this callback firing (e.g. user navigated away quickly)
        if (!isMountedRef.current || isCleaningUpRef.current) return;

        // Re-check voting — VotingStarted can arrive in the async window between the
        // outer check and this measure() callback completing.
        if (useVotingStore.getState().isActive) {
          console.log('[REVEAL] Skipping overlay (inner) — VotingStarted arrived mid-measure');
          hasPlayedRevealRef.current = true;
          hasCalledRevealCompleteRef.current = true;
          return;
        }

        // Validate that the section has been fully laid out.
        // On slow devices the layout may not be complete yet, returning h=0.
        // Retry up to 3 times with a short delay to let layout settle.
        if (h < 100) {
          if (retryCount < 3) {
            setTimeout(() => showFullscreenReveal(retryCount + 1), 150);
          }
          return;
        }

        const screenHeight = Dimensions.get('window').height;
        // Translate so the overlay's center aligns with the section's center
        const initialTranslateY = (py + h / 2) - screenHeight / 2;
        // Scale so the overlay's height matches the section's height
        const initialScale = Math.max(h / screenHeight, 0.25);

        // Store so hideFullscreenReveal collapses back to the exact same bounds
        workoutSectionFrameRef.current = { translateY: initialTranslateY, scale: initialScale };
        // Reset double-fire guard for the new reveal cycle
        hasCalledRevealCompleteRef.current = false;

        fullscreenOpacity.setValue(0);
        fullscreenScale.setValue(initialScale);
        fullscreenTranslateY.setValue(initialTranslateY);
        setIsFullscreenRevealVisible(true);

        Animated.parallel([
          // Quick fade-in so user doesn't see the tiny scaled-down content
          Animated.timing(fullscreenOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(fullscreenScale, {
            toValue: 1,
            damping: 20,
            stiffness: 140,
            mass: 1,
            useNativeDriver: true,
          }),
          Animated.spring(fullscreenTranslateY, {
            toValue: 0,
            damping: 20,
            stiffness: 140,
            mass: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );
  };

  /**
   * Collapse the overlay back to the workout section's exact bounds, then call onDone.
   * Uses the values stored by showFullscreenReveal so entrance and exit are symmetric.
   */
  const hideFullscreenReveal = (onDone?: () => void) => {
    const { translateY: finalTranslateY, scale: finalScale } = workoutSectionFrameRef.current;

    Animated.parallel([
      Animated.timing(fullscreenOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fullscreenScale, {
        toValue: finalScale,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fullscreenTranslateY, {
        toValue: finalTranslateY,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsFullscreenRevealVisible(false);
      // Reset double-fire guard so a subsequent lobby session works correctly
      hasCalledRevealCompleteRef.current = false;
      onDone?.();
    });
  };

  // Show fullscreen reveal the first time exercises arrive — for ALL users.
  // For non-initiators isGenerating is always false, so this fires the moment
  // exercises land via WebSocket. For the initiator, setIsGenerating(false) is
  // called in the finally block of autoGenerateExercises, after exercises are saved.
  useEffect(() => {
    if (hasExercises && !isGenerating && !hasPlayedRevealRef.current) {
      if (!isMountedRef.current || isCleaningUpRef.current) return;
      // Don't trigger reveal until init is complete — stale Zustand data may
      // briefly show exercises that no longer exist on the server (e.g. returning
      // from minimize after members left and exercises were cleared server-side).
      if (!hasJoinedRef.current) return;
      hasPlayedRevealRef.current = true;
      showFullscreenReveal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExercises, isGenerating]);

  // Reset the ref whenever exercises are cleared so the reveal can play again
  // if the lobby is reused (defensive — exercises are normally only set once).
  // Also dismiss the overlay if it's stuck open with no exercises (e.g. user
  // returned from minimize and fresh server state cleared exercises).
  useEffect(() => {
    if (!hasExercises) {
      hasPlayedRevealRef.current = false;

      if (isFullscreenRevealVisible) {
        console.log('[REVEAL] Exercises cleared while overlay visible — dismissing');
        setIsFullscreenRevealVisible(false);
        hasCalledRevealCompleteRef.current = true;
        fullscreenOpacity.setValue(0);
        fullscreenScale.setValue(0.6);
        fullscreenTranslateY.setValue(200);
      }
    }
  }, [hasExercises]);

  /**
   * Called by the overlay's AnimatedExerciseReveal when all cards have revealed.
   * Collapses the overlay back to the workout section's bounds, then triggers voting
   * (initiator only — non-initiators have no pending voting data).
   */
  const handleRevealComplete = () => {
    if (isCleaningUpRef.current || !isMountedRef.current) return;
    // Guard against double-fire (e.g. safety timeout + normal chain both firing)
    if (hasCalledRevealCompleteRef.current) return;
    hasCalledRevealCompleteRef.current = true;

    hideFullscreenReveal(() => {
      if (!pendingVotingDataRef.current) return;
      if (isCleaningUpRef.current || !isMountedRef.current) return;

      const { exercises, alternatives } = pendingVotingDataRef.current;
      pendingVotingDataRef.current = null;

      console.log('🎬 [REVEAL] Animation complete — triggering voting now');
      triggerVoting(exercises, alternatives);
    });
  };

  // Show loading only if user is not available
  // Don't check currentLobby here as it's populated AFTER initializeLobby completes
  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show loading while lobby is being initialized
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
        <Text style={styles.loadingText}>Loading lobby...</Text>
      </View>
    );
  }

  // If no lobby state after loading is done, something went wrong
  if (!currentLobby) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No lobby found. Please try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleLeaveLobby} style={styles.leaveButton} disabled={isLeaving}>
            {isLeaving ? (
              <ActivityIndicator size="small" color={COLORS.ERROR[600]} />
            ) : (
              <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Workout Lobby</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Minimize Button - Explore app while staying in lobby */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleMinimizeLobby}
            disabled={isLeaving}
          >
            <Ionicons name="chevron-down" size={24} color={COLORS.PRIMARY[600]} />
          </TouchableOpacity>

          {/* Settings Button - Initiator Only */}
          {isInitiator && (
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsSettingsModalOpen(true)}>
              <Ionicons name="settings-outline" size={24} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          )}

          {/* Chat Button */}
          <TouchableOpacity
            onPress={() => {
              setIsChatOpen(true);
              setChatOpen(true);
            }}
            style={styles.iconButtonContainer}
          >
            <Ionicons name="chatbubble-outline" size={24} color={COLORS.PRIMARY[600]} />
            {unreadMessageCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Members Section */}
        <View style={styles.membersSection}>
          <View style={styles.membersSectionHeader}>
            <View style={styles.membersSectionLeft}>
              <Text style={styles.sectionTitle}>Members ({lobbyMembers.length})</Text>
              <Text style={styles.readyCountBadge}>
                {lobbyMembers.filter(m => m.status === 'ready').length}/{lobbyMembers.length} ready
              </Text>
            </View>
            <TouchableOpacity onPress={handleInviteMembers} style={styles.inviteIconButton}>
              <Ionicons name="person-add-outline" size={22} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.membersAvatarRow}
            contentContainerStyle={styles.membersAvatarRowContent}
          >
            {lobbyMembers.map((member) => {
              const isOnline = onlineUsers.has(member.user_id.toString());
              const isCurrentUser = member.user_id === parseInt(currentUser.id);
              const isLobbyInitiator = member.user_id === currentLobby?.initiator_id;
              const memberIsReady = member.status === 'ready';

              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.memberAvatarChip}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedLobbyMember(member);
                    setShowMemberPreview(true);
                  }}
                >
                  {/* Avatar ring — green border = ready, orange = waiting */}
                  <View style={[styles.memberAvatarRing, memberIsReady ? styles.memberAvatarRingReady : styles.memberAvatarRingWaiting]}>
                    <Avatar
                      profilePicture={member.profile_picture}
                      size="sm"
                      backgroundColor={COLORS.PRIMARY[100]}
                      iconColor={COLORS.PRIMARY[600]}
                    />
                    {isLobbyInitiator && (
                      <View style={styles.crownBadge}>
                        <Ionicons name="star" size={10} color={COLORS.WARNING[500]} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: isOnline ? COLORS.SUCCESS[500] : COLORS.SECONDARY[300] },
                      ]}
                    />
                  </View>
                  {/* Name below avatar */}
                  <Text style={styles.memberChipName} numberOfLines={1}>
                    {isCurrentUser ? 'You' : member.user_name}
                  </Text>
                  {/* Ready status label */}
                  <Text style={[styles.memberChipStatus, memberIsReady ? styles.memberChipStatusReady : styles.memberChipStatusWaiting]}>
                    {memberIsReady ? '✓ Ready' : 'Waiting'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Workout Exercises Section */}
        <View ref={workoutSectionRef} style={styles.workoutSection}>
          <View style={styles.workoutHeader}>
            <Text style={styles.sectionTitle}>
              Workout Plan
            </Text>
            {hasExercises && (
              <View style={styles.workoutBadge}>
                <Ionicons name="flash" size={14} color={COLORS.PRIMARY[600]} />
                <Text style={styles.workoutBadgeText}>Tabata</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.exercisesScrollView} showsVerticalScrollIndicator={false}>
            <AnimatedExerciseReveal
              exercises={currentLobby?.workout_data?.exercises || []}
              isGenerating={isGenerating}
              onRevealComplete={handleRevealComplete}
              skipAnimation={isFullscreenRevealVisible}
            />
          </ScrollView>


          {/* Voting Result Banner */}
          {votingResult && votingResult !== 'pending' && votingResult === 'accept_recommended' && (
            <View style={[styles.votingResultBanner, styles.votingResultAccept]}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.NEUTRAL.WHITE}
              />
              <Text style={styles.votingResultText}>
                Group accepted the recommended workout!
              </Text>
            </View>
          )}

          {/* Customization Mode - Shows when group voted to customize */}
          {votingResult === 'customize' && (
            <View style={styles.customizationPanel}>
              <View style={styles.customizationHeader}>
                <Ionicons name="options" size={20} color={COLORS.PRIMARY[600]} />
                <Text style={styles.customizationTitle}>Customize Workout</Text>
                {isCustomizer && (
                  <View style={styles.initiatorBadge}>
                    <Text style={styles.initiatorBadgeText}>You Control</Text>
                  </View>
                )}
              </View>

              {isCustomizer ? (
                <Text style={styles.customizationDescription}>
                  Drag exercises to reorder, or tap Swap to replace with an alternative.
                </Text>
              ) : (
                <Text style={styles.customizationDescription}>
                  {customizerName ? `${customizerName} is customizing` : 'The customizer is customizing'} the workout. Changes will appear here in real-time.
                </Text>
              )}

              {/* Exercise List - Draggable for customizer, static for others */}
              {isCustomizer && exerciseDetails.length > 1 ? (
                <View style={styles.customizationExerciseList}>
                  <DragList
                    data={exerciseDetails}
                    keyExtractor={(item: Exercise) => String(item.exercise_id)}
                    onReordered={handleExerciseReorder}
                    renderItem={(info: DragListRenderItemInfo<Exercise>) => {
                      const { item, onDragStart, onDragEnd, isActive } = info;
                      const index = exerciseDetails.findIndex((e) => e.exercise_id === item.exercise_id);
                      return (
                        <View
                          style={[
                            styles.customizationExerciseCard,
                            isActive && styles.customizationExerciseCardDragging,
                          ]}
                        >
                          {/* Drag Handle */}
                          <TouchableOpacity
                            onPressIn={onDragStart}
                            onPressOut={onDragEnd}
                            style={styles.dragHandle}
                            disabled={isSwappingExercise}
                          >
                            <Ionicons name="reorder-three" size={20} color={COLORS.SECONDARY[400]} />
                          </TouchableOpacity>

                          <View style={styles.customizationExerciseInfo}>
                            <Text style={styles.customizationExerciseIndex}>{index + 1}</Text>
                            <View style={styles.customizationExerciseDetails}>
                              <Text style={styles.customizationExerciseName}>{item.exercise_name}</Text>
                              <View style={styles.customizationExerciseTags}>
                                <View style={styles.customizationTag}>
                                  <Ionicons name="body-outline" size={12} color={COLORS.SECONDARY[600]} />
                                  <Text style={styles.customizationTagText}>
                                    {(item.target_muscle_group || 'core').replace(/_/g, ' ')}
                                  </Text>
                                </View>
                                {(item as any).estimated_calories_burned && (
                                  <View style={styles.customizationTag}>
                                    <Ionicons name="flame-outline" size={12} color="#F59E0B" />
                                    <Text style={styles.customizationTagText}>{(item as any).estimated_calories_burned} cal</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>

                          {/* Swap Button */}
                          <TouchableOpacity
                            style={styles.swapButton}
                            onPress={() => handleOpenSwapModal(index, item)}
                            disabled={isSwappingExercise}
                          >
                            {isSwappingExercise && selectedExerciseForSwap?.index === index ? (
                              <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
                            ) : (
                              <>
                                <Ionicons name="swap-horizontal" size={16} color={COLORS.PRIMARY[600]} />
                                <Text style={styles.swapButtonText}>Swap</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                  />
                </View>
              ) : (
                <ScrollView style={styles.customizationExerciseList} showsVerticalScrollIndicator={false}>
                  {exerciseDetails.map((exercise, index) => (
                    <View key={exercise.exercise_id || index} style={styles.customizationExerciseCard}>
                      <View style={styles.customizationExerciseInfo}>
                        <Text style={styles.customizationExerciseIndex}>{index + 1}</Text>
                        <View style={styles.customizationExerciseDetails}>
                          <Text style={styles.customizationExerciseName}>{exercise.exercise_name}</Text>
                          <View style={styles.customizationExerciseTags}>
                            <View style={styles.customizationTag}>
                              <Ionicons name="body-outline" size={12} color={COLORS.SECONDARY[600]} />
                              <Text style={styles.customizationTagText}>
                                {(exercise.target_muscle_group || 'core').replace(/_/g, ' ')}
                              </Text>
                            </View>
                            {(exercise as any).estimated_calories_burned && (
                              <View style={styles.customizationTag}>
                                <Ionicons name="flame-outline" size={12} color="#F59E0B" />
                                <Text style={styles.customizationTagText}>{(exercise as any).estimated_calories_burned} cal</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Swap Button - Only for customizer with 1 or fewer exercises */}
                      {isCustomizer && (
                        <TouchableOpacity
                          style={styles.swapButton}
                          onPress={() => handleOpenSwapModal(index, exercise)}
                          disabled={isSwappingExercise}
                        >
                          {isSwappingExercise && selectedExerciseForSwap?.index === index ? (
                            <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
                          ) : (
                            <>
                              <Ionicons name="swap-horizontal" size={16} color={COLORS.PRIMARY[600]} />
                              <Text style={styles.swapButtonText}>Swap</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Alternatives Pool Info */}
              {votingAlternatives && votingAlternatives.length > 0 && (
                <View style={styles.alternativesInfo}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.SECONDARY[600]} />
                  <Text style={styles.alternativesInfoText}>
                    {votingAlternatives.length} alternative exercises available
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* WebSocket connection warning */}
      {!isConnected && (
        <View style={styles.connectionWarning}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.connectionWarningText}>
            {connectionState === 'reconnecting' ? 'Reconnecting to lobby...' : 'Connection lost — some actions may not work'}
          </Text>
        </View>
      )}

      {/* Footer Actions */}
      <View style={styles.footer}>
        {/* Ready Button - Everyone including creator */}
        <TouchableOpacity
          style={[styles.readyButton, isReady && styles.readyButtonActive]}
          onPress={handleToggleReady}
          disabled={isTogglingReady}
        >
          <Ionicons
            name={isReady ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={24}
            color={isReady ? COLORS.NEUTRAL.WHITE : COLORS.SUCCESS[600]}
          />
          <Text style={[styles.readyButtonText, isReady && styles.readyButtonTextActive]}>
            {isReady ? 'Ready!' : 'Mark Ready'}
          </Text>
        </TouchableOpacity>

        {/* Ready Check Button - Any member can start, before exercises are generated */}
        {!hasExercises && (
          <TouchableOpacity
            style={[styles.readyCheckButton, !canStartReadyCheck && styles.readyCheckButtonDisabled]}
            onPress={handleStartReadyCheck}
            disabled={!canStartReadyCheck || isStartingReadyCheck || isReadyCheckActive}
          >
            {isStartingReadyCheck ? (
              <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
            ) : isReadyCheckActive ? (
              <>
                <Ionicons name="time" size={24} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.readyCheckButtonText}>Ready Check Active</Text>
              </>
            ) : (
              <>
                <Ionicons name="notifications" size={24} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.readyCheckButtonText}>Ready Check</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Start Button - Initiator only, when all ready AND exercises exist */}
        {isInitiator && hasExercises && (
          <TouchableOpacity
            style={[styles.startButton, !canStartWorkout && styles.startButtonDisabled]}
            onPress={handleStartWorkout}
            disabled={!canStartWorkout || isStarting}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.startButtonText}>Start Workout</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>


      {/* Chat Modal */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setIsChatOpen(false);
          setChatOpen(false); // Update store to mark chat as closed
        }}
      >
        <SafeAreaView style={styles.chatModalContainer} edges={['top']}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={styles.chatModalHeaderSafe}>
            <View style={styles.chatModalHeader}>
              <Text style={styles.chatModalTitle}>Chat</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsChatOpen(false);
                  setChatOpen(false); // Update store to mark chat as closed
                }}
                style={styles.chatModalClose}
              >
                <Ionicons name="close" size={28} color={COLORS.SECONDARY[900]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat content */}
          <LobbyChat sessionId={sessionId} currentUserId={parseInt(currentUser.id)} />
        </SafeAreaView>
      </Modal>

      {/* Invite Members Modal */}
      <Modal
        visible={isInviteModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setIsInviteModalOpen(false);
          setSelectedMembers(new Set());
        }}
      >
        <SafeAreaView style={styles.inviteModalContainer} edges={['top', 'bottom']}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={styles.inviteModalHeaderSafe}>
            <View style={styles.inviteModalHeader}>
              <View style={styles.inviteModalHeaderLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setIsInviteModalOpen(false);
                    setSelectedMembers(new Set());
                  }}
                  style={styles.inviteModalBackButton}
                >
                  <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.inviteModalTitle}>Invite Members</Text>
                  <Text style={styles.inviteModalSubtitle}>
                    {selectedMembers.size} selected
                  </Text>
                </View>
              </View>
              {!isLoadingMembers && groupMembers.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedMembers.size === groupMembers.length) {
                      setSelectedMembers(new Set());
                    } else {
                      setSelectedMembers(new Set(groupMembers.map((m: any) => parseInt(m.userId))));
                    }
                  }}
                  style={styles.selectAllButton}
                >
                  <Text style={styles.selectAllText}>
                    {selectedMembers.size === groupMembers.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={styles.inviteModalContent}>
            {isLoadingMembers ? (
              <View style={styles.inviteLoadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
                <Text style={styles.inviteLoadingText}>Loading members...</Text>
              </View>
            ) : groupMembers.length === 0 ? (
              <View style={styles.inviteEmptyContainer}>
                <Ionicons name="people-outline" size={64} color={COLORS.SECONDARY[300]} />
                <Text style={styles.inviteEmptyText}>All group members are already in the lobby!</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.inviteMembersList}
                contentContainerStyle={styles.inviteMembersListContent}
                showsVerticalScrollIndicator={false}
              >
                {groupMembers.map((member: any) => {
                  const userId = parseInt(member.userId);
                  const isSelected = selectedMembers.has(userId);
                  // Use global online users instead of group-specific presence
                  const isMemberOnline = onlineUsers.has(member.userId.toString());

                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.inviteMemberCard,
                        isSelected && styles.inviteMemberCardSelected,
                      ]}
                      onPress={() => toggleMemberSelection(userId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.inviteMemberLeft}>
                        <View style={styles.inviteMemberAvatarContainer}>
                          <Avatar profilePicture={member.profilePicture} size="sm" backgroundColor={COLORS.PRIMARY[100]} iconColor={COLORS.PRIMARY[600]} />
                          <View
                            style={[
                              styles.inviteOnlineDot,
                              { backgroundColor: isMemberOnline ? COLORS.SUCCESS[500] : COLORS.SECONDARY[300] },
                            ]}
                          />
                        </View>
                        <View style={styles.inviteMemberInfo}>
                          <Text style={styles.inviteMemberName}>{member.username}</Text>
                          {/* Fitness Level */}
                          {member.fitnessLevel && (
                            <Text style={styles.inviteFitnessLevel}>
                              {member.fitnessLevel.charAt(0).toUpperCase() + member.fitnessLevel.slice(1)}
                            </Text>
                          )}
                          <Text style={styles.inviteMemberStatus}>
                            {isMemberOnline ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.inviteCheckbox,
                          isSelected && styles.inviteCheckboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={COLORS.NEUTRAL.WHITE} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Footer */}
          {!isLoadingMembers && groupMembers.length > 0 && (
            <View style={styles.inviteModalFooterSafe}>
              <View style={styles.inviteFooter}>
                <TouchableOpacity
                  style={[
                    styles.inviteButton,
                    selectedMembers.size === 0 && styles.inviteButtonDisabled,
                  ]}
                  onPress={handleSendInvitations}
                  disabled={selectedMembers.size === 0 || isInviting}
                  activeOpacity={0.8}
                >
                  {isInviting ? (
                    <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color={COLORS.NEUTRAL.WHITE} />
                      <Text style={styles.inviteButtonText}>
                        Send Invites{selectedMembers.size > 0 ? ` (${selectedMembers.size})` : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Settings Modal - Initiator Only */}
      <Modal
        visible={isSettingsModalOpen}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => setIsSettingsModalOpen(false)}
      >
        <SafeAreaView style={styles.chatModalContainer} edges={['top']}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={styles.chatModalHeaderSafe}>
            <View style={styles.chatModalHeader}>
              <Text style={styles.chatModalTitle}>Lobby Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
                <Ionicons name="close" size={28} color={COLORS.SECONDARY[900]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings Content */}
          <ScrollView style={styles.settingsContent}>
            <Text style={styles.settingsSectionTitle}>Member Management</Text>

            {lobbyMembers
              .filter(member => member.user_id !== parseInt(currentUser.id))
              .map((member) => {
                const isLobbyInitiator = member.user_id === currentLobby?.initiator_id;

                return (
                  <View key={member.user_id} style={styles.settingsMemberCard}>
                    <View style={styles.settingsMemberInfo}>
                      <View style={styles.memberAvatar}>
                        <Avatar profilePicture={member.profile_picture} size="sm" backgroundColor={COLORS.PRIMARY[100]} iconColor={COLORS.PRIMARY[600]} />
                        {isLobbyInitiator && (
                          <View style={styles.crownBadge}>
                            <Ionicons name="star" size={14} color={COLORS.WARNING[500]} />
                          </View>
                        )}
                      </View>
                      <View>
                        <Text style={styles.settingsMemberName}>{member.user_name}</Text>
                        {member.fitness_level && (
                          <Text style={styles.settingsMemberLevel}>
                            {member.fitness_level.charAt(0).toUpperCase() + member.fitness_level.slice(1)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.settingsMemberActions}>
                      {/* Transfer Role Button */}
                      {!isLobbyInitiator && (
                        <TouchableOpacity
                          style={styles.settingsIconButton}
                          onPress={() => {
                            setIsSettingsModalOpen(false);
                            handleTransferRole(member.user_id, member.user_name);
                          }}
                        >
                          <Ionicons name="swap-horizontal" size={24} color={COLORS.PRIMARY[600]} />
                        </TouchableOpacity>
                      )}

                      {/* Remove Button */}
                      <TouchableOpacity
                        style={styles.settingsIconButton}
                        onPress={() => {
                          setIsSettingsModalOpen(false);
                          handleKickMember(member.user_id, member.user_name);
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color={COLORS.ERROR[600]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

            {lobbyMembers.length === 1 && (
              <View style={styles.settingsEmptyState}>
                <Ionicons name="people-outline" size={48} color={COLORS.SECONDARY[400]} />
                <Text style={styles.settingsEmptyText}>No other members in lobby</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Member Profile Preview Modal */}
      <UserProfilePreviewModal
        visible={showMemberPreview}
        onClose={() => {
          setShowMemberPreview(false);
          setSelectedLobbyMember(null);
        }}
        user={selectedLobbyMember ? {
          userId: selectedLobbyMember.user_id,
          username: selectedLobbyMember.user_name,
          userRole: selectedLobbyMember.user_role,
          groupRole: selectedLobbyMember.user_id === currentLobby?.initiator_id ? 'owner' : 'member',
          fitnessLevel: selectedLobbyMember.fitness_level,
          isOnline: onlineUsers.has(selectedLobbyMember.user_id.toString()),
          isReady: selectedLobbyMember.status === 'ready',
          profilePicture: selectedLobbyMember.profile_picture,
        } : null}
        context="lobby"
      />

      {/* Exercise Swap Modal - For group customization */}
      <ExerciseSwapModal
        visible={showSwapModal}
        currentExercise={selectedExerciseForSwap?.exercise || null}
        alternatives={votingAlternatives || alternativePool || []}
        onSwap={handleExerciseSwap}
        onClose={() => {
          setShowSwapModal(false);
          setSelectedExerciseForSwap(null);
        }}
      />

      {/* Group Vote Bottom Sheet - animated backdrop + spring slide-up (matches WorkoutSetModal) */}
      <Modal
        visible={voteSheetVisible}
        transparent
        animationType="none"
        onRequestClose={() => {}}
        statusBarTranslucent
      >
        <View style={styles.voteSheetOverlay}>
          {/* Animated backdrop */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.voteSheetBackdrop, { opacity: votingBackdropOpacity }]}
          />
          {/* Animated sheet - springs up from bottom */}
          <Animated.View style={[styles.voteSheet, { transform: [{ translateY: votingSlideAnim }] }]}>
            {/* Handle bar */}
            <View style={styles.voteSheetHandle} />

            {/* Header */}
            <View style={styles.voteSheetHeader}>
              <View style={styles.voteSheetHeaderLeft}>
                <Ionicons name="people" size={22} color={COLORS.PRIMARY[600]} />
                <Text style={styles.voteSheetTitle}>Group Vote</Text>
              </View>
              <View style={[styles.voteSheetTimer, votingTimeRemaining <= 10 && styles.voteSheetTimerUrgent]}>
                <Ionicons name="time-outline" size={16} color={votingTimeRemaining <= 10 ? COLORS.ERROR[500] : COLORS.SECONDARY[600]} />
                <Text style={[styles.voteSheetTimerText, votingTimeRemaining <= 10 && styles.votingTimerTextUrgent]}>
                  {votingTimeRemaining}s
                </Text>
              </View>
            </View>

            <Text style={styles.voteSheetSubtitle}>
              Accept the recommended workout or vote to customize?
            </Text>

            {/* Vote counts */}
            <View style={styles.voteCountsContainer}>
              <View style={styles.voteCount}>
                <Text style={styles.voteCountNumber}>{getVoteCounts().accept}</Text>
                <Text style={styles.voteCountLabel}>Accept</Text>
              </View>
              <View style={styles.voteCountDivider} />
              <View style={styles.voteCount}>
                <Text style={styles.voteCountNumber}>{getVoteCounts().customize}</Text>
                <Text style={styles.voteCountLabel}>Customize</Text>
              </View>
              <View style={styles.voteCountDivider} />
              <View style={styles.voteCount}>
                <Text style={styles.voteCountNumber}>{getVoteCounts().pending}</Text>
                <Text style={styles.voteCountLabel}>Pending</Text>
              </View>
            </View>

            {/* Buttons or voted state */}
            {currentUser && !hasUserVoted(parseInt(currentUser.id)) ? (
              <View style={styles.voteButtonsContainer}>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteButtonAccept]}
                  onPress={() => handleVoteSubmit('accept')}
                  disabled={isSubmittingVote}
                >
                  {isSubmittingVote ? (
                    <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.NEUTRAL.WHITE} />
                      <Text style={styles.voteButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteButtonCustomize]}
                  onPress={() => handleVoteSubmit('customize')}
                  disabled={isSubmittingVote}
                >
                  {isSubmittingVote ? (
                    <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
                  ) : (
                    <>
                      <Ionicons name="options" size={20} color={COLORS.NEUTRAL.WHITE} />
                      <Text style={styles.voteButtonText}>Customize</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.votedIndicator}>
                <Ionicons name="checkmark-done" size={20} color={COLORS.SUCCESS[600]} />
                <Text style={styles.votedText}>
                  You voted: {currentUser ? memberVotes[parseInt(currentUser.id)]?.vote || 'pending' : 'pending'}
                </Text>
              </View>
            )}

            {!canUserCustomize && (
              <Text style={styles.votingInfoText}>
                If "Customize" wins, mentors/advanced users will modify the workout.
              </Text>
            )}
          </Animated.View>
        </View>
      </Modal>

    </SafeAreaView>

      {/* ── Fullscreen Exercise Reveal Overlay ─────────────────────────────────
          Fires for ALL lobby members (not just initiator) when exercises arrive.
          Starts at the workout-section's position and scales/slides to fullscreen,
          plays the skeleton → card reveal, then collapses back to the section.   */}
      {isFullscreenRevealVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.fullscreenRevealOverlay,
            {
              opacity: fullscreenOpacity,
              transform: [
                { scale: fullscreenScale },
                { translateY: fullscreenTranslateY },
              ],
            },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={styles.fullscreenRevealHeader}>
              <Ionicons name="sparkles" size={22} color={COLORS.PRIMARY[500]} />
              <Text style={styles.fullscreenRevealTitle}>Workout Plan Ready</Text>
            </View>
            <ScrollView
              style={styles.fullscreenRevealScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.fullscreenRevealScrollContent}
            >
              <AnimatedExerciseReveal
                exercises={currentLobby?.workout_data?.exercises || []}
                isGenerating={false}
                onRevealComplete={handleRevealComplete}
              />
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  loadingText: {
    marginTop: 16,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  leaveButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  iconButtonContainer: {
    position: 'relative',
    padding: 8,
  },
  badgeContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.ERROR[600],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 1,
  },
  badgeText: {
    color: COLORS.NEUTRAL.WHITE,
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    lineHeight: 14,
  },
  content: {
    flex: 1,
  },
  membersSection: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  inviteIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readyCountBadge: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[600],
    backgroundColor: COLORS.SUCCESS[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  membersAvatarRow: {
    // horizontal scroll handles overflow
  },
  membersAvatarRowContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 14,
  },
  memberAvatarChip: {
    alignItems: 'center',
    gap: 4,
    width: 62,
  },
  memberAvatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: COLORS.PRIMARY[50],
  },
  memberAvatarRingReady: {
    borderColor: COLORS.SUCCESS[500],
  },
  memberAvatarRingWaiting: {
    borderColor: COLORS.WARNING[300],
  },
  memberChipName: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[800],
    textAlign: 'center',
    maxWidth: 62,
  },
  memberChipStatus: {
    fontSize: 9,
    fontFamily: FONTS.SEMIBOLD,
    textAlign: 'center',
  },
  memberChipStatusReady: {
    color: COLORS.SUCCESS[600],
  },
  memberChipStatusWaiting: {
    color: COLORS.WARNING[600],
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crownBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.WARNING[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[50],
    gap: 4,
  },
  transferButtonText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  kickButton: {
    padding: 4,
  },

  // ── Fullscreen exercise reveal overlay ─────────────────────────────────────
  fullscreenRevealOverlay: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    zIndex: 100,
  },
  fullscreenRevealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  fullscreenRevealTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  fullscreenRevealScroll: {
    flex: 1,
  },
  fullscreenRevealScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  workoutSection: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  workoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY[50],
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  workoutBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exercisesScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  workoutInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  infoBannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBannerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  infoBannerDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.SECONDARY[300],
  },
  exerciseCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  exerciseHeaderRight: {
    flex: 1,
    gap: 6,
  },
  exerciseName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    lineHeight: 20,
  },
  difficultyStars: {
    flexDirection: 'row',
    gap: 3,
  },
  exerciseCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  exerciseDetailsLine: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
  },
  exerciseDetailDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.SECONDARY[300],
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  generatingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  emptyWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyWorkoutText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  emptyWorkoutSubtext: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  workoutInfo: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  workoutInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutInfoLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  workoutInfoValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    marginTop: 16,
    gap: 8,
  },
  generateButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  chatModalHeaderSafe: {
    backgroundColor: COLORS.SECONDARY[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
    paddingTop: 16,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chatModalTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  chatModalClose: {
    padding: 4,
  },
  inviteModalContainer: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  inviteModalHeaderSafe: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
    paddingTop: 16,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inviteModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  selectAllText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  inviteModalBackButton: {
    padding: 4,
  },
  inviteModalTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  inviteModalSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  inviteModalContent: {
    flex: 1,
  },
  inviteLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  inviteLoadingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  inviteEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  inviteEmptyText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  inviteMembersList: {
    flex: 1,
  },
  inviteMembersListContent: {
    padding: 16,
  },
  inviteSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginBottom: 16,
  },
  inviteMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  inviteMemberCardSelected: {
    borderColor: COLORS.PRIMARY[600],
    backgroundColor: COLORS.PRIMARY[50],
    shadowColor: COLORS.PRIMARY[600],
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  inviteMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
    marginRight: 12,
  },
  inviteMemberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inviteOnlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  inviteMemberAvatarContainer: {
    position: 'relative',
  },
  inviteMemberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  inviteMemberName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  inviteFitnessLevel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 2,
  },
  inviteMemberStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inviteMemberStatus: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
    letterSpacing: 0.3,
  },
  inviteCheckbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: COLORS.SECONDARY[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  inviteCheckboxSelected: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[600],
  },
  inviteModalFooterSafe: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  inviteFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    gap: 8,
  },
  inviteButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
    opacity: 0.6,
  },
  inviteButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  connectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F59E0B',
  },
  connectionWarningText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
    flexDirection: 'row',
    gap: 12,
  },
  readyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SUCCESS[50],
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[200],
    gap: 8,
  },
  readyButtonActive: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  readyButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SUCCESS[600],
  },
  readyButtonTextActive: {
    color: COLORS.NEUTRAL.WHITE,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  // Ready Check Button Styles
  readyCheckButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.WARNING[500],
    gap: 8,
  },
  readyCheckButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
    opacity: 0.6,
  },
  readyCheckButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  // Settings Modal Styles
  settingsContent: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  settingsSectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  settingsMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsMemberName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  settingsMemberLevel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  settingsMemberActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SECONDARY[100],
  },
  settingsEmptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  settingsEmptyText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  // Voting Panel Styles
  votingPanel: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  votingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  votingTitle: {
    flex: 1,
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  votingTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  votingTimerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  votingTimerTextUrgent: {
    color: COLORS.ERROR[500],
  },
  votingDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 12,
  },
  voteCountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  voteCount: {
    flex: 1,
    alignItems: 'center',
  },
  voteCountNumber: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  voteCountLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  voteCountDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.SECONDARY[200],
  },
  voteButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  voteButtonAccept: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  voteButtonCustomize: {
    backgroundColor: COLORS.WARNING[600],
  },
  voteButtonFull: {
    flex: 1,
  },
  voteButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  votingInfoText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  votedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.SUCCESS[50],
    borderRadius: 12,
  },
  votedText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SUCCESS[700],
    textTransform: 'capitalize',
  },
  // ── Group Vote Bottom Sheet ───────────────────────────────────────────────
  voteSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  voteSheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  voteSheet: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  voteSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.SECONDARY[300],
    alignSelf: 'center',
    marginBottom: 16,
  },
  voteSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  voteSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteSheetTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  voteSheetTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.SECONDARY[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  voteSheetTimerUrgent: {
    backgroundColor: COLORS.ERROR[50],
  },
  voteSheetTimerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  voteSheetSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 16,
  },
  // ─────────────────────────────────────────────────────────────────────────

  votingResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  votingResultAccept: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  votingResultCustomize: {
    backgroundColor: COLORS.WARNING[600],
  },
  votingResultText: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  // ============================================
  // CUSTOMIZATION PANEL STYLES
  // ============================================
  customizationPanel: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  customizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  customizationTitle: {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[700],
  },
  initiatorBadge: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  initiatorBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  customizationDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 12,
    lineHeight: 20,
  },
  customizationExerciseList: {
    maxHeight: 280,
  },
  customizationExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  customizationExerciseCardDragging: {
    backgroundColor: COLORS.PRIMARY[50],
    borderColor: COLORS.PRIMARY[300],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dragHandle: {
    padding: 8,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customizationExerciseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customizationExerciseIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY[100],
    textAlign: 'center',
    lineHeight: 28,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[700],
    marginRight: 12,
  },
  customizationExerciseDetails: {
    flex: 1,
  },
  customizationExerciseName: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  customizationExerciseTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  customizationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.SECONDARY[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  customizationTagText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textTransform: 'capitalize',
  },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[300],
  },
  swapButtonText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  alternativesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.PRIMARY[200],
  },
  alternativesInfoText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
});
