import React, { useRef, useEffect } from 'react';
import { Animated, PanResponder, Text, StyleSheet, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useLobby } from '../../contexts/LobbyContext';
import reverbService from '../../services/reverbService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MinimizedLobbyButton() {
  const { lobbyState, restoreLobby, lobbyNotificationCount, incrementLobbyNotifications, updateLobbyChatMessages, updateLobbyMembers, leaveLobby } = useLobby();

  // Use refs to always have latest state in event handlers
  const lobbyStateRef = useRef(lobbyState);
  const updateLobbyChatMessagesRef = useRef(updateLobbyChatMessages);
  const updateLobbyMembersRef = useRef(updateLobbyMembers);
  const incrementLobbyNotificationsRef = useRef(incrementLobbyNotifications);
  const leaveLobbyRef = useRef(leaveLobby);

  useEffect(() => {
    lobbyStateRef.current = lobbyState;
    updateLobbyChatMessagesRef.current = updateLobbyChatMessages;
    updateLobbyMembersRef.current = updateLobbyMembers;
    incrementLobbyNotificationsRef.current = incrementLobbyNotifications;
    leaveLobbyRef.current = leaveLobby;
  }, [lobbyState, updateLobbyChatMessages, updateLobbyMembers, incrementLobbyNotifications, leaveLobby]);

  // Position state for draggable button (circular: 60x60, positioned on right side)
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 80, y: SCREEN_HEIGHT - 180 })).current;
  const lastTap = useRef(0);

  // Subscribe to lobby events when minimized - only depends on session ID and minimized state
  useEffect(() => {
    if (!lobbyState || !lobbyState.isMinimized) return;

    const sessionId = lobbyState.sessionId;
    console.log('🔔 Setting up minimized lobby notifications for session:', sessionId);

    // Wait for Reverb to be ready before subscribing
    const subscribeWhenReady = () => {
      const checkInterval = setInterval(() => {
        const isConnected = reverbService.isConnected();
        console.log('🔄 Checking Reverb connection for minimized lobby:', isConnected);

        if (isConnected) {
          clearInterval(checkInterval);
          console.log('✅ Reverb connected, subscribing to minimized lobby');

          // Subscribe to lobby channel
          reverbService.subscribeToPrivateChannel(`lobby.${sessionId}`, {
            onEvent: (eventName, data) => {
              console.log('🔔 Minimized lobby event:', eventName, data);

        // ALWAYS get latest state from ref - this is critical!
        const currentLobbyState = lobbyStateRef.current;
        if (!currentLobbyState) {
          console.log('⚠️ No current lobby state in ref, skipping event');
          return;
        }

        console.log('📊 Current lobby state from ref:', {
          sessionId: currentLobbyState.sessionId,
          membersCount: currentLobbyState.members?.length || 0,
          chatCount: currentLobbyState.chatMessages?.length || 0
        });

        // Increment badge for chat messages
        if (eventName === 'LobbyMessageSent') {
          console.log('💬 New chat message while minimized');
          incrementLobbyNotificationsRef.current();

          // Get FRESH state again right before updating
          const latestState = lobbyStateRef.current;
          if (!latestState) return;

          // Add chat message to global state
          const newMessage = {
            id: data.message_id,
            userId: data.user_id,
            userName: data.user_name,
            message: data.message,
            timestamp: data.timestamp * 1000,
            isOwnMessage: false,
            isSystemMessage: data.is_system_message || false,
          };

          const currentMessages = latestState.chatMessages || [];
          console.log('💬 Adding message to', currentMessages.length, 'existing messages');
          updateLobbyChatMessagesRef.current([...currentMessages, newMessage]);
        }

        // Increment badge for member status updates (joins)
        if (eventName === 'MemberStatusUpdate') {
          console.log('👥 Member joined/status changed while minimized');
          incrementLobbyNotificationsRef.current();

          // Get FRESH state again right before updating
          const latestState = lobbyStateRef.current;
          if (!latestState) return;

          // Update members in global state
          const currentMembers = latestState.members || [];
          console.log('👥 Current members count:', currentMembers.length);

          const memberExists = currentMembers.find(m => m.user_id === data.user_id);

          if (memberExists) {
            // Update existing member status
            console.log('👤 Updating existing member:', data.user_id, 'to status:', data.status);
            const updatedMembers = currentMembers.map(m =>
              m.user_id === data.user_id ? { ...m, status: data.status } : m
            );
            updateLobbyMembersRef.current(updatedMembers);
          } else {
            // Add new member
            console.log('👤 Adding new member:', data.user_id, data.name);
            const updatedMembers = [...currentMembers, {
              user_id: data.user_id,
              name: data.name,
              status: data.status
            }];
            updateLobbyMembersRef.current(updatedMembers);

            // System message for member join will be broadcast separately via LobbyMessageSent event
            // No need to create it locally - backend handles it
          }
        }

        // Increment badge for member kicked/left
        if (eventName === 'MemberKicked') {
          console.log('🚫 Member left/kicked while minimized');
          incrementLobbyNotificationsRef.current();

          // Get FRESH state again right before updating
          const latestState = lobbyStateRef.current;
          if (!latestState) return;

          // Remove member from global state
          const currentMembers = latestState.members || [];
          console.log('🚫 Removing member:', data.kickedUserId, 'from', currentMembers.length, 'members');
          const updatedMembers = currentMembers.filter(m => m.user_id !== Number(data.kickedUserId));
          console.log('🚫 Updated members count:', updatedMembers.length);
          updateLobbyMembersRef.current(updatedMembers);

          // System message for member leaving will be broadcast separately via LobbyMessageSent event
          // No need to create it locally - backend handles it
        }

        // Handle ExercisesGenerated event
        if (eventName === 'ExercisesGenerated') {
          console.log('🏋️ Exercises generated while minimized');
          incrementLobbyNotificationsRef.current();
        }

        // Handle LobbyDeleted event
        if (eventName === 'LobbyDeleted') {
          console.log('🗑️ Lobby was deleted while minimized');
          // Clear lobby state completely - lobby no longer exists
          leaveLobbyRef.current();
        }
      },
    });
        }
      }, 500); // Check every 500ms

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏰ Timeout waiting for Reverb connection');
      }, 10000);
    };

    subscribeWhenReady();

    // Cleanup
    return () => {
      console.log('🔕 Cleaning up minimized lobby notifications');
      reverbService.unsubscribe(`private-lobby.${sessionId}`);
    };
  }, [lobbyState?.isMinimized, lobbyState?.sessionId]); // Only re-subscribe if session ID or minimized state changes

  // Handler for button press - defined before panResponder
  const handlePress = () => {
    const currentLobbyState = lobbyStateRef.current;

    if (!currentLobbyState) {
      return;
    }

    // Navigate first, then restore after navigation completes
    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: currentLobbyState.sessionId,
        groupId: currentLobbyState.groupId,
        workoutData: currentLobbyState.workoutData,
        initiatorId: currentLobbyState.initiatorId,
        isCreatingLobby: currentLobbyState.isCreatingLobby,
      },
    });

    // Restore lobby state after navigation
    setTimeout(() => {
      restoreLobby();
    }, 100);
  };

  // PanResponder for drag functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start dragging if moved more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Set offset to current value so dragging continues from current position
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        // Check if this was a tap (not a drag) BEFORE flattening offset
        const distance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);

        if (distance < 10) {
          // This was a tap, not a drag
          pan.flattenOffset(); // Flatten to keep position

          const now = Date.now();
          const timeSinceLastTap = now - lastTap.current;

          if (timeSinceLastTap < 300) {
            // Double tap - ignore
            return;
          }
          lastTap.current = now;
          handlePress();
          return;
        }

        // This was a drag, flatten offset and constrain position
        pan.flattenOffset();

        // Ensure button stays within screen bounds
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // Button dimensions (circular button: 60x60)
        const buttonSize = 60;

        // Calculate boundaries
        const minX = 16;
        const maxX = SCREEN_WIDTH - buttonSize - 16;
        const minY = 60; // Leave space for status bar
        const maxY = SCREEN_HEIGHT - buttonSize - 100; // Leave space for tab bar

        // Clamp position within bounds
        const clampedX = Math.max(minX, Math.min(maxX, currentX));
        const clampedY = Math.max(minY, Math.min(maxY, currentY));

        // Animate to clamped position
        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  // Don't show if no lobby or lobby is not minimized
  // IMPORTANT: This check must come AFTER all hooks to maintain hook order
  if (!lobbyState || !lobbyState.isMinimized) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Ionicons name="people" size={28} color={COLORS.NEUTRAL.WHITE} />

      {/* Notification Badge */}
      {lobbyNotificationCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {lobbyNotificationCount > 9 ? '9+' : lobbyNotificationCount}
          </Text>
        </View>
      )}

      {/* Pulse Indicator */}
      <View style={styles.pulseIndicator} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.ERROR[500],
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  pulseIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.SUCCESS[400],
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
});
