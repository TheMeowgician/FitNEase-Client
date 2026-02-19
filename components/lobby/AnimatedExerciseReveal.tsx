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
 * Center Stage animation: each exercise pops up as a large spotlight card
 * in the center, holds for 1s so the group can read it, then slides down
 * and lands in the growing list below — one by one.
 */
export const AnimatedExerciseReveal: React.FC<AnimatedExerciseRevealProps> = ({
  exercises,
  isGenerating,
  onRevealComplete,
}) => {
  // How many exercises have fully landed in the list
  const [revealedCount, setRevealedCount] = useState(0);
  // Which exercise is currently in the spotlight (-1 = none)
  const [spotlightIndex, setSpotlightIndex] = useState(-1);
  const [isRevealing, setIsRevealing] = useState(false);

  // Per-card list animations — card slides up from slightly below
  const listOpacity = useRef<Animated.Value[]>([]);
  const listTranslateY = useRef<Animated.Value[]>([]);

  // Spotlight card animations
  const spotlightOpacity = useRef(new Animated.Value(0)).current;
  const spotlightScale = useRef(new Animated.Value(0.82)).current;
  const spotlightTranslateY = useRef(new Animated.Value(0)).current;

  // "Exercise X of Y" label fade
  const labelOpacity = useRef(new Animated.Value(0)).current;

  // Shimmer for generating placeholders
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Initialize per-card animated values whenever exercise count changes
  useEffect(() => {
    if (exercises.length > 0) {
      listOpacity.current = exercises.map(() => new Animated.Value(0));
      listTranslateY.current = exercises.map(() => new Animated.Value(18));
    } else {
      // Reset everything so animation re-triggers when new exercises arrive
      setRevealedCount(0);
      setSpotlightIndex(-1);
      setIsRevealing(false);
      listOpacity.current = [];
      listTranslateY.current = [];
    }
  }, [exercises.length]);

  // Trigger the reveal sequence once exercises arrive
  useEffect(() => {
    if (exercises.length > 0 && !isGenerating && !isRevealing && revealedCount === 0) {
      startRevealAnimation();
    }
  }, [exercises, isGenerating]);

  // Shimmer loop while generating
  useEffect(() => {
    if (isGenerating) {
      const loop = Animated.loop(
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
      loop.start();
      return () => loop.stop();
    }
  }, [isGenerating]);

  /**
   * Reveal a single exercise:
   * 1. Pop the spotlight card in (spring scale + opacity)
   * 2. Hold for 1000ms
   * 3. Exit spotlight (fade + slide down) while list card fades in
   * 4. Call onDone so caller can move to next exercise
   */
  const revealExercise = (index: number, onDone: () => void) => {
    // Reset spotlight animations for this exercise
    spotlightOpacity.setValue(0);
    spotlightScale.setValue(0.82);
    spotlightTranslateY.setValue(0);
    labelOpacity.setValue(0);

    // Show this exercise in spotlight zone
    setSpotlightIndex(index);

    // Phase 1: Spotlight pops in
    Animated.parallel([
      Animated.timing(spotlightOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.spring(spotlightScale, {
        toValue: 1,
        friction: 7,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Hold so the group can read the exercise
      setTimeout(() => {
        // Phase 3: Spotlight exits + list card appears simultaneously
        Animated.parallel([
          // Spotlight fades out + drifts slightly downward
          Animated.timing(spotlightOpacity, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(spotlightTranslateY, {
            toValue: 14,
            duration: 320,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(spotlightScale, {
            toValue: 0.9,
            duration: 320,
            useNativeDriver: true,
          }),
          // List card springs up into place
          Animated.timing(listOpacity.current[index], {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(listTranslateY.current[index], {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.back(1.1)),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setRevealedCount(index + 1);
          setSpotlightIndex(-1);
          // Short breathing gap before next exercise
          setTimeout(onDone, 200);
        });
      }, 1000);
    });
  };

  const startRevealAnimation = () => {
    setIsRevealing(true);

    const revealNext = (index: number) => {
      if (index >= exercises.length) {
        setIsRevealing(false);
        onRevealComplete?.();
        return;
      }
      revealExercise(index, () => revealNext(index + 1));
    };

    // Brief pause before the first exercise pops in
    setTimeout(() => revealNext(0), 350);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const formatMuscleGroup = (text: string): string => {
    if (!text) return 'Full Body';
    return text
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getDifficultyColor = (level: number): string => {
    if (level <= 1) return COLORS.SUCCESS[500];
    if (level === 2) return COLORS.WARNING[500];
    return COLORS.ERROR[500];
  };

  const getDifficultyLabel = (level: number): string => {
    if (level <= 1) return 'Beginner';
    if (level === 2) return 'Intermediate';
    return 'Advanced';
  };

  // ─── Generating state ─────────────────────────────────────────────────────

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

        {[0, 1, 2, 3].map((_, index) => (
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

  // ─── Empty state ──────────────────────────────────────────────────────────

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

  // ─── Reveal state ─────────────────────────────────────────────────────────

  const spotlightExercise = spotlightIndex >= 0 ? exercises[spotlightIndex] : null;
  const spotlightDiffLevel = Number(spotlightExercise?.difficulty_level || 2);

  return (
    <View style={styles.container}>

      {/* ── Spotlight Zone ──────────────────────────────────────────────── */}
      {isRevealing && (
        <View style={styles.spotlightZone}>

          {/* "Exercise X of Y" label */}
          <Animated.Text style={[styles.spotlightLabel, { opacity: labelOpacity }]}>
            ✨  Exercise {spotlightIndex + 1} of {exercises.length}
          </Animated.Text>

          {/* Big spotlight card */}
          {spotlightExercise && (
            <Animated.View
              style={[
                styles.spotlightCard,
                {
                  opacity: spotlightOpacity,
                  transform: [
                    { scale: spotlightScale },
                    { translateY: spotlightTranslateY },
                  ],
                },
              ]}
            >
              {/* Number badge row */}
              <View style={styles.spotlightBadgeRow}>
                <LinearGradient
                  colors={[COLORS.PRIMARY[400], COLORS.PRIMARY[700]]}
                  style={styles.spotlightNumberBadge}
                >
                  <Text style={styles.spotlightNumberText}>{spotlightIndex + 1}</Text>
                </LinearGradient>
              </View>

              {/* Exercise name */}
              <Text style={styles.spotlightExerciseName} numberOfLines={2}>
                {spotlightExercise.exercise_name}
              </Text>

              {/* Muscle group + difficulty row */}
              <View style={styles.spotlightMetaRow}>
                <View style={styles.spotlightMetaItem}>
                  <Ionicons name="body-outline" size={15} color={COLORS.SECONDARY[500]} />
                  <Text style={styles.spotlightMetaText}>
                    {formatMuscleGroup(spotlightExercise.target_muscle_group || '')}
                  </Text>
                </View>
                <View style={[
                  styles.spotlightDifficultyBadge,
                  { backgroundColor: getDifficultyColor(spotlightDiffLevel) + '22' },
                ]}>
                  <View style={styles.difficultyStars}>
                    {[1, 2, 3].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= spotlightDiffLevel ? 'star' : 'star-outline'}
                        size={13}
                        color={getDifficultyColor(spotlightDiffLevel)}
                      />
                    ))}
                  </View>
                  <Text style={[
                    styles.spotlightDifficultyText,
                    { color: getDifficultyColor(spotlightDiffLevel) },
                  ]}>
                    {getDifficultyLabel(spotlightDiffLevel)}
                  </Text>
                </View>
              </View>

              {/* Tabata stats row */}
              <View style={styles.spotlightTabataRow}>
                <View style={styles.tabataItem}>
                  <Text style={styles.spotlightTabataValue}>20s</Text>
                  <Text style={styles.tabataLabel}>Work</Text>
                </View>
                <View style={styles.tabataDivider} />
                <View style={styles.tabataItem}>
                  <Text style={styles.spotlightTabataValue}>10s</Text>
                  <Text style={styles.tabataLabel}>Rest</Text>
                </View>
                <View style={styles.tabataDivider} />
                <View style={styles.tabataItem}>
                  <Text style={styles.spotlightTabataValue}>8</Text>
                  <Text style={styles.tabataLabel}>Rounds</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Progress dots */}
          <View style={styles.progressDotsRow}>
            {exercises.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < revealedCount && styles.progressDotDone,
                  i === spotlightIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── Summary header — appears after all exercises land ──────────── */}
      {revealedCount === exercises.length && !isRevealing && (
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
      )}

      {/* ── Revealed exercise list ─────────────────────────────────────── */}
      {exercises.map((exercise, index) => {
        // Render only exercises that have landed in the list or are about to
        // (index === revealedCount means it's the one currently in spotlight,
        // pre-rendered as invisible so its list animation is ready to fire)
        if (index > revealedCount) return null;

        const opacity = listOpacity.current[index] ?? new Animated.Value(1);
        const translateY = listTranslateY.current[index] ?? new Animated.Value(0);
        const difficultyLevel = Number(exercise.difficulty_level || 2);

        return (
          <Animated.View
            key={`exercise-${exercise.exercise_id}-${index}`}
            style={[
              styles.exerciseCard,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Number badge */}
            <View style={styles.numberBadge}>
              <LinearGradient
                colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
                style={styles.numberGradient}
              >
                <Text style={styles.numberText}>{index + 1}</Text>
              </LinearGradient>
            </View>

            {/* Exercise content */}
            <View style={styles.exerciseContent}>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exercise.exercise_name}
              </Text>

              <View style={styles.exerciseMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="body-outline" size={14} color={COLORS.SECONDARY[500]} />
                  <Text style={styles.metaText}>
                    {formatMuscleGroup(exercise.target_muscle_group || '')}
                  </Text>
                </View>
                <View style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(difficultyLevel) + '20' },
                ]}>
                  <View style={styles.difficultyStars}>
                    {[1, 2, 3].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= difficultyLevel ? 'star' : 'star-outline'}
                        size={10}
                        color={getDifficultyColor(difficultyLevel)}
                      />
                    ))}
                  </View>
                  <Text style={[
                    styles.difficultyText,
                    { color: getDifficultyColor(difficultyLevel) },
                  ]}>
                    {getDifficultyLabel(difficultyLevel)}
                  </Text>
                </View>
              </View>

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

  // ── Generating state ────────────────────────────────────────────────────

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

  // ── Shimmer placeholder cards ────────────────────────────────────────────

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

  // ── Empty state ──────────────────────────────────────────────────────────

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

  // ── Spotlight zone ───────────────────────────────────────────────────────

  spotlightZone: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  spotlightLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  spotlightCard: {
    width: '90%',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[100],
  },
  spotlightBadgeRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  spotlightNumberBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightNumberText: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  spotlightExerciseName: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 28,
  },
  spotlightMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  spotlightMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  spotlightMetaText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  spotlightDifficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  spotlightDifficultyText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
  },
  spotlightTabataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  spotlightTabataValue: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  progressDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY[200],
  },
  progressDotDone: {
    backgroundColor: COLORS.PRIMARY[500],
  },
  progressDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY[600],
  },

  // ── Summary header ───────────────────────────────────────────────────────

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

  // ── Exercise cards (list) ────────────────────────────────────────────────

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
