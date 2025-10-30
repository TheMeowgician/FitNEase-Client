import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, StatusBar, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { WorkoutSetModal } from '../../components/workout/WorkoutSetModal';
import { WorkoutDayStatus } from '../../components/dashboard/WorkoutDayStatus';
import ProgressionCard from '../../components/ProgressionCard';
import { ExerciseCard } from '../../components/exercise/ExerciseCard';
import { useAuth } from '../../contexts/AuthContext';
import { useMLService } from '../../hooks/api/useMLService';
import { useEngagementService } from '../../hooks/api/useEngagementService';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProgressStore } from '../../stores/progressStore';
import { useRecommendationStore } from '../../stores/recommendationStore';
import { authService } from '../../services/microservices/authService';
import { trackingService } from '../../services/microservices/trackingService';
import { commsService } from '../../services/microservices/commsService';
import { generateTabataSession, hasEnoughExercises, getSessionSummary } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { capitalizeFirstLetter, formatFullName } from '../../utils/stringUtils';

// ====================================================================
// 🧪 TESTING FLAG: Daily Workout Limit Control
// ====================================================================
// TODO: RESTORE TO TRUE BEFORE PRODUCTION DEPLOYMENT!
// Set to false during testing to allow unlimited workouts per day
// Set to true in production to enforce one workout per day limit
const ENABLE_DAILY_WORKOUT_LIMIT = false; // 🧪 TESTING MODE - UNLIMITED WORKOUTS
// ====================================================================

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { getRecommendations } = useMLService();
  const { getUserStats, getUserAchievements } = useEngagementService();
  const { unreadCount } = useNotifications();

  // Use centralized progress store
  const {
    weeklyStats,
    recentWorkouts,
    isLoading: isLoadingProgress,
    fetchAllProgressData,
  } = useProgressStore();

  // Use centralized recommendation store for consistent exercises across all pages
  const {
    recommendations,
    isLoading: isLoadingRecommendations,
    fetchRecommendations,
  } = useRecommendationStore();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [engagementStats, setEngagementStats] = useState<any>(null);
  const [fitnessLevel, setFitnessLevel] = useState<string>('beginner');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWorkoutSetModal, setShowWorkoutSetModal] = useState(false);
  const [currentWorkoutSet, setCurrentWorkoutSet] = useState<any>(null);
  const [isRefreshingWorkouts, setIsRefreshingWorkouts] = useState(false);
  const [isTodayWorkoutCompleted, setIsTodayWorkoutCompleted] = useState(false); // Track if today's workout is done
  const loadingRef = React.useRef(false); // Prevent duplicate concurrent loads

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Refresh progress data when screen comes into focus (e.g., after completing a workout)
  // Uses centralized progress store - lightweight and cached
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [DASHBOARD] Screen focused - refreshing progress from store');
        fetchAllProgressData(user.id);
        checkTodayWorkoutCompletion(); // Check if today's workout is completed
      }
    }, [user, fetchAllProgressData])
  );

  /**
   * Check if user has completed a workout TODAY
   * If completed, hide exercises and show completion message
   */
  const checkTodayWorkoutCompletion = async () => {
    if (!user) return;

    // 🧪 TESTING MODE: Skip check if daily limit is disabled
    if (!ENABLE_DAILY_WORKOUT_LIMIT) {
      console.log('🧪 [DASHBOARD] Daily workout limit DISABLED - unlimited workouts allowed');
      setIsTodayWorkoutCompleted(false);
      return;
    }

    try {
      console.log('✅ [DASHBOARD] Checking if today\'s workout is completed...');

      const userId = String(user.id);
      const sessions = await trackingService.getSessions({
        userId,
        status: 'completed',
        limit: 50, // Get recent sessions
      });

      // Get today's date range (start and end of day)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      console.log(`📅 [DASHBOARD] Today range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

      // Check if any session was completed today
      const todaySession = sessions.sessions.find((session: any) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= todayStart && sessionDate <= todayEnd;
      });

      if (todaySession) {
        console.log(`✅ [DASHBOARD] Found completed workout today (session: ${todaySession.id})`);
        setIsTodayWorkoutCompleted(true);
      } else {
        console.log(`📅 [DASHBOARD] No completed workout today`);
        setIsTodayWorkoutCompleted(false);
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Failed to check today\'s workout completion:', error);
      setIsTodayWorkoutCompleted(false);
    }
  };

  const loadDashboardData = async () => {
    if (!user) {
      console.warn('📊 [DASHBOARD] No user found, skipping data load');
      return;
    }

    // Prevent duplicate concurrent loads
    if (loadingRef.current) {
      console.log('📊 [DASHBOARD] Already loading, skipping duplicate call');
      return;
    }

    try {
      loadingRef.current = true;
      setIsLoading(true);
      console.log('📊 [DASHBOARD] Loading dashboard data for user:', user.id);

      // Fetch recommendations from centralized store (will use cache if available)
      try {
        console.log('📊 [DASHBOARD] Fetching recommendations from store for user ID:', user.id);
        const userId = String(user.id); // Ensure it's a string
        await fetchRecommendations(userId, getRecommendations);
        console.log('📊 [DASHBOARD] Store now has:', recommendations?.length || 0, 'cached recommendations');
      } catch (recError) {
        console.error('📊 [DASHBOARD] Error fetching recommendations from store:', recError);
        // Only show alert if it's a critical error, not just empty results
        if (recError && (recError as any).message !== 'Empty response') {
          Alert.alert(
            'Recommendation Error',
            'Unable to load exercise recommendations. Please check your internet connection and try again.',
            [
              { text: 'Retry', onPress: () => loadDashboardData() },
              { text: 'OK', style: 'cancel' }
            ]
          );
        }
      }

      const [achievementsResponse, engagementResponse, fitnessAssessment] = await Promise.all([
        getUserAchievements(user.id).catch(err => {
          console.warn('Achievements service unavailable:', err);
          return [];
        }),
        getUserStats(user.id).catch(err => {
          console.warn('Engagement service unavailable:', err);
          return null;
        }),
        authService.getFitnessAssessment().catch(err => {
          console.warn('Fitness assessment unavailable:', err);
          return null;
        }),
      ]);

      // Fetch progress data from centralized store
      await fetchAllProgressData(user.id);

      // Check if today's workout is completed
      await checkTodayWorkoutCompletion();

      console.log(`📊 [DASHBOARD] Using ${recommendations?.length || 0} recommendations from store`);
      console.log('📊 [DASHBOARD] Weekly stats from store:', weeklyStats);

      // 🐛 DEBUG: Log exercises from store to compare with other pages
      if (recommendations && recommendations.length > 0) {
        const fitnessLvl = user.fitnessLevel || 'beginner';
        const count = fitnessLvl === 'beginner' ? 4 : fitnessLvl === 'intermediate' ? 5 : 6;
        const firstExercises = recommendations.slice(0, count);
        console.log(`🐛 [DASHBOARD DEBUG] Fitness Level: ${fitnessLvl}, Count: ${count}`);
        console.log(`🐛 [DASHBOARD DEBUG] First exercise: ${firstExercises[0]?.exercise_name} (ID: ${firstExercises[0]?.exercise_id})`);
        console.log(`🐛 [DASHBOARD DEBUG] All ${count} exercises:`, firstExercises.map((e: any) => `${e.exercise_name} (${e.exercise_id})`));
      }

      setAchievements(achievementsResponse || []);
      setEngagementStats(engagementResponse);

      // Set fitness level from assessment data (more accurate than user profile)
      if (fitnessAssessment && fitnessAssessment.length > 0) {
        const assessmentFitnessLevel = fitnessAssessment[0].assessment_data.fitness_level;
        setFitnessLevel(assessmentFitnessLevel || 'beginner');
        console.log('💪 [DASHBOARD] Using fitness level from assessment:', assessmentFitnessLevel);
      } else {
        // Fallback to user profile fitness level
        setFitnessLevel(user.fitnessLevel || 'beginner');
        console.log('💪 [DASHBOARD] Using fitness level from user profile:', user.fitnessLevel);
      }

      // If still no recommendations, log warning but don't block UI
      if (!recommendations || recommendations.length === 0) {
        console.warn('📊 [DASHBOARD] No recommendations in store - showing empty state');
        // Don't show alert - let the UI show the empty state instead
      } else {
        console.log(`✅ [DASHBOARD] Successfully using ${recommendations.length} cached recommendations from store!`);
      }
    } catch (error) {
      console.error('📊 [DASHBOARD] Fatal error loading dashboard data:', error);
      Alert.alert(
        'Error',
        'Failed to load dashboard. Please try restarting the app.',
        [
          { text: 'Retry', onPress: () => loadDashboardData() },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } finally {
      setIsLoading(false);
      loadingRef.current = false; // Reset loading flag
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const refreshWorkoutRecommendations = async () => {
    if (!user) return;

    try {
      setIsRefreshingWorkouts(true);
      console.log('🔄 [DASHBOARD] Refreshing workout recommendations - clearing cache');

      // Clear store cache and fetch fresh recommendations
      const userId = String(user.id);
      const { clearRecommendations } = useRecommendationStore.getState();
      clearRecommendations();

      await fetchRecommendations(userId, getRecommendations);

      console.log('🔄 [DASHBOARD] Store refreshed with', recommendations?.length || 0, 'new recommendations');

      if (!recommendations || recommendations.length === 0) {
        console.warn('🔄 [DASHBOARD] No recommendations received');
      } else {
        console.log('✅ [DASHBOARD] Successfully refreshed', recommendations.length, 'recommendations in store!');
      }
    } catch (error) {
      console.error('🔄 [DASHBOARD] Error refreshing recommendations:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh workout recommendations. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshingWorkouts(false);
    }
  };

  const handleViewWorkoutSet = () => {
    if (recommendations.length === 0) {
      Alert.alert(
        'No Recommendations',
        'Please wait while we load your personalized workout recommendations.'
      );
      return;
    }

    // Determine number of exercises based on fitness level
    // Beginner: 3-4 exercises, Intermediate: 4-6, Advanced: 6-8
    const exerciseCount = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;
    const exercises = recommendations.slice(0, Math.min(exerciseCount, recommendations.length));

    // Calculate total duration and calories
    const totalDuration = exercises.length * 4; // 4 minutes per exercise (Tabata protocol)
    const totalCalories = exercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 0), 0);

    const workoutSet = {
      exercises,
      total_duration: totalDuration,
      total_calories: totalCalories,
      difficulty: fitnessLevel,
    };

    setCurrentWorkoutSet(workoutSet);
    setShowWorkoutSetModal(true);
  };

  const handleStartWorkout = async () => {
    if (!user) return;

    try {
      // Check if we have enough recommendations
      if (recommendations.length === 0) {
        Alert.alert(
          'No Recommendations',
          'Please wait while we load your personalized workout recommendations.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if we have enough exercises for the user's fitness level
      if (!hasEnoughExercises(recommendations, fitnessLevel)) {
        Alert.alert(
          'Insufficient Exercises',
          `You need more exercise recommendations for a proper ${fitnessLevel} level workout session. Please try again later.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Generate a proper Tabata session with multiple exercises
      const session = generateTabataSession(recommendations, fitnessLevel, user.id);

      // Close modal if open
      setShowWorkoutSetModal(false);

      // Navigate to workout session with the generated session
      router.push({
        pathname: '/workout/session',
        params: {
          sessionData: JSON.stringify(session),
          type: 'tabata'
        }
      });
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    }
  };

  const handleViewProgress = () => {
    router.push('/(tabs)/progress');
  };

  const handleBrowseExercises = () => {
    router.push('/exercises/library');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert(
        'Logout Failed',
        'There was an error signing you out. Please try again.'
      );
    } finally {
      setIsLoggingOut(false);
    }
  };


  const getUserDisplayData = () => {
    if (!user) {
      return {
        name: 'User',
        role: 'Unknown',
        details: 'Loading...',
      };
    }

    const name = capitalizeFirstLetter(user.firstName) || 'User';
    const role = user.role === 'mentor' ? 'Mentor' : 'Member';
    const levelText = fitnessLevel ? `${fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)} Level` : 'Beginner Level';
    const details = `${levelText} • Tabata Training`;

    return { name, role, details };
  };

  const userDisplay = getUserDisplayData();

  // Format time ago helper
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Check if today is a workout day
  const isWorkoutDay = () => {
    if (!user?.workoutDays || user.workoutDays.length === 0) {
      return true; // Show workouts if no schedule set
    }
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = DAYS_OF_WEEK[today];
    return user.workoutDays.includes(todayName);
  };

  const quickActions = [
    // Only show "Start Workout" on workout days
    ...(isWorkoutDay() ? [{
      icon: 'flash-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Start Workout',
      subtitle: 'Begin your Tabata session',
      onPress: handleStartWorkout,
      color: '#10B981',
    }] : []),
    {
      icon: 'bar-chart-outline' as keyof typeof Ionicons.glyphMap,
      title: 'View Progress',
      subtitle: 'Check your fitness journey',
      onPress: handleViewProgress,
      color: '#3B82F6',
    },
    {
      icon: 'library-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Browse Exercises',
      subtitle: 'Explore workout library',
      onPress: handleBrowseExercises,
      color: '#8B5CF6',
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner message="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appleContainer} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color="#111827" />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="white" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileGreeting}>Welcome back,</Text>
              <Text style={styles.profileName}>{userDisplay.name}</Text>
              <View style={styles.profileBadge}>
                <Ionicons name="flash" size={12} color="#10B981" />
                <Text style={styles.profileDetails}>{userDisplay.details}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Workout Day Status */}
        {user?.workoutDays && user.workoutDays.length > 0 && (
          <WorkoutDayStatus workoutDays={user.workoutDays} />
        )}

        {/* Stats Summary - Redesigned */}
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

        {/* Progression Card */}
        <View style={styles.progressionSection}>
          <ProgressionCard />
        </View>

        {/* Today's Recommended Workout Set - Only show on workout days */}
        {isWorkoutDay() ? (
          <View style={styles.workoutSection}>
            <View style={styles.sectionHeaderWithAction}>
              <Text style={styles.sectionHeader}>Today's Tabata Workout</Text>
              <TouchableOpacity
                onPress={refreshWorkoutRecommendations}
                disabled={isRefreshingWorkouts}
                style={styles.refreshButton}
                activeOpacity={0.7}
              >
                {isRefreshingWorkouts ? (
                  <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
                ) : (
                  <Ionicons name="refresh" size={20} color={COLORS.PRIMARY[600]} />
                )}
              </TouchableOpacity>
            </View>
            {isTodayWorkoutCompleted ? (
              // Show completion message if today's workout is done
              <View style={styles.completedWorkoutCard}>
                <View style={styles.completedWorkoutIconContainer}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.completedWorkoutTitle}>Today's Workout Complete!</Text>
                <Text style={styles.completedWorkoutText}>
                  Excellent work! You've finished your Tabata workout for today.
                  Come back tomorrow for your next session.
                </Text>
                <View style={styles.completedWorkoutStats}>
                  <Ionicons name="trophy" size={20} color="#F59E0B" />
                  <Text style={styles.completedWorkoutStatsText}>
                    Keep your streak going!
                  </Text>
                </View>
              </View>
            ) : recommendations.length > 0 ? (
              <TouchableOpacity
                style={styles.workoutSetCard}
                onPress={handleViewWorkoutSet}
                activeOpacity={0.92}
              >
                {/* Header with Icon */}
                <View style={styles.workoutSetHeader}>
                  <View style={styles.tabataIconLarge}>
                    <Ionicons name="flash" size={36} color={COLORS.NEUTRAL.WHITE} />
                  </View>
                  <View style={styles.workoutSetTitleContainer}>
                    <Text style={styles.workoutSetTitle}>
                      {fitnessLevel ? `${fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)} Tabata` : 'Tabata Workout'}
                    </Text>
                    <Text style={styles.workoutSetSubtitle}>
                      {fitnessLevel === 'beginner' ? '4' : fitnessLevel === 'intermediate' ? '5' : '6'} exercises • Tabata protocol
                    </Text>
                  </View>
                </View>

                {/* Preview of first 3 exercises */}
                <View style={styles.exercisePreviewList}>
                  {recommendations?.slice(0, 3).map((ex, idx) => (
                    <ExerciseCard
                      key={ex.exercise_id}
                      exercise={ex}
                      index={idx}
                      showCompletionIcon={true}
                      showMLBadge={true} // 🧪 Testing: Show ML model type
                      mlModelType="Hybrid" // Content 60% + Collab 40%
                    />
                  ))}
                  {(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) > 3 && (
                    <Text style={styles.moreExercises}>
                      +{(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) - 3} more
                    </Text>
                  )}
                </View>

                {/* Stats Row */}
                <View style={styles.workoutSetStats}>
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.workoutSetStatText}>
                      {(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) * 4} min
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="flame-outline" size={20} color="#F59E0B" />
                    <Text style={styles.workoutSetStatText}>
                      ~{recommendations?.slice(0, fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6)
                        .reduce((sum, ex) => sum + (ex.estimated_calories_burned || 0), 0)} cal
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="fitness-outline" size={20} color="#8B5CF6" />
                    <Text style={styles.workoutSetStatText}>
                      {(() => {
                        const workoutExercises = recommendations?.slice(0, fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) || [];
                        const muscleGroups = new Set<string>();
                        workoutExercises.forEach(ex => {
                          if (ex.target_muscle_group) {
                            ex.target_muscle_group.split(',').forEach((mg: string) => muscleGroups.add(mg.trim()));
                          }
                        });
                        const uniqueGroups = Array.from(muscleGroups);
                        if (uniqueGroups.length >= 3) {
                          return 'Full Body';
                        } else if (uniqueGroups.length > 0) {
                          return uniqueGroups.map((g: string) =>
                            g.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                          ).join(' & ');
                        }
                        return 'Full Body';
                      })()}
                    </Text>
                  </View>
                </View>

                {/* View Details Button */}
                <View style={styles.viewDetailsButton}>
                  <Text style={styles.viewDetailsText}>View Full Workout</Text>
                  <Ionicons name="chevron-forward" size={22} color={COLORS.PRIMARY[600]} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyWorkoutCard}>
                <Ionicons name="fitness-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyWorkoutTitle}>No Recommendations Yet</Text>
                <Text style={styles.emptyWorkoutText}>
                  Complete your fitness assessment to get personalized Tabata workouts
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.workoutSection}>
            <Text style={styles.sectionHeader}>Rest Day</Text>
            <View style={styles.restDayCard}>
              <View style={styles.restDayIcon}>
                <Ionicons name="bed-outline" size={48} color={COLORS.SECONDARY[400]} />
              </View>
              <Text style={styles.restDayTitle}>Recovery Time</Text>
              <Text style={styles.restDayText}>
                Your body needs rest to build strength. Check back on your next workout day!
              </Text>
            </View>
          </View>
        )}

        {/* Achievements Section */}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionHeader}>Recent Achievements</Text>
          {achievements && achievements.length > 0 ? (
            <View style={styles.achievementsGrid}>
              {achievements.slice(0, 3).map((userAchievement: any, index: number) => (
                <View key={index} style={styles.achievementCard}>
                  <View style={[styles.achievementBadge, { backgroundColor: userAchievement.achievement?.badge_color || COLORS.PRIMARY[600] }]}>
                    <Ionicons
                      name={userAchievement.achievement?.badge_icon as any || "trophy"}
                      size={24}
                      color="white"
                    />
                  </View>
                  <Text style={styles.achievementName}>
                    {userAchievement.achievement?.achievement_name || 'Achievement'}
                  </Text>
                  <Text style={styles.achievementPoints}>
                    {userAchievement.points_earned || 0} pts
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyAchievements}>
              <Ionicons name="trophy-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyAchievementsTitle}>No Achievements Yet</Text>
              <Text style={styles.emptyAchievementsText}>
                Complete workouts to earn your first achievement
              </Text>
            </View>
          )}
          {engagementStats && (
            <View style={styles.engagementSummary}>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementStatNumber}>{engagementStats.total_points || 0}</Text>
                <Text style={styles.engagementStatLabel}>Total Points</Text>
              </View>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementStatNumber}>{engagementStats.current_streak_days || 0}</Text>
                <Text style={styles.engagementStatLabel}>Day Streak</Text>
              </View>
              <View style={styles.engagementStat}>
                <Text style={styles.engagementStatNumber}>{engagementStats.total_achievements || 0}</Text>
                <Text style={styles.engagementStatLabel}>Achievements</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={24} color="white" />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionHeader}>Recent Activity</Text>
          <View style={styles.activityCard}>
            {recentWorkouts && recentWorkouts.length > 0 ? (
              <>
                {recentWorkouts.slice(0, 3).map((workout: any, index: number) => (
                  <View
                    key={workout.sessionId || workout.id || index}
                    style={[
                      styles.activityItem,
                      index === recentWorkouts.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.activityIcon}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>Completed Tabata Workout</Text>
                      <Text style={styles.activityTime}>{formatTimeAgo(workout.createdAt)}</Text>
                    </View>
                    <Text style={styles.activityCalories}>
                      {workout.actualDuration || workout.duration || 0}min
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyActivityText}>Start your first workout to see activity</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Workout Set Modal */}
      <WorkoutSetModal
        visible={showWorkoutSetModal}
        onClose={() => setShowWorkoutSetModal(false)}
        workoutSet={currentWorkoutSet}
        onStartWorkout={handleStartWorkout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
  },
  appleContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  fixedHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 0,
  },
  profileSection: {
    marginHorizontal: 24,
    marginBottom: 32,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  profileInfo: {
    flex: 1,
  },
  profileGreeting: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  profileName: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 6,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  profileDetails: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#10B981',
    marginLeft: 4,
  },
  statsSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600] + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  weekBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    marginRight: 16,
  },
  statContent: {
    flex: 1,
  },
  statDividerHorizontal: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  achievementsSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  achievementsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  achievementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  achievementBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementPoints: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[600],
  },
  emptyAchievements: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  emptyAchievementsTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyAchievementsText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  engagementSummary: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  engagementStat: {
    alignItems: 'center',
  },
  engagementStatNumber: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 4,
  },
  engagementStatLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY[600] + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  workoutSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginLeft: 8,
  },
  workoutDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginBottom: 16,
  },
  workoutDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  workoutDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDetailText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginLeft: 4,
  },
  startWorkoutButton: {
    backgroundColor: COLORS.PRIMARY[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 14,
  },
  startWorkoutText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
    marginRight: 8,
  },
  emptyWorkoutCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedWorkoutCard: {
    backgroundColor: '#F0FDF4', // Light green background
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completedWorkoutIconContainer: {
    marginBottom: 16,
  },
  completedWorkoutTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: '#065F46',
    marginBottom: 12,
    textAlign: 'center',
  },
  completedWorkoutText: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: '#047857',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  completedWorkoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  completedWorkoutStatsText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#065F46',
    marginLeft: 8,
  },
  restDayCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restDayIcon: {
    marginBottom: 16,
  },
  restDayTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  restDayText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyWorkoutTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyWorkoutText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  actionsSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    textAlign: 'center',
  },
  progressionSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  activitySection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
  },
  activityTime: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginTop: 2,
  },
  activityCalories: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  activityBadge: {
    fontSize: 16,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyActivityText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  // Workout Set Styles
  workoutSetCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  workoutSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  tabataIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  workoutSetTitleContainer: {
    flex: 1,
  },
  workoutSetTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  workoutSetSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  exercisePreviewList: {
    marginBottom: 18,
  },
  moreExercises: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'center',
    marginTop: 4,
  },
  workoutSetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
  },
  workoutSetStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutSetStatText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.SECONDARY[200],
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 16,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewDetailsText: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginRight: 6,
  },
});