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
import { useAuth } from '../../contexts/AuthContext';
import { useMLService } from '../../hooks/api/useMLService';
import { useEngagementService } from '../../hooks/api/useEngagementService';
import { useNotifications } from '../../contexts/NotificationContext';
import { authService } from '../../services/microservices/authService';
import { trackingService } from '../../services/microservices/trackingService';
import { commsService } from '../../services/microservices/commsService';
import { generateTabataSession, hasEnoughExercises, getSessionSummary } from '../../services/workoutSessionGenerator';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { capitalizeFirstLetter, formatFullName } from '../../utils/stringUtils';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { getRecommendations } = useMLService();
  const { getUserStats, getUserAchievements } = useEngagementService();
  const { unreadCount } = useNotifications();

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [engagementStats, setEngagementStats] = useState<any>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState<string>('beginner');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWorkoutSetModal, setShowWorkoutSetModal] = useState(false);
  const [currentWorkoutSet, setCurrentWorkoutSet] = useState<any>(null);
  const loadingRef = React.useRef(false); // Prevent duplicate concurrent loads

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Refresh recent workouts when screen comes into focus (e.g., after completing a workout)
  // This is lightweight and only updates the recent activity section
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [DASHBOARD] Screen focused - refreshing recent workouts');
        loadRecentWorkouts();
      }
    }, [user])
  );

  const loadRecentWorkouts = async () => {
    if (!user) return;

    try {
      // Get all completed workouts to calculate this week's stats
      const allWorkouts = await trackingService.getWorkoutHistory(user.id);

      // Calculate this week's stats
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const thisWeekWorkouts = allWorkouts.filter((w: any) => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfWeek;
      });

      const weeklyStats = {
        this_week_sessions: thisWeekWorkouts.length,
        total_calories_burned: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
        total_exercise_time: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
      };

      console.log('🔄 [DASHBOARD] This week stats:', weeklyStats);
      setStats(weeklyStats);

      // Get recent 5 workouts for activity section
      const workoutSessions = await trackingService.getSessions({
        status: 'completed',
        limit: 5,
        userId: String(user.id)
      });
      console.log('🔄 [DASHBOARD] Refreshed recent workouts:', workoutSessions.sessions.length);
      setRecentWorkouts(workoutSessions?.sessions || []);
    } catch (error) {
      console.warn('Recent workouts refresh failed:', error);
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

      // Try to get recommendations with better error handling
      let recsResponse: any[] = [];
      try {
        console.log('📊 [DASHBOARD] Calling getRecommendations for user ID:', user.id, typeof user.id);
        const userId = String(user.id); // Ensure it's a string
        recsResponse = await getRecommendations(userId, 8);
        console.log('📊 [DASHBOARD] Recommendations received:', recsResponse?.length || 0, 'exercises');
        console.log('📊 [DASHBOARD] First recommendation:', recsResponse?.[0]);
      } catch (recError) {
        console.error('📊 [DASHBOARD] Error getting recommendations:', recError);
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

      const [workoutHistory, achievementsResponse, engagementResponse, fitnessAssessment, workoutSessions] = await Promise.all([
        trackingService.getWorkoutHistory(user.id).catch((err: Error) => {
          console.warn('Workout history unavailable:', err);
          return [];
        }),
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
        trackingService.getSessions({ status: 'completed', limit: 5, userId: String(user.id) }).catch(err => {
          console.warn('Recent workouts unavailable:', err);
          return { sessions: [], total: 0, page: 1, limit: 5 };
        }),
      ]);

      // Calculate this week's stats from workout history
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const thisWeekWorkouts = workoutHistory.filter((w: any) => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfWeek;
      });

      const weeklyStats = {
        this_week_sessions: thisWeekWorkouts.length,
        total_calories_burned: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
        total_exercise_time: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
      };

      console.log(`📊 [DASHBOARD] Loaded ${recsResponse?.length || 0} recommendations for dashboard`);
      console.log('📊 [DASHBOARD] This week stats:', weeklyStats);
      setRecommendations(recsResponse || []);
      setStats(weeklyStats);
      setAchievements(achievementsResponse || []);
      setEngagementStats(engagementResponse);
      setRecentWorkouts(workoutSessions?.sessions || []);

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
      if (!recsResponse || recsResponse.length === 0) {
        console.warn('📊 [DASHBOARD] No recommendations received - showing empty state');
        // Don't show alert - let the UI show the empty state instead
      } else {
        console.log(`✅ [DASHBOARD] Successfully loaded ${recsResponse.length} recommendations!`);
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
                <Text style={styles.statValue}>{stats?.this_week_sessions || 0} sessions</Text>
              </View>
            </View>
            <View style={styles.statDividerHorizontal} />
            <View style={styles.statRow}>
              <View style={[styles.statIconCircle, { backgroundColor: '#F59E0B' + '15' }]}>
                <Ionicons name="flame" size={20} color="#F59E0B" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Calories Burned</Text>
                <Text style={styles.statValue}>{Math.round(stats?.total_calories_burned || 0).toLocaleString()} cal</Text>
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
                  {Math.floor((stats?.total_exercise_time || 0) / 60)}h {(stats?.total_exercise_time || 0) % 60}m
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
            <Text style={styles.sectionHeader}>Today's Tabata Workout</Text>
            {recommendations.length > 0 ? (
              <TouchableOpacity
                style={styles.workoutSetCard}
                onPress={handleViewWorkoutSet}
                activeOpacity={0.95}
              >
                {/* Header with Icon */}
                <View style={styles.workoutSetHeader}>
                  <View style={[styles.tabataIconLarge, { backgroundColor: COLORS.PRIMARY[600] + '15' }]}>
                    <Ionicons name="flash" size={32} color={COLORS.PRIMARY[600]} />
                  </View>
                  <View style={styles.workoutSetTitleContainer}>
                    <Text style={styles.workoutSetTitle}>
                      {fitnessLevel ? `${fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)} Tabata Set` : 'Tabata Set'}
                    </Text>
                    <Text style={styles.workoutSetSubtitle}>
                      {fitnessLevel === 'beginner' ? '4' : fitnessLevel === 'intermediate' ? '5' : '6'} exercises
                    </Text>
                  </View>
                </View>

                {/* Preview of first 3 exercises */}
                <View style={styles.exercisePreviewList}>
                  {recommendations?.slice(0, 3).map((ex, idx) => (
                    <View key={ex.exercise_id} style={styles.exercisePreviewItem}>
                      <View style={styles.exercisePreviewNumber}>
                        <Text style={styles.exercisePreviewNumberText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.exercisePreviewName} numberOfLines={1}>{ex.exercise_name}</Text>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    </View>
                  ))}
                  {(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) > 3 && (
                    <Text style={styles.moreExercises}>
                      +{(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) - 3} more exercises
                    </Text>
                  )}
                </View>

                {/* Stats Row */}
                <View style={styles.workoutSetStats}>
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="time-outline" size={18} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.workoutSetStatText}>
                      {(fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6) * 4} min
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="flame-outline" size={18} color="#F59E0B" />
                    <Text style={styles.workoutSetStatText}>
                      ~{recommendations?.slice(0, fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6)
                        .reduce((sum, ex) => sum + (ex.estimated_calories_burned || 0), 0)} cal
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.workoutSetStat}>
                    <Ionicons name="fitness-outline" size={18} color="#8B5CF6" />
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
                        // If multiple muscle groups, show "Full Body", otherwise show the specific group
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
                  <Ionicons name="chevron-forward" size={20} color={COLORS.PRIMARY[600]} />
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
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  workoutSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tabataIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  workoutSetTitleContainer: {
    flex: 1,
  },
  workoutSetTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 4,
  },
  workoutSetSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  exercisePreviewList: {
    marginBottom: 20,
  },
  exercisePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
  },
  exercisePreviewNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exercisePreviewNumberText: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exercisePreviewName: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    marginRight: 8,
  },
  moreExercises: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'center',
    marginTop: 8,
  },
  workoutSetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  workoutSetStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutSetStatText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#374151',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#D1D5DB',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: COLORS.PRIMARY[600] + '10',
    borderRadius: 12,
  },
  viewDetailsText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginRight: 6,
  },
});