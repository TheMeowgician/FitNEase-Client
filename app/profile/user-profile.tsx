import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/microservices/authService';
import { trackingService } from '../../services/microservices/trackingService';
import { engagementService, Achievement, UserAchievement } from '../../services/microservices/engagementService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { capitalizeFirstLetter } from '../../utils/stringUtils';
import { useSmartBack } from '../../hooks/useSmartBack';
import { getAchievementIcon } from '../../constants/achievementIcons';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const { user } = useAuth();
  const { goBack } = useSmartBack();
  const [fitnessLevel, setFitnessLevel] = useState<string>('beginner');
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalMinutes: 0,
    totalCalories: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [bodyMetrics, setBodyMetrics] = useState({
    height: 0,
    weight: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [availableAchievements, setAvailableAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    loadUserData();
  }, [user]);

  // Refresh profile stats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 [PROFILE] Screen focused - refreshing workout stats');
        loadUserData();
      }
    }, [user])
  );

  const loadUserData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Load fitness level and body metrics from fitness assessment
      // Look for initial_onboarding assessment which has fitness_level (weekly assessments don't)
      console.log('[USER-PROFILE] Loading fitness level from assessment for user:', user.id);
      const fitnessAssessment = await authService.getFitnessAssessment(user.id);
      if (fitnessAssessment && fitnessAssessment.length > 0) {
        // Find the initial_onboarding assessment (has fitness_level)
        const onboardingAssessment = fitnessAssessment.find(
          (a: any) => a.assessment_type === 'initial_onboarding' && a.assessment_data?.fitness_level
        );

        if (onboardingAssessment) {
          const assessmentData = onboardingAssessment.assessment_data;
          setFitnessLevel(assessmentData.fitness_level || 'beginner');

          // Extract height and weight from assessment data
          if (assessmentData.height && assessmentData.weight) {
            setBodyMetrics({
              height: assessmentData.height,
              weight: assessmentData.weight,
            });
          }
        } else {
          // Fallback: check any assessment with fitness_level
          const anyWithFitnessLevel = fitnessAssessment.find(
            (a: any) => a.assessment_data?.fitness_level
          );
          if (anyWithFitnessLevel) {
            setFitnessLevel(anyWithFitnessLevel.assessment_data.fitness_level);
            console.log('[USER-PROFILE] Using fitness level from assessment:', anyWithFitnessLevel.assessment_data.fitness_level);
          } else {
            // Fallback: use user profile fitness level
            setFitnessLevel(user.fitnessLevel || 'beginner');
            console.log('[USER-PROFILE] No assessment with fitness_level, using user profile:', user.fitnessLevel);
          }
        }
      } else {
        setFitnessLevel(user.fitnessLevel || 'beginner');
        console.log('[USER-PROFILE] No assessments, using user profile:', user.fitnessLevel);
      }

      // Load workout stats
      const workoutHistory = await trackingService.getWorkoutHistory(user.id);
      if (workoutHistory && workoutHistory.length > 0) {
        const totalWorkouts = workoutHistory.length;
        const totalMinutes = workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0);
        const totalCalories = workoutHistory.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

        setStats({
          totalWorkouts,
          totalMinutes,
          totalCalories,
          currentStreak: 0, // TODO: Calculate streak
          longestStreak: 0, // TODO: Calculate longest streak
        });
      }

      // Load achievements from engagement service
      try {
        const [available, userAch] = await Promise.all([
          engagementService.getAvailableAchievements(),
          engagementService.getUserAchievements(String(user.id)),
        ]);
        setAvailableAchievements(available);
        setUserAchievements(userAch);
        console.log('🏆 [PROFILE] Loaded achievements:', userAch.length, 'unlocked of', available.length);
      } catch (achError) {
        console.warn('Failed to load achievements:', achError);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFitnessLevelColor = () => {
    switch (fitnessLevel) {
      case 'beginner': return COLORS.SUCCESS[500];
      case 'intermediate': return COLORS.WARNING[500];
      case 'advanced': return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[500];
    }
  };

  const getFitnessLevelIcon = () => {
    switch (fitnessLevel) {
      case 'beginner': return 'leaf';
      case 'intermediate': return 'flame';
      case 'advanced': return 'trophy';
      default: return 'fitness';
    }
  };

  const calculateBMI = () => {
    if (bodyMetrics.height && bodyMetrics.weight) {
      const heightInMeters = bodyMetrics.height / 100;
      const bmi = bodyMetrics.weight / (heightInMeters * heightInMeters);
      return bmi.toFixed(1);
    }
    return 'N/A';
  };

  const getBMICategory = (bmi: string) => {
    const bmiNum = parseFloat(bmi);
    if (isNaN(bmiNum)) return 'Unknown';
    if (bmiNum < 18.5) return 'Underweight';
    if (bmiNum < 25) return 'Normal';
    if (bmiNum < 30) return 'Overweight';
    return 'Obese';
  };

  const calculateAge = () => {
    if (!user?.dateOfBirth) return '-';

    const birthDate = new Date(user.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age.toString();
  };

  // Get achievement preview from real backend data
  const getAchievementPreview = () => {
    // Create a set of unlocked achievement IDs for quick lookup
    const unlockedIds = new Set(
      userAchievements.filter(ua => ua.is_completed).map(ua => ua.achievement_id)
    );

    // Get first 4 achievements (prioritize unlocked ones)
    const sortedAchievements = [...availableAchievements].sort((a, b) => {
      const aUnlocked = unlockedIds.has(a.achievement_id);
      const bUnlocked = unlockedIds.has(b.achievement_id);
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      return a.achievement_id - b.achievement_id;
    });

    const previewAchievements = sortedAchievements.slice(0, 4);

    // Map to display format with icons based on achievement type
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

    return previewAchievements.map(ach => ({
      icon: iconMap[ach.achievement_type] || 'trophy',
      title: ach.achievement_name,
      earned: unlockedIds.has(ach.achievement_id),
      color: colorMap[ach.rarity_level] || '#6B7280',
      customImage: getAchievementIcon(ach.achievement_name),
    }));
  };

  const quickAchievements = getAchievementPreview();
  const earnedCount = userAchievements.filter(a => a.is_completed).length;
  const totalAchievements = availableAchievements.length;
  const hasAchievementsData = availableAchievements.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY[600]} />

      {/* Header with gradient background */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => router.push('/settings/edit-profile')} style={styles.editButton}>
            <Ionicons name="create-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.profileHeaderSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="white" />
            </View>
            <View style={[styles.levelBadge, { backgroundColor: getFitnessLevelColor() }]}>
              <Ionicons name={getFitnessLevelIcon() as any} size={14} color="white" />
            </View>
          </View>

          <Text style={styles.userName}>{capitalizeFirstLetter(user?.firstName || 'User')}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          <View style={styles.levelContainer}>
            <View style={[styles.levelPill, { backgroundColor: getFitnessLevelColor() + '20', borderColor: getFitnessLevelColor() }]}>
              <Ionicons name={getFitnessLevelIcon() as any} size={16} color={getFitnessLevelColor()} />
              <Text style={[styles.levelText, { color: getFitnessLevelColor() }]}>
                {capitalizeFirstLetter(fitnessLevel)} Level
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.PRIMARY[100] }]}>
                <Ionicons name="fitness" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.WARNING[100] }]}>
                <Ionicons name="time" size={24} color={COLORS.WARNING[600]} />
              </View>
              <Text style={styles.statValue}>{Math.floor(stats.totalMinutes / 60)}h</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.ERROR[100] }]}>
                <Ionicons name="flame" size={24} color={COLORS.ERROR[600]} />
              </View>
              <Text style={styles.statValue}>{Math.floor(stats.totalCalories)}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.SUCCESS[100] }]}>
                <Ionicons name="rocket" size={24} color={COLORS.SUCCESS[600]} />
              </View>
              <Text style={styles.statValue}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
        </View>

        {/* Body Metrics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="body" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Body Metrics</Text>
          </View>

          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Height</Text>
                <Text style={styles.metricValue}>{bodyMetrics.height || '-'} cm</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Weight</Text>
                <Text style={styles.metricValue}>{bodyMetrics.weight || '-'} kg</Text>
              </View>
            </View>

            <View style={styles.metricDividerHorizontal} />

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Age</Text>
                <Text style={styles.metricValue}>{calculateAge()} years</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>BMI</Text>
                <Text style={styles.metricValue}>{calculateBMI()}</Text>
                <Text style={styles.bmiCategory}>{getBMICategory(calculateBMI())}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Achievements</Text>
            <TouchableOpacity
              onPress={() => router.push('/achievements')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          </View>

          {/* Quick Achievement Preview */}
          <View style={styles.achievementPreviewCard}>
            {hasAchievementsData ? (
              <>
                <View style={styles.achievementPreviewRow}>
                  {quickAchievements.map((achievement, index) => (
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
                <Text style={styles.achievementEmptyText}>
                  Achievements unavailable
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Workout Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Workout Preferences</Text>
          </View>

          <View style={styles.preferencesCard}>
            <View style={styles.preferenceItem}>
              <Ionicons name="calendar" size={18} color={COLORS.SECONDARY[600]} />
              <Text style={styles.preferenceLabel}>Workout Days</Text>
              <Text style={styles.preferenceValue}>
                {user?.workoutDays?.length || 0} days/week
              </Text>
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceItem}>
              <Ionicons name="time" size={18} color={COLORS.SECONDARY[600]} />
              <Text style={styles.preferenceLabel}>Duration</Text>
              <Text style={styles.preferenceValue}>
                {user?.timeConstraints || 30} min
              </Text>
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceItem}>
              <Ionicons name="walk" size={18} color={COLORS.SECONDARY[600]} />
              <Text style={styles.preferenceLabel}>Activity Level</Text>
              <Text style={styles.preferenceValue}>
                {capitalizeFirstLetter(user?.activityLevel?.replace('_', ' ') || 'Moderate')}
              </Text>
            </View>
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
    backgroundColor: COLORS.PRIMARY[600],
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileHeaderSection: {
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 32,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.PRIMARY[700],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.PRIMARY[600],
  },
  userName: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: 'white',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  levelContainer: {
    alignItems: 'center',
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  levelText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  metricsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 4,
  },
  metricValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  bmiCategory: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SUCCESS[600],
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.NEUTRAL[200],
    marginHorizontal: 20,
  },
  metricDividerHorizontal: {
    height: 1,
    backgroundColor: COLORS.NEUTRAL[200],
    marginVertical: 16,
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
  preferencesCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  preferenceLabel: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    marginLeft: 12,
  },
  preferenceValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  preferenceDivider: {
    height: 1,
    backgroundColor: COLORS.NEUTRAL[200],
    marginVertical: 12,
  },
});
