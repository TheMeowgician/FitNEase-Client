import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { planningService, WeeklyWorkoutPlan, Exercise } from '@/services/microservices/planningService';
import { trackingService } from '@/services/microservices/trackingService';
import { format } from 'date-fns';
import { COLORS, FONTS, FONT_SIZES, GRADIENTS } from '@/constants/colors';
import { ExerciseCard } from '@/components/exercise/ExerciseCard';
import { useMLService } from '@/hooks/api/useMLService';
import { useProgressStore } from '../../stores/progressStore';
import { useRecommendationStore } from '../../stores/recommendationStore';

const { width } = Dimensions.get('window');

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface DayData {
  name: string;
  fullName: string;
  workouts: Exercise[];
  completed: boolean;
  isRestDay: boolean;
}

export default function WeeklyPlanScreen() {
  const { user } = useAuth();
  const { getRecommendations } = useMLService();

  // Use centralized progress store (same as Dashboard)
  const {
    weeklyStats,
    recentWorkouts,
    isLoading: isLoadingProgress,
    fetchAllProgressData,
    refreshAfterWorkout,
  } = useProgressStore();

  // Use centralized recommendation store for consistent exercises across all pages
  const {
    recommendations: todayRecommendations,
    isLoading: isLoadingRecommendations,
    fetchRecommendations,
  } = useRecommendationStore();

  // Local state for weekly plan exercises (separate from dashboard)
  const [weeklyExercises, setWeeklyExercises] = useState<any[]>([]);

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [expandedDay, setExpandedDay] = useState<DayOfWeek | null>(null);

  // Track completed days based on actual workout sessions
  const [completedDays, setCompletedDays] = useState<Set<DayOfWeek>>(new Set());

  // Track last completed workout count for auto-completion detection
  const lastCompletedCountRef = useRef<number>(0);

  const daysOfWeek: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  const dayFullNames = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  const userWorkoutDays = user?.workoutDays || [];
  const hasWorkoutDays = userWorkoutDays.length > 0;

  useEffect(() => {
    loadWeeklyPlan();
    checkCompletedDays(); // Check which days have completed workouts
  }, [user]);

  // Refresh progress data and check completed days when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [WEEKLY_PLAN] Screen focused - refreshing progress and checking completion');
        fetchAllProgressData(user.id);
        checkCompletedDays(); // Re-check completed days
      }
    }, [user, fetchAllProgressData])
  );

  // 🔥 NEW: Load ML recommendations for ALL workout days (to match Dashboard and Workouts)
  useEffect(() => {
    loadMLRecommendations();
  }, [user]);

  const loadMLRecommendations = async () => {
    if (!user) return;

    try {
      const userId = String(user.id);
      const fitnessLevel = user.fitnessLevel || 'beginner';
      const exercisesPerDay = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;
      const totalWorkoutDays = userWorkoutDays.length;

      // Calculate TOTAL exercises needed for ALL workout days (no repetition!)
      const totalExercisesNeeded = totalWorkoutDays * exercisesPerDay;

      console.log(`💪 [WEEKLY_PLAN] Fetching ${totalExercisesNeeded} exercises for ${totalWorkoutDays} workout days (${exercisesPerDay} per day)`);

      // Request enough exercises for ALL workout days
      const recommendationsResponse = await getRecommendations(userId, totalExercisesNeeded);

      // Handle both array and object response types
      const recs = Array.isArray(recommendationsResponse)
        ? recommendationsResponse
        : recommendationsResponse?.recommendations || [];

      if (recs && recs.length > 0) {
        console.log(`✅ [WEEKLY_PLAN] Received ${recs.length} unique exercises from ML (needed ${totalExercisesNeeded})`);

        // ✅ SAVE to local state for weekly plan
        setWeeklyExercises(recs);

        // 🐛 DEBUG: Log exercise distribution
        console.log(`🐛 [WEEKLY_PLAN DEBUG] Exercise distribution for ${totalWorkoutDays} days:`);
        for (let i = 0; i < totalWorkoutDays; i++) {
          const start = i * exercisesPerDay;
          const end = Math.min(start + exercisesPerDay, recs.length);
          const dayExercises = recs.slice(start, end);
          console.log(`  Day ${i + 1}: Exercises ${start}-${end - 1} → ${dayExercises.map((e: any) => e.exercise_name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('❌ [WEEKLY_PLAN] Failed to load ML recommendations:', error);
    }
  };

  /**
   * Check which days this week have completed workouts
   * Auto-detects workout completion without manual button press
   */
  const checkCompletedDays = async () => {
    if (!user) return;

    try {
      console.log('✅ [WEEKLY_PLAN] Checking completed workouts for this week...');

      // Get all completed workout sessions
      const userId = String(user.id);
      const sessions = await trackingService.getSessions({
        userId,
        status: 'completed',
        limit: 100, // Get recent sessions
      });

      // Get start and end of current week (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      console.log(`📅 [WEEKLY_PLAN] Week range: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

      // Filter sessions that occurred this week
      const thisWeekSessions = sessions.sessions.filter((session: any) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      });

      console.log(`✅ [WEEKLY_PLAN] Found ${thisWeekSessions.length} completed workouts this week`);

      // Map each session to the day of week it was completed
      const completed = new Set<DayOfWeek>();
      const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      thisWeekSessions.forEach((session: any) => {
        const sessionDate = new Date(session.createdAt);
        const dayIndex = sessionDate.getDay();
        const dayName = dayMap[dayIndex] as DayOfWeek;
        completed.add(dayName);
        console.log(`✅ [WEEKLY_PLAN] ${dayName.toUpperCase()} marked as completed (session: ${session.id})`);
      });

      setCompletedDays(completed);
      console.log(`✅ [WEEKLY_PLAN] Completed days:`, Array.from(completed));
    } catch (error) {
      console.error('❌ [WEEKLY_PLAN] Failed to check completed days:', error);
    }
  };

  const loadWeeklyPlan = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await planningService.getCurrentWeekPlan(parseInt(user.id));
      const plan = (response.data as any)?.plan || response.data;

      console.log('📅 [WEEKLY_PLAN] Loaded plan:', plan);
      console.log('📅 [WEEKLY_PLAN] Plan data:', plan?.plan_data);
      console.log('📅 [WEEKLY_PLAN] Monday exercises:', plan?.plan_data?.monday?.exercises);

      setWeeklyPlan(plan);
    } catch (error) {
      console.error('Failed to load weekly plan:', error);
      Alert.alert('Error', 'Failed to load weekly workout plan');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWeeklyPlan();
    setRefreshing(false);
  };

  const handleGeneratePlan = async (regenerate: boolean = false) => {
    if (!user?.id) return;

    // Check if user has set workout days
    if (!hasWorkoutDays) {
      Alert.alert(
        'Set Your Workout Days First',
        'Please configure your preferred workout days in Settings → Personalization → Workout Days before generating a plan.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => router.push('/settings/personalization/workout-days'),
          },
        ]
      );
      return;
    }

    try {
      setGeneratingPlan(true);
      const response = await planningService.generateWeeklyPlan({
        user_id: parseInt(user.id),
        regenerate,
      });
      const plan = (response.data as any)?.plan || response.data;
      setWeeklyPlan(plan);
      Alert.alert(
        'Success',
        regenerate ? 'New weekly plan generated!' : 'Your weekly plan is ready!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to generate plan:', error);
      Alert.alert('Error', 'Failed to generate weekly plan. Please try again.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleCompleteDay = async (day: DayOfWeek, silent: boolean = false) => {
    if (!weeklyPlan) return;

    try {
      const response = await planningService.completeDayWorkout(weeklyPlan.plan_id, day);
      const plan = (response.data as any)?.plan || response.data;
      setWeeklyPlan(plan);

      if (!silent) {
        Alert.alert('Great Job!', `${dayFullNames[day]}'s workout completed!`);
      } else {
        console.log(`✅ [WEEKLY_PLAN] ${dayFullNames[day]}'s workout auto-completed`);
      }
    } catch (error) {
      console.error('Failed to complete day:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to mark workout as complete');
      }
    }
  };

  // Normalize exercise data to handle field name variations
  const normalizeExercise = (exercise: any): Exercise => {
    return {
      workout_id: exercise.workout_id || 0,
      exercise_id: exercise.exercise_id || exercise.id || 0,
      exercise_name: exercise.exercise_name || exercise.name || 'Unknown Exercise',
      target_muscle_group: exercise.target_muscle_group || exercise.muscle_group || 'core',
      difficulty_level: exercise.difficulty_level || exercise.difficulty || 1,
      equipment_needed: exercise.equipment_needed || exercise.equipment || 'none',
      estimated_calories_burned: exercise.estimated_calories_burned || 28, // 4 min * 7 cal/min
      default_duration_seconds: exercise.default_duration_seconds || exercise.duration_seconds || 240,
      exercise_category: exercise.exercise_category || 'strength',
    };
  };

  const getDayData = (day: DayOfWeek): DayData => {
    const isScheduledWorkoutDay = userWorkoutDays.includes(day);
    const isTodayDay = isToday(day);

    // 🎯 Use auto-detected completion status from completed workouts
    const completed = completedDays.has(day);

    if (!weeklyPlan && weeklyExercises.length === 0) {
      return {
        name: dayNames[day],
        fullName: dayFullNames[day],
        workouts: [],
        completed,
        isRestDay: !isScheduledWorkoutDay,
      };
    }

    // 🔥 FIXED: Use UNIQUE exercises for each workout day (no repetition)
    let workouts: Exercise[];
    if (isScheduledWorkoutDay && weeklyExercises.length > 0) {
      // Use ML recommendations with SEQUENTIAL slicing to ensure NO repetition
      const fitnessLevel = user?.fitnessLevel || 'beginner';
      const exercisesPerDay = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;

      // Get the index of this day in the WORKOUT days list (not all days)
      const workoutDayIndex = userWorkoutDays.indexOf(day);

      // Calculate sequential start index for this workout day
      // Day 0: exercises 0-3 (or 0-4 or 0-5)
      // Day 1: exercises 4-7 (or 5-9 or 6-11) - NO OVERLAP!
      // Day 2: exercises 8-11 (or 10-14 or 12-17) - NO OVERLAP!
      const startIndex = workoutDayIndex * exercisesPerDay;
      const endIndex = Math.min(startIndex + exercisesPerDay, weeklyExercises.length);

      // Check if we have enough exercises
      if (startIndex < weeklyExercises.length) {
        workouts = weeklyExercises.slice(startIndex, endIndex).map(normalizeExercise);
        console.log(`💪 [WEEKLY_PLAN] ${day.toUpperCase()}: Using exercises ${startIndex}-${endIndex-1} (Workout Day ${workoutDayIndex + 1}/${userWorkoutDays.length})`);
      } else {
        // Not enough exercises, fallback to empty
        console.warn(`⚠️ [WEEKLY_PLAN] ${day.toUpperCase()}: Not enough exercises (need ${startIndex}+, have ${weeklyExercises.length})`);
        workouts = [];
      }
    } else {
      // Fallback to pre-planned exercises if ML recommendations not available
      const planData = (weeklyPlan as any)?.plan_data || {};
      const dayData = planData[day] || {};
      const rawExercises = dayData.exercises || [];
      workouts = rawExercises.map(normalizeExercise);
    }

    // DEBUG: Log first exercise ID for each day to verify uniqueness
    if (workouts.length > 0) {
      console.log(`📅 ${day.toUpperCase()}: ${workouts[0].exercise_name} (ID: ${workouts[0].exercise_id})${isTodayDay ? ' [TODAY]' : ''}${completed ? ' ✅' : ''}`);
    }

    return {
      name: dayNames[day],
      fullName: dayFullNames[day],
      workouts,
      completed,
      // Always use user's preferred workout days to determine rest days
      isRestDay: !isScheduledWorkoutDay,
    };
  };

  const getTodayDay = (): DayOfWeek | null => {
    const today = new Date().getDay();
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayMap[today] as DayOfWeek;
  };

  const isToday = (day: DayOfWeek): boolean => {
    return day === getTodayDay();
  };

  const getWorkoutIcon = (category: string): any => {
    const icons: Record<string, any> = {
      strength: 'barbell-outline',
      cardio: 'footsteps-outline',
      flexibility: 'body-outline',
      core: 'fitness-outline',
      balance: 'git-compare-outline',
    };
    return icons[category?.toLowerCase()] || 'fitness-outline';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Weekly Plan</Text>
              <Text style={styles.headerSubtitle}>Your AI-powered workout schedule</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading your weekly plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user has no workout days configured
  if (!hasWorkoutDays) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Weekly Plan</Text>
              <Text style={styles.headerSubtitle}>Your AI-powered workout schedule</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={64} color={COLORS.WARNING[500]} />
            </View>
            <Text style={styles.emptyTitle}>Configure Your Workout Days</Text>
            <Text style={styles.emptyDescription}>
              To generate your personalized weekly plan, please set your preferred workout days first.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/settings/personalization/workout-days')}
              style={styles.emptyButton}
            >
              <LinearGradient
                colors={GRADIENTS.PRIMARY as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <View style={styles.emptyButtonContent}>
                  <Ionicons name="settings-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.emptyButtonText}>Set Workout Days</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // No plan generated yet
  if (!weeklyPlan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Weekly Plan</Text>
              <Text style={styles.headerSubtitle}>Your AI-powered workout schedule</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={64} color={COLORS.PRIMARY[500]} />
            </View>
            <Text style={styles.emptyTitle}>Generate Your Weekly Plan</Text>
            <Text style={styles.emptyDescription}>
              Create your personalized weekly workout plan powered by AI based on your preferences and goals.
            </Text>
            <TouchableOpacity
              onPress={() => handleGeneratePlan(false)}
              disabled={generatingPlan}
              style={styles.emptyButton}
            >
              <LinearGradient
                colors={GRADIENTS.PRIMARY as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                {generatingPlan ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={styles.emptyButtonContent}>
                    <Ionicons name="sparkles" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.emptyButtonText}>Generate My Plan</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const totalWorkouts = weeklyPlan.total_workouts || 0;
  const completedWorkouts = weeklyPlan.completed_workouts || 0;
  const completionPercentage = weeklyPlan.completion_percentage || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Weekly Plan</Text>
            <Text style={styles.headerSubtitle}>
              {format(new Date(weeklyPlan.week_start_date), 'MMM d')} - {format(new Date(weeklyPlan.week_end_date), 'MMM d, yyyy')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY[600]} />
        }
      >
        {/* This Week's Progress Stats (same as Dashboard) */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Text style={styles.sectionHeader}>This Week's Progress</Text>
            <View style={styles.weekBadge}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.PRIMARY[600]} />
              <Text style={styles.weekBadgeText}>Week {(() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const diff = now.getTime() - start.getTime();
                const oneWeek = 1000 * 60 * 60 * 24 * 7;
                return Math.ceil(diff / oneWeek);
              })()}</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <View style={[styles.statIconCircle, { backgroundColor: '#10B981' + '15' }]}>
                <Ionicons name="barbell" size={20} color="#10B981" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Workouts</Text>
                <Text style={styles.statValue}>{weeklyStats?.this_week_sessions || 0} sessions</Text>
              </View>
            </View>
            <View style={styles.statDividerHorizontal} />
            <View style={styles.statRow}>
              <View style={[styles.statIconCircle, { backgroundColor: '#F59E0B' + '15' }]}>
                <Ionicons name="flame" size={20} color="#F59E0B" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Calories Burned</Text>
                <Text style={styles.statValue}>{Math.round(weeklyStats?.total_calories_burned || 0).toLocaleString()} cal</Text>
              </View>
            </View>
            <View style={styles.statDividerHorizontal} />
            <View style={styles.statRow}>
              <View style={[styles.statIconCircle, { backgroundColor: '#3B82F6' + '15' }]}>
                <Ionicons name="time" size={20} color="#3B82F6" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Exercise Time</Text>
                <Text style={styles.statValue}>
                  {Math.floor((weeklyStats?.total_exercise_time || 0) / 60)}h {(weeklyStats?.total_exercise_time || 0) % 60}m
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plan Completion Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Ionicons name="analytics" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.progressTitle}>Weekly Progress</Text>
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.progressPercentage}>{Math.round(completionPercentage)}%</Text>
            <Text style={styles.progressLabel}>
              {completedWorkouts} of {totalWorkouts} days completed
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
          </View>
        </View>

        {/* Workout Schedule Card - Circular Design */}
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeaderRow}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.scheduleTitle}>Your Workout Schedule</Text>
          </View>

          {/* Circular Day Indicators */}
          <View style={styles.weekContainer}>
            {daysOfWeek.map((day) => {
              const dayData = getDayData(day);
              const isTodayDay = isToday(day);
              const isScheduled = !dayData.isRestDay;
              return (
                <View key={day} style={styles.dayCircleWrapper}>
                  <View
                    style={[
                      styles.dayCircle,
                      isTodayDay && styles.dayCircleToday,
                      isScheduled && !isTodayDay && styles.dayCircleScheduled,
                      dayData.completed && styles.dayCircleCompleted,
                    ]}
                  >
                    {dayData.completed ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.SUCCESS[600]} />
                    ) : !isScheduled ? (
                      <Ionicons name="moon" size={12} color={COLORS.SECONDARY[400]} />
                    ) : null}
                  </View>
                  <Text style={[styles.dayCircleLabel, isTodayDay && styles.dayCircleLabelToday]}>
                    {dayNames[day]}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.scheduleSummary}>
            <Ionicons name="fitness-outline" size={16} color={COLORS.SECONDARY[600]} />
            <Text style={styles.scheduleSummaryText}>
              {userWorkoutDays.length} workout day{userWorkoutDays.length !== 1 ? 's' : ''} • {7 - userWorkoutDays.length} rest day{7 - userWorkoutDays.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Days Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="calendar" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>This Week</Text>
          </View>

          <View style={styles.daysContainer}>
            {daysOfWeek.map((day) => {
              const dayData = getDayData(day);
              const isExpanded = expandedDay === day;
              const isTodayDay = isToday(day);

              // Rest day card
              if (dayData.isRestDay) {
                return (
                  <View key={day} style={styles.dayWrapper}>
                    <View style={[styles.dayCard, styles.restDayCard]}>
                      <View style={styles.dayCardContent}>
                        <View style={[styles.dayIndicator, styles.restDayIndicator]}>
                          <Ionicons name="moon-outline" size={24} color={COLORS.SECONDARY[500]} />
                        </View>

                        <View style={styles.dayInfo}>
                          <View style={styles.dayTitleRow}>
                            <Text style={styles.dayTitle}>{dayData.fullName}</Text>
                            {isTodayDay && (
                              <View style={[styles.todayBadge, styles.restDayBadge]}>
                                <Text style={styles.restDayBadgeText}>TODAY</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.dayMetaRow}>
                            <Ionicons name="battery-charging-outline" size={14} color={COLORS.SECONDARY[500]} />
                            <Text style={styles.restDayMeta}>Rest & Recovery Day</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }

              // Workout day card
              return (
                <View key={day} style={styles.dayWrapper}>
                  <TouchableOpacity
                    onPress={() => setExpandedDay(isExpanded ? null : day)}
                    style={[
                      styles.dayCard,
                      dayData.completed && styles.dayCardCompleted,
                      isTodayDay && !dayData.completed && styles.dayCardToday,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayCardContent}>
                      <View style={[
                        styles.dayIndicator,
                        dayData.completed && styles.dayIndicatorCompleted,
                        isTodayDay && !dayData.completed && styles.dayIndicatorToday,
                      ]}>
                        {dayData.completed ? (
                          <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />
                        ) : isTodayDay ? (
                          <View style={styles.todayDot} />
                        ) : (
                          <Text style={styles.dayIndicatorText}>{dayData.name}</Text>
                        )}
                      </View>

                      <View style={styles.dayInfo}>
                        <View style={styles.dayTitleRow}>
                          <Text style={styles.dayTitle}>{dayData.fullName}</Text>
                          {isTodayDay && !dayData.completed && (
                            <View style={styles.todayBadge}>
                              <Text style={styles.todayBadgeText}>TODAY</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.dayMetaRow}>
                          <Ionicons name="fitness-outline" size={14} color={COLORS.SECONDARY[500]} />
                          <Text style={styles.dayMeta}>
                            {dayData.workouts.length} exercise{dayData.workouts.length !== 1 ? 's' : ''}
                          </Text>
                          {dayData.completed && (
                            <>
                              <Text style={styles.dayMetaDivider}>•</Text>
                              <Text style={styles.dayMetaCompleted}>Completed</Text>
                            </>
                          )}
                        </View>
                      </View>

                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={COLORS.SECONDARY[400]}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Content - Exercise List */}
                  {isExpanded && dayData.workouts.length > 0 && (
                    <View style={styles.exercisesContainer}>
                      {dayData.workouts.map((exercise, idx) => (
                        <ExerciseCard
                          key={`${day}-${exercise.exercise_id}-${idx}`}
                          exercise={exercise}
                          index={idx}
                          showCompletionIcon={true}
                        />
                      ))}

                      {/* Completion Status - Auto-detected from completed workouts */}
                      {dayData.completed ? (
                        <View style={styles.completionStatusContainer}>
                          <LinearGradient
                            colors={['#10B981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.completionStatusGradient}
                          >
                            <Ionicons name="checkmark-circle" size={32} color="white" />
                            <View style={styles.completionStatusText}>
                              <Text style={styles.completionStatusTitle}>Workout Completed!</Text>
                              <Text style={styles.completionStatusSubtitle}>Great job finishing your workout</Text>
                            </View>
                          </LinearGradient>
                        </View>
                      ) : (
                        <View style={styles.incompletionStatusContainer}>
                          <View style={styles.incompletionStatusContent}>
                            <Ionicons name="time-outline" size={24} color={COLORS.SECONDARY[400]} />
                            <Text style={styles.incompletionStatusText}>
                              Complete your workout to mark this day as done
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  // This Week's Progress Stats Section (same styles as Dashboard)
  statsSection: {
    marginBottom: 20,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  weekBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[700],
  },
  statsCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 2,
  },
  statValue: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  statDividerHorizontal: {
    height: 1,
    backgroundColor: COLORS.NEUTRAL[200],
    marginHorizontal: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    width: '100%',
  },
  emptyButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  progressCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  progressTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  progressStats: {
    marginBottom: 16,
  },
  progressPercentage: {
    fontSize: FONT_SIZES.DISPLAY_SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 4,
  },
  scheduleCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  scheduleTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  dayCircleWrapper: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: COLORS.NEUTRAL[100],
  },
  dayCircleToday: {
    backgroundColor: COLORS.PRIMARY[600],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[600],
  },
  dayCircleScheduled: {
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[500],
  },
  dayCircleCompleted: {
    backgroundColor: COLORS.SUCCESS[50],
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[500],
  },
  dayCircleLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  dayCircleLabelToday: {
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  scheduleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleSummaryText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  daysContainer: {
    gap: 12,
  },
  dayWrapper: {
    marginBottom: 4,
  },
  dayCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCardCompleted: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[500],
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[500],
  },
  restDayCard: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
  },
  dayCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.NEUTRAL[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dayIndicatorCompleted: {
    backgroundColor: COLORS.SUCCESS[50],
  },
  dayIndicatorToday: {
    backgroundColor: COLORS.PRIMARY[50],
  },
  restDayIndicator: {
    backgroundColor: COLORS.NEUTRAL[100],
  },
  dayIndicatorText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
  },
  todayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.PRIMARY[600],
  },
  dayInfo: {
    flex: 1,
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  todayBadge: {
    backgroundColor: COLORS.PRIMARY[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  restDayBadge: {
    backgroundColor: COLORS.NEUTRAL[200],
  },
  todayBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[700],
  },
  restDayBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
  },
  dayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayMeta: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  restDayMeta: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  dayMetaDivider: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginHorizontal: 4,
  },
  dayMetaCompleted: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[600],
  },
  exercisesContainer: {
    marginTop: 12,
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    padding: 12,
  },
  // Completion Status Styles (replaces old complete button)
  completionStatusContainer: {
    marginTop: 16,
  },
  completionStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completionStatusText: {
    marginLeft: 16,
    flex: 1,
  },
  completionStatusTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginBottom: 2,
  },
  completionStatusSubtitle: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  incompletionStatusContainer: {
    marginTop: 16,
  },
  incompletionStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  incompletionStatusText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginLeft: 12,
    flex: 1,
  },
});
