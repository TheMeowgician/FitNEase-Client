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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useProgressStore } from '../../stores/progressStore';
import ProgressionCard from '../../components/ProgressionCard';
import { progressionService } from '../../services/microservices/progressionService';
import { trackingService } from '../../services/microservices/trackingService';
import { useEngagementService } from '../../hooks/api/useEngagementService';

// Achievement icons for milestones
const MILESTONE_ICONS = {
  first_workout: require('../../assets/images/achievements/first_workout.png'),
  getting_started: require('../../assets/images/achievements/getting_started.png'),
  week_warrior: require('../../assets/images/achievements/week_warrior.png'),
  dedicated: require('../../assets/images/achievements/dedicated.png'),
};

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const { user } = useAuth();
  const { getUserStats } = useEngagementService();

  // Use centralized progress store
  const {
    overallStats,
    isLoading,
    isRefreshing,
    fetchAllProgressData,
  } = useProgressStore();

  const [refreshing, setRefreshing] = useState(false);
  const [engagementStreak, setEngagementStreak] = useState(0);

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
      console.log('📊 [PROGRESS] Loading progress data from store');

      // Fetch from centralized store
      await fetchAllProgressData(user.id);

      // Get engagement streak separately
      const engagementStats = await getUserStats(user.id).catch(() => null);
      setEngagementStreak(engagementStats?.current_streak_days || 0);

      console.log('✅ [PROGRESS] Progress data loaded from store');
    } catch (error) {
      console.error('❌ [PROGRESS] Failed to load progress data:', error);
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
          icon: 'flag-outline' as const,
          color: COLORS.SUCCESS[500],
          gradient: [COLORS.SUCCESS[400], COLORS.SUCCESS[600]] as const,
          title: 'Beginner',
          description: 'Building foundations',
        };
      case 'intermediate':
        return {
          icon: 'flash' as const,
          color: COLORS.PRIMARY[500],
          gradient: [COLORS.PRIMARY[400], COLORS.PRIMARY[600]] as const,
          title: 'Intermediate',
          description: 'Getting stronger',
        };
      case 'advanced':
        return {
          icon: 'trophy' as const,
          color: COLORS.WARNING[500],
          gradient: [COLORS.WARNING[400], COLORS.WARNING[600]] as const,
          title: 'Advanced',
          description: 'Peak performance',
        };
      default:
        return {
          icon: 'fitness' as const,
          color: COLORS.SECONDARY[500],
          gradient: [COLORS.SECONDARY[400], COLORS.SECONDARY[600]] as const,
          title: 'Unknown',
          description: 'Keep going',
        };
    }
  };

  const levelInfo = getFitnessLevelInfo();

  // Show loading state on first load
  if (isLoading && !overallStats) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Your Progress</Text>
              <Text style={styles.headerSubtitle}>Track your fitness journey</Text>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + '20' }]}>
              <Ionicons name={levelInfo.icon} size={28} color={levelInfo.color} />
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
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + '20' }]}>
            <Ionicons name={levelInfo.icon} size={28} color={levelInfo.color} />
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
            <View style={styles.levelCardIconContainer}>
              <Ionicons name={levelInfo.icon} size={40} color="white" />
            </View>
            <View style={styles.levelCardText}>
              <Text style={styles.levelCardTitle}>{levelInfo.title} Level</Text>
              <Text style={styles.levelCardDescription}>{levelInfo.description}</Text>
            </View>
          </View>
          <View style={styles.levelCardStats}>
            <View style={styles.levelCardStat}>
              <Ionicons name="trophy" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{overallStats?.totalWorkouts || 0}</Text>
              <Text style={styles.levelCardStatLabel}>Workouts</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="calendar" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{overallStats?.activeDays || 0}</Text>
              <Text style={styles.levelCardStatLabel}>Active Days</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="flame" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.levelCardStatValue}>{engagementStreak || 0}</Text>
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
              <Text style={styles.quickStatValue}>{overallStats?.totalWorkouts || 0}</Text>
              <Text style={styles.quickStatLabel}>Total Workouts</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.WARNING[100] }]}>
                <Ionicons name="time" size={24} color={COLORS.WARNING[600]} />
              </View>
              <Text style={styles.quickStatValue}>{Math.floor((overallStats?.totalMinutes || 0) / 60)}h {(overallStats?.totalMinutes || 0) % 60}m</Text>
              <Text style={styles.quickStatLabel}>Total Time</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.SUCCESS[100] }]}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.SUCCESS[600]} />
              </View>
              <Text style={styles.quickStatValue}>{overallStats?.activeDays || 0}</Text>
              <Text style={styles.quickStatLabel}>Active Days</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: COLORS.ERROR[100] }]}>
                <Ionicons name="flame" size={24} color={COLORS.ERROR[600]} />
              </View>
              <Text style={styles.quickStatValue}>{engagementStreak || 0}</Text>
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
            <View style={[styles.milestoneCard, (overallStats?.totalWorkouts || 0) >= 1 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  (overallStats?.totalWorkouts || 0) >= 1 ? styles.milestoneIconCompleted : styles.milestoneIconPending
                ]}>
                  <Image source={MILESTONE_ICONS.first_workout} style={styles.milestoneIconImage} />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>First Workout</Text>
                  <Text style={styles.milestoneDescription}>Complete 1 workout</Text>
                </View>
              </View>
              {(overallStats?.totalWorkouts || 0) >= 1 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 10 Workouts */}
            <View style={[styles.milestoneCard, (overallStats?.totalWorkouts || 0) >= 10 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  (overallStats?.totalWorkouts || 0) >= 10 ? styles.milestoneIconCompleted : styles.milestoneIconPending
                ]}>
                  <Image source={MILESTONE_ICONS.getting_started} style={styles.milestoneIconImage} />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>Getting Started</Text>
                  <Text style={styles.milestoneDescription}>Complete 10 workouts</Text>
                </View>
              </View>
              {(overallStats?.totalWorkouts || 0) >= 10 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 7 Day Streak */}
            <View style={[styles.milestoneCard, engagementStreak >= 7 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  engagementStreak >= 7 ? styles.milestoneIconCompleted : styles.milestoneIconPending
                ]}>
                  <Image source={MILESTONE_ICONS.week_warrior} style={styles.milestoneIconImage} />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>On Fire</Text>
                  <Text style={styles.milestoneDescription}>Maintain 7-day streak</Text>
                </View>
              </View>
              {engagementStreak >= 7 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
            </View>

            {/* 28 Active Days */}
            <View style={[styles.milestoneCard, (overallStats?.activeDays || 0) >= 28 && styles.milestoneCardCompleted]}>
              <View style={styles.milestoneLeft}>
                <View style={[
                  styles.milestoneIconContainer,
                  (overallStats?.activeDays || 0) >= 28 ? styles.milestoneIconCompleted : styles.milestoneIconPending
                ]}>
                  <Image source={MILESTONE_ICONS.dedicated} style={styles.milestoneIconImage} />
                </View>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneTitle}>Dedicated</Text>
                  <Text style={styles.milestoneDescription}>Active for 28 days</Text>
                </View>
              </View>
              {(overallStats?.activeDays || 0) >= 28 && <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS[500]} />}
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
    alignItems: 'center',
    justifyContent: 'center',
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
  levelCardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    overflow: 'hidden',
  },
  milestoneIconImage: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  milestoneIconCompleted: {
    opacity: 1,
  },
  milestoneIconPending: {
    opacity: 0.5,
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
