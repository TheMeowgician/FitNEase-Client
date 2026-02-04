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
import { useConnectionStore, selectIsConnected, selectConnectionState } from '../../stores/connectionStore';
import { useAuth } from '../../contexts/AuthContext';
import { useLobby } from '../../contexts/LobbyContext';
import { useReverb } from '../../contexts/ReverbProvider';
import { reverbService } from '../../services/reverbService';
import { socialService } from '../../services/microservices/socialService';
import { contentService, Exercise } from '../../services/microservices/contentService';
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
  const isConnected = useConnectionStore(selectIsConnected);
  const connectionState = useConnectionStore(selectConnectionState);

  // Global online users from Reverb context
  const { onlineUsers, refreshGroupSubscriptions } = useReverb();
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

  // Check if current user can customize (mentor or advanced fitness level)
  const currentUserMember = lobbyMembers.find(m => m.user_id === parseInt(currentUser?.id || '0'));
  const canUserCustomize = currentUserMember?.user_role === 'mentor' ||
                           currentUserMember?.fitness_level === 'advanced';

  // Check if ANY member in lobby can customize (for showing customize vote counts)
  const hasCustomizableMembers = lobbyMembers.some(
    m => m.user_role === 'mentor' || m.fitness_level === 'advanced'
  );

  const hasJoinedRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const isLobbyDeletedRef = useRef(false); // Track if LobbyDeleted event was received (blocks further actions)
  const isMinimizedRef = useRef(false); // Track if user minimized (to explore app while staying in lobby)
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
   * Watch for ready check completion
   * When all members accept the ready check, auto-generate exercises
   */
  useEffect(() => {
    // Only proceed if ready check succeeded and we're the initiator
    if (readyCheckResult === 'success' && isInitiator && !hasExercises && !isGenerating) {
      console.log('🎯 [READY CHECK] All members ready! Auto-generating exercises...');
      autoGenerateExercises(lobbyMembers.length);
    }
  }, [readyCheckResult, isInitiator, hasExercises, isGenerating, lobbyMembers.length]);

  /**
   * Voting countdown timer
   * Updates every second while voting is active
   */
  useEffect(() => {
    if (!isVotingActive || !votingExpiresAt) {
      setVotingTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((votingExpiresAt - now) / 1000));
      setVotingTimeRemaining(remaining);

      // Auto-complete voting on timeout (initiator only)
      if (remaining === 0 && isInitiator) {
        console.log('[VOTING] Timeout reached, forcing completion');
        socialService.forceCompleteVoting(sessionId).catch(console.error);
      }
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isVotingActive, votingExpiresAt, isInitiator, sessionId]);

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

  /**
   * Auto-generate exercises when ALL members are ready (minimum 2 users)
   */
  useEffect(() => {
    // Guard against updates during cleanup
    if (isCleaningUpRef.current || !isMountedRef.current) return;

    // Skip if lobby not loaded yet
    if (!currentLobby) {
      return;
    }

    const totalMembers = lobbyMembers.length;

    // Trigger auto-generation when:
    // 1. At least 2 members in lobby
    // 2. ALL members are ready
    // 3. User is initiator
    // 4. No exercises generated yet
    if (totalMembers >= 2 && allMembersReady && isInitiator && !hasExercises && !isGenerating) {
      console.log('🎯 [AUTO-GEN] All', totalMembers, 'members ready - triggering auto-generation');
      autoGenerateExercises(totalMembers);
    }
  }, [currentLobby, lobbyMembers, allMembersReady, isInitiator, hasExercises, isGenerating]);

  /**
   * Clear exercises when member count drops below 2
   * This prevents showing stale exercises when a user leaves
   */
  useEffect(() => {
    // Guard against updates during cleanup
    if (isCleaningUpRef.current) return;

    const memberCount = lobbyMembers.length;

    // If we have exercises but less than 2 members, clear them
    if (hasExercises && memberCount < 2) {
      console.log('🧹 [LOBBY] Member count dropped below 2, clearing exercises');
      setExerciseDetails([]);

      // Also clear from lobby state if user is initiator
      if (isInitiator && currentLobby?.session_id && !isCleaningUpRef.current) {
        console.log('🧹 [LOBBY] Clearing exercises from backend (initiator)');
        socialService.updateWorkoutDataV2(currentLobby.session_id, {
          workout_format: 'tabata',
          exercises: []
        }).catch(err => {
          // Only log error if not cleaning up (expected to fail during cleanup)
          if (!isCleaningUpRef.current) {
            console.error('❌ Failed to clear exercises from backend:', err);
          }
        });
      }
    }
  }, [lobbyMembers.length, hasExercises, isInitiator, currentLobby?.session_id]);

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
        const details = await Promise.all(detailsPromises);

        // Filter out null results (failed fetches)
        const validDetails = details.filter((d): d is Exercise => d !== null);
        setExerciseDetails(validDetails);

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
        // CRITICAL: Guard against updates during cleanup to prevent stale state
        if (isCleaningUpRef.current || !isMountedRef.current) {
          console.log('⚠️ [REAL-TIME] Ignoring LobbyStateChanged during cleanup');
          return;
        }
        console.log('📊 [REAL-TIME] Lobby state changed:', data);
        // CRITICAL: This is the single source of truth for lobby state
        // Backend broadcasts this event for ALL changes (join, leave, status, kick, transfer, etc.)
        if (data?.lobby_state) {
          setLobbyState(data.lobby_state);
        }
      },
      // NOTE: Individual events like MemberJoined, MemberLeft, MemberStatusUpdated are kept
      // for system chat messages only. State updates come from LobbyStateChanged above.
      onMemberJoined: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('👤 [REAL-TIME] Member joined:', data);
        // Add system chat message (don't update state - LobbyStateChanged handles it)
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
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) {
          console.log('⚠️ [REAL-TIME] Ignoring WorkoutStarted during cleanup');
          return;
        }
        console.log('🏋️ Workout started!', data);

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
        });
      },
      onReadyCheckResponse: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('📝 [REAL-TIME] Ready check response:', data);

        // Update response in store
        const updateResponse = useReadyCheckStore.getState().updateResponse;
        updateResponse(data.user_id, data.response);

        // If user accepted, update their member status in lobby to 'ready'
        if (data.response === 'accepted') {
          updateMemberStatus(data.user_id, 'ready');
          // If it's the current user, also update local ready state
          if (currentUser && data.user_id === parseInt(currentUser.id)) {
            setIsReady(true);
          }
        }
      },
      onReadyCheckComplete: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('🏁 [REAL-TIME] Ready check complete:', data);

        // Set result in store - this triggers exercise generation if success
        setReadyCheckResult(data.success ? 'success' : 'failed');

        // If ready check succeeded, set all members to ready and update local state
        if (data.success) {
          // Update all members' status to 'ready'
          lobbyMembers.forEach(member => {
            updateMemberStatus(member.user_id, 'ready');
          });
          // Set local ready state
          setIsReady(true);
        }
      },
      onReadyCheckCancelled: (data: any) => {
        // Guard against updates during cleanup
        if (isCleaningUpRef.current || !isMountedRef.current) return;
        console.log('❌ [REAL-TIME] Ready check cancelled:', data);

        // Clear ready check in store
        clearReadyCheck();
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

        // Complete voting in store
        completeVoting({
          result: data.result,
          reason: data.reason,
          finalVotes: data.final_votes,
          acceptCount: data.accept_count,
          customizeCount: data.customize_count,
          finalExercises: data.final_exercises,
        });
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
    if (!sessionId || !currentUser) return;

    const newStatus = isReady ? 'waiting' : 'ready';

    try {
      const response = await socialService.updateLobbyStatusV2(sessionId, newStatus);

      if (response.status === 'success') {
        setIsReady(!isReady);
        updateMemberStatus(parseInt(currentUser.id), newStatus);
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      alert.error('Error', 'Failed to update status. Please try again.');
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
   */
  const handleSendInvitations = async () => {
    if (selectedMembers.size === 0) {
      alert.warning('No Members Selected', 'Please select at least one member to invite.');
      return;
    }

    setIsInviting(true);
    try {
      // Send invitations individually and track successes/failures
      const results = await Promise.allSettled(
        Array.from(selectedMembers).map(userId =>
          socialService.inviteMemberToLobbyV2(
            sessionId,
            userId,
            parseInt(groupId),
            currentLobby?.workout_data || { workout_format: 'tabata', exercises: [] }
          ).then(() => ({ userId, success: true }))
            .catch((error) => ({ userId, success: false, error: error.message, userName: getMemberName(userId) }))
        )
      );

      // Count successes and failures
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      );
      const failed = results.filter(
        (r) => r.status === 'fulfilled' && !r.value.success
      );

      console.log('📊 Invitation results:', {
        total: selectedMembers.size,
        successful: successful.length,
        failed: failed.length,
        failedDetails: failed.map((f: any) => ({
          userId: f.value?.userId,
          userName: f.value?.userName,
          error: f.value?.error
        }))
      });

      // Show appropriate message
      if (successful.length === selectedMembers.size) {
        // All succeeded
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
        const failedUsers = failed.map((f: any) => f.value?.userName || `User ${f.value?.userId}`).join(', ');
        const hasLobbyError = failed.some((f: any) =>
          f.value?.error?.includes('already in another lobby')
        );

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
        const firstError = (failed[0] as any)?.value?.error || 'Unknown error';
        const hasLobbyError = firstError.includes('already in another lobby');
        const failedUserNames = failed.map((f: any) => f.value?.userName || `User ${f.value?.userId}`).join(', ');

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
        target_exercises: 8,
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

        // Auto-start voting after a short delay (allow exercise reveal animation)
        setTimeout(() => {
          if (!isCleaningUpRef.current && isMountedRef.current) {
            triggerVoting(response.workout.exercises, alternatives);
          }
        }, 2000);
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
    } catch (error) {
      console.error('[VOTING] Error submitting vote:', error);
      alert.error('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  /**
   * Open swap modal for an exercise (initiator only)
   */
  const handleOpenSwapModal = (index: number, exercise: any) => {
    if (!isInitiator) {
      alert.info('Initiator Only', 'Only the lobby initiator can swap exercises.');
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
    if (!isInitiator || !sessionId || !selectedExerciseForSwap || isSwappingExercise) return;

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
            <Text style={styles.sectionTitle}>
              Members ({lobbyMembers.length})
            </Text>
            {/* Invite Members Button - Available to All Users */}
            <TouchableOpacity onPress={handleInviteMembers} style={styles.inviteIconButton}>
              <Ionicons name="person-add-outline" size={22} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.membersScrollView}>
            {lobbyMembers.map((member) => {
              // Use global online users instead of lobby-specific presence
              const isOnline = onlineUsers.has(member.user_id.toString());
              const isCurrentUser = member.user_id === parseInt(currentUser.id);
              // Check initiator from lobby state instead of URL param (for role transfer)
              const isLobbyInitiator = member.user_id === currentLobby?.initiator_id;
              const canTransferRole = isInitiator && !isCurrentUser && !isLobbyInitiator;

              console.log(`🔍 [LOBBY] Checking member ${member.user_name}:`, {
                userId: member.user_id,
                isOnline,
                globalOnlineUsers: Array.from(onlineUsers)
              });

              // Get fitness level color
              const getFitnessLevelColor = (level: string) => {
                switch (level?.toLowerCase()) {
                  case 'advanced': return { bg: '#FEE2E2', text: '#DC2626' }; // Red
                  case 'intermediate': return { bg: '#FEF3C7', text: '#D97706' }; // Orange
                  case 'beginner':
                  default: return { bg: '#D1FAE5', text: '#059669' }; // Green
                }
              };
              const fitnessColors = getFitnessLevelColor(member.fitness_level || 'beginner');

              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.memberCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedLobbyMember(member);
                    setShowMemberPreview(true);
                  }}
                >
                  {/* Avatar */}
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={24} color={COLORS.PRIMARY[600]} />
                    {isLobbyInitiator && (
                      <View style={styles.crownBadge}>
                        <Ionicons name="star" size={12} color={COLORS.WARNING[500]} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: isOnline ? COLORS.SUCCESS[500] : COLORS.SECONDARY[300] },
                      ]}
                    />
                  </View>

                  {/* Content */}
                  <View style={styles.memberContent}>
                    {/* Top Row: Name + You badge */}
                    <View style={styles.memberTopRow}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.user_name}
                      </Text>
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      )}
                    </View>

                    {/* Bottom Row: Badges */}
                    <View style={styles.memberBadgeRow}>
                      {/* Fitness Level Badge */}
                      {member.fitness_level && (
                        <View style={[styles.fitnessLevelBadge, { backgroundColor: fitnessColors.bg }]}>
                          <Text style={[styles.fitnessLevelText, { color: fitnessColors.text }]}>
                            {member.fitness_level.charAt(0).toUpperCase() + member.fitness_level.slice(1)}
                          </Text>
                        </View>
                      )}
                      {/* Mentor Badge */}
                      {member.user_role === 'mentor' && (
                        <View style={styles.mentorBadge}>
                          <Ionicons name="school" size={10} color="#FFFFFF" />
                          <Text style={styles.mentorBadgeText}>Mentor</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      member.status === 'ready'
                        ? styles.statusBadgeReady
                        : styles.statusBadgeWaiting,
                    ]}
                  >
                    <Ionicons
                      name={member.status === 'ready' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={member.status === 'ready' ? COLORS.SUCCESS[700] : COLORS.WARNING[700]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        member.status === 'ready'
                          ? styles.statusTextReady
                          : styles.statusTextWaiting,
                      ]}
                    >
                      {member.status === 'ready' ? 'Ready' : 'Waiting'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Workout Exercises Section */}
        <View style={styles.workoutSection}>
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
            />
          </ScrollView>

          {/* Voting Panel - Shows when voting is active */}
          {isVotingActive && (
            <View style={styles.votingPanel}>
              <View style={styles.votingHeader}>
                <Ionicons name="people" size={20} color={COLORS.PRIMARY[600]} />
                <Text style={styles.votingTitle}>Group Vote</Text>
                <View style={styles.votingTimer}>
                  <Ionicons name="time-outline" size={16} color={votingTimeRemaining <= 10 ? COLORS.ERROR[500] : COLORS.SECONDARY[600]} />
                  <Text style={[styles.votingTimerText, votingTimeRemaining <= 10 && styles.votingTimerTextUrgent]}>
                    {votingTimeRemaining}s
                  </Text>
                </View>
              </View>

              <Text style={styles.votingDescription}>
                Accept the recommended workout or vote to customize?
              </Text>

              {/* Vote Counts */}
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

              {/* Vote Buttons - ALL members can vote for both options */}
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

              {/* Info text explaining customization privileges */}
              {!canUserCustomize && (
                <Text style={styles.votingInfoText}>
                  If "Customize" wins, mentors/advanced users will modify the workout.
                </Text>
              )}
            </View>
          )}

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
                {isInitiator && (
                  <View style={styles.initiatorBadge}>
                    <Text style={styles.initiatorBadgeText}>You Control</Text>
                  </View>
                )}
              </View>

              {isInitiator ? (
                <Text style={styles.customizationDescription}>
                  Tap the swap button on any exercise to replace it with an alternative.
                </Text>
              ) : (
                <Text style={styles.customizationDescription}>
                  The initiator is customizing the workout. Changes will appear here in real-time.
                </Text>
              )}

              {/* Exercise List with Swap Buttons */}
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

                    {/* Swap Button - Only for initiator */}
                    {isInitiator && (
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

      {/* Footer Actions */}
      <View style={styles.footer}>
        {/* Ready Button - Everyone including creator */}
        <TouchableOpacity
          style={[styles.readyButton, isReady && styles.readyButtonActive]}
          onPress={handleToggleReady}
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

                  console.log(`🔍 [INVITE MODAL] Checking member ${member.username}:`, {
                    userId: member.userId,
                    isOnline: isMemberOnline,
                    globalOnlineUsers: Array.from(onlineUsers)
                  });

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
                          <View style={styles.inviteMemberAvatar}>
                            <Ionicons name="person" size={26} color={COLORS.PRIMARY[600]} />
                          </View>
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
                        <Ionicons name="person" size={24} color={COLORS.PRIMARY[600]} />
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
    maxHeight: 320,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
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
  membersScrollView: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
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
  memberContent: {
    flex: 1,
    gap: 6,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: COLORS.PRIMARY[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[700],
  },
  memberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  fitnessLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fitnessLevelText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  mentorBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusBadgeReady: {
    backgroundColor: COLORS.SUCCESS[100],
  },
  statusBadgeWaiting: {
    backgroundColor: COLORS.WARNING[100],
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
  },
  statusTextReady: {
    color: COLORS.SUCCESS[700],
  },
  statusTextWaiting: {
    color: COLORS.WARNING[700],
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inviteModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    padding: 16,
    marginTop: 16,
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
    paddingVertical: 12,
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
