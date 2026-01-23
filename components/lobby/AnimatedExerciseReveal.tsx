import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface Exercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level?: number | string;
  target_muscle_group?: string;
  estimated_calories_burned?: number;
}

interface AnimatedExerciseRevealProps {
  exercises: Exercise[];
  isGenerating: boolean;
  onRevealComplete?: () => void;
}

/**
 * Animated Exercise Reveal Component
 *
 * Shows exercises one by one with smooth animations when workout is generated.
 * Used in the group lobby when all users are ready.
 */
export const AnimatedExerciseReveal: React.FC<AnimatedExerciseRevealProps> = ({
  exercises,
  isGenerating,
  onRevealComplete,
}) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const animatedValues = useRef<Animated.Value[]>([]);
  const scaleValues = useRef<Animated.Value[]>([]);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Initialize animated values for each exercise
  useEffect(() => {
    if (exercises.length > 0) {
      animatedValues.current = exercises.map(() => new Animated.Value(0));
      scaleValues.current = exercises.map(() => new Animated.Value(0.8));
    }
  }, [exercises.length]);

  // Start reveal animation when exercises are loaded
  useEffect(() => {
    if (exercises.length > 0 && !isGenerating && !isRevealing && revealedCount === 0) {
      startRevealAnimation();
    }
  }, [exercises, isGenerating]);

  // Shimmer animation during generation
  useEffect(() => {
    if (isGenerating) {
      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerLoop.start();
      return () => shimmerLoop.stop();
    }
  }, [isGenerating]);

  const startRevealAnimation = () => {
    setIsRevealing(true);
    let delay = 0;

    exercises.forEach((_, index) => {
      setTimeout(() => {
        // Animate opacity and scale
        Animated.parallel([
          Animated.timing(animatedValues.current[index], {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
          Animated.spring(scaleValues.current[index], {
            toValue: 1,
            friction: 6,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setRevealedCount(index + 1);
          if (index === exercises.length - 1) {
            setIsRevealing(false);
            onRevealComplete?.();
          }
        });
      }, delay);
      delay += 200; // 200ms between each exercise reveal
    });
  };

  // Format muscle group text
  const formatMuscleGroup = (text: string): string => {
    if (!text) return 'Full Body';
    return text
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get difficulty color
  const getDifficultyColor = (level: number): string => {
    if (level <= 1) return COLORS.SUCCESS[500];
    if (level === 2) return COLORS.WARNING[500];
    return COLORS.ERROR[500];
  };

  // Get difficulty label
  const getDifficultyLabel = (level: number): string => {
    if (level <= 1) return 'Beginner';
    if (level === 2) return 'Intermediate';
    return 'Advanced';
  };

  // Generating state - show shimmer placeholders
  if (isGenerating) {
    return (
      <View style={styles.container}>
        <View style={styles.generatingHeader}>
          <Animated.View
            style={[
              styles.generatingIcon,
              {
                transform: [{
                  rotate: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={32} color={COLORS.PRIMARY[500]} />
          </Animated.View>
          <Text style={styles.generatingTitle}>Generating Workout</Text>
          <Text style={styles.generatingSubtitle}>
            Creating personalized exercises for your group...
          </Text>
        </View>

        {/* Shimmer placeholder cards */}
        {[1, 2, 3, 4].map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.shimmerCard,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.3, 0.6, 0.3],
                }),
              },
            ]}
          >
            <View style={styles.shimmerNumber} />
            <View style={styles.shimmerContent}>
              <View style={styles.shimmerTitle} />
              <View style={styles.shimmerSubtitle} />
            </View>
          </Animated.View>
        ))}
      </View>
    );
  }

  // No exercises yet
  if (exercises.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrapper}>
          <Ionicons name="barbell-outline" size={48} color={COLORS.SECONDARY[300]} />
        </View>
        <Text style={styles.emptyTitle}>Waiting for Workout</Text>
        <Text style={styles.emptySubtitle}>
          Exercises will appear when all members are ready
        </Text>
      </View>
    );
  }

  // Reveal exercises with animation
  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <LinearGradient
          colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryGradient}
        >
          <View style={styles.summaryItem}>
            <Ionicons name="fitness" size={20} color="white" />
            <Text style={styles.summaryValue}>{exercises.length}</Text>
            <Text style={styles.summaryLabel}>Exercises</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="time" size={20} color="white" />
            <Text style={styles.summaryValue}>{exercises.length * 4}</Text>
            <Text style={styles.summaryLabel}>Minutes</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="flame" size={20} color="white" />
            <Text style={styles.summaryValue}>~{exercises.length * 15}</Text>
            <Text style={styles.summaryLabel}>Calories</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Progress indicator during reveal */}
      {isRevealing && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Revealing exercises... {revealedCount}/{exercises.length}
          </Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${(revealedCount / exercises.length) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Exercise Cards */}
      {exercises.map((exercise, index) => {
        const opacity = animatedValues.current[index] || new Animated.Value(1);
        const scale = scaleValues.current[index] || new Animated.Value(1);
        const difficultyLevel = Number(exercise.difficulty_level || 2);

        return (
          <Animated.View
            key={`exercise-${exercise.exercise_id}-${index}`}
            style={[
              styles.exerciseCard,
              {
                opacity,
                transform: [
                  { scale },
                  {
                    translateY: opacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Exercise Number Badge */}
            <View style={styles.numberBadge}>
              <LinearGradient
                colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
                style={styles.numberGradient}
              >
                <Text style={styles.numberText}>{index + 1}</Text>
              </LinearGradient>
            </View>

            {/* Exercise Content */}
            <View style={styles.exerciseContent}>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exercise.exercise_name}
              </Text>

              <View style={styles.exerciseMeta}>
                {/* Muscle Group */}
                <View style={styles.metaItem}>
                  <Ionicons name="body-outline" size={14} color={COLORS.SECONDARY[500]} />
                  <Text style={styles.metaText}>
                    {formatMuscleGroup(exercise.target_muscle_group || '')}
                  </Text>
                </View>

                {/* Difficulty */}
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(difficultyLevel) + '20' }]}>
                  <View style={styles.difficultyStars}>
                    {[1, 2, 3].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= difficultyLevel ? "star" : "star-outline"}
                        size={10}
                        color={getDifficultyColor(difficultyLevel)}
                      />
                    ))}
                  </View>
                  <Text style={[styles.difficultyText, { color: getDifficultyColor(difficultyLevel) }]}>
                    {getDifficultyLabel(difficultyLevel)}
                  </Text>
                </View>
              </View>

              {/* Tabata Info */}
              <View style={styles.tabataInfo}>
                <View style={styles.tabataItem}>
                  <Text style={styles.tabataValue}>20s</Text>
                  <Text style={styles.tabataLabel}>Work</Text>
                </View>
                <View style={styles.tabataDivider} />
                <View style={styles.tabataItem}>
                  <Text style={styles.tabataValue}>10s</Text>
                  <Text style={styles.tabataLabel}>Rest</Text>
                </View>
                <View style={styles.tabataDivider} />
                <View style={styles.tabataItem}>
                  <Text style={styles.tabataValue}>8</Text>
                  <Text style={styles.tabataLabel}>Rounds</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },

  // Generating state
  generatingHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  generatingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  generatingTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  generatingSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },

  // Shimmer cards
  shimmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[100],
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  shimmerNumber: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.SECONDARY[200],
    marginRight: 14,
  },
  shimmerContent: {
    flex: 1,
  },
  shimmerTitle: {
    width: '70%',
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.SECONDARY[200],
    marginBottom: 8,
  },
  shimmerSubtitle: {
    width: '50%',
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.SECONDARY[200],
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.SECONDARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Summary header
  summaryHeader: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: 'white',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Progress indicator
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.PRIMARY[100],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 2,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
  },

  // Number badge
  numberBadge: {
    marginRight: 14,
  },
  numberGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },

  // Exercise content
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
    lineHeight: 22,
  },

  // Meta info
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },

  // Difficulty badge
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  difficultyStars: {
    flexDirection: 'row',
    gap: 2,
  },
  difficultyText: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
  },

  // Tabata info
  tabataInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabataItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabataValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  tabataLabel: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  tabataDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.SECONDARY[200],
    marginHorizontal: 8,
  },
});

export default AnimatedExerciseReveal;
