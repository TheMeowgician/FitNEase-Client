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
import { useFocusEffect, router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useProgressStore } from '../../stores/progressStore';
import ProgressionCard from '../../components/ProgressionCard';
import { progressionService } from '../../services/microservices/progressionService';
import { trackingService } from '../../services/microservices/trackingService';
import { engagementService, Achievement, UserAchievement } from '../../services/microservices/engagementService';
import { useEngagementService } from '../../hooks/api/useEngagementService';
import { getAchievementIcon } from '../../constants/achievementIcons';

interface AchievementPreview {
  icon: string;
  title: string;
  earned: boolean;
  color: string;
  customImage: any;
}

// Fitness level icons
const FITNESS_LEVEL_ICONS = {
  beginner: require('../../assets/images/achievements/beginner.png'),
  intermediate: require('../../assets/images/achievements/intermediate.png'),
  advanced: require('../../assets/images/achievements/advanced.png'),
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
  const [achievementPreviews, setAchievementPreviews] = useState<AchievementPreview[]>([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);

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

      // Fetch from centralized store + achievements in parallel
      const [, engagementStats, availableAchievements, userAchievements] = await Promise.all([
        fetchAllProgressData(user.id),
        getUserStats(user.id).catch(() => null),
        engagementService.getAvailableAchievements().catch(() => []),
        engagementService.getUserAchievements(String(user.id)).catch(() => []),
      ]);

      setEngagementStreak(engagementStats?.current_streak_days || 0);

      // Build achievement previews (same pattern as user-profile page)
      const unlockedIds = new Set(
        userAchievements.filter(ua => ua.is_completed).map(ua => ua.achievement_id)
      );

      // Sort: unlocked first, then by ID
      const sortedAchievements = [...availableAchievements].sort((a, b) => {
        const aUnlocked = unlockedIds.has(a.achievement_id);
        const bUnlocked = unlockedIds.has(b.achievement_id);
        if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
        return a.achievement_id - b.achievement_id;
      });

      const iconMap: Record<string, string> = {
        workout_count: 'fitness',
        streak: 'flame',
        calories: 'flash',
        time: 'time',
        social: 'people',
      };

      const colorMap: Record<string, string> = {
        common: '#6B7280',
        rare: '#3B82F6',
        epic: '#8B5CF6',
        legendary: '#F59E0B',
      };

      const previews = sortedAchievements.slice(0, 4).map(ach => ({
        icon: iconMap[ach.achievement_type] || 'trophy',
        title: ach.achievement_name,
        earned: unlockedIds.has(ach.achievement_id),
        color: colorMap[ach.rarity_level] || '#6B7280',
        customImage: getAchievementIcon(ach.achievement_name),
      }));

      setAchievementPreviews(previews);
      setEarnedCount(userAchievements.filter(a => a.is_completed).length);
      setTotalAchievements(availableAchievements.length);

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
          image: FITNESS_LEVEL_ICONS.beginner,
          color: COLORS.SUCCESS[500],
          gradient: [COLORS.SUCCESS[400], COLORS.SUCCESS[600]] as const,
          title: 'Beginner',
          description: 'Building foundations',
        };
      case 'intermediate':
        return {
          icon: 'flash' as const,
          image: FITNESS_LEVEL_ICONS.intermediate,
          color: COLORS.PRIMARY[500],
          gradient: [COLORS.PRIMARY[400], COLORS.PRIMARY[600]] as const,
          title: 'Intermediate',
          description: 'Getting stronger',
        };
      case 'advanced':
        return {
          icon: 'trophy' as const,
          image: FITNESS_LEVEL_ICONS.advanced,
          color: COLORS.WARNING[500],
          gradient: [COLORS.WARNING[400], COLORS.WARNING[600]] as const,
          title: 'Advanced',
          description: 'Peak performance',
        };
      default:
        return {
          icon: 'fitness' as const,
          image: FITNESS_LEVEL_ICONS.beginner,
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
              <Image source={levelInfo.image} style={styles.levelBadgeImage} />
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
            <Image source={levelInfo.image} style={styles.levelBadgeImage} />
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
              <Image source={levelInfo.image} style={styles.levelCardImage} />
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

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Achievements</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/achievements')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.achievementPreviewCard}>
            {achievementPreviews.length > 0 ? (
              <>
                <View style={styles.achievementPreviewRow}>
                  {achievementPreviews.map((achievement, index) => (
                    <View key={index} style={styles.achievementPreviewItem}>
                      {achievement.earned && achievement.customImage ? (
                        <Image
                          source={achievement.customImage}
                          style={styles.achievementPreviewImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          style={[
                            styles.achievementPreviewIcon,
                            achievement.earned
                              ? { backgroundColor: achievement.color }
                              : styles.achievementPreviewIconLocked,
                          ]}
                        >
                          {achievement.earned ? (
                            <Ionicons name={achievement.icon as any} size={20} color="white" />
                          ) : (
                            <Ionicons name="lock-closed" size={16} color={COLORS.SECONDARY[400]} />
                          )}
                        </View>
                      )}
                      <Text
                        style={[
                          styles.achievementPreviewLabel,
                          !achievement.earned && styles.achievementPreviewLabelLocked,
                        ]}
                        numberOfLines={1}
                      >
                        {achievement.title}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Progress Bar */}
                <View style={styles.achievementProgressSection}>
                  <View style={styles.achievementProgressBar}>
                    <View
                      style={[
                        styles.achievementProgressFill,
                        { width: `${totalAchievements > 0 ? (earnedCount / totalAchievements) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.achievementProgressText}>
                    {earnedCount} of {totalAchievements} unlocked
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.achievementEmptyState}>
                <Ionicons name="trophy-outline" size={32} color={COLORS.SECONDARY[300]} />
                <Text style={styles.achievementEmptyText}>Loading achievements...</Text>
              </View>
            )}
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
    overflow: 'hidden',
  },
  levelBadgeImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
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
    overflow: 'hidden',
  },
  levelCardImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
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
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
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
  achievementPreviewCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  achievementPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  achievementPreviewItem: {
    alignItems: 'center',
    flex: 1,
  },
  achievementPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  achievementPreviewImage: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  achievementPreviewIconLocked: {
    backgroundColor: COLORS.NEUTRAL[200],
  },
  achievementPreviewLabel: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    textAlign: 'center',
  },
  achievementPreviewLabelLocked: {
    color: COLORS.SECONDARY[400],
  },
  achievementProgressSection: {
    alignItems: 'center',
  },
  achievementProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[500],
    borderRadius: 3,
  },
  achievementProgressText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[600],
  },
  achievementEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  achievementEmptyText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 8,
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
