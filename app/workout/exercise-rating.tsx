import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { COLORS, FONTS } from '../../constants/colors';
import ProgressUpdateModal from '../../components/ProgressUpdateModal';
import AchievementUnlockModal, { UnlockedAchievement } from '../../components/achievements/AchievementUnlockModal';
import { ratingService } from '../../services/microservices/ratingService';
import { engagementService } from '../../services/microservices/engagementService';
import { useProgressStore } from '../../stores/progressStore';

/**
 * Exercise Rating Screen
 *
 * This is CRITICAL for collaborative filtering!
 * Shows after workout completion, allows user to rate each exercise individually.
 *
 * Flow:
 * 1. User completes workout → session.tsx
 * 2. Navigate to this screen with exercises data
 * 3. User rates each exercise (1-5 stars + difficulty)
 * 4. Submit ratings to backend
 * 5. Navigate to progress modal
 */

interface ExerciseToRate {
  exercise_id: number;
  exercise_name: string;
  target_muscle_group?: string;
  completed: boolean;
}

interface ExerciseRating {
  exercise_id: number;
  rating_value: number;
  difficulty_perceived?: 'too_easy' | 'appropriate' | 'challenging' | 'too_hard';
  enjoyment_rating?: number;
  would_do_again: boolean;
  completed: boolean;
}

export default function ExerciseRatingScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const { refreshAfterWorkout } = useProgressStore();
  const params = useLocalSearchParams();

  // Parse parameters
  const sessionId = params.sessionId as string;
  const workoutId = params.workoutId as string;
  const exercisesData = params.exercises as string;
  const beforeStats = params.beforeStats as string;
  const afterStats = params.afterStats as string;
  const workoutData = params.workoutData as string;

  // Parse exercises from JSON
  const exercises: ExerciseToRate[] = exercisesData ? JSON.parse(exercisesData) : [];

  // State for ratings
  const [ratings, setRatings] = useState<Map<number, ExerciseRating>>(
    new Map(
      exercises.map((ex) => [
        ex.exercise_id,
        {
          exercise_id: ex.exercise_id,
          rating_value: 0,
          would_do_again: true,
          completed: ex.completed,
        },
      ])
    )
  );

  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);
  const [achievementIdsToMark, setAchievementIdsToMark] = useState<number[]>([]);

  // Current exercise being rated
  const currentExercise = exercises[currentIndex];
  const currentRating = ratings.get(currentExercise?.exercise_id);

  // Parse progress data for modal
  const parsedBeforeStats = beforeStats ? JSON.parse(beforeStats) : null;
  const parsedAfterStats = afterStats ? JSON.parse(afterStats) : null;
  const parsedWorkoutData = workoutData ? JSON.parse(workoutData) : null;

  const handleStarRating = (stars: number) => {
    if (!currentExercise) return;

    const updatedRatings = new Map(ratings);
    const existingRating = updatedRatings.get(currentExercise.exercise_id)!;
    updatedRatings.set(currentExercise.exercise_id, {
      ...existingRating,
      rating_value: stars,
    });
    setRatings(updatedRatings);
  };

  const handleDifficultySelect = (
    difficulty: 'too_easy' | 'appropriate' | 'challenging' | 'too_hard'
  ) => {
    if (!currentExercise) return;

    const updatedRatings = new Map(ratings);
    const existingRating = updatedRatings.get(currentExercise.exercise_id)!;
    updatedRatings.set(currentExercise.exercise_id, {
      ...existingRating,
      difficulty_perceived: difficulty,
    });
    setRatings(updatedRatings);
  };

  const handleNext = () => {
    // Validate current rating
    if (!currentRating || currentRating.rating_value === 0) {
      alert.warning('Rating Required', 'Please rate this exercise before continuing.');
      return;
    }

    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All exercises rated, submit
      submitRatings();
    }
  };

  const handleSkip = () => {
    // Skip without submitting ratings
    navigateToProgressModal();
  };

  const submitRatings = async () => {
    try {
      setSubmitting(true);

      // Convert ratings map to array
      const ratingsArray = Array.from(ratings.values()).filter(
        (rating) => rating.rating_value > 0 // Only submit rated exercises
      );

      if (ratingsArray.length === 0) {
        // No ratings, skip to progress modal
        navigateToProgressModal();
        return;
      }

      console.log('📊 [RATING] Submitting exercise ratings:', {
        count: ratingsArray.length,
        sessionId,
        userId: user?.id,
      });

      // Submit batch ratings
      await ratingService.submitExerciseRatingsBatch({
        user_id: Number(user?.id),
        session_id: Number(sessionId),
        workout_id: workoutId ? Number(workoutId) : undefined,
        ratings: ratingsArray,
      });

      console.log('✅ [RATING] Exercise ratings submitted successfully');

      // Show progress modal
      setShowProgressModal(true);
    } catch (error) {
      console.error('❌ [RATING] Failed to submit ratings:', error);
      alert.warning(
        'Submission Failed',
        'Failed to save your ratings, but your workout was saved.',
        navigateToProgressModal
      );
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToProgressModal = () => {
    // Show progress modal directly
    setShowProgressModal(true);
  };

  const handleProgressModalClose = async () => {
    setShowProgressModal(false);

    // Refresh progress store to update dashboard and progress page
    if (user?.id) {
      console.log('🔄 [RATING MODAL CLOSE] Refreshing progress store...');
      await refreshAfterWorkout(user.id);
      console.log('✅ [RATING MODAL CLOSE] Progress store refreshed');

      // Check for newly unlocked achievements
      console.log('🏆 [RATING MODAL CLOSE] Checking for unlocked achievements...');
      try {
        const newAchievements = await engagementService.checkAchievementsAfterWorkout(user.id);

        if (newAchievements && newAchievements.length > 0) {
          console.log('🏆 [RATING MODAL CLOSE] Found unlocked achievements:', newAchievements.length);

          // Extract user_achievement_ids for marking as seen later
          const idsToMark = newAchievements
            .filter((a: any) => a.user_achievement_id)
            .map((a: any) => a.user_achievement_id);
          setAchievementIdsToMark(idsToMark);

          // Map to the format expected by the modal
          const formattedAchievements: UnlockedAchievement[] = newAchievements.map((a: any) => ({
            achievement_id: a.achievement_id || a.achievement?.achievement_id,
            achievement_name: a.achievement_name || a.achievement?.achievement_name || 'Achievement',
            description: a.description || a.achievement?.description || 'Congratulations!',
            badge_icon: a.badge_icon || a.achievement?.badge_icon || 'trophy',
            badge_color: a.badge_color || a.achievement?.badge_color || '#F59E0B',
            rarity_level: a.rarity_level || a.achievement?.rarity_level || 'common',
            points_value: a.points_value || a.achievement?.points_value || a.points_earned || 100,
          }));

          setUnlockedAchievements(formattedAchievements);
          setShowAchievementModal(true);
          return; // Don't navigate yet, wait for achievement modal to close
        }
      } catch (error) {
        console.warn('🏆 [RATING MODAL CLOSE] Achievement check failed:', error);
        // Continue to navigation even if achievement check fails
      }
    }

    // Navigate to home tab and replace history to prevent going back
    router.replace('/(tabs)');
  };

  const handleAchievementModalClose = async () => {
    setShowAchievementModal(false);
    setUnlockedAchievements([]);

    // Mark achievements as seen so they don't show again on app reopen
    if (achievementIdsToMark.length > 0 && user?.id) {
      console.log('🏆 [RATING] Marking achievements as seen:', achievementIdsToMark);
      await engagementService.markAchievementsSeen(user.id, achievementIdsToMark);
      setAchievementIdsToMark([]);
    }

    // Now navigate to home tab
    router.replace('/(tabs)');
  };

  if (!currentExercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = ((currentIndex + 1) / exercises.length) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Rate Your Workout</Text>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Help us personalize your recommendations
        </Text>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Exercise {currentIndex + 1} of {exercises.length}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise Card */}
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <Ionicons name="barbell" size={24} color={COLORS.PRIMARY[600]} />
            <Text style={styles.exerciseName}>{currentExercise.exercise_name}</Text>
          </View>
          {currentExercise.target_muscle_group && (
            <View style={styles.muscleBadge}>
              <Ionicons name="body" size={14} color={COLORS.PRIMARY[600]} />
              <Text style={styles.muscleBadgeText}>
                {currentExercise.target_muscle_group}
              </Text>
            </View>
          )}
        </View>

        {/* Star Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>How would you rate this exercise?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => handleStarRating(star)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    currentRating && star <= currentRating.rating_value
                      ? 'star'
                      : 'star-outline'
                  }
                  size={48}
                  color={
                    currentRating && star <= currentRating.rating_value
                      ? '#FFD700'
                      : COLORS.NEUTRAL[300]
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
          {currentRating && currentRating.rating_value > 0 && (
            <Text style={styles.ratingFeedback}>
              {currentRating.rating_value === 5
                ? 'Excellent! 🎉'
                : currentRating.rating_value === 4
                ? 'Great! 👍'
                : currentRating.rating_value === 3
                ? 'Good 👌'
                : currentRating.rating_value === 2
                ? 'Okay'
                : 'Not great'}
            </Text>
          )}
        </View>

        {/* Difficulty Selection */}
        {currentRating && currentRating.rating_value > 0 && (
          <View style={styles.difficultySection}>
            <Text style={styles.difficultyLabel}>How was the difficulty?</Text>
            <View style={styles.difficultyButtons}>
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  currentRating.difficulty_perceived === 'too_easy' &&
                    styles.difficultyButtonActive,
                ]}
                onPress={() => handleDifficultySelect('too_easy')}
              >
                <Ionicons
                  name="chevron-down-circle"
                  size={20}
                  color={
                    currentRating.difficulty_perceived === 'too_easy'
                      ? COLORS.PRIMARY[600]
                      : COLORS.NEUTRAL[500]
                  }
                />
                <Text
                  style={[
                    styles.difficultyButtonText,
                    currentRating.difficulty_perceived === 'too_easy' &&
                      styles.difficultyButtonTextActive,
                  ]}
                >
                  Too Easy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  currentRating.difficulty_perceived === 'appropriate' &&
                    styles.difficultyButtonActive,
                ]}
                onPress={() => handleDifficultySelect('appropriate')}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={
                    currentRating.difficulty_perceived === 'appropriate'
                      ? COLORS.PRIMARY[600]
                      : COLORS.NEUTRAL[500]
                  }
                />
                <Text
                  style={[
                    styles.difficultyButtonText,
                    currentRating.difficulty_perceived === 'appropriate' &&
                      styles.difficultyButtonTextActive,
                  ]}
                >
                  Just Right
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  currentRating.difficulty_perceived === 'challenging' &&
                    styles.difficultyButtonActive,
                ]}
                onPress={() => handleDifficultySelect('challenging')}
              >
                <Ionicons
                  name="flame"
                  size={20}
                  color={
                    currentRating.difficulty_perceived === 'challenging'
                      ? COLORS.PRIMARY[600]
                      : COLORS.NEUTRAL[500]
                  }
                />
                <Text
                  style={[
                    styles.difficultyButtonText,
                    currentRating.difficulty_perceived === 'challenging' &&
                      styles.difficultyButtonTextActive,
                  ]}
                >
                  Challenging
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  currentRating.difficulty_perceived === 'too_hard' &&
                    styles.difficultyButtonActive,
                ]}
                onPress={() => handleDifficultySelect('too_hard')}
              >
                <Ionicons
                  name="chevron-up-circle"
                  size={20}
                  color={
                    currentRating.difficulty_perceived === 'too_hard'
                      ? COLORS.PRIMARY[600]
                      : COLORS.NEUTRAL[500]
                  }
                />
                <Text
                  style={[
                    styles.difficultyButtonText,
                    currentRating.difficulty_perceived === 'too_hard' &&
                      styles.difficultyButtonTextActive,
                  ]}
                >
                  Too Hard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!currentRating || currentRating.rating_value === 0) &&
              styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={
            !currentRating || currentRating.rating_value === 0 || submitting
          }
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentIndex < exercises.length - 1 ? 'Next Exercise' : 'Submit & Continue'}
              </Text>
              {currentIndex < exercises.length - 1 && (
                <Ionicons name="arrow-forward" size={20} color="white" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress Modal */}
      {showProgressModal && parsedBeforeStats && parsedAfterStats && parsedWorkoutData && (
        <ProgressUpdateModal
          visible={showProgressModal}
          onClose={handleProgressModalClose}
          beforeStats={parsedBeforeStats}
          afterStats={parsedAfterStats}
          workoutData={parsedWorkoutData}
        />
      )}

      {/* Achievement Unlock Modal */}
      <AchievementUnlockModal
        visible={showAchievementModal}
        achievements={unlockedAchievements}
        onClose={handleAchievementModalClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[600],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  exerciseName: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
  },
  muscleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  muscleBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textTransform: 'capitalize',
  },
  ratingSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[900],
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingFeedback: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  difficultySection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
  },
  difficultyLabel: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[900],
    marginBottom: 16,
  },
  difficultyButtons: {
    gap: 12,
  },
  difficultyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.NEUTRAL[300],
    backgroundColor: 'white',
  },
  difficultyButtonActive: {
    borderColor: COLORS.PRIMARY[600],
    backgroundColor: COLORS.PRIMARY[50],
  },
  difficultyButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[700],
  },
  difficultyButtonTextActive: {
    color: COLORS.PRIMARY[600],
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.PRIMARY[600],
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.NEUTRAL[300],
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
});
