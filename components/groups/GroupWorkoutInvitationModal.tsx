import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface InvitationData {
  group_id: number;
  initiator_id: number;
  initiator_name: string;
  workout_data: {
    workout_format: string;
    exercises: Array<{
      exercise_id: number;
      exercise_name: string;
      difficulty_level: number;
      estimated_calories_burned: number;
      muscle_group: string;
    }>;
    group_analysis?: {
      avg_fitness_level: number;
      min_fitness_level: number;
      max_fitness_level: number;
      fitness_level_range: string;
      total_members: number;
    };
    tabata_structure?: {
      rounds: number;
      work_duration_seconds: number;
      rest_duration_seconds: number;
      total_duration_minutes: number;
    };
  };
  session_id: string;
}

interface Props {
  visible: boolean;
  invitationData: InvitationData | null;
  onAccept: () => void;
  onDecline: () => void;
  countdown?: number; // Auto-decline countdown in seconds
}

export default function GroupWorkoutInvitationModal({
  visible,
  invitationData,
  onAccept,
  onDecline,
  countdown = 30,
}: Props) {
  const [timeLeft, setTimeLeft] = useState(countdown);
  const hasDeclinedRef = useRef(false);

  useEffect(() => {
    if (visible && invitationData) {
      setTimeLeft(countdown);
      hasDeclinedRef.current = false;

      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Use setTimeout to call onDecline outside of setState
            if (!hasDeclinedRef.current) {
              hasDeclinedRef.current = true;
              setTimeout(() => {
                console.log('❌ User declined invitation');
                onDecline();
              }, 0);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible, invitationData, countdown, onDecline]);

  if (!invitationData) return null;

  const { workout_data, initiator_name } = invitationData;
  const { exercises, tabata_structure, group_analysis } = workout_data;

  const getDifficultyLabel = (level: number) => {
    switch (level) {
      case 1: return 'Beginner';
      case 2: return 'Intermediate';
      case 3: return 'Advanced';
      default: return 'Unknown';
    }
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return COLORS.SUCCESS[500];
      case 2: return COLORS.WARNING[500];
      case 3: return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[500];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="people" size={32} color={COLORS.PRIMARY[600]} />
            </View>
            <Text style={styles.title}>Group Workout Invitation!</Text>
            <Text style={styles.subtitle}>
              {initiator_name} invited you to join a group workout
            </Text>

            {/* Countdown Timer */}
            <View style={styles.timerContainer}>
              <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.timerText}>
                Respond in {timeLeft}s
              </Text>
            </View>
          </View>

          {/* Workout Details */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Workout Format */}
            <View style={styles.formatBadge}>
              <Text style={styles.formatText}>
                {workout_data.workout_format.toUpperCase()} WORKOUT
              </Text>
            </View>

            {/* Tabata Structure */}
            {tabata_structure && (
              <View style={styles.tabataInfo}>
                <Text style={styles.sectionTitle}>Tabata Structure</Text>
                <View style={styles.tabataGrid}>
                  <View style={styles.tabataStat}>
                    <Text style={styles.tabataValue}>{tabata_structure.rounds}</Text>
                    <Text style={styles.tabataLabel}>Rounds</Text>
                  </View>
                  <View style={styles.tabataStat}>
                    <Text style={styles.tabataValue}>{tabata_structure.work_duration_seconds}s</Text>
                    <Text style={styles.tabataLabel}>Work</Text>
                  </View>
                  <View style={styles.tabataStat}>
                    <Text style={styles.tabataValue}>{tabata_structure.rest_duration_seconds}s</Text>
                    <Text style={styles.tabataLabel}>Rest</Text>
                  </View>
                  <View style={styles.tabataStat}>
                    <Text style={styles.tabataValue}>{tabata_structure.total_duration_minutes}min</Text>
                    <Text style={styles.tabataLabel}>Total</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Group Analysis */}
            {group_analysis && (
              <View style={styles.groupAnalysis}>
                <Text style={styles.sectionTitle}>Group Fitness Level</Text>
                <View style={styles.analysisRow}>
                  <Text style={styles.analysisLabel}>Range:</Text>
                  <Text style={styles.analysisValue}>
                    {getDifficultyLabel(group_analysis.min_fitness_level)} - {getDifficultyLabel(group_analysis.max_fitness_level)}
                  </Text>
                </View>
                <View style={styles.analysisRow}>
                  <Text style={styles.analysisLabel}>Members:</Text>
                  <Text style={styles.analysisValue}>{group_analysis.total_members}</Text>
                </View>
                <View style={styles.analysisRow}>
                  <Text style={styles.analysisLabel}>Type:</Text>
                  <Text style={styles.analysisValue}>
                    {group_analysis.fitness_level_range === 'homogeneous' ? 'Similar Levels' : 'Mixed Levels'}
                  </Text>
                </View>
              </View>
            )}

            {/* Exercises */}
            <View style={styles.exercisesSection}>
              <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
              {exercises.map((exercise, index) => (
                <View key={exercise.exercise_id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseNumber}>#{index + 1}</Text>
                    <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                  </View>
                  <View style={styles.exerciseDetails}>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '20' }]}>
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(exercise.difficulty_level) }]}>
                        {getDifficultyLabel(exercise.difficulty_level)}
                      </Text>
                    </View>
                    <View style={styles.exerciseStat}>
                      <Ionicons name="body-outline" size={14} color="#6b7280" />
                      <Text style={styles.exerciseStatText}>{exercise.muscle_group}</Text>
                    </View>
                    <View style={styles.exerciseStat}>
                      <Ionicons name="flame-outline" size={14} color="#f59e0b" />
                      <Text style={styles.exerciseStatText}>{exercise.estimated_calories_burned} cal</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept & Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxHeight: '90%',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.SECONDARY[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginLeft: 6,
  },
  content: {
    maxHeight: '60%',
    padding: 20,
  },
  formatBadge: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  formatText: {
    color: COLORS.NEUTRAL.WHITE,
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  tabataInfo: {
    marginBottom: 20,
  },
  tabataGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tabataStat: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  tabataValue: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  tabataLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 4,
  },
  groupAnalysis: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analysisLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  analysisValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exercisesSection: {
    marginBottom: 20,
  },
  exerciseCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseNumber: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    marginRight: 8,
  },
  exerciseName: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flex: 1,
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  difficultyText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  exerciseStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseStatText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SECONDARY[100],
    alignItems: 'center',
    marginRight: 8,
  },
  declineButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  acceptButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
});
