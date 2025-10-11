import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { progressionService } from '../services/microservices/progressionService';

interface FitnessLevelBadgeProps {
  level: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const COLORS = {
  PRIMARY: {
    900: '#0F172A',
    800: '#1E293B',
    700: '#334155',
    600: '#475569',
    500: '#64748B',
  },
  SECONDARY: {
    500: '#8B5CF6',
    400: '#A78BFA',
  },
  SUCCESS: '#10B981',
  INFO: '#3B82F6',
  WARNING: '#F59E0B',
};

export default function FitnessLevelBadge({
  level,
  size = 'medium',
  showLabel = true,
}: FitnessLevelBadgeProps) {
  const levelName = progressionService.getFitnessLevelName(level);
  const levelColor = progressionService.getFitnessLevelColor(level);
  const levelEmoji = progressionService.getFitnessLevelEmoji(level);

  const sizeStyles = {
    small: {
      container: styles.containerSmall,
      text: styles.textSmall,
      emoji: styles.emojiSmall,
    },
    medium: {
      container: styles.containerMedium,
      text: styles.textMedium,
      emoji: styles.emojiMedium,
    },
    large: {
      container: styles.containerLarge,
      text: styles.textLarge,
      emoji: styles.emojiLarge,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[styles.container, currentSize.container, { backgroundColor: levelColor }]}>
      <Text style={[styles.emoji, currentSize.emoji]}>{levelEmoji}</Text>
      {showLabel && <Text style={[styles.text, currentSize.text]}>{levelName}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  containerMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  containerLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emoji: {
    marginRight: 4,
  },
  emojiSmall: {
    fontSize: 12,
  },
  emojiMedium: {
    fontSize: 16,
  },
  emojiLarge: {
    fontSize: 20,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
  textLarge: {
    fontSize: 15,
  },
});
