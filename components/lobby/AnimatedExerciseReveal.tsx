import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  /** When true, immediately shows all cards at full opacity — no animation played */
  skipAnimation?: boolean;
}

/**
 * Animated Exercise Reveal — Skeleton shimmer → crossfade morph
 *
 * Each exercise card starts as a shimmering skeleton placeholder.
 * One by one, the skeleton crossfades into the real exercise content
 * with a smooth opacity transition and a subtle scale pop.
 *
 * The shimmer is a single gradient sweep shared across all cards,
 * giving a synchronized wave effect.
 */
export const AnimatedExerciseReveal: React.FC<AnimatedExerciseRevealProps> = ({
  exercises,
  isGenerating,
  onRevealComplete,
  skipAnimation = false,
}) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);

  // Per-card crossfade: skeleton opacity (1→0) and real content opacity (0→1)
  const skeletonOpacities = useRef<Animated.Value[]>([]);
  const realOpacities = useRef<Animated.Value[]>([]);
  // Subtle scale pop on each card during reveal
  const cardScales = useRef<Animated.Value[]>([]);

  // Single shimmer sweep shared across ALL cards — keeps the wave synchronized
  const shimmerTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const shimmerAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pending reveal timeout — stored so skipAnimation can cancel it
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generating spinner animation
  const spinnerAnim = useRef(new Animated.Value(0)).current;

  // ─── Synchronous init — runs during render, before JSX is computed ───────
  // Without this, the first render after exercises arrive uses the fallback
  // values below (skeleton opacity 0, real opacity 1), flashing real content
  // for one frame before the useEffect below runs.

  if (exercises.length > 0 && skeletonOpacities.current.length !== exercises.length) {
    skeletonOpacities.current = exercises.map(() => new Animated.Value(1));
    realOpacities.current    = exercises.map(() => new Animated.Value(0));
    cardScales.current       = exercises.map(() => new Animated.Value(0.97));
  }

  // ─── Initialize per-card values when exercise count changes ──────────────

  useEffect(() => {
    if (exercises.length > 0) {
      // Guard: sync init above may have already populated arrays for this length.
      // Only re-create if out of sync (e.g. exercises were replaced wholesale).
      if (skeletonOpacities.current.length !== exercises.length) {
        skeletonOpacities.current = exercises.map(() => new Animated.Value(1));
        realOpacities.current    = exercises.map(() => new Animated.Value(0));
        cardScales.current       = exercises.map(() => new Animated.Value(0.97));
      }
    } else {
      setRevealedCount(0);
      setIsRevealing(false);
      skeletonOpacities.current = [];
      realOpacities.current    = [];
      cardScales.current       = [];
    }
  }, [exercises.length]);

  // ─── Instantly reveal all cards when skipAnimation is true ───────────────
  // Used by the workout section while the fullscreen overlay is animating,
  // so the section already shows all cards when the overlay disappears.

  useEffect(() => {
    if (skipAnimation && exercises.length > 0 && skeletonOpacities.current.length === exercises.length) {
      // Cancel any pending reveal timeout
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      // Snap all cards to fully revealed state
      skeletonOpacities.current.forEach(anim => anim.setValue(0));
      realOpacities.current.forEach(anim => anim.setValue(1));
      cardScales.current.forEach(anim => anim.setValue(1));
      setRevealedCount(exercises.length);
      setIsRevealing(false);
      shimmerAnimRef.current?.stop();
    }
  }, [skipAnimation, exercises.length]);

  // ─── Start reveal when exercises arrive after generation ─────────────────

  useEffect(() => {
    if (exercises.length > 0 && !isGenerating && !isRevealing && revealedCount === 0 && !skipAnimation) {
      // 700ms gives the fullscreen overlay entrance animation time to settle
      // before the first card starts revealing, so both feel sequential not simultaneous.
      revealTimeoutRef.current = setTimeout(() => startRevealAnimation(), 700);
    }
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, [exercises, isGenerating, skipAnimation]);

  // ─── Shimmer sweep — runs while any card is still skeleton ───────────────

  useEffect(() => {
    const shouldShimmer = isGenerating || (exercises.length > 0 && revealedCount < exercises.length);

    if (shouldShimmer) {
      startShimmer();
    } else {
      shimmerAnimRef.current?.stop();
    }

    return () => {
      shimmerAnimRef.current?.stop();
    };
  }, [isGenerating, exercises.length, revealedCount]);

  // ─── Generating spinner ───────────────────────────────────────────────────

  useEffect(() => {
    if (isGenerating) {
      const loop = Animated.loop(
        Animated.timing(spinnerAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isGenerating]);

  const startShimmer = () => {
    shimmerAnimRef.current?.stop();
    shimmerTranslateX.setValue(-SCREEN_WIDTH);
    shimmerAnimRef.current = Animated.loop(
      Animated.timing(shimmerTranslateX, {
        toValue: SCREEN_WIDTH * 1.5,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerAnimRef.current.start();
  };

  // ─── Reveal one card: skeleton crossfades to real content ────────────────

  const revealCard = (index: number, onDone: () => void) => {
    Animated.parallel([
      // Skeleton fades out
      Animated.timing(skeletonOpacities.current[index], {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Real content fades in
      Animated.timing(realOpacities.current[index], {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Subtle scale pop
      Animated.spring(cardScales.current[index], {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRevealedCount(index + 1);
      // Breathing gap before next card — long enough to appreciate each reveal
      setTimeout(onDone, 550);
    });
  };

  const startRevealAnimation = () => {
    setIsRevealing(true);

    const revealNext = (index: number) => {
      if (index >= exercises.length) {
        setIsRevealing(false);
        shimmerAnimRef.current?.stop();
        onRevealComplete?.();
        return;
      }
      revealCard(index, () => revealNext(index + 1));
    };

    revealNext(0);
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

  // ─── Shared shimmer overlay (injected into each skeleton card) ───────────
  // This renders the moving gradient sweep inside a card's overflow:hidden container.

  const ShimmerOverlay = () => (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ translateX: shimmerTranslateX }] },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[
          'transparent',
          'rgba(255, 255, 255, 0.45)',
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );

  // ─── Generating state: shimmer skeleton placeholders ─────────────────────

  if (isGenerating) {
    return (
      <View style={styles.container}>
        {/* Header with spinning sparkle */}
        <View style={styles.generatingHeader}>
          <Animated.View
            style={[
              styles.generatingIcon,
              {
                transform: [{
                  rotate: spinnerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={28} color={COLORS.PRIMARY[500]} />
          </Animated.View>
          <Text style={styles.generatingTitle}>Generating Workout</Text>
          <Text style={styles.generatingSubtitle}>
            Creating personalized exercises for your group...
          </Text>
        </View>

        {/* Shimmer skeleton placeholder cards */}
        {[0, 1, 2, 3, 4].map((_, i) => (
          <View key={i} style={[styles.exerciseCard, styles.skeletonCardBase, { opacity: 1 - i * 0.12 }]}>
            <View style={styles.skeletonNumberBadge} />
            <View style={styles.skeletonContent}>
              <View style={[styles.skeletonLine, { width: '68%', height: 16, marginBottom: 10 }]} />
              <View style={[styles.skeletonLine, { width: '44%', height: 12, marginBottom: 14 }]} />
              <View style={[styles.skeletonLine, { width: '90%', height: 32, borderRadius: 10 }]} />
            </View>
            <ShimmerOverlay />
          </View>
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

  // ─── Reveal state: skeleton cards morph into real exercise cards ──────────

  return (
    <View style={styles.container}>

      {/* Summary header — only after all cards have revealed */}
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

      {exercises.map((exercise, index) => {
        const skeletonOpacity = skeletonOpacities.current[index] ?? new Animated.Value(0);
        const realOpacity     = realOpacities.current[index]     ?? new Animated.Value(1);
        const cardScale       = cardScales.current[index]        ?? new Animated.Value(1);
        const difficultyLevel = Number(exercise.difficulty_level || 2);

        return (
          <Animated.View
            key={`exercise-${exercise.exercise_id}-${index}`}
            style={[
              styles.exerciseCard,
              { transform: [{ scale: cardScale }] },
            ]}
          >
            {/* ── Real content (always present — defines card height) ──── */}
            <Animated.View style={[styles.realLayer, { opacity: realOpacity }]}>
              {/* Number badge */}
              <View style={styles.numberBadge}>
                <LinearGradient
                  colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
                  style={styles.numberGradient}
                >
                  <Text style={styles.numberText}>{index + 1}</Text>
                </LinearGradient>
              </View>

              {/* Exercise info */}
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

            {/* ── Skeleton overlay (sits on top, fades out during reveal) ─ */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.skeletonOverlay,
                { opacity: skeletonOpacity },
              ]}
              pointerEvents="none"
            >
              <View style={styles.skeletonNumberBadge} />
              <View style={styles.skeletonContent}>
                <View style={[styles.skeletonLine, { width: '68%', height: 16, marginBottom: 10 }]} />
                <View style={[styles.skeletonLine, { width: '44%', height: 12, marginBottom: 14 }]} />
                <View style={[styles.skeletonLine, { width: '90%', height: 32, borderRadius: 10 }]} />
              </View>
              {/* Moving shimmer sweep */}
              <ShimmerOverlay />
            </Animated.View>

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
    marginBottom: 12,
  },
  generatingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  generatingTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 6,
  },
  generatingSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    paddingHorizontal: 16,
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

  // ── Exercise card (shared base) ──────────────────────────────────────────

  exerciseCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',           // clips the shimmer sweep to card bounds
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
  },

  // Real content layer
  realLayer: {
    flexDirection: 'row',
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

  // ── Skeleton styles ──────────────────────────────────────────────────────

  // Base for generating placeholder cards (not overlay)
  skeletonCardBase: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Overlay that sits on top of the real card content
  skeletonOverlay: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  skeletonNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.SECONDARY[200],
    marginRight: 14,
    flexShrink: 0,
  },

  skeletonContent: {
    flex: 1,
    justifyContent: 'center',
  },

  skeletonLine: {
    backgroundColor: COLORS.SECONDARY[200],
    borderRadius: 8,
  },
});

export default AnimatedExerciseReveal;
