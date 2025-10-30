import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/colors';

export interface ExerciseCardProps {
  exercise: {
    exercise_id: number | string;
    exercise_name: string;
    difficulty_level?: number | string;
    target_muscle_group?: string;
    estimated_calories_burned?: number;
  };
  index: number;
  showCompletionIcon?: boolean;
  showMLBadge?: boolean; // 🧪 For testing: show ML model type
  mlModelType?: string; // e.g., "Hybrid", "Content", "Collaborative"
  style?: ViewStyle;
}

/**
 * Unified Exercise Card Component
 *
 * Used across Dashboard, Workouts, and Weekly Plan screens for consistent UI.
 *
 * Features:
 * - Consistent styling across all pages
 * - Numbered badge showing exercise order
 * - Exercise name with ellipsis for long names
 * - Optional completion checkmark icon
 * - Customizable via style prop
 *
 * @param exercise - Exercise object with id and name
 * @param index - Zero-based index for numbering (displays as index + 1)
 * @param showCompletionIcon - Whether to show checkmark icon (default: true)
 * @param style - Additional styles to apply to container
 */
export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  index,
  showCompletionIcon = true,
  showMLBadge = false,
  mlModelType = 'Hybrid',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Number Badge */}
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>

      {/* Exercise Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {exercise.exercise_name}
        </Text>

        {/* 🧪 ML Model Badge (Testing Only) */}
        {showMLBadge && (
          <View style={styles.mlBadge}>
            <Ionicons name="sparkles" size={10} color={COLORS.WARNING[600]} />
            <Text style={styles.mlBadgeText}>{mlModelType}</Text>
          </View>
        )}
      </View>

      {/* Completion Icon */}
      {showCompletionIcon && (
        <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberText: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  nameContainer: {
    flex: 1,
    marginRight: 10,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  mlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.WARNING[100],
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  mlBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[700],
    textTransform: 'uppercase',
  },
});
