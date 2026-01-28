import { useState, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { router, useFocusEffect } from 'expo-router';
import { planningService, WeeklyWorkoutPlan, Exercise } from '@/services/microservices/planningService';
import { trackingService } from '@/services/microservices/trackingService';
import { format, startOfWeek, addDays, isSameDay, isToday as isDateToday } from 'date-fns';
import { COLORS, FONTS, FONT_SIZES } from '@/constants/colors';
import { WeekCalendarStrip } from '@/components/calendar/WeekCalendarStrip';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface DayData {
  date: Date;
  dayName: DayOfWeek;
  shortName: string;
  workouts: Exercise[];
  completed: boolean;
  isRestDay: boolean;
  isToday: boolean;
}

export default function WeeklyPlanScreen() {
  const { user } = useAuth();
  const alert = useAlert();

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Track completed days based on actual workout sessions
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());

  const dayNameMap: Record<number, DayOfWeek> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  const shortDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDayNames: Record<DayOfWeek, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  // Helper function to format muscle group text (e.g., "lower_body" → "Lower Body")
  const formatMuscleGroup = (text: string): string => {
    if (!text) return 'Full body';
    return text
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const userWorkoutDays = user?.workoutDays || [];
  const hasWorkoutDays = userWorkoutDays.length > 0;


  useEffect(() => {
    loadWeeklyPlan();
    checkCompletedDays();
  }, [user, currentWeekStart]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        checkCompletedDays();
      }
    }, [user])
  );

  const checkCompletedDays = async () => {
    if (!user) return;

    try {
      const userId = String(user.id);
      const sessions = await trackingService.getSessions({
        userId,
        status: 'completed',
        limit: 100,
      });

      // Get week boundaries
      const weekEnd = addDays(currentWeekStart, 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Filter sessions for this week and map to date strings
      const completed = new Set<string>();
      sessions.sessions.forEach((session: any) => {
        const sessionDate = new Date(session.createdAt);
        if (sessionDate >= currentWeekStart && sessionDate <= weekEnd) {
          completed.add(format(sessionDate, 'yyyy-MM-dd'));
        }
      });

      setCompletedDays(completed);
    } catch (error) {
      console.error('Failed to check completed days:', error);
    }
  };

  const loadWeeklyPlan = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      // Always fetch current week's plan (auto-generates if needed)
      const response = await planningService.getCurrentWeekPlan(parseInt(user.id));
      const plan = (response.data as any)?.plan || response.data;
      setWeeklyPlan(plan);
    } catch (error) {
      console.error('Failed to load weekly plan:', error);
      setWeeklyPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWeeklyPlan();
    await checkCompletedDays();
    setRefreshing(false);
  };

  const handleGeneratePlan = async (regenerate: boolean = false) => {
    if (!user?.id) return;

    if (!hasWorkoutDays) {
      alert.confirm(
        'Set Your Workout Days First',
        'Please configure your preferred workout days in Settings before generating a plan.',
        () => router.push('/settings/personalization/workout-days'),
        undefined,
        'Go to Settings',
        'Cancel'
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
      alert.success('Success', regenerate ? 'New weekly plan generated!' : 'Your weekly plan is ready!');
    } catch (error) {
      console.error('Failed to generate plan:', error);
      alert.error('Error', 'Failed to generate weekly plan. Please try again.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Normalize exercise data
  const normalizeExercise = (exercise: any): Exercise => ({
    workout_id: exercise.workout_id || 0,
    exercise_id: exercise.exercise_id || exercise.id || 0,
    exercise_name: exercise.exercise_name || exercise.name || 'Unknown Exercise',
    target_muscle_group: exercise.target_muscle_group || exercise.muscle_group || 'core',
    difficulty_level: exercise.difficulty_level || exercise.difficulty || 1,
    equipment_needed: exercise.equipment_needed || exercise.equipment || 'none',
    estimated_calories_burned: exercise.estimated_calories_burned || 28,
    default_duration_seconds: exercise.default_duration_seconds || exercise.duration_seconds || 240,
    exercise_category: exercise.exercise_category || 'strength',
  });

  // Generate week days data
  const getWeekDays = (): DayData[] => {
    const days: DayData[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(currentWeekStart, i);
      const dayName = dayNameMap[date.getDay()];
      const dateStr = format(date, 'yyyy-MM-dd');
      const isScheduledWorkoutDay = userWorkoutDays.includes(dayName);

      // Get exercises from plan
      const planData = (weeklyPlan as any)?.plan_data || {};
      const dayData = planData[dayName] || {};
      const rawExercises = dayData.exercises || [];
      const workouts: Exercise[] = rawExercises.map(normalizeExercise);

      days.push({
        date,
        dayName,
        shortName: shortDayNames[i],
        workouts,
        completed: completedDays.has(dateStr),
        isRestDay: !isScheduledWorkoutDay,
        isToday: isDateToday(date),
      });
    }

    return days;
  };

  const weekDays = getWeekDays();
  const selectedDayData = weekDays.find(d => isSameDay(d.date, selectedDate)) || weekDays.find(d => d.isToday) || weekDays[0];

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading your weekly plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No workout days configured
  if (!hasWorkoutDays) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.PRIMARY[500]} />
          </View>
          <Text style={styles.emptyTitle}>Set Up Your Schedule</Text>
          <Text style={styles.emptyDescription}>
            Choose which days you want to work out to generate your personalized weekly plan.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/settings/personalization/workout-days')}
          >
            <Text style={styles.primaryButtonText}>Set Workout Days</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No plan generated yet
  if (!weeklyPlan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="sparkles-outline" size={48} color={COLORS.PRIMARY[500]} />
          </View>
          <Text style={styles.emptyTitle}>Generate Your Plan</Text>
          <Text style={styles.emptyDescription}>
            Create an AI-powered weekly workout plan based on your fitness goals and preferences.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleGeneratePlan(false)}
            disabled={generatingPlan}
          >
            {generatingPlan ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Generate Plan</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate completion stats
  const completedCount = weekDays.filter(d => d.completed && !d.isRestDay).length;
  const workoutDaysCount = weekDays.filter(d => !d.isRestDay).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header - Consistent with Dashboard */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Plan</Text>
      </View>

      {/* Calendar Week Strip - Current week only, no navigation */}
      <WeekCalendarStrip
        weekStart={currentWeekStart}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        showNavigation={false}
        workoutDays={userWorkoutDays}
        completedDates={completedDays}
        showProgress={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.PRIMARY[600]}
          />
        }
      >
        {/* Selected Day Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {fullDayNames[selectedDayData.dayName]}
          </Text>
          <View style={styles.sectionBadges}>
            {selectedDayData.isToday && (
              <View style={styles.todayPill}>
                <View style={styles.todayPillDot} />
                <Text style={styles.todayPillText}>Today</Text>
              </View>
            )}
            {selectedDayData.completed && (
              <View style={styles.completedPill}>
                <Ionicons name="checkmark" size={12} color={COLORS.SUCCESS[600]} />
                <Text style={styles.completedPillText}>Completed</Text>
              </View>
            )}
          </View>
        </View>

        {/* Rest Day */}
        {selectedDayData.isRestDay ? (
          <View style={styles.restDayCard}>
            <View style={styles.restDayIconWrapper}>
              <Ionicons name="moon" size={28} color={COLORS.SECONDARY[400]} />
            </View>
            <View style={styles.restDayTextContainer}>
              <Text style={styles.restDayTitle}>Rest & Recovery</Text>
              <Text style={styles.restDayDescription}>
                Your muscles grow stronger during rest. Take it easy today.
              </Text>
            </View>
          </View>
        ) : selectedDayData.workouts.length === 0 ? (
          <View style={styles.emptyWorkoutCard}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyWorkoutText}>No exercises scheduled</Text>
          </View>
        ) : (
          <>
            {/* Quick Stats Row */}
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: COLORS.PRIMARY[50] }]}>
                  <Ionicons name="fitness" size={16} color={COLORS.PRIMARY[600]} />
                </View>
                <Text style={styles.quickStatValue}>{selectedDayData.workouts.length}</Text>
                <Text style={styles.quickStatLabel}>exercises</Text>
              </View>
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: COLORS.WARNING[50] }]}>
                  <Ionicons name="flame" size={16} color={COLORS.WARNING[600]} />
                </View>
                <Text style={styles.quickStatValue}>
                  {selectedDayData.workouts.reduce((sum, e) => sum + (e.estimated_calories_burned || 28), 0)}
                </Text>
                <Text style={styles.quickStatLabel}>calories</Text>
              </View>
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: COLORS.SUCCESS[50] }]}>
                  <Ionicons name="time" size={16} color={COLORS.SUCCESS[600]} />
                </View>
                <Text style={styles.quickStatValue}>{Math.round(selectedDayData.workouts.length * 4)}</Text>
                <Text style={styles.quickStatLabel}>minutes</Text>
              </View>
            </View>

            {/* Modern Exercise List */}
            <View style={styles.exercisesContainer}>
              <Text style={styles.exercisesTitle}>Exercises</Text>
              {selectedDayData.workouts.map((exercise, idx) => (
                <View
                  key={`${selectedDayData.dayName}-${exercise.exercise_id}-${idx}`}
                  style={styles.exerciseItem}
                >
                  <View style={styles.exerciseNumberContainer}>
                    <Text style={styles.exerciseNumber}>{idx + 1}</Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {exercise.exercise_name}
                    </Text>
                    <View style={styles.exerciseMeta}>
                      <Text style={styles.exerciseMetaText}>
                        {formatMuscleGroup(exercise.target_muscle_group || '')}
                      </Text>
                      <View style={styles.exerciseMetaDot} />
                      <Text style={styles.exerciseMetaText}>4 min</Text>
                    </View>
                  </View>
                  {selectedDayData.completed && (
                    <View style={styles.exerciseCheckmark}>
                      <Ionicons name="checkmark" size={14} color="white" />
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Action Button */}
            {selectedDayData.completed ? (
              <View style={styles.completedBanner}>
                <Ionicons name="trophy" size={20} color={COLORS.SUCCESS[600]} />
                <Text style={styles.completedBannerText}>Workout completed!</Text>
              </View>
            ) : selectedDayData.isToday ? (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push('/workout')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButtonGradient}
                >
                  <Ionicons name="play" size={20} color="white" />
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.upcomingBanner}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.SECONDARY[400]} />
                <Text style={styles.upcomingBannerText}>
                  {selectedDayData.date < new Date() ? 'Missed workout' : 'Scheduled workout'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.SUCCESS[500] }]} />
            <Text style={styles.legendText}>Completed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.PRIMARY[500] }]} />
            <Text style={styles.legendText}>Workout</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.SECONDARY[300] }]} />
            <Text style={styles.legendText}>Rest</Text>
          </View>
        </View>

        {/* Regenerate Plan Button */}
        <TouchableOpacity
          style={styles.regenerateButton}
          onPress={() => handleGeneratePlan(true)}
          disabled={generatingPlan}
        >
          {generatingPlan ? (
            <ActivityIndicator color={COLORS.PRIMARY[600]} size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={COLORS.PRIMARY[600]} />
              <Text style={styles.regenerateText}>Regenerate Plan</Text>
            </>
          )}
        </TouchableOpacity>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 16,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },

  // Header - Consistent with other pages
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  todayChipText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },

  // Calendar Section
  calendarSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  weekNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.SECONDARY[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[50],
    opacity: 0.5,
  },
  weekLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayName: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNameSelected: {
    color: COLORS.PRIMARY[600],
    fontFamily: FONTS.SEMIBOLD,
  },
  dayNameToday: {
    color: COLORS.PRIMARY[600],
    fontFamily: FONTS.SEMIBOLD,
  },
  dayNumberWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayNumberWrapperSelected: {
    backgroundColor: COLORS.PRIMARY[600],
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dayNumberWrapperToday: {
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[400],
  },
  dayNumber: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[800],
  },
  dayNumberSelected: {
    color: 'white',
    fontFamily: FONTS.BOLD,
  },
  dayNumberToday: {
    color: COLORS.PRIMARY[700],
    fontFamily: FONTS.BOLD,
  },
  statusIndicator: {
    height: 8,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.SUCCESS[500],
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY[400],
  },

  // Progress Summary - Minimal style
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  progressText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  progressDotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SECONDARY[200],
  },
  progressDotCompleted: {
    backgroundColor: COLORS.SUCCESS[500],
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  sectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 5,
  },
  todayPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  todayPillText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[50],
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS[200],
  },
  completedPillText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[700],
  },

  // Rest Day Card
  restDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  restDayIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.SECONDARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  restDayTextContainer: {
    flex: 1,
  },
  restDayTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[800],
    marginBottom: 4,
  },
  restDayDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    lineHeight: 20,
  },

  // Empty Workout Card
  emptyWorkoutCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyWorkoutText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 12,
  },

  // Quick Stats Row
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  quickStatLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },

  // Exercises Container
  exercisesContainer: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  exercisesTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[100],
  },
  exerciseNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseNumber: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseMetaText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  exerciseMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.SECONDARY[300],
    marginHorizontal: 6,
  },
  exerciseCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.SUCCESS[500],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Completed Banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SUCCESS[50],
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS[200],
  },
  completedBannerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[700],
  },

  // Start Button
  startButton: {
    marginBottom: 8,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  startButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },

  // Upcoming Banner
  upcomingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  upcomingBannerText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 24,
    paddingVertical: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },

  // Regenerate Button
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
  },
  regenerateText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
});
