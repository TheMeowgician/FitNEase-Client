import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { usePlanningService } from '../../hooks/api/usePlanningService';
import { trackingService } from '../../services/microservices/trackingService';
import { getExerciseCountForLevel } from '../../services/workoutSessionGenerator';
import { WorkoutSetModal } from '../../components/workout/WorkoutSetModal';
import { COLORS, FONTS } from '../../constants/colors';

// ====================================================================
// 🧪 TESTING FLAG: Daily Workout Limit Control
// ====================================================================
const ENABLE_DAILY_WORKOUT_LIMIT = true;
// ====================================================================

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const { getTodayExercises } = usePlanningService();

  const [exercises, setExercises] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWorkoutSetModal, setShowWorkoutSetModal] = useState(false);
  const [currentWorkoutSet, setCurrentWorkoutSet] = useState<any>(null);
  const [isTodayWorkoutCompleted, setIsTodayWorkoutCompleted] = useState(false);
  const [completedSessionCount, setCompletedSessionCount] = useState(0); // For progressive overload

  const [isViewingWorkoutSet, setIsViewingWorkoutSet] = useState(false);

  // NEW: State for workout customization (advanced/mentor users)
  const [alternativePool, setAlternativePool] = useState<any[]>([]);

  // NEW: Determine if user can customize based on fitness level
  const canCustomize = user?.fitnessLevel === 'advanced';

  useEffect(() => {
    loadWorkoutData();
  }, []);

  // Refresh completion status when returning to this screen (e.g. after finishing a workout)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        checkTodayWorkoutCompletion();
      }
    }, [user])
  );

  const isWorkoutDay = () => {
    if (!user?.workoutDays || user.workoutDays.length === 0) {
      return true;
    }
    const today = new Date().getDay();
    const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = DAYS_OF_WEEK[today];
    return user.workoutDays.includes(todayName);
  };

  const checkTodayWorkoutCompletion = async () => {
    if (!user) return;

    if (!ENABLE_DAILY_WORKOUT_LIMIT) {
      setIsTodayWorkoutCompleted(false);
      return;
    }

    try {
      const userId = String(user.id);
      const sessions = await trackingService.getSessions({
        userId,
        status: 'completed',
        limit: 50,
      });

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Count total individual sessions for progressive overload
      const individualSessions = sessions.sessions.filter((s: any) => s.sessionType !== 'group');
      setCompletedSessionCount(individualSessions.length);

      // Only count individual sessions — group workouts don't mark the day complete
      const todaySession = individualSessions.find((session: any) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= todayStart && sessionDate <= todayEnd;
      });

      setIsTodayWorkoutCompleted(!!todaySession);
    } catch (error) {
      console.error('Failed to check workout completion:', error);
      setIsTodayWorkoutCompleted(false);
    }
  };

  const fetchSessionCount = async (): Promise<number> => {
    try {
      const sessions = await trackingService.getSessions({
        userId: String(user?.id),
        status: 'completed',
        limit: 50,
      });
      const individual = (sessions?.sessions || []).filter((s: any) => s.sessionType !== 'group');
      return individual.length;
    } catch {
      return 0;
    }
  };

  const loadWorkoutData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const userId = String(user.id);

      // Fetch session count first so PHP can detect progressive overload tier changes
      const sessionCount = await fetchSessionCount();
      setCompletedSessionCount(sessionCount);

      const todayExercises = await getTodayExercises(userId, sessionCount);
      setExercises(todayExercises || []);
      await checkTodayWorkoutCompletion();
    } catch (error) {
      console.error('Error loading workout data:', error);
      alert.error('Error', 'Failed to load workouts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkoutData();
    setRefreshing(false);
  };

  const handleViewWorkoutSet = async () => {
    if (isViewingWorkoutSet) return;
    if (!exercises || exercises.length === 0) {
      alert.info('No Exercises', 'No exercises available for today.');
      return;
    }

    setIsViewingWorkoutSet(true);
    try {
      const fitnessLevel = user?.fitnessLevel || 'beginner';
      // Exercise count uses progressive overload based on completed session count
      const exerciseCount = getExerciseCountForLevel(fitnessLevel, completedSessionCount);
      const workoutExercises = exercises.slice(0, Math.min(exerciseCount, exercises.length));

      const totalDuration = workoutExercises.length * 4;
      const totalCalories = workoutExercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 28), 0);

      const workoutSet = {
        exercises: workoutExercises,
        total_duration: totalDuration,
        total_calories: totalCalories,
        difficulty: fitnessLevel,
      };

      setCurrentWorkoutSet(workoutSet);

      // Fetch alternatives for advanced/expert users to enable customization
      if (canCustomize && user) {
        try {
          console.log('[WORKOUTS] Fetching alternatives for customization...');
          const { mlService } = await import('../../services/microservices/mlService');
          const response = await mlService.getRecommendations(String(user.id), {
            num_recommendations: 6,
            include_alternatives: true,
            num_alternatives: 6,
          });

          if (response?.alternative_pool && response.alternative_pool.length > 0) {
            // Filter out exercises that are already in the workout
            const workoutExerciseIds = new Set(workoutExercises.map((ex: any) => ex.exercise_id));
            const filteredAlternatives = response.alternative_pool.filter(
              (alt: any) => !workoutExerciseIds.has(alt.exercise_id)
            );
            setAlternativePool(filteredAlternatives);
            console.log(`[WORKOUTS] Loaded ${filteredAlternatives.length} alternatives for customization`);
          }
        } catch (error) {
          console.error('[WORKOUTS] Failed to fetch alternatives:', error);
          // Continue without alternatives - swap feature just won't be available
        }
      }

      setShowWorkoutSetModal(true);
    } finally {
      setIsViewingWorkoutSet(false);
    }
  };

  const doStartWorkoutSet = () => {
    if (!currentWorkoutSet || !user) return;

    setShowWorkoutSetModal(false);

    const session = {
      session_id: `tabata_${user.id}_${Date.now()}`,
      session_name: 'Tabata Workout',
      difficulty_level: currentWorkoutSet.difficulty || user.fitnessLevel || 'beginner',
      total_exercises: currentWorkoutSet.exercises.length,
      total_duration_minutes: currentWorkoutSet.total_duration,
      estimated_calories: currentWorkoutSet.total_calories,
      exercises: currentWorkoutSet.exercises,
      created_at: new Date().toISOString(),
    };

    router.push({
      pathname: '/workout/session',
      params: {
        sessionData: JSON.stringify(session),
        type: 'tabata'
      }
    });
  };

  const handleStartWorkoutSet = () => {
    if (isTodayWorkoutCompleted) {
      alert.confirm(
        'Already Completed Today',
        "You've already finished today's workout plan! Would you like to do another Tabata set?",
        () => doStartWorkoutSet(),
        undefined,
        "Let's Go!",
        'Not Now'
      );
      return;
    }
    doStartWorkoutSet();
  };

  // NEW: Handler for exercise swap (customization feature for advanced/mentor users)
  const handleExerciseSwap = (exerciseIndex: number, newExercise: any) => {
    if (!currentWorkoutSet) return;

    // Create a copy of the workout set with the swapped exercise
    const updatedExercises = [...currentWorkoutSet.exercises];
    updatedExercises[exerciseIndex] = newExercise;

    // Recalculate totals
    const totalCalories = updatedExercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 28), 0);

    setCurrentWorkoutSet({
      ...currentWorkoutSet,
      exercises: updatedExercises,
      total_calories: totalCalories,
    });

    // Remove swapped exercise from alternative pool to prevent duplicate swaps
    setAlternativePool(prev => prev.filter(ex => ex.exercise_id !== newExercise.exercise_id));

    console.log(`[WORKOUTS] Swapped exercise at index ${exerciseIndex} with ${newExercise.exercise_name}`);
  };

  const getWorkoutStats = () => {
    const fitnessLevel = user?.fitnessLevel || 'beginner';
    const exerciseCount = getExerciseCountForLevel(fitnessLevel, completedSessionCount);
    const workoutExercises = exercises.slice(0, Math.min(exerciseCount, exercises.length));

    const totalDuration = workoutExercises.length * 4;
    const totalCalories = workoutExercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 28), 0);

    const muscleGroups = new Set<string>();
    workoutExercises.forEach((ex: any) => {
      if (ex.target_muscle_group) {
        ex.target_muscle_group.split(',').forEach((mg: string) => muscleGroups.add(mg.trim()));
      }
    });

    let targetArea = 'Full Body';
    const uniqueGroups = Array.from(muscleGroups);
    if (uniqueGroups.length > 0 && uniqueGroups.length < 3) {
      targetArea = uniqueGroups
        .map((g: string) => g.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
        .join(' & ');
    }

    return { exerciseCount: workoutExercises.length, totalDuration, totalCalories, targetArea };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Workouts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading your workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stats = getWorkoutStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workouts</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={COLORS.PRIMARY[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isWorkoutDay() ? (
          exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="fitness-outline" size={64} color={COLORS.NEUTRAL[300]} />
              <Text style={styles.emptyTitle}>No Exercises Available</Text>
              <Text style={styles.emptyText}>
                Your workout plan is being prepared. Pull down to refresh.
              </Text>
            </View>
          ) : (
            <>
              {/* Completed Today Banner */}
              {isTodayWorkoutCompleted && (
                <View style={styles.completedTodayBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS[500]} />
                  <Text style={styles.completedTodayBannerText}>Completed Today!</Text>
                  <Text style={styles.completedTodayBannerSub}>Tap to do another set</Text>
                </View>
              )}

              {/* Today's Workout Card */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today's Tabata</Text>
                <View style={styles.personalizedBadge}>
                  <Ionicons name="sparkles" size={14} color={COLORS.SUCCESS[600]} />
                  <Text style={styles.personalizedText}>Personalized</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.workoutCard}
                onPress={handleViewWorkoutSet}
                activeOpacity={0.9}
                disabled={isViewingWorkoutSet}
              >
                {/* Card Header */}
                <View style={styles.workoutCardHeader}>
                  <View style={styles.workoutCardTitleContainer}>
                    <Text style={styles.workoutCardTitle}>Tabata Workout</Text>
                    <Text style={styles.workoutCardSubtitle}>
                      {stats.exerciseCount} exercises • {stats.targetArea}
                    </Text>
                  </View>
                </View>

                {/* Exercise Preview */}
                <View style={styles.exercisePreview}>
                  {exercises.slice(0, 4).map((exercise, index) => (
                    <View key={exercise.exercise_id || index} style={styles.exercisePreviewItem}>
                      <View style={styles.exercisePreviewNumber}>
                        <Text style={styles.exercisePreviewNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.exercisePreviewName} numberOfLines={1}>
                        {exercise.exercise_name}
                      </Text>
                    </View>
                  ))}
                  {exercises.length > 4 && (
                    <Text style={styles.moreExercisesText}>
                      +{Math.min(exercises.length, stats.exerciseCount) - 4} more
                    </Text>
                  )}
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={18} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.statValue}>{stats.totalDuration} min</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="flame-outline" size={18} color={COLORS.WARNING[500]} />
                    <Text style={styles.statValue}>~{stats.totalCalories} cal</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="fitness-outline" size={18} color={COLORS.SUCCESS[500]} />
                    <Text style={styles.statValue}>{stats.exerciseCount} sets</Text>
                  </View>
                </View>

                {/* Start Button */}
                <View style={styles.startButton}>
                  <Text style={styles.startButtonText}>View & Start Workout</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.NEUTRAL.WHITE} />
                </View>
              </TouchableOpacity>

              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.PRIMARY[600]} />
                <Text style={styles.infoText}>
                  Each exercise follows Tabata protocol: 20 seconds work, 10 seconds rest, 8 rounds per exercise.
                </Text>
              </View>
            </>
          )
        ) : (
          <View style={styles.restDayCard}>
            <View style={styles.restDayIconContainer}>
              <Ionicons name="moon" size={64} color={COLORS.NEUTRAL[400]} />
            </View>
            <Text style={styles.restDayTitle}>Rest Day</Text>
            <Text style={styles.restDayText}>
              Your body needs time to recover and build strength. Enjoy your rest day!
            </Text>
            <Text style={styles.restDaySubtext}>
              Come back on your next scheduled workout day.
            </Text>
          </View>
        )}
      </ScrollView>

      <WorkoutSetModal
        visible={showWorkoutSetModal}
        onClose={() => setShowWorkoutSetModal(false)}
        workoutSet={currentWorkoutSet}
        onStartWorkout={handleStartWorkoutSet}
        // NEW: Customization props for advanced/mentor users
        alternativePool={alternativePool}
        canCustomize={canCustomize}
        onExerciseSwap={handleExerciseSwap}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL[50],
  },
  header: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  personalizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[50],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  personalizedText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[600],
  },

  // Workout Card
  workoutCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  workoutCardTitleContainer: {
    flex: 1,
  },
  workoutCardTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
  },
  workoutCardSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    marginTop: 2,
  },

  // Exercise Preview
  exercisePreview: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  exercisePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  exercisePreviewNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exercisePreviewNumberText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[700],
  },
  exercisePreviewName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[700],
  },
  moreExercisesText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'center',
    paddingTop: 8,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[100],
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[700],
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.NEUTRAL[200],
  },

  // Start Button
  startButton: {
    backgroundColor: COLORS.PRIMARY[600],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.PRIMARY[50],
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[700],
    lineHeight: 18,
  },

  // Completed Today Banner
  completedTodayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedTodayBannerText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: '#065F46',
    flex: 1,
  },
  completedTodayBannerSub: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#047857',
  },

  // Completed Card (kept for legacy reference)
  completedCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  completedIconContainer: {
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
    marginBottom: 8,
  },
  completedText: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[50],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  completedBadgeText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[700],
  },

  // Empty Card
  emptyCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    textAlign: 'center',
  },

  // Rest Day Card
  restDayCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  restDayIconContainer: {
    marginBottom: 20,
  },
  restDayTitle: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[800],
    marginBottom: 12,
  },
  restDayText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  restDaySubtext: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[400],
    textAlign: 'center',
  },
});
