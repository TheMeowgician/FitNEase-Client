import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useLobbyStore, selectCurrentLobby, selectLobbyMembers, selectAreAllMembersReady, selectIsLobbyInitiator } from '../../stores/lobbyStore';
import { useConnectionStore, selectIsConnected, selectConnectionState } from '../../stores/connectionStore';
import { useAuth } from '../../contexts/AuthContext';
import { reverbService } from '../../services/reverbService';
import { socialService } from '../../services/microservices/socialService';
import LobbyChat from '../../components/groups/LobbyChat';

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
  }>();

  const { sessionId, groupId, workoutData, initiatorId, isCreatingLobby } = params;

  // Auth
  const { user: currentUser } = useAuth();

  // Stores
  const currentLobby = useLobbyStore(selectCurrentLobby);
  const lobbyMembers = useLobbyStore(selectLobbyMembers);
  const isConnected = useConnectionStore(selectIsConnected);
  const connectionState = useConnectionStore(selectConnectionState);
  const setLobbyState = useLobbyStore((state) => state.setLobbyState);
  const updateMemberStatus = useLobbyStore((state) => state.updateMemberStatus);
  const addMember = useLobbyStore((state) => state.addMember);
  const removeMember = useLobbyStore((state) => state.removeMember);
  const addChatMessage = useLobbyStore((state) => state.addChatMessage);
  const clearLobby = useLobbyStore((state) => state.clearLobby);
  const setLoading = useLobbyStore((state) => state.setLoading);

  // Local state
  const [isReady, setIsReady] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<Set<number>>(new Set());

  const hasJoinedRef = useRef(false);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // Check if current user is initiator
  useEffect(() => {
    if (currentUser && initiatorId) {
      setIsInitiator(currentUser.id === parseInt(initiatorId));
    }
  }, [currentUser, initiatorId]);

  // Check if all members are ready
  const allMembersReady = useLobbyStore(selectAreAllMembersReady);
  const canStartWorkout = isInitiator && allMembersReady && lobbyMembers.length > 0;

  /**
   * Initialize lobby on mount
   */
  useEffect(() => {
    initializeLobby();

    return () => {
      cleanup();
    };
  }, []);

  const initializeLobby = async () => {
    if (!sessionId || !currentUser) {
      console.error('❌ Missing sessionId or user');
      router.back();
      return;
    }

    try {
      setLoading(true);

      // If creating lobby, call API to create it
      if (isCreatingLobby === 'true') {
        const workoutDataParsed = workoutData ? JSON.parse(workoutData) : null;

        const response = await socialService.createLobby(
          parseInt(groupId),
          workoutDataParsed
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to create lobby');
        }

        // Set initial lobby state
        setLobbyState(response.data.lobby_state);
      } else {
        // Join existing lobby
        const response = await socialService.joinLobby(sessionId);

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to join lobby');
        }

        // Set lobby state from join response
        setLobbyState(response.data.lobby_state);
      }

      // Save active lobby to AsyncStorage (for crash recovery)
      await saveActiveLobbyToStorage();

      // Subscribe to WebSocket channels
      subscribeToChannels();

      hasJoinedRef.current = true;
    } catch (error) {
      console.error('❌ Error initializing lobby:', error);
      Alert.alert('Error', 'Failed to join lobby. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save active lobby to AsyncStorage for crash recovery
   */
  const saveActiveLobbyToStorage = async () => {
    if (!sessionId || !groupId || !currentUser) return;

    try {
      const storageKey = `activeLobby_group_${groupId}_user_${currentUser.id}`;
      const lobbyData = {
        sessionId,
        groupId,
        userId: currentUser.id,
        joinedAt: Date.now(),
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(lobbyData));
      console.log('💾 Saved active lobby to storage');
    } catch (error) {
      console.error('❌ Error saving lobby to storage:', error);
    }
  };

  /**
   * Subscribe to WebSocket channels
   */
  const subscribeToChannels = () => {
    if (!sessionId) return;

    // Subscribe to lobby channel for events
    channelRef.current = reverbService.subscribeToLobby(sessionId, {
      onLobbyStateChanged: (data: any) => {
        console.log('📊 Lobby state changed:', data);
        setLobbyState(data.lobby_state);
      },
      onMemberJoined: (data: any) => {
        console.log('👤 Member joined:', data.member);
        addMember(data.member);
        addChatMessage({
          message_id: `system-${Date.now()}`,
          user_id: null,
          user_name: 'System',
          message: `${data.member.user_name} joined the lobby`,
          timestamp: Math.floor(Date.now() / 1000),
          is_system_message: true,
        });
      },
      onMemberLeft: (data: any) => {
        console.log('👤 Member left:', data.user_id);
        removeMember(data.user_id);
        addChatMessage({
          message_id: `system-${Date.now()}`,
          user_id: null,
          user_name: 'System',
          message: `${data.user_name} left the lobby`,
          timestamp: Math.floor(Date.now() / 1000),
          is_system_message: true,
        });
      },
      onMemberStatusUpdated: (data: any) => {
        console.log('✅ Member status updated:', data);
        updateMemberStatus(data.user_id, data.status);
      },
      onLobbyMessageSent: (data: any) => {
        console.log('💬 Message received:', data.message);
        addChatMessage(data.message);
      },
      onWorkoutStarted: (data: any) => {
        console.log('🏋️ Workout started!', data);
        // Navigate to workout session
        router.replace({
          pathname: '/workout/session',
          params: {
            sessionId: data.session_id,
            workoutData: JSON.stringify(data.workout_data),
            isGroup: 'true',
          },
        });
      },
      onLobbyDeleted: (data: any) => {
        console.log('🗑️ Lobby deleted:', data.reason);
        Alert.alert('Lobby Closed', data.reason || 'The lobby has been closed.');
        cleanup();
        router.back();
      },
      onMemberKicked: (data: any) => {
        console.log('⚠️ Member kicked:', data);
        if (data.kicked_user_id === currentUser?.user_id) {
          Alert.alert('Kicked', data.reason || 'You have been removed from the lobby.');
          cleanup();
          router.back();
        } else {
          removeMember(data.kicked_user_id);
          addChatMessage({
            message_id: `system-${Date.now()}`,
            user_id: null,
            user_name: 'System',
            message: `${data.kicked_user_name} was removed from the lobby`,
            timestamp: Math.floor(Date.now() / 1000),
            is_system_message: true,
          });
        }
      },
    });

    // Subscribe to presence channel for online status
    presenceChannelRef.current = reverbService.subscribeToPresence(`lobby.${sessionId}`, {
      onHere: (members: any[]) => {
        console.log('👥 Members here:', members);
        const memberIds = new Set(members.map((m) => m.user_id));
        setOnlineMembers(memberIds);
      },
      onJoining: (member: any) => {
        console.log('✅ Member joining:', member);
        setOnlineMembers((prev) => new Set([...prev, member.user_id]));
      },
      onLeaving: (member: any) => {
        console.log('❌ Member leaving:', member);
        setOnlineMembers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(member.user_id);
          return newSet;
        });
      },
    });

    console.log('✅ Subscribed to lobby channels');
  };

  /**
   * Toggle ready status
   */
  const handleToggleReady = async () => {
    if (!sessionId || !currentUser) return;

    const newStatus = isReady ? 'waiting' : 'ready';

    try {
      const response = await socialService.updateLobbyStatus(sessionId, newStatus);

      if (response.success) {
        setIsReady(!isReady);
        updateMemberStatus(currentUser.id, newStatus);
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  /**
   * Leave lobby
   */
  const handleLeaveLobby = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave the lobby?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveLobby();
          },
        },
      ]
    );
  };

  const leaveLobby = async () => {
    if (!sessionId || isLeaving) return;

    setIsLeaving(true);

    try {
      await socialService.leaveLobby(sessionId);
      cleanup();
      router.back();
    } catch (error) {
      console.error('❌ Error leaving lobby:', error);
      // Still cleanup and go back even if API fails
      cleanup();
      router.back();
    } finally {
      setIsLeaving(false);
    }
  };

  /**
   * Kick member (initiator only)
   */
  const handleKickMember = (userId: number, userName: string) => {
    if (!isInitiator) return;

    Alert.alert(
      'Remove Member',
      `Remove ${userName} from the lobby?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialService.kickMember(sessionId, userId);
            } catch (error) {
              console.error('❌ Error kicking member:', error);
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  /**
   * Start workout (initiator only)
   */
  const handleStartWorkout = async () => {
    if (!canStartWorkout || isStarting) return;

    setIsStarting(true);

    try {
      const response = await socialService.startWorkout(sessionId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to start workout');
      }

      // WorkoutStarted event will trigger navigation
    } catch (error) {
      console.error('❌ Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
      setIsStarting(false);
    }
  };

  /**
   * Comprehensive cleanup on unmount, leave, kick, or delete
   */
  const cleanup = async () => {
    console.log('🧹 [CLEANUP] Starting comprehensive cleanup...');

    try {
      // 1. Clear AsyncStorage
      if (sessionId && groupId && currentUser) {
        const storageKey = `activeLobby_group_${groupId}_user_${currentUser.id}`;
        await AsyncStorage.removeItem(storageKey);
        console.log('🧹 [CLEANUP] Cleared AsyncStorage');
      }

      // 2. Unsubscribe from lobby channel
      if (channelRef.current) {
        reverbService.unsubscribe(`private-lobby.${sessionId}`);
        channelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from lobby channel');
      }

      // 3. Unsubscribe from presence channel
      if (presenceChannelRef.current) {
        reverbService.unsubscribe(`presence-lobby.${sessionId}`);
        presenceChannelRef.current = null;
        console.log('🧹 [CLEANUP] Unsubscribed from presence channel');
      }

      // 4. Clear lobby store
      clearLobby();
      console.log('🧹 [CLEANUP] Cleared lobby store');

      // 5. Reset all refs
      hasJoinedRef.current = false;
      console.log('🧹 [CLEANUP] Reset refs');

      console.log('✅ [CLEANUP] Cleanup complete');
    } catch (error) {
      console.error('❌ [CLEANUP] Cleanup failed:', error);
    }
  };

  if (!currentUser || !currentLobby) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
        <Text style={styles.loadingText}>Loading lobby...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeaveLobby} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Group Workout Lobby</Text>
          <View style={styles.connectionIndicator}>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: isConnected ? COLORS.SUCCESS[500] : COLORS.ERROR[500] },
              ]}
            />
            <Text style={styles.connectionText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Members Section */}
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>
            Members ({lobbyMembers.length})
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.membersList}
          >
            {lobbyMembers.map((member) => {
              const isOnline = onlineMembers.has(member.user_id);
              const isCurrentUser = member.user_id === currentUser.id;
              const isLobbyInitiator = member.user_id === parseInt(initiatorId);

              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.memberCard}
                  onLongPress={() => {
                    if (isInitiator && !isCurrentUser && !isLobbyInitiator) {
                      handleKickMember(member.user_id, member.user_name);
                    }
                  }}
                  delayLongPress={500}
                >
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
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.user_name}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      member.status === 'ready'
                        ? styles.statusBadgeReady
                        : styles.statusBadgeWaiting,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        member.status === 'ready'
                          ? styles.statusTextReady
                          : styles.statusTextWaiting,
                      ]}
                    >
                      {member.status === 'ready' ? 'Ready' : 'Not Ready'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Chat Section */}
        <View style={styles.chatSection}>
          <Text style={styles.sectionTitle}>Chat</Text>
          <LobbyChat sessionId={sessionId} currentUserId={currentUser.id} />
        </View>
      </View>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeaveLobby}
          disabled={isLeaving}
        >
          {isLeaving ? (
            <ActivityIndicator size="small" color={COLORS.ERROR[600]} />
          ) : (
            <>
              <Ionicons name="exit-outline" size={20} color={COLORS.ERROR[600]} />
              <Text style={styles.leaveButtonText}>Leave</Text>
            </>
          )}
        </TouchableOpacity>

        {isInitiator ? (
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
        ) : (
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
        )}
      </View>
    </View>
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
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[600],
  },
  content: {
    flex: 1,
  },
  membersSection: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  membersList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  memberCard: {
    alignItems: 'center',
    width: 80,
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.WARNING[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  memberName: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeReady: {
    backgroundColor: COLORS.SUCCESS[100],
  },
  statusBadgeWaiting: {
    backgroundColor: COLORS.WARNING[100],
  },
  statusText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  statusTextReady: {
    color: COLORS.SUCCESS[700],
  },
  statusTextWaiting: {
    color: COLORS.WARNING[700],
  },
  chatSection: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
    gap: 12,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.ERROR[50],
    gap: 8,
  },
  leaveButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.ERROR[600],
  },
  readyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SUCCESS[50],
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
});
