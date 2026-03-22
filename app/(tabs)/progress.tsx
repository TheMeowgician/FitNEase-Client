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
import { useFocusEffect, router } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { OfflinePlaceholder } from '../../components/ui/OfflinePlaceholder';
import NetInfo from '@react-native-community/netinfo';
import { useProgressStore } from '../../stores/progressStore';
import ProgressionCard from '../../components/ProgressionCard';
import { progressionService } from '../../services/microservices/progressionService';
import { trackingService } from '../../services/microservices/trackingService';
import { engagementService, Achievement, UserAchievement } from '../../services/microservices/engagementService';
import { useEngagementService } from '../../hooks/api/useEngagementService';
import { getAchievementIcon } from '../../constants/achievementIcons';
import { ProgressSkeleton } from '../../components/ui/SkeletonLoader';

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

// Sourced from: Parade, BrainyQuote, GMU Center for Well-Being, Peloton, Future Fit
const FITNESS_QUOTES = [
  { text: 'The last three or four reps is what makes the muscle grow. This area of pain divides a champion from someone who is not a champion.', author: 'Arnold Schwarzenegger' },
  { text: 'Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.', author: 'John F. Kennedy' },
  { text: 'Take care of your body. It\'s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'Strength does not come from the physical capacity. It comes from an indomitable will.', author: 'Mahatma Gandhi' },
  { text: 'I hate every minute of training. But I said, don\'t quit. Suffer now and live the rest of your life as a champion.', author: 'Muhammad Ali' },
  { text: 'Exercise is king. Nutrition is queen. Put them together and you\'ve got a kingdom.', author: 'Jack LaLanne' },
  { text: 'Blood, sweat and respect. First two you give. Last one you earn.', author: 'Dwayne Johnson' },
  { text: 'Reading is to the mind what exercise is to the body.', author: 'Joseph Addison' },
  { text: 'If we could give every individual the right amount of nourishment and exercise, not too little and not too much, we would have found the safest way to health.', author: 'Hippocrates' },
  { text: 'The only bad workout is the one that didn\'t happen.', author: 'Unknown' },
  { text: 'Fitness is not about being better than someone else. It\'s about being better than you used to be.', author: 'Khloe Kardashian' },
  { text: 'Success usually comes to those who are too busy to be looking for it.', author: 'Henry David Thoreau' },
  { text: 'The pain you feel today will be the strength you feel tomorrow.', author: 'Arnold Schwarzenegger' },
  { text: 'Your body can stand almost anything. It\'s your mind that you have to convince.', author: 'Andrew Murphy' },
];

export default function ProgressScreen() {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const { getUserStats } = useEngagementService();

  const [dailyQuote, setDailyQuote] = useState(() => FITNESS_QUOTES[Math.floor(Math.random() * FITNESS_QUOTES.length)]);

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

  // Auto-recovery: when connection returns, refresh data
  useEffect(() => {
    if (isConnected) {
      console.log('🔄 [PROGRESS] Connection restored - loading progress data');
      loadProgressData();
    }
  }, [isConnected]);

  // Refresh data and quote when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [PROGRESS] Screen focused - refreshing stats');
        loadProgressData();
      }
      setDailyQuote(FITNESS_QUOTES[Math.floor(Math.random() * FITNESS_QUOTES.length)]);
    }, [user])
  );

  const loadProgressData = async () => {
    if (!user?.id) return;

    // Skip API calls when offline — prevents error toasts and useless retries
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('⚠️ [PROGRESS] Device offline, skipping data load');
      return;
    }

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

  // Show offline placeholder on ANY screen state when there's no internet
  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OfflinePlaceholder onRetry={loadProgressData} />
      </SafeAreaView>
    );
  }

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
            <View style={styles.levelBadge}>
              <Image source={levelInfo.image} style={styles.levelBadgeImage} />
            </View>
          </View>
        </View>
        <ProgressSkeleton />
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
        <View style={styles.levelCard}>
          <View style={styles.levelCardContent}>
            <Image source={levelInfo.image} style={styles.levelCardImage} />
            <View style={styles.levelCardText}>
              <Text style={styles.levelCardTitle}>{levelInfo.title} Level</Text>
              <Text style={styles.levelCardDescription}>{levelInfo.description}</Text>
            </View>
          </View>
          <View style={styles.levelCardStats}>
            <View style={styles.levelCardStat}>
              <Ionicons name="trophy" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.levelCardStatValue}>{overallStats?.totalWorkouts || 0}</Text>
              <Text style={styles.levelCardStatLabel}>Workouts</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="calendar" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.levelCardStatValue}>{overallStats?.activeDays || 0}</Text>
              <Text style={styles.levelCardStatLabel}>Active Days</Text>
            </View>
            <View style={styles.levelCardStatDivider} />
            <View style={styles.levelCardStat}>
              <Ionicons name="flame" size={20} color={COLORS.ERROR[500]} />
              <Text style={styles.levelCardStatValue}>{engagementStreak || 0}</Text>
              <Text style={styles.levelCardStatLabel}>Day Streak</Text>
            </View>
          </View>
        </View>

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
            "{dailyQuote.text}"
          </Text>
          <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text>
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  levelCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelCardImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    marginRight: 16,
  },
  levelCardText: {
    flex: 1,
  },
  levelCardTitle: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  levelCardDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  levelCardStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 16,
    padding: 16,
  },
  levelCardStat: {
    flex: 1,
    alignItems: 'center',
  },
  levelCardStatDivider: {
    width: 1,
    backgroundColor: COLORS.NEUTRAL[200],
    marginHorizontal: 12,
  },
  levelCardStatValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 8,
  },
  levelCardStatLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
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
