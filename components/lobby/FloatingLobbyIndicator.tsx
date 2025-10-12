import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useLobby } from '../../contexts/LobbyContext';

export default function FloatingLobbyIndicator() {
  const { lobbyState, restoreLobby } = useLobby();

  if (!lobbyState || !lobbyState.isMinimized) {
    return null;
  }

  const handlePress = () => {
    restoreLobby();
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
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="people" size={24} color={COLORS.NEUTRAL.WHITE} />
        <View style={styles.pulseDot} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Lobby Active</Text>
        <Text style={styles.subtitle}>Tap to return</Text>
      </View>
      <Ionicons name="chevron-up" size={20} color={COLORS.NEUTRAL.WHITE} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[700],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.SUCCESS[500],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[700],
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[100],
    marginTop: 2,
  },
});
