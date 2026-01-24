import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
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
 */
export function GlobalLobbyIndicator() {
  const { activeLobby, isInLobby, clearActiveLobbyLocal } = useLobby();
  const currentLobby = useLobbyStore(selectCurrentLobby);
  const lobbyMembers = useLobbyStore(selectLobbyMembers);
  const allMembersReady = useLobbyStore(selectAreAllMembersReady);
  const clearLobby = useLobbyStore((state) => state.clearLobby);

  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [isLeaving, setIsLeaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isCleaningUpRef = useRef(false);

  // Don't show indicator if not in lobby or already on lobby screen
  const isOnLobbyScreen = pathname?.includes('/workout/group-lobby');
  const isOnWorkoutSession = pathname?.includes('/workout/session');

  if (!isInLobby || !activeLobby || isOnLobbyScreen || isOnWorkoutSession) {
    return null;
  }

  // Get member info from Zustand store (real-time) or fallback
  const memberCount = currentLobby?.members?.length || lobbyMembers.length || 1;
  const readyCount = currentLobby?.members?.filter((m: any) => m.status === 'ready').length ||
                     lobbyMembers.filter((m: any) => m.status === 'ready').length || 0;

  const handlePress = () => {
    if (isLeaving) return;

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
  };

  const handleLeave = () => {
    if (isLeaving) return;

    alert.confirm(
      'Leave Lobby',
      'Are you sure you want to leave the lobby?',
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

    console.log('✅ [INDICATOR] Leave complete');
    setIsLeaving(false);
    isCleaningUpRef.current = false;
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 80, // Position above tab bar
        }
      ]}
    >
      {/* Main Indicator */}
      <TouchableOpacity
        style={styles.mainContent}
        onPress={handlePress}
        onLongPress={toggleExpand}
        activeOpacity={0.9}
        disabled={isLeaving}
      >
        <View style={styles.content}>
          {/* Icon with status indicator */}
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={22} color={COLORS.NEUTRAL.WHITE} />
            <View style={[
              styles.statusDot,
              allMembersReady && memberCount >= 2 ? styles.statusDotReady : styles.statusDotWaiting
            ]} />
          </View>

          {/* Info */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {activeLobby.groupName}
            </Text>
            <Text style={styles.subtitle}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'} • {readyCount} ready
            </Text>
          </View>

          {/* Arrow or Loading */}
          {isLeaving ? (
            <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
          ) : (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.NEUTRAL.WHITE} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded View with Member Details */}
      {isExpanded && !isLeaving && (
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
