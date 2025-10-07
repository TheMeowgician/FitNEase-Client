import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useEngagementService } from '../../hooks/api/useEngagementService';
import { COLORS, FONTS } from '../../constants/colors';
import { UserAchievement, UserStats } from '../../services/microservices/engagementService';

export default function AchievementsScreen() {
  const { user } = useAuth();
  const { getUserAchievements, getUserStats } = useEngagementService();

  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAchievementsData();
    }
  }, [user]);

  const loadAchievementsData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const [achievementsData, statsData] = await Promise.all([
        getUserAchievements(user.id),
        getUserStats(user.id),
      ]);

      setAchievements(achievementsData || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return '#6B7280';
      case 'uncommon':
        return '#10B981';
      case 'rare':
        return '#3B82F6';
      case 'epic':
        return '#8B5CF6';
      case 'legendary':
        return '#F59E0B';
      default:
        return COLORS.PRIMARY[600];
    }
  };

  const getStatusBarHeight = () => {
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight || 24;
    }
    return 0;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completedAchievements = achievements.filter(a => a.is_completed);
  const inProgressAchievements = achievements.filter(a => !a.is_completed && a.progress_percentage > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stats Overview */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total_points}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{completedAchievements.length}</Text>
              <Text style={styles.statLabel}>Unlocked</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.current_streak_days}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
        )}

        {/* Completed Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unlocked Achievements</Text>
          {completedAchievements.length > 0 ? (
            <View style={styles.achievementsGrid}>
              {completedAchievements.map((userAchievement, index) => (
                <View key={index} style={styles.achievementCard}>
                  <View style={[
                    styles.achievementBadge,
                    { backgroundColor: userAchievement.achievement?.badge_color || getRarityColor(userAchievement.achievement?.rarity_level || 'common') }
                  ]}>
                    <Ionicons
                      name={userAchievement.achievement?.badge_icon as any || "trophy"}
                      size={32}
                      color="white"
                    />
                  </View>
                  <Text style={styles.achievementName}>
                    {userAchievement.achievement?.achievement_name || 'Achievement'}
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {userAchievement.achievement?.description || 'Great job!'}
                  </Text>
                  <View style={styles.achievementFooter}>
                    <Text style={[styles.achievementRarity, { color: getRarityColor(userAchievement.achievement?.rarity_level || 'common') }]}>
                      {userAchievement.achievement?.rarity_level?.toUpperCase() || 'COMMON'}
                    </Text>
                    <Text style={styles.achievementPoints}>
                      {userAchievement.points_earned} pts
                    </Text>
                  </View>
                  {userAchievement.earned_at && (
                    <Text style={styles.achievementDate}>
                      Earned {new Date(userAchievement.earned_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Achievements Yet</Text>
              <Text style={styles.emptyStateText}>
                Start working out to earn your first achievement!
              </Text>
            </View>
          )}
        </View>

        {/* In Progress Achievements */}
        {inProgressAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In Progress</Text>
            <View style={styles.achievementsGrid}>
              {inProgressAchievements.map((userAchievement, index) => (
                <View key={index} style={[styles.achievementCard, styles.inProgressCard]}>
                  <View style={styles.achievementBadge}>
                    <Ionicons
                      name={userAchievement.achievement?.badge_icon as any || "trophy"}
                      size={32}
                      color="#D1D5DB"
                    />
                  </View>
                  <Text style={styles.achievementName}>
                    {userAchievement.achievement?.achievement_name || 'Achievement'}
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {userAchievement.achievement?.description || 'Keep going!'}
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${userAchievement.progress_percentage}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(userAchievement.progress_percentage)}% complete
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  statsCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inProgressCard: {
    opacity: 0.7,
  },
  achievementBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  achievementName: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  achievementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  achievementRarity: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
  },
  achievementPoints: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  achievementDate: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});