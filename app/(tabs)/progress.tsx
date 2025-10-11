import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import ProgressionCard from '../../components/ProgressionCard';
import { progressionService } from '../../services/microservices/progressionService';
import { trackingService } from '../../services/microservices/trackingService';
import { useEngagementService } from '../../hooks/api/useEngagementService';

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const { user } = useAuth();
  const { getUserStats } = useEngagementService();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalMinutes: 0,
    totalCalories: 0,
    activeDays: 0,
    currentStreak: 0,
    completedSessions: 0,
    thisWeekWorkouts: 0,
    thisMonthWorkouts: 0,
  });

  useEffect(() => {
    loadProgressData();
  }, [user]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [PROGRESS] Screen focused - refreshing stats');
        loadProgressData();
      }
    }, [user])
  );

  const loadProgressData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      console.log('📊 [PROGRESS] Loading progress data for user:', user.id);

      // Fetch data from services
      const [workoutHistory, engagementStats] = await Promise.all([
        trackingService.getWorkoutHistory(user.id).catch((err: Error) => {
          console.warn('⚠️ [PROGRESS] Tracking service unavailable:', err);
          return [];
        }),
        getUserStats(user.id).catch((err: Error) => {
          console.warn('⚠️ [PROGRESS] Engagement service unavailable:', err);
          return null;
        }),
      ]);

      console.log('📊 [PROGRESS] Workout history:', workoutHistory.length, 'sessions');
      console.log('📊 [PROGRESS] Engagement stats:', engagementStats);

      // Calculate stats from workout history
      const totalWorkouts = workoutHistory.length;
      const totalMinutes = workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0);
      const totalCalories = workoutHistory.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

      // Calculate this week's workouts
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const thisWeekWorkouts = workoutHistory.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfWeek;
      }).length;

      // Calculate this month's workouts
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthWorkouts = workoutHistory.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfMonth;
      }).length;

      // Calculate active days (unique dates with workouts)
      const uniqueDates = new Set(
        workoutHistory.map(w => new Date(w.date).toDateString())
      );
      const activeDays = uniqueDates.size;

      // Update stats with real data
      setStats({
        totalWorkouts,
        totalMinutes,
        totalCalories,
        activeDays,
        currentStreak: engagementStats?.current_streak_days || 0,
        completedSessions: totalWorkouts,
        thisWeekWorkouts,
        thisMonthWorkouts,
      });

      console.log('✅ [PROGRESS] Stats updated successfully:', {
        totalWorkouts,
        totalMinutes,
        totalCalories,
        activeDays,
        thisWeekWorkouts,
        thisMonthWorkouts,
      });
    } catch (error) {
      console.error('❌ [PROGRESS] Failed to load progress data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProgressData();
    setRefreshing(false);
  };

  const getFitnessLevelInfo = () => {
    const level = user?.fitnessLevel || 'beginner';
    switch (level) {
      case 'beginner':
        return {
          emoji: '🌱',
          color: COLORS.SUCCESS[500],
          gradient: [COLORS.SUCCESS[400], COLORS.SUCCESS[600]] as const,
          title: 'Beginner',
          description: 'Building foundations',
        };
      case 'intermediate':
        return {
          emoji: '🔥',
          color: COLORS.PRIMARY[500],
          gradient: [COLORS.PRIMARY[400], COLORS.PRIMARY[600]] as const,
          title: 'Intermediate',
          description: 'Getting stronger',
        };
      case 'advanced':
        return {
          emoji: '⭐',
          color: COLORS.WARNING[500],
          gradient: [COLORS.WARNING[400], COLORS.WARNING[600]] as const,
          title: 'Advanced',
          description: 'Peak performance',
        };
      default:
        return {
          emoji: '💪',
          color: COLORS.SECONDARY[500],
          gradient: [COLORS.SECONDARY[400], COLORS.SECONDARY[600]] as const,
          title: 'Unknown',
          description: 'Keep going',
        };
    }
  };

  const levelInfo = getFitnessLevelInfo();

  // Show loading state on first load
  if (isLoading && stats.totalWorkouts === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Your Progress</Text>
              <Text style={styles.headerSubtitle}>Track your fitness journey</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelEmoji}>{levelInfo.emoji}</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Your Progress</Text>
            <Text style={styles.headerSubtitle}>Track your fitness journey</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelEmoji}>{levelInfo.emoji}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.PRIMARY[600]} />
        }
      >
        {/* Current Level Card */}
        <LinearGradient colors={levelInfo.gradient} style={styles.levelCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.levelCardContent}>
            <Text style={styles.levelCardEmoji}>{levelInfo.emoji}</Text>
            <View style={styles.levelCardText}>
              <Text style={styles.levelCardTitle}>{levelInfo.title} Level</Text>
              <Text style={styles.levelCardDescription}>{levelInfo.description}</Text>
            </View>
          </View>
          <View style={styles.levelCardStats}>
            <View style={styles.levelCardStat}>
              <Ionicons name="trophy" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.levelCardStatLabel}>Workouts</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="calendar" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{stats.activeDays}</Text>
              <Text style={styles.levelCardStatLabel}>Active Days</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="flame" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{stats.currentStreak}</Text>
              <Text style={styles.levelCardStatLabel}>Day Streak</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Progression Card */}
        <ProgressionCard />

        {/* Quick Stats Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Quick Stats</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.PRIMARY[100] }]}>
                <Ionicons name="fitness" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <Text style={styles.quickStatValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.quickStatLabel}>Total Workouts</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.WARNING[100] }]}>
                <Ionicons name="time" size={24} color={COLORS.WARNING[600]} />
              </View>
              <Text style={styles.quickStatValue}>{Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m</Text>
              <Text style={styles.quickStatLabel}>Total Time</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.SUCCESS[100] }]}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.SUCCESS[600]} />
              </View>
              <Text style={styles.quickStatValue}>{stats.activeDays}</Text>
              <Text style={styles.quickStatLabel}>Active Days</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.ERROR[100] }]}>
                <Ionicons name="flame" size={24} color={COLORS.ERROR[600]} />
              </View>
              <Text style={styles.quickStatValue}>{stats.currentStreak}</Text>
              <Text style={styles.quickStatLabel}>Current Streak</Text>
            </View>
          </View>
        </View>

        {/* Milestone Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Milestones</Text>
          </View>

          <View style={styles.milestonesContainer}>
            {/* First Workout */}
            <View style={[styles.milestoneCard, stats.totalWorkouts >= 1 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  stats.totalWorkouts >= 1 ? { backgroundColor: COLORS.SUCCESS[500] } : { backgroundColor: COLORS.NEUTRAL[300] }
                ]}>
                  <Ionicons name={stats.totalWorkouts >= 1 ? "checkmark" : "flash"} size={20} color="white" />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>First Workout</Text>
                  <Text style={styles.milestoneDescription}>Complete 1 workout</Text>
                </View>
              </View>
              {stats.totalWorkouts >= 1 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 10 Workouts */}
            <View style={[styles.milestoneCard, stats.totalWorkouts >= 10 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  stats.totalWorkouts >= 10 ? { backgroundColor: COLORS.SUCCESS[500] } : { backgroundColor: COLORS.NEUTRAL[300] }
                ]}>
                  <Ionicons name={stats.totalWorkouts >= 10 ? "checkmark" : "rocket"} size={20} color="white" />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>Getting Started</Text>
                  <Text style={styles.milestoneDescription}>Complete 10 workouts</Text>
                </View>
              </View>
              {stats.totalWorkouts >= 10 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 7 Day Streak */}
            <View style={[styles.milestoneCard, stats.currentStreak >= 7 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  stats.currentStreak >= 7 ? { backgroundColor: COLORS.SUCCESS[500] } : { backgroundColor: COLORS.NEUTRAL[300] }
                ]}>
                  <Ionicons name={stats.currentStreak >= 7 ? "checkmark" : "flame"} size={20} color="white" />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>On Fire</Text>
                  <Text style={styles.milestoneDescription}>Maintain 7-day streak</Text>
                </View>
              </View>
              {stats.currentStreak >= 7 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 28 Active Days */}
            <View style={[styles.milestoneCard, stats.activeDays >= 28 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  stats.activeDays >= 28 ? { backgroundColor: COLORS.SUCCESS[500] } : { backgroundColor: COLORS.NEUTRAL[300] }
                ]}>
                  <Ionicons name={stats.activeDays >= 28 ? "checkmark" : "calendar"} size={20} color="white" />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>Dedicated</Text>
                  <Text style={styles.milestoneDescription}>Active for 28 days</Text>
                </View>
              </View>
              {stats.activeDays >= 28 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>
          </View>
        </View>

        {/* Motivational Quote */}
        <View style={styles.quoteCard}>
          <Ionicons name="bulb" size={24} color={COLORS.WARNING[500]} />
          <Text style={styles.quoteText}>
            "The only bad workout is the one that didn't happen."
          </Text>
          <Text style={styles.quoteAuthor}>- Unknown</Text>
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
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.NEUTRAL[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelEmoji: {
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  levelCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  levelCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelCardEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  levelCardText: {
    flex: 1,
  },
  levelCardTitle: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: 'white',
    marginBottom: 4,
  },
  levelCardDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  levelCardStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  levelCardStat: {
    flex: 1,
    alignItems: 'center',
  },
  levelCardStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  levelCardStatValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: 'white',
    marginTop: 8,
  },
  levelCardStatLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStatCard: {
    width: (width - 52) / 2,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickStatValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  milestonesContainer: {
    gap: 12,
  },
  milestoneCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  milestoneCardCompleted: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS[500],
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  milestoneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  milestoneText: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  milestoneDescription: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  quoteCard: {
    backgroundColor: COLORS.WARNING[50],
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.WARNING[200],
  },
  quoteText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
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
});
