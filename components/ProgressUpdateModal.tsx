import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../constants/colors';

const { width } = Dimensions.get('window');

interface ProgressStats {
  workouts: number;
  calories: number;
  minutes: number;
  activeDays: number;
  currentStreak: number;
  scoreProgress: number;
  nextLevel: string;
}

interface ProgressUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  beforeStats: ProgressStats;
  afterStats: ProgressStats;
  workoutData: {
    duration: number;
    calories: number;
  };
}

export default function ProgressUpdateModal({
  visible,
  onClose,
  beforeStats,
  afterStats,
  workoutData,
}: ProgressUpdateModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Individual stat animations
  const workoutsAnim = useRef(new Animated.Value(beforeStats.workouts)).current;
  const caloriesAnim = useRef(new Animated.Value(beforeStats.calories)).current;
  const minutesAnim = useRef(new Animated.Value(beforeStats.minutes)).current;
  const activeDaysAnim = useRef(new Animated.Value(beforeStats.activeDays)).current;
  const streakAnim = useRef(new Animated.Value(beforeStats.currentStreak)).current;
  const scoreProgressAnim = useRef(new Animated.Value(beforeStats.scoreProgress)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.8);
      workoutsAnim.setValue(beforeStats.workouts);
      caloriesAnim.setValue(beforeStats.calories);
      minutesAnim.setValue(beforeStats.minutes);
      activeDaysAnim.setValue(beforeStats.activeDays);
      streakAnim.setValue(beforeStats.currentStreak);
      scoreProgressAnim.setValue(beforeStats.scoreProgress);

      // Start entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After entrance, animate stat increases
        Animated.stagger(100, [
          Animated.timing(workoutsAnim, {
            toValue: afterStats.workouts,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(caloriesAnim, {
            toValue: afterStats.calories,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(minutesAnim, {
            toValue: afterStats.minutes,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(activeDaysAnim, {
            toValue: afterStats.activeDays,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(streakAnim, {
            toValue: afterStats.currentStreak,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(scoreProgressAnim, {
            toValue: afterStats.scoreProgress,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]).start();
      });
    }
  }, [visible, beforeStats, afterStats]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const formatNumber = (animatedValue: Animated.Value) => {
    return animatedValue.interpolate({
      inputRange: [0, 100000],
      outputRange: ['0', '100000'],
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.celebrationIcon}>
              <Ionicons name="trophy" size={40} color={COLORS.WARNING[500]} />
            </View>
            <Text style={styles.title}>Workout Complete! 🎉</Text>
            <Text style={styles.subtitle}>Amazing work! Here's your progress update</Text>
          </View>

          {/* Workout Summary */}
          <View style={styles.workoutSummary}>
            <View style={styles.summaryItem}>
              <Ionicons name="time" size={24} color={COLORS.PRIMARY[600]} />
              <Text style={styles.summaryValue}>{workoutData.duration} min</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="flame" size={24} color={COLORS.ERROR[500]} />
              <Text style={styles.summaryValue}>{workoutData.calories}</Text>
              <Text style={styles.summaryLabel}>Calories</Text>
            </View>
          </View>

          {/* Stats Comparison */}
          <View style={styles.statsSection}>
            <Text style={styles.statsSectionTitle}>Your Progress</Text>

            {/* Workouts */}
            <StatRow
              icon="fitness"
              label="Total Workouts"
              beforeValue={beforeStats.workouts}
              afterValue={afterStats.workouts}
              animatedValue={workoutsAnim}
              color={COLORS.PRIMARY[600]}
            />

            {/* Calories */}
            <StatRow
              icon="flame"
              label="Total Calories Burned"
              beforeValue={beforeStats.calories}
              afterValue={afterStats.calories}
              animatedValue={caloriesAnim}
              color={COLORS.ERROR[500]}
            />

            {/* Minutes */}
            <StatRow
              icon="time"
              label="Total Minutes"
              beforeValue={beforeStats.minutes}
              afterValue={afterStats.minutes}
              animatedValue={minutesAnim}
              color={COLORS.WARNING[600]}
            />

            {/* Active Days */}
            {afterStats.activeDays > beforeStats.activeDays && (
              <StatRow
                icon="calendar"
                label="Active Days"
                beforeValue={beforeStats.activeDays}
                afterValue={afterStats.activeDays}
                animatedValue={activeDaysAnim}
                color={COLORS.SUCCESS[600]}
              />
            )}

            {/* Streak */}
            {afterStats.currentStreak > beforeStats.currentStreak && (
              <StatRow
                icon="flash"
                label="Current Streak"
                beforeValue={beforeStats.currentStreak}
                afterValue={afterStats.currentStreak}
                animatedValue={streakAnim}
                color={COLORS.WARNING[500]}
              />
            )}
          </View>

          {/* Progress to Next Level */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Ionicons name="trophy" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.progressTitle}>Progress to {afterStats.nextLevel}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: scoreProgressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Animated.Text style={styles.progressPercentage}>
              {scoreProgressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0', '100'],
              })}%
            </Animated.Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface StatRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  beforeValue: number;
  afterValue: number;
  animatedValue: Animated.Value;
  color: string;
}

function StatRow({ icon, label, beforeValue, afterValue, animatedValue, color }: StatRowProps) {
  const hasIncrease = afterValue > beforeValue;
  const increase = afterValue - beforeValue;

  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statRight}>
        <Animated.Text style={styles.statValue}>
          {animatedValue.interpolate({
            inputRange: [0, 1000000],
            outputRange: ['0', '1000000'],
          })}
        </Animated.Text>
        {hasIncrease && (
          <View style={styles.increaseContainer}>
            <Ionicons name="arrow-up" size={14} color={COLORS.SUCCESS[600]} />
            <Text style={styles.increaseText}>+{increase}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    maxWidth: 500,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.NEUTRAL.BLACK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  celebrationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.WARNING[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  workoutSummary: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.PRIMARY[200],
    marginHorizontal: 16,
  },
  summaryValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    flex: 1,
  },
  statRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    minWidth: 40,
    textAlign: 'right',
  },
  increaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  increaseText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[600],
  },
  progressSection: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: COLORS.SECONDARY[200],
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 6,
  },
  progressPercentage: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'right',
  },
  closeButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
});
