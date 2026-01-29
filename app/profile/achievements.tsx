import React, { useState, useEffect, useCallback } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { engagementService, Achievement, UserAchievement } from '../../services/microservices/engagementService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useSmartBack } from '../../hooks/useSmartBack';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

// Rarity configuration
const RARITY_CONFIG = {
  common: {
    color: '#6B7280',
    bgColor: '#F3F4F6',
    gradient: ['#9CA3AF', '#6B7280'] as const,
    label: 'COMMON',
    points: '10-25',
  },
  rare: {
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    gradient: ['#60A5FA', '#3B82F6'] as const,
    label: 'RARE',
    points: '50-75',
  },
  epic: {
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    gradient: ['#A78BFA', '#8B5CF6'] as const,
    label: 'EPIC',
    points: '100-150',
  },
  legendary: {
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    gradient: ['#FBBF24', '#F59E0B'] as const,
    label: 'LEGENDARY',
    points: '200+',
  },
};

// Icon mapping for achievement types
const ACHIEVEMENT_ICONS: { [key: string]: string } = {
  'workout-first': 'barbell',
  'workout-10': 'barbell',
  'workout-25': 'barbell',
  'workout-50': 'barbell',
  'workout-100': 'trophy',
  'streak-3': 'flame',
  'streak-7': 'flame',
  'streak-14': 'flame',
  'streak-30': 'flame',
  'calories-1k': 'flame-outline',
  'calories-5k': 'flame-outline',
  'time-1hr': 'time',
  'time-5hr': 'time',
  'social-first': 'people',
  'special-earlybird': 'sunny',
  'special-nightowl': 'moon',
  default: 'trophy',
};

interface AchievementWithStatus extends Achievement {
  isUnlocked: boolean;
  earnedAt?: string | null;
  progress?: number;
}

export default function AchievementsScreen() {
  const { user } = useAuth();
  const { goBack } = useSmartBack();
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);

  useEffect(() => {
    loadAchievements();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAchievements();
      }
    }, [user])
  );

  const loadAchievements = async () => {
    if (!user?.id) return;

    try {
      // Fetch available achievements and user's achievements in parallel
      const [availableAchievements, userAchievements] = await Promise.all([
        engagementService.getAvailableAchievements(),
        engagementService.getUserAchievements(String(user.id)),
      ]);

      // Create a map of unlocked achievements
      const unlockedMap = new Map<number, UserAchievement>();
      userAchievements.forEach((ua) => {
        if (ua.is_completed) {
          unlockedMap.set(ua.achievement_id, ua);
        }
      });

      // Merge available achievements with unlock status
      const mergedAchievements: AchievementWithStatus[] = availableAchievements.map((achievement) => {
        const userAchievement = unlockedMap.get(achievement.achievement_id);
        return {
          ...achievement,
          isUnlocked: !!userAchievement,
          earnedAt: userAchievement?.earned_at,
          progress: userAchievement?.progress_percentage || 0,
        };
      });

      // Sort: unlocked first, then by rarity (legendary > epic > rare > common)
      const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
      mergedAchievements.sort((a, b) => {
        if (a.isUnlocked !== b.isUnlocked) {
          return a.isUnlocked ? -1 : 1;
        }
        return (rarityOrder[a.rarity_level as keyof typeof rarityOrder] || 4) -
               (rarityOrder[b.rarity_level as keyof typeof rarityOrder] || 4);
      });

      setAchievements(mergedAchievements);

      // Calculate total points
      const points = userAchievements
        .filter((ua) => ua.is_completed)
        .reduce((sum, ua) => sum + (ua.points_earned || 0), 0);
      setTotalPoints(points);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  };

  const getIcon = (badgeIcon: string): string => {
    return ACHIEVEMENT_ICONS[badgeIcon] || ACHIEVEMENT_ICONS.default;
  };

  const getRarityConfig = (rarity: string) => {
    return RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
  };

  const filteredAchievements = selectedRarity
    ? achievements.filter((a) => a.rarity_level === selectedRarity)
    : achievements;

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.PRIMARY[600]} />
        }
      >
        {/* Stats Card */}
        <LinearGradient
          colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="trophy" size={24} color={COLORS.WARNING[400]} />
              </View>
              <Text style={styles.statValue}>{unlockedCount}</Text>
              <Text style={styles.statLabel}>Unlocked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={24} color={COLORS.WARNING[400]} />
              </View>
              <Text style={styles.statValue}>{totalPoints}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="ribbon" size={24} color={COLORS.WARNING[400]} />
              </View>
              <Text style={styles.statValue}>{achievements.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Rarity Filter */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedRarity && styles.filterChipActive]}
              onPress={() => setSelectedRarity(null)}
            >
              <Text style={[styles.filterChipText, !selectedRarity && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {Object.entries(RARITY_CONFIG).map(([key, config]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterChip,
                  selectedRarity === key && { backgroundColor: config.color + '20', borderColor: config.color },
                ]}
                onPress={() => setSelectedRarity(selectedRarity === key ? null : key)}
              >
                <View style={[styles.rarityDot, { backgroundColor: config.color }]} />
                <Text
                  style={[
                    styles.filterChipText,
                    selectedRarity === key && { color: config.color },
                  ]}
                >
                  {config.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Achievements Grid */}
        <View style={styles.achievementsGrid}>
          {filteredAchievements.map((achievement) => {
            const rarityConfig = getRarityConfig(achievement.rarity_level);
            const icon = getIcon(achievement.badge_icon);

            return (
              <View
                key={achievement.achievement_id}
                style={[
                  styles.achievementCard,
                  !achievement.isUnlocked && styles.achievementCardLocked,
                ]}
              >
                {/* Rarity Badge */}
                <View style={[styles.rarityBadge, { backgroundColor: rarityConfig.bgColor }]}>
                  <Text style={[styles.rarityBadgeText, { color: rarityConfig.color }]}>
                    {rarityConfig.label}
                  </Text>
                </View>

                {/* Icon */}
                <View
                  style={[
                    styles.iconContainer,
                    achievement.isUnlocked
                      ? { backgroundColor: achievement.badge_color || rarityConfig.color }
                      : styles.iconContainerLocked,
                  ]}
                >
                  {achievement.isUnlocked ? (
                    <Ionicons name={icon as any} size={32} color={COLORS.NEUTRAL.WHITE} />
                  ) : (
                    <Ionicons name="lock-closed" size={28} color={COLORS.SECONDARY[400]} />
                  )}
                </View>

                {/* Name & Description */}
                <Text
                  style={[
                    styles.achievementName,
                    !achievement.isUnlocked && styles.textLocked,
                  ]}
                  numberOfLines={2}
                >
                  {achievement.achievement_name}
                </Text>
                <Text
                  style={[
                    styles.achievementDescription,
                    !achievement.isUnlocked && styles.textLocked,
                  ]}
                  numberOfLines={2}
                >
                  {achievement.description}
                </Text>

                {/* Points */}
                <View style={styles.pointsContainer}>
                  <Ionicons
                    name="star"
                    size={14}
                    color={achievement.isUnlocked ? COLORS.WARNING[500] : COLORS.SECONDARY[300]}
                  />
                  <Text
                    style={[
                      styles.pointsText,
                      !achievement.isUnlocked && styles.textLocked,
                    ]}
                  >
                    {achievement.points_value} pts
                  </Text>
                </View>

                {/* Unlocked indicator */}
                {achievement.isUnlocked && (
                  <View style={styles.unlockedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS[500]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyStateTitle}>No Achievements Found</Text>
            <Text style={styles.emptyStateText}>
              {selectedRarity
                ? `No ${selectedRarity} achievements available yet.`
                : 'Start working out to unlock achievements!'}
            </Text>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Rarity Guide</Text>
          <View style={styles.legendGrid}>
            {Object.entries(RARITY_CONFIG).map(([key, config]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                <View>
                  <Text style={styles.legendLabel}>{config.label}</Text>
                  <Text style={styles.legendPoints}>{config.points} points</Text>
                </View>
              </View>
            ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  statsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
  },
  filterChipActive: {
    backgroundColor: COLORS.PRIMARY[500],
    borderColor: COLORS.PRIMARY[500],
  },
  filterChipText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  filterChipTextActive: {
    color: COLORS.NEUTRAL.WHITE,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  achievementCardLocked: {
    backgroundColor: COLORS.NEUTRAL[100],
  },
  rarityBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainerLocked: {
    backgroundColor: COLORS.NEUTRAL[200],
    shadowOpacity: 0,
    elevation: 0,
  },
  achievementName: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 36,
  },
  achievementDescription: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
  textLocked: {
    color: COLORS.SECONDARY[400],
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  pointsText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[600],
  },
  unlockedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 8,
    textAlign: 'center',
  },
  legendCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  legendTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  legendPoints: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
});
