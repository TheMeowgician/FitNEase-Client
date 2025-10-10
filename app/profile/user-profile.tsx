import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/microservices/authService';
import { trackingService } from '../../services/microservices/trackingService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { capitalizeFirstLetter } from '../../utils/stringUtils';
import { useSmartBack } from '../../hooks/useSmartBack';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Load fitness level
      const fitnessAssessment = await authService.getFitnessAssessment();
      if (fitnessAssessment && fitnessAssessment.length > 0) {
        setFitnessLevel(fitnessAssessment[0].assessment_data.fitness_level || 'beginner');
      } else {
        setFitnessLevel(user.fitnessLevel || 'beginner');
      }

      // Load workout stats
      const workoutHistory = await trackingService.getWorkoutHistory();
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
    if (user?.height && user?.weight) {
      const heightInMeters = user.height / 100;
      const bmi = user.weight / (heightInMeters * heightInMeters);
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

  const achievements = [
    { icon: 'flash', title: 'First Workout', description: 'Complete your first workout', earned: stats.totalWorkouts > 0 },
    { icon: 'flame', title: 'On Fire', description: 'Complete 10 workouts', earned: stats.totalWorkouts >= 10 },
    { icon: 'rocket', title: 'Consistent', description: '7-day workout streak', earned: stats.currentStreak >= 7 },
    { icon: 'trophy', title: 'Dedicated', description: 'Complete 50 workouts', earned: stats.totalWorkouts >= 50 },
    { icon: 'star', title: 'Century Club', description: 'Complete 100 workouts', earned: stats.totalWorkouts >= 100 },
    { icon: 'medal', title: 'Time Lord', description: 'Train for 1000 minutes', earned: stats.totalMinutes >= 1000 },
  ];

  const earnedAchievements = achievements.filter(a => a.earned);
  const lockedAchievements = achievements.filter(a => !a.earned);

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
                <Text style={styles.metricValue}>{user?.height || '-'} cm</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Weight</Text>
                <Text style={styles.metricValue}>{user?.weight || '-'} kg</Text>
              </View>
            </View>

            <View style={styles.metricDividerHorizontal} />

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Age</Text>
                <Text style={styles.metricValue}>{user?.age || '-'} years</Text>
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
            <Text style={styles.achievementCount}>
              {earnedAchievements.length}/{achievements.length}
            </Text>
          </View>

          {/* Earned Achievements */}
          {earnedAchievements.length > 0 && (
            <View style={styles.achievementsGrid}>
              {earnedAchievements.map((achievement, index) => (
                <View key={index} style={styles.achievementCard}>
                  <View style={styles.achievementIconContainer}>
                    <Ionicons name={achievement.icon as any} size={28} color={COLORS.WARNING[500]} />
                  </View>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <>
              <Text style={styles.lockedLabel}>Locked Achievements</Text>
              <View style={styles.achievementsGrid}>
                {lockedAchievements.slice(0, 3).map((achievement, index) => (
                  <View key={index} style={[styles.achievementCard, styles.achievementCardLocked]}>
                    <View style={[styles.achievementIconContainer, styles.achievementIconLocked]}>
                      <Ionicons name="lock-closed" size={28} color={COLORS.SECONDARY[400]} />
                    </View>
                    <Text style={[styles.achievementTitle, styles.achievementTitleLocked]}>
                      {achievement.title}
                    </Text>
                    <Text style={[styles.achievementDescription, styles.achievementDescriptionLocked]}>
                      {achievement.description}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
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
  achievementCount: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
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
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  achievementCard: {
    width: (width - 52) / 2,
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
  achievementCardLocked: {
    backgroundColor: COLORS.NEUTRAL[100],
    opacity: 0.6,
  },
  achievementIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.WARNING[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementIconLocked: {
    backgroundColor: COLORS.NEUTRAL[200],
  },
  achievementTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTitleLocked: {
    color: COLORS.SECONDARY[600],
  },
  achievementDescription: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  achievementDescriptionLocked: {
    color: COLORS.SECONDARY[500],
  },
  lockedLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
    marginBottom: 12,
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
