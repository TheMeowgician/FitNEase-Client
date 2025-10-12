import React, { useRef, useEffect } from 'react';
import { Animated, PanResponder, Text, StyleSheet, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useLobby } from '../../contexts/LobbyContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MinimizedLobbyButton() {
  const { lobbyState, restoreLobby } = useLobby();

  // Position state for draggable button
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 200, y: SCREEN_HEIGHT - 180 })).current;
  const lastTap = useRef(0);

  // Handler for button press - defined before panResponder
  const handlePress = () => {
    console.log('🔵 handlePress called');
    console.log('🔵 lobbyState:', lobbyState);

    if (!lobbyState) {
      console.log('❌ No lobby state, returning');
      return;
    }

    console.log('✅ Navigating to lobby...');
    // Navigate first, then restore after navigation completes
    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: lobbyState.sessionId,
        groupId: lobbyState.groupId,
        workoutData: lobbyState.workoutData,
        initiatorId: lobbyState.initiatorId,
        isCreatingLobby: lobbyState.isCreatingLobby,
      },
    });

    // Restore lobby state after a small delay to ensure navigation happens first
    setTimeout(() => {
      console.log('✅ Restoring lobby state after navigation');
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

        console.log('👆 Pan released - distance:', distance, 'dx:', gestureState.dx, 'dy:', gestureState.dy);

        if (distance < 10) {
          // This was a tap, not a drag
          console.log('✅ Detected as TAP (distance < 10)');
          pan.flattenOffset(); // Flatten to keep position

          const now = Date.now();
          const timeSinceLastTap = now - lastTap.current;
          console.log('⏱️ Time since last tap:', timeSinceLastTap, 'ms');

          if (timeSinceLastTap < 300) {
            // Double tap - ignore
            console.log('⚠️ Double tap detected, ignoring');
            return;
          }
          lastTap.current = now;
          console.log('📞 Calling handlePress...');
          handlePress();
          return;
        }

        console.log('🔄 Detected as DRAG (distance >= 10)');


        // This was a drag, flatten offset and constrain position
        pan.flattenOffset();

        // Ensure button stays within screen bounds
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // Button dimensions (approximate)
        const buttonWidth = 180;
        const buttonHeight = 56;

        // Calculate boundaries
        const minX = 16;
        const maxX = SCREEN_WIDTH - buttonWidth - 16;
        const minY = 60; // Leave space for status bar
        const maxY = SCREEN_HEIGHT - buttonHeight - 100; // Leave space for tab bar

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
      <View style={styles.iconContainer}>
        <Ionicons name="people" size={24} color={COLORS.NEUTRAL.WHITE} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.titleText}>Workout Lobby</Text>
        <Text style={styles.subtitleText}>Drag or tap</Text>
      </View>
      <View style={styles.pulseIndicator} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    marginRight: 8,
  },
  titleText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  subtitleText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL.WHITE,
    opacity: 0.9,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SUCCESS[400],
    marginLeft: 4,
  },
});
