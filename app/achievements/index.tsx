import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { engagementService, Achievement, UserAchievement } from '../../services/microservices/engagementService';
import AchievementUnlockModal, { UnlockedAchievement } from '../../components/achievements/AchievementUnlockModal';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useSmartBack } from '../../hooks/useSmartBack';
import { getAchievementIcon } from '../../constants/achievementIcons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

// Rarity configuration
const RARITY_CONFIG = {
  common: {
    color: '#6B7280',
    bgColor: '#F3F4F6',
    label: 'COMMON',
  },
  rare: {
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    label: 'RARE',
  },
  epic: {
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    label: 'EPIC',
  },
  legendary: {
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'LEGENDARY',
  },
};

interface AchievementWithStatus extends Achievement {
  isUnlocked: boolean;
  earnedAt?: string | null;
  pointsEarned?: number;
}

export default function AchievementsScreen() {
  const { user } = useAuth();
  const { goBack } = useSmartBack();
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<UnlockedAchievement | null>(null);

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
      // Fetch ALL available achievements and user's unlocked achievements
      const [availableAchievements, userAchievements] = await Promise.all([
        engagementService.getAvailableAchievements(),
        engagementService.getUserAchievements(String(user.id)),
      ]);

      console.log('📊 Available achievements:', availableAchievements.length);
      console.log('🏆 User achievements:', userAchievements.length);

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
          pointsEarned: userAchievement?.points_earned,
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

      // Calculate total points from unlocked achievements
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

  const getRarityConfig = (rarity: string) => {
    return RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
  };

  const filteredAchievements = achievements.filter((a) => {
    if (selectedFilter === 'unlocked') return a.isUnlocked;
    if (selectedFilter === 'locked') return !a.isUnlocked;
    return true;
  });

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const lockedCount = achievements.filter((a) => !a.isUnlocked).length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
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
      <StatusBar barStyle="dark-content" backgroundColor="white" />

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
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.WARNING[100] }]}>
              <Ionicons name="star" size={20} color={COLORS.WARNING[500]} />
            </View>
            <Text style={styles.statValue}>{totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.SUCCESS[100] }]}>
              <Ionicons name="trophy" size={20} color={COLORS.SUCCESS[500]} />
            </View>
            <Text style={styles.statValue}>{unlockedCount}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.SECONDARY[100] }]}>
              <Ionicons name="lock-closed" size={20} color={COLORS.SECONDARY[500]} />
            </View>
            <Text style={styles.statValue}>{lockedCount}</Text>
            <Text style={styles.statLabel}>Locked</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'unlocked', 'locked'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, selectedFilter === filter && styles.filterTabActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[styles.filterTabText, selectedFilter === filter && styles.filterTabTextActive]}>
                {filter === 'all' ? `All (${achievements.length})` :
                 filter === 'unlocked' ? `Unlocked (${unlockedCount})` :
                 `Locked (${lockedCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Achievements Grid */}
        {filteredAchievements.length > 0 ? (
          <View style={styles.achievementsGrid}>
            {filteredAchievements.map((achievement) => {
              const rarityConfig = getRarityConfig(achievement.rarity_level);

              return (
                <TouchableOpacity
                  key={achievement.achievement_id}
                  activeOpacity={achievement.isUnlocked ? 0.7 : 1}
                  style={[
                    styles.achievementCard,
                    !achievement.isUnlocked && styles.achievementCardLocked,
                  ]}
                  onPress={() => {
                    if (!achievement.isUnlocked) return; // Locked — no modal
                    setSelectedAchievement({
                      achievement_id: achievement.achievement_id,
                      achievement_name: achievement.achievement_name,
                      description: achievement.description,
                      badge_icon: achievement.badge_icon,
                      badge_color: achievement.badge_color,
                      rarity_level: achievement.rarity_level as any,
                      points_value: achievement.points_value,
                    });
                    setShowAchievementModal(true);
                  }}
                >
                  {/* Rarity Badge */}
                  <View style={[styles.rarityBadge, { backgroundColor: rarityConfig.bgColor }]}>
                    <Text style={[styles.rarityBadgeText, { color: rarityConfig.color }]}>
                      {rarityConfig.label}
                    </Text>
                  </View>

                  {/* Icon */}
                  {achievement.isUnlocked ? (
                    // Show custom image for unlocked achievements
                    getAchievementIcon(achievement.achievement_name) ? (
                      <Image
                        source={getAchievementIcon(achievement.achievement_name)!}
                        style={styles.achievementImage}
                        resizeMode="contain"
                      />
                    ) : (
                      // Fallback to Ionicon if no custom image
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: achievement.badge_color || rarityConfig.color },
                        ]}
                      >
                        <Ionicons name={(achievement.badge_icon || 'trophy') as any} size={28} color="white" />
                      </View>
                    )
                  ) : (
                    // Show locked icon for locked achievements
                    <View style={[styles.iconContainer, styles.iconContainerLocked]}>
                      <Ionicons name="lock-closed" size={24} color={COLORS.SECONDARY[400]} />
                    </View>
                  )}

                  {/* Name & Description */}
                  <Text
                    style={[styles.achievementName, !achievement.isUnlocked && styles.textLocked]}
                    numberOfLines={2}
                  >
                    {achievement.achievement_name}
                  </Text>
                  <Text
                    style={[styles.achievementDescription, !achievement.isUnlocked && styles.textLocked]}
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
                    <Text style={[styles.pointsText, !achievement.isUnlocked && styles.textLocked]}>
                      {achievement.points_value} pts
                    </Text>
                  </View>

                  {/* Unlocked indicator */}
                  {achievement.isUnlocked && (
                    <View style={styles.unlockedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS[500]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyStateTitle}>No Achievements Found</Text>
            <Text style={styles.emptyStateText}>
              {selectedFilter === 'unlocked'
                ? 'Complete workouts to unlock achievements!'
                : selectedFilter === 'locked'
                ? 'You have unlocked all achievements!'
                : 'No achievements available.'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Achievement Detail Modal */}
      <AchievementUnlockModal
        visible={showAchievementModal}
        achievements={selectedAchievement ? [selectedAchievement] : []}
        onClose={() => {
          setShowAchievementModal(false);
          setSelectedAchievement(null);
        }}
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
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.NEUTRAL[200],
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: COLORS.PRIMARY[500],
  },
  filterTabText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  filterTabTextActive: {
    color: COLORS.NEUTRAL.WHITE,
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
  achievementImage: {
    width: 72,
    height: 72,
    marginTop: 4,
    marginBottom: 8,
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
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
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
    paddingHorizontal: 40,
  },
});
