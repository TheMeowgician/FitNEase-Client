import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useLobby } from '../../contexts/LobbyContext';
import { useLobbyStore, selectCurrentLobby, selectLobbyMembers, selectAreAllMembersReady } from '../../stores/lobbyStore';
import { socialService } from '../../services/microservices/socialService';
import { reverbService } from '../../services/reverbService';
import { useAlert } from '../../contexts/AlertContext';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Global Lobby Indicator
 *
 * Enhanced floating indicator that appears when user is in an active lobby.
 * Features:
 * - Shows member count and ready status
 * - Leave button to exit lobby from anywhere
 * - Quick navigation back to lobby
 * - Real-time status updates via Zustand store
 * - Robust cleanup on leave
 * - Session reconnect: shows "Rejoin Workout" when a workout is in progress
 */
export function GlobalLobbyIndicator() {
  const { activeLobby, isInLobby, clearActiveLobbyLocal, activeSessionData, clearActiveSession } = useLobby();
  const currentLobby = useLobbyStore(selectCurrentLobby);
  const lobbyMembers = useLobbyStore(selectLobbyMembers);
  const allMembersReady = useLobbyStore(selectAreAllMembersReady);
  const clearLobby = useLobbyStore((state) => state.clearLobby);

  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [isLeaving, setIsLeaving] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isCleaningUpRef = useRef(false);
  const hasAutoNavigatedRef = useRef<string | null>(null);

  // Background workout start detection
  // When user minimizes lobby and host starts workout, the Zustand store updates
  // to 'in_progress' via WebSocket. This effect detects that and auto-navigates.
  useEffect(() => {
    if (!currentLobby || !activeLobby || !isInLobby) return;

    const isOnSession = pathname?.includes('/workout/session');
    const isOnLobby = pathname?.includes('/workout/group-lobby');
    const sessionId = currentLobby.session_id;

    if (
      currentLobby.status === 'in_progress' &&
      !isOnSession &&
      !isOnLobby &&
      hasAutoNavigatedRef.current !== sessionId &&
      currentLobby.workout_data?.exercises?.length > 0
    ) {
      console.log('🚨 [INDICATOR] Background workout start detected! Auto-navigating to session...');
      hasAutoNavigatedRef.current = sessionId;

      // Build session data from Zustand store
      const tabataSession = {
        session_id: sessionId,
        session_name: `Group Workout - ${currentLobby.group_id}`,
        difficulty_level: 'intermediate',
        total_exercises: currentLobby.workout_data.exercises.length,
        total_duration_minutes: currentLobby.workout_data.exercises.length * 4,
        estimated_calories: currentLobby.workout_data.exercises.reduce(
          (sum: number, ex: any) => sum + (ex.estimated_calories_burned || 0), 0
        ),
        exercises: currentLobby.workout_data.exercises,
        created_at: new Date().toISOString(),
      };

      router.replace({
        pathname: '/workout/session',
        params: {
          sessionData: JSON.stringify(tabataSession),
          type: 'group_tabata',
          isGroup: 'true',
          initiatorId: currentLobby.initiator_id.toString(),
          groupId: currentLobby.group_id.toString(),
        },
      });
    }
  }, [currentLobby?.status, currentLobby?.session_id, pathname, isInLobby]);

  // Don't show indicator if not in lobby or already on lobby screen
  const isOnLobbyScreen = pathname?.includes('/workout/group-lobby');
  const isOnWorkoutSession = pathname?.includes('/workout/session');

  if (!isInLobby || !activeLobby || isOnLobbyScreen || isOnWorkoutSession) {
    return null;
  }

  // CRITICAL: Don't show indicator if Zustand store has invalid lobby state
  // This prevents ghost indicators from appearing after lobby deletion
  if (currentLobby && (currentLobby.status === 'completed' || !currentLobby.members || currentLobby.members.length === 0)) {
    console.log('🛡️ [INDICATOR] Hiding - lobby is invalid:', {
      status: currentLobby.status,
      memberCount: currentLobby.members?.length || 0,
    });
    return null;
  }

  // Determine if we're in reconnect mode (workout in progress)
  const isSessionReconnect = !!activeSessionData;

  // Get member info from Zustand store (real-time) or fallback
  const memberCount = currentLobby?.members?.length || lobbyMembers.length || 1;
  const readyCount = currentLobby?.members?.filter((m: any) => m.status === 'ready').length ||
                     lobbyMembers.filter((m: any) => m.status === 'ready').length || 0;

  const handlePress = () => {
    if (isLeaving || isRejoining) return;

    if (isSessionReconnect) {
      // Reconnect to active workout session
      handleRejoinSession();
    } else {
      // Navigate to lobby screen
      router.push({
        pathname: '/workout/group-lobby',
        params: {
          sessionId: activeLobby.sessionId,
          groupId: activeLobby.groupId,
          workoutData: '',
          initiatorId: activeLobby.userId.toString(),
          isCreatingLobby: 'false',
        },
      });
    }
  };

  const handleRejoinSession = async () => {
    if (!activeSessionData || isRejoining) return;

    setIsRejoining(true);
    console.log('🔄 [INDICATOR] Attempting to rejoin workout session...');

    try {
      // No need to call joinLobbyV2 — the user is still a member (closing the app
      // doesn't trigger a leave). The lobby status is 'in_progress' which rejects
      // new joins anyway. We just navigate to the session screen and the WebSocket
      // subscription handles the rest.

      // Navigate to session screen with stored params
      router.replace({
        pathname: '/workout/session',
        params: {
          sessionData: activeSessionData.sessionData,
          type: 'group_tabata',
          isGroup: 'true',
          initiatorId: activeSessionData.initiatorId,
          groupId: activeSessionData.groupId,
        },
      });

      // Clear active session data (session screen will re-save it)
      clearActiveSession();

      console.log('✅ [INDICATOR] Navigated to workout session for reconnect');
    } catch (error) {
      console.error('❌ [INDICATOR] Failed to rejoin session:', error);
      alert.error('Reconnect Failed', 'Could not rejoin the workout session. The session may have ended.');
      // Clear stale session data
      clearActiveSession();
    } finally {
      setIsRejoining(false);
    }
  };

  const handleLeave = () => {
    if (isLeaving) return;

    const title = isSessionReconnect ? 'Leave Workout' : 'Leave Lobby';
    const message = isSessionReconnect
      ? 'Are you sure you want to leave the active workout?'
      : 'Are you sure you want to leave the lobby?';

    alert.confirm(
      title,
      message,
      async () => {
        await performLeave();
      },
      undefined,
      'Leave',
      'Cancel'
    );
  };

  /**
   * Comprehensive leave and cleanup function
   * This is the single source of truth for leaving from the indicator
   */
  const performLeave = async () => {
    if (isCleaningUpRef.current || isLeaving) {
      console.log('🛡️ [INDICATOR] Already leaving, skipping');
      return;
    }

    isCleaningUpRef.current = true;
    setIsLeaving(true);
    console.log('🚪 [INDICATOR] Starting leave process...');

    try {
      // Step 1: Call backend API to leave
      console.log('📤 [INDICATOR] Calling leaveLobbyV2 API...');
      await socialService.leaveLobbyV2(activeLobby.sessionId);
      console.log('✅ [INDICATOR] Left lobby on backend');
    } catch (error: any) {
      // If user already left or lobby doesn't exist, treat as success
      const errorMessage = error?.message || '';
      if (errorMessage.includes('not in this lobby') || errorMessage.includes('not found')) {
        console.log('ℹ️ [INDICATOR] User already left or lobby not found - continuing cleanup');
      } else {
        console.error('❌ [INDICATOR] Error leaving lobby:', error);
      }
    }

    try {
      // Step 2: Unsubscribe from all lobby channels
      console.log('🔕 [INDICATOR] Unsubscribing from channels...');
      reverbService.unsubscribe(`private-lobby.${activeLobby.sessionId}`);
      reverbService.unsubscribe(`presence-lobby.${activeLobby.sessionId}`);
      reverbService.unsubscribe(`presence-group.${activeLobby.groupId}`);
      // Also unsubscribe from session channel in case of reconnect scenario
      reverbService.unsubscribe(`private-session.${activeLobby.sessionId}`);
      console.log('✅ [INDICATOR] Unsubscribed from channels');
    } catch (error) {
      console.error('❌ [INDICATOR] Error unsubscribing:', error);
    }

    // Step 3: Small delay to ensure unsubscribe completes
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Step 4: Clear Zustand store (pass sessionId to mark as "just left")
      console.log('🧹 [INDICATOR] Clearing Zustand store...');
      clearLobby(activeLobby.sessionId);
      console.log('✅ [INDICATOR] Zustand store cleared, marked session as left');
    } catch (error) {
      console.error('❌ [INDICATOR] Error clearing Zustand:', error);
    }

    try {
      // Step 5: Clear LobbyContext (includes AsyncStorage)
      console.log('🧹 [INDICATOR] Clearing LobbyContext...');
      await clearActiveLobbyLocal();
      console.log('✅ [INDICATOR] LobbyContext cleared');
    } catch (error) {
      console.error('❌ [INDICATOR] Error clearing LobbyContext:', error);
    }

    // Step 6: Clear active session data if present
    if (activeSessionData) {
      clearActiveSession();
      console.log('✅ [INDICATOR] Active session data cleared');
    }

    console.log('✅ [INDICATOR] Leave complete');
    setIsLeaving(false);
    isCleaningUpRef.current = false;
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Determine styling based on mode
  const containerStyle = isSessionReconnect
    ? [styles.container, styles.containerReconnect, { bottom: insets.bottom + 80 }]
    : [styles.container, { bottom: insets.bottom + 80 }];

  const iconContainerStyle = isSessionReconnect
    ? [styles.iconContainer, styles.iconContainerReconnect]
    : styles.iconContainer;

  return (
    <View style={containerStyle}>
      {/* Main Indicator */}
      <TouchableOpacity
        style={styles.mainContent}
        onPress={handlePress}
        onLongPress={toggleExpand}
        activeOpacity={0.9}
        disabled={isLeaving || isRejoining}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={iconContainerStyle}>
            {isSessionReconnect ? (
              <Ionicons name="fitness" size={22} color={COLORS.NEUTRAL.WHITE} />
            ) : (
              <>
                <Ionicons name="people" size={22} color={COLORS.NEUTRAL.WHITE} />
                <View style={[
                  styles.statusDot,
                  allMembersReady && memberCount >= 2 ? styles.statusDotReady : styles.statusDotWaiting
                ]} />
              </>
            )}
          </View>

          {/* Info */}
          <View style={styles.textContainer}>
            {isSessionReconnect ? (
              <>
                <Text style={styles.title} numberOfLines={1}>
                  Workout In Progress
                </Text>
                <Text style={styles.subtitle}>
                  Tap to rejoin {activeLobby.groupName}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title} numberOfLines={1}>
                  {activeLobby.groupName}
                </Text>
                <Text style={styles.subtitle}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'} • {readyCount} ready
                </Text>
              </>
            )}
          </View>

          {/* Action Button */}
          {isLeaving || isRejoining ? (
            <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
          ) : (
            <TouchableOpacity
              style={isSessionReconnect ? styles.dismissButton : styles.leaveButton}
              onPress={handleLeave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.NEUTRAL.WHITE} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded View with Member Details (only for lobby mode, not reconnect) */}
      {isExpanded && !isLeaving && !isSessionReconnect && (
        <View style={styles.expandedSection}>
          <View style={styles.expandedDivider} />

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color={COLORS.SUCCESS[100]} />
              <Text style={styles.statText}>{memberCount} in lobby</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.SUCCESS[100]} />
              <Text style={styles.statText}>{readyCount} ready</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePress}
            >
              <Ionicons name="enter-outline" size={18} color={COLORS.NEUTRAL.WHITE} />
              <Text style={styles.actionButtonText}>Go to Lobby</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.leaveActionButton]}
              onPress={handleLeave}
            >
              <Ionicons name="exit-outline" size={18} color={COLORS.ERROR[100]} />
              <Text style={[styles.actionButtonText, styles.leaveActionText]}>Leave</Text>
            </TouchableOpacity>
          </View>

          {/* Hint to collapse */}
          <Text style={styles.hintText}>Tap to go to lobby • Long press to collapse</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: COLORS.SUCCESS[600],
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  containerReconnect: {
    backgroundColor: COLORS.WARNING[600],
  },
  mainContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.SUCCESS[700],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainerReconnect: {
    backgroundColor: COLORS.WARNING[700],
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[700],
  },
  statusDotWaiting: {
    backgroundColor: COLORS.WARNING[400],
  },
  statusDotReady: {
    backgroundColor: COLORS.PRIMARY[400],
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SUCCESS[100],
  },
  leaveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expanded Section
  expandedSection: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SUCCESS[100],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  leaveActionButton: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  leaveActionText: {
    color: COLORS.ERROR[100],
  },
  hintText: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});

export default GlobalLobbyIndicator;
