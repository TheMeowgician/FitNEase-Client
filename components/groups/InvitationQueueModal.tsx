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
import { router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useInvitationStore, selectCurrentInvitation, selectInvitationCount } from '../../stores/invitationStore';

const { width } = Dimensions.get('window');

/**
 * Professional Invitation Queue Modal
 *
 * Features:
 * - Shows invitations one at a time (queue system)
 * - Auto-expiration countdown
 * - Integration with persistent invitation store
 * - Accept/decline with backend API calls
 * - Badge showing total pending invitations
 */
export default function InvitationQueueModal() {
  // Access invitation store
  const currentInvitation = useInvitationStore(selectCurrentInvitation);
  const invitationCount = useInvitationStore(selectInvitationCount);
  const acceptInvitation = useInvitationStore((state) => state.acceptInvitation);
  const declineInvitation = useInvitationStore((state) => state.declineInvitation);
  const showNextInvitation = useInvitationStore((state) => state.showNextInvitation);
  const isLoading = useInvitationStore((state) => state.isLoading);

  const [timeLeft, setTimeLeft] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasDeclinedRef = useRef(false);

  // Calculate time left until expiration
  useEffect(() => {
    if (currentInvitation) {
      const expiresAtMs = currentInvitation.expires_at * 1000;
      const now = Date.now();
      const secondsLeft = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

      setTimeLeft(secondsLeft);
      hasDeclinedRef.current = false;

      const timer = setInterval(() => {
        const expiresAtMs = currentInvitation.expires_at * 1000;
        const now = Date.now();
        const secondsLeft = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

        setTimeLeft(secondsLeft);

        if (secondsLeft <= 0) {
          clearInterval(timer);
          // Auto-decline expired invitation
          if (!hasDeclinedRef.current) {
            hasDeclinedRef.current = true;
            console.log('⏰ Invitation expired, auto-declining');
            handleDecline();
          }
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentInvitation?.invitation_id]);

  const handleAccept = async () => {
    if (!currentInvitation || isProcessing) return;

    setIsProcessing(true);

    try {
      const result = await acceptInvitation(currentInvitation.invitation_id);

      if (result.success && result.sessionId) {
        console.log('✅ Invitation accepted, navigating to lobby');

        // Navigate to lobby
        router.push({
          pathname: '/workout/group-lobby',
          params: {
            sessionId: result.sessionId,
            groupId: currentInvitation.group_id.toString(),
            workoutData: JSON.stringify(currentInvitation.workout_data),
            initiatorId: currentInvitation.initiator_id.toString(),
            isCreatingLobby: 'false',
          },
        });
      } else {
        console.error('❌ Failed to accept invitation:', result.error);
        // Show error to user (could add error state here)
      }
    } catch (error) {
      console.error('❌ Error accepting invitation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentInvitation || isProcessing) return;

    setIsProcessing(true);

    try {
      await declineInvitation(currentInvitation.invitation_id);
      console.log('❌ Invitation declined');
    } catch (error) {
      console.error('❌ Error declining invitation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentInvitation) {
    return null; // No invitation to show
  }

  const { workout_data, initiator_name } = currentInvitation;
  const exercises = workout_data?.exercises || [];
  const tabata_structure = workout_data?.tabata_structure;
  const group_analysis = workout_data?.group_analysis;

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

  const formatMuscleGroup = (muscleGroup: string) => {
    return muscleGroup
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const visible = !!currentInvitation && !isProcessing;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDecline}
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

            {/* Countdown Timer & Queue Badge */}
            <View style={styles.badgeRow}>
              <View style={styles.timerContainer}>
                <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
                <Text style={styles.timerText}>
                  {timeLeft}s left
                </Text>
              </View>

              {invitationCount > 1 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>
                    +{invitationCount - 1} more
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Workout Details */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Workout Format */}
            <View style={styles.formatBadge}>
              <Text style={styles.formatText}>
                {(workout_data.workout_format || 'tabata').toUpperCase()} WORKOUT
              </Text>
            </View>

            {/* Tabata Structure */}
            {tabata_structure && (
              <View style={styles.tabataInfo}>
                <Text style={styles.sectionTitle}>Tabata Structure</Text>
                <View style={styles.tabataContainer}>
                  <View style={styles.tabataRow}>
                    <View style={styles.tabataStat}>
                      <Ionicons name="repeat" size={20} color={COLORS.PRIMARY[600]} />
                      <Text style={styles.tabataValue}>{tabata_structure.rounds}</Text>
                      <Text style={styles.tabataLabel}>Rounds</Text>
                    </View>
                    <View style={styles.tabataStat}>
                      <Ionicons name="timer" size={20} color={COLORS.SUCCESS[600]} />
                      <Text style={styles.tabataValue}>{tabata_structure.work_duration_seconds}s</Text>
                      <Text style={styles.tabataLabel}>Work</Text>
                    </View>
                  </View>
                  <View style={styles.tabataRow}>
                    <View style={styles.tabataStat}>
                      <Ionicons name="pause" size={20} color={COLORS.WARNING[600]} />
                      <Text style={styles.tabataValue}>{tabata_structure.rest_duration_seconds}s</Text>
                      <Text style={styles.tabataLabel}>Rest</Text>
                    </View>
                    <View style={styles.tabataStat}>
                      <Ionicons name="time" size={20} color={COLORS.SECONDARY[600]} />
                      <Text style={styles.tabataValue}>{tabata_structure.total_duration_minutes}</Text>
                      <Text style={styles.tabataLabel}>Total Minutes</Text>
                    </View>
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
              </View>
            )}

            {/* Exercises */}
            {exercises.length > 0 && (
              <View style={styles.exercisesSection}>
                <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
                {exercises.map((exercise: any, index: number) => (
                  <View key={exercise.exercise_id || index} style={styles.exerciseCard}>
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
                      {exercise.muscle_group && (
                        <View style={styles.exerciseStat}>
                          <Ionicons name="body-outline" size={14} color="#6b7280" />
                          <Text style={styles.exerciseStatText}>{formatMuscleGroup(exercise.muscle_group)}</Text>
                        </View>
                      )}
                      {exercise.estimated_calories_burned && (
                        <View style={styles.exerciseStat}>
                          <Ionicons name="flame-outline" size={14} color="#f59e0b" />
                          <Text style={styles.exerciseStatText}>{exercise.estimated_calories_burned} cal</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              disabled={isProcessing || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.SECONDARY[600]} />
              ) : (
                <Text style={styles.declineButtonText}>Decline</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptButton, (isProcessing || isLoading) && styles.acceptButtonDisabled]}
              onPress={handleAccept}
              disabled={isProcessing || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept & Join</Text>
                </>
              )}
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  queueBadge: {
    backgroundColor: COLORS.WARNING[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  queueBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
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
  tabataContainer: {
    gap: 10,
  },
  tabataRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tabataStat: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  tabataValue: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  tabataLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
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
    justifyContent: 'center',
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
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
});
