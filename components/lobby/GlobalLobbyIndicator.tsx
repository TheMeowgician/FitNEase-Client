import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useLobby } from '../../contexts/LobbyContext';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Global Lobby Indicator
 *
 * Floating button that appears when user is in an active lobby
 * Allows quick navigation back to lobby from anywhere in the app
 * Auto-hides when on the lobby screen itself
 */
export function GlobalLobbyIndicator() {
  const { activeLobby, isInLobby } = useLobby();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Don't show indicator if not in lobby or already on lobby screen
  const isOnLobbyScreen = pathname?.includes('/workout/group-lobby');
  if (!isInLobby || !activeLobby || isOnLobbyScreen) {
    return null;
  }

  const handlePress = () => {
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

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          bottom: insets.bottom + 80, // Position above tab bar
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={24} color={COLORS.NEUTRAL.WHITE} />
          <View style={styles.pulsingDot} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Active Lobby</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {activeLobby.groupName}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.NEUTRAL.WHITE} />
      </View>
    </TouchableOpacity>
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
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.SUCCESS[700],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulsingDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.WARNING[400],
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[700],
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
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SUCCESS[100],
  },
});
