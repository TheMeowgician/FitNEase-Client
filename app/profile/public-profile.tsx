import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { authService } from '../../services/microservices/authService';
import { trackingService } from '../../services/microservices/trackingService';
import { Avatar } from '../../components/ui/Avatar';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { capitalizeFirstLetter } from '../../utils/stringUtils';

export default function PublicProfileScreen() {
  const { userId, username } = useLocalSearchParams<{ userId: string; username: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ totalWorkouts: 0, totalMinutes: 0, totalCalories: 0 });
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState('beginner');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(false);

    try {
      const results = await Promise.allSettled([
        authService.getMemberProfile(userId),
        trackingService.getMemberSessionStats(userId),
        trackingService.getSessions({ userId, status: 'completed', limit: 5 }),
      ]);

      // Profile
      if (results[0].status === 'fulfilled' && results[0].value) {
        const p = results[0].value;
        setProfile(p);
        setFitnessLevel(p.fitness_level || p.fitnessLevel || 'beginner');
      }

      // Stats
      if (results[1].status === 'fulfilled' && results[1].value) {
        const s = results[1].value;
        setStats({
          totalWorkouts: s.total_sessions || s.completed_sessions || 0,
          totalMinutes: s.total_exercise_time || 0,
          totalCalories: Math.round(s.total_calories_burned || 0),
        });
      }

      // Recent sessions
      if (results[2].status === 'fulfilled' && results[2].value) {
        setRecentWorkouts(results[2].value.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load public profile:', err);
      setError(true);
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

  const displayName = profile?.username || profile?.first_name || username || 'User';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.SECONDARY[300]} />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayName}'s Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar
            name={displayName}
            size="xl"
            profilePicture={profile?.profile_picture || profile?.profilePicture}
          />
          <Text style={styles.profileName}>{displayName}</Text>
          <View style={[styles.fitnessLevelBadge, { backgroundColor: getFitnessLevelColor() + '20' }]}>
            <Text style={[styles.fitnessLevelText, { color: getFitnessLevelColor() }]}>
              {capitalizeFirstLetter(fitnessLevel)}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="fitness" size={22} color={COLORS.PRIMARY[600]} />
            <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color="#8B5CF6" />
            <Text style={styles.statValue}>
              {stats.totalMinutes >= 60
                ? `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`
                : `${stats.totalMinutes}m`}
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={22} color="#EF4444" />
            <Text style={styles.statValue}>{stats.totalCalories}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityCard}>
            {recentWorkouts.length > 0 ? (
              recentWorkouts.map((workout: any, index: number) => {
                const isGroup = workout.sessionType === 'group';
                return (
                  <TouchableOpacity
                    key={workout.id || workout.sessionId || index}
                    style={[
                      styles.activityItem,
                      index < recentWorkouts.length - 1 && styles.activityItemBorder,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/workout/workout-detail', params: { sessionData: JSON.stringify(workout) } })}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: isGroup ? COLORS.PRIMARY[50] : '#ECFDF5' }]}>
                      <Ionicons
                        name={isGroup ? 'people' : 'fitness'}
                        size={18}
                        color={isGroup ? COLORS.PRIMARY[600] : '#10B981'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>
                        {isGroup ? 'Group Tabata' : 'Tabata Workout'}
                      </Text>
                      <Text style={styles.activitySub}>
                        {workout.actualDuration || workout.duration || 0}min · {workout.exercises?.length || 0} exercises
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.SECONDARY[400]} />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={32} color={COLORS.SECONDARY[300]} />
                <Text style={styles.emptyActivityText}>No workouts yet</Text>
              </View>
            )}
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[600],
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileName: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 12,
  },
  fitnessLevelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  fitnessLevelText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  activitySub: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyActivityText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 8,
  },
});
