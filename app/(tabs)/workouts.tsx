import React, { useState, useEffect } from 'react';
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
import { router } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { usePlanningService } from '../../hooks/api/usePlanningService';
import { trackingService } from '../../services/microservices/trackingService';
import { WorkoutSetModal } from '../../components/workout/WorkoutSetModal';
import { COLORS, FONTS } from '../../constants/colors';

// ====================================================================
// 🧪 TESTING FLAG: Daily Workout Limit Control
// ====================================================================
const ENABLE_DAILY_WORKOUT_LIMIT = false; // 🧪 TESTING MODE - UNLIMITED WORKOUTS
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

  useEffect(() => {
    loadWorkoutData();
  }, []);

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

      const todaySession = sessions.sessions.find((session: any) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= todayStart && sessionDate <= todayEnd;
      });

      setIsTodayWorkoutCompleted(!!todaySession);
    } catch (error) {
      console.error('Failed to check workout completion:', error);
      setIsTodayWorkoutCompleted(false);
    }
  };

  const loadWorkoutData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const userId = String(user.id);
      const todayExercises = await getTodayExercises(userId);
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

  const handleViewWorkoutSet = () => {
    if (!exercises || exercises.length === 0) {
      alert.info('No Exercises', 'No exercises available for today.');
      return;
    }

    const fitnessLevel = user?.fitnessLevel || 'beginner';
    const exerciseCount = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;
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
    setShowWorkoutSetModal(true);
  };

  const handleStartWorkoutSet = () => {
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

  const getWorkoutStats = () => {
    const fitnessLevel = user?.fitnessLevel || 'beginner';
    const exerciseCount = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;
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
          isTodayWorkoutCompleted ? (
            <View style={styles.completedCard}>
              <View style={styles.completedIconContainer}>
                <Ionicons name="checkmark-circle" size={72} color={COLORS.SUCCESS[500]} />
              </View>
              <Text style={styles.completedTitle}>Workout Complete!</Text>
              <Text style={styles.completedText}>
                Great job! You've finished your Tabata workout for today. Come back tomorrow for your next session.
              </Text>
              <View style={styles.completedBadge}>
                <Ionicons name="trophy" size={20} color={COLORS.WARNING[500]} />
                <Text style={styles.completedBadgeText}>Keep your streak going!</Text>
              </View>
            </View>
          ) : exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="fitness-outline" size={64} color={COLORS.NEUTRAL[300]} />
              <Text style={styles.emptyTitle}>No Exercises Available</Text>
              <Text style={styles.emptyText}>
                Your workout plan is being prepared. Pull down to refresh.
              </Text>
            </View>
          ) : (
            <>
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
              >
                {/* Card Header */}
                <View style={styles.workoutCardHeader}>
                  <View style={styles.workoutIconContainer}>
                    <Ionicons name="flash" size={32} color={COLORS.NEUTRAL.WHITE} />
                  </View>
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
  workoutIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.SUCCESS[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
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

  // Completed Card
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
