import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { authService, User } from '../../../services/microservices/authService';
import { trackingService } from '../../../services/microservices/trackingService';
import { COLORS, FONTS, FONT_SIZES } from '../../../constants/colors';

interface MemberStats {
  totalSessions: number;
  completedSessions: number;
  totalMinutes: number;
  totalCalories: number;
  averageSessionDuration: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null;
  // Additional fields from backend getSessionStats
  groupSessionsCount?: number;
  individualSessionsCount?: number;
  thisWeekSessions?: number;
  thisMonthSessions?: number;
}

interface WeeklySummary {
  workoutsThisWeek: number;
  minutesThisWeek: number;
  caloriesThisWeek: number;
  daysActive: number;
}

interface Assessment {
  assessment_id: number;
  assessment_type: string;
  assessment_date: string;
  score: number;
  assessment_data: any;
}

interface SessionHistory {
  id: string;
  workoutName: string;
  sessionType?: 'individual' | 'group';
  duration: number;
  caloriesBurned: number;
  completionPercentage: number;
  status: 'completed' | 'in-progress' | 'paused' | 'cancelled';
  date: string;
  exercises: any[];
  // Keep full session data for navigation to workout-detail
  _raw?: any;
}

export default function MemberDetailScreen() {
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();

  const [member, setMember] = useState<User | null>(null);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sessions, setSessions] = useState<SessionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'assessments' | 'sessions'>('overview');

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadMemberData();
      }
    }, [id])
  );

  const loadMemberData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      console.log('Loading member data for ID:', id);

      // Load all data in parallel with individual error handling
      const results = await Promise.allSettled([
        authService.getMemberProfile(id),
        trackingService.getMemberSessionStats(id),
        trackingService.getMemberWeeklySummary(id),
        authService.getMemberAssessments(id),
        trackingService.getSessions({ userId: id, limit: 50 }),
      ]);

      // Profile
      if (results[0].status === 'fulfilled' && results[0].value) {
        console.log('Member profile:', results[0].value);
        setMember(results[0].value);
      } else {
        console.error('Failed to load member profile:', results[0].status === 'rejected' ? results[0].reason : 'null response');
      }

      // Stats
      if (results[1].status === 'fulfilled' && results[1].value) {
        console.log('Member stats:', results[1].value);
        setStats(results[1].value);
      }

      // Weekly summary
      if (results[2].status === 'fulfilled' && results[2].value) {
        console.log('Member weekly:', results[2].value);
        setWeeklySummary(results[2].value);
      }

      // Assessments
      if (results[3].status === 'fulfilled') {
        console.log('Member assessments:', results[3].value);
        setAssessments(results[3].value || []);
      }

      // Sessions
      if (results[4].status === 'fulfilled' && results[4].value) {
        console.log('Member sessions:', results[4].value);
        const transformedSessions: SessionHistory[] = (results[4].value?.sessions || []).map((s: any) => ({
          id: s.id,
          workoutName: s.workoutName || 'Tabata Workout',
          sessionType: s.sessionType,
          duration: s.duration || 0,
          caloriesBurned: s.actualCaloriesBurned || 0,
          completionPercentage: s.completionPercentage || 0,
          status: s.status || 'completed',
          date: s.createdAt || s.startTime,
          exercises: s.exercises || [],
          _raw: s,
        }));
        setSessions(transformedSessions);
      }
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemberData();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getFitnessLevelColor = (level?: string) => {
    switch (level) {
      case 'beginner':
        return COLORS.SUCCESS[500];
      case 'intermediate':
        return COLORS.WARNING[500];
      case 'advanced':
        return COLORS.ERROR[500];
      default:
        return COLORS.SECONDARY[400];
    }
  };

  const getAssessmentTypeLabel = (type: string) => {
    switch (type) {
      case 'initial':
        return 'Initial Assessment';
      case 'initial_onboarding':
        return 'Initial Onboarding';
      case 'weekly':
        return 'Weekly Check-In';
      case 'progress':
        return 'Progress Assessment';
      default:
        // Format any unknown type: replace underscores with spaces, capitalize words
        return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Profile Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fitness Level</Text>
            <View style={[styles.levelBadge, { backgroundColor: getFitnessLevelColor(member?.fitnessLevel) + '20' }]}>
              <Text style={[styles.levelText, { color: getFitnessLevelColor(member?.fitnessLevel) }]}>
                {member?.fitnessLevel
                  ? member.fitnessLevel.charAt(0).toUpperCase() + member.fitnessLevel.slice(1)
                  : 'Not set'}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Activity Level</Text>
            <Text style={styles.infoValue}>
              {member?.activityLevel?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not set'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Workout Days</Text>
            <Text style={styles.infoValue}>
              {member?.workoutDays?.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') || 'Not set'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{formatDate(member?.createdAt || '')}</Text>
          </View>
        </View>
      </View>

      {/* Weekly Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="fitness" size={24} color={COLORS.PRIMARY[600]} />
            <Text style={styles.statValue}>{weeklySummary?.workoutsThisWeek || 0}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={24} color={COLORS.SUCCESS[600]} />
            <Text style={styles.statValue}>{weeklySummary?.minutesThisWeek || 0}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={24} color={COLORS.WARNING[500]} />
            <Text style={styles.statValue}>{weeklySummary?.caloriesThisWeek || 0}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={24} color={COLORS.SECONDARY[600]} />
            <Text style={styles.statValue}>{weeklySummary?.daysActive || 0}</Text>
            <Text style={styles.statLabel}>Days Active</Text>
          </View>
        </View>
      </View>

      {/* Overall Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Progress</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Completed Sessions</Text>
            <Text style={styles.infoValue}>{stats?.completedSessions || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Time</Text>
            <Text style={styles.infoValue}>{formatDuration(stats?.totalMinutes || 0)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Calories</Text>
            <Text style={styles.infoValue}>{Math.round(stats?.totalCalories || 0)} kcal</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Group Sessions</Text>
            <Text style={styles.infoValue}>{stats?.groupSessionsCount || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Individual Sessions</Text>
            <Text style={styles.infoValue}>{stats?.individualSessionsCount || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>This Week</Text>
            <Text style={styles.infoValue}>{stats?.thisWeekSessions || 0} sessions</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>This Month</Text>
            <Text style={styles.infoValue}>{stats?.thisMonthSessions || 0} sessions</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAssessmentsTab = () => (
    <View style={styles.tabContent}>
      {assessments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={48} color={COLORS.SECONDARY[300]} />
          <Text style={styles.emptyText}>No assessments yet</Text>
          <Text style={styles.emptySubtext}>
            This member hasn't completed any fitness assessments
          </Text>
        </View>
      ) : (
        <View style={styles.assessmentsList}>
          {assessments.map((assessment) => (
            <View key={assessment.assessment_id} style={styles.assessmentCard}>
              <View style={styles.assessmentHeader}>
                <View style={styles.assessmentType}>
                  <Ionicons
                    name={assessment.assessment_type === 'weekly' ? 'calendar' : 'clipboard'}
                    size={20}
                    color={COLORS.PRIMARY[600]}
                  />
                  <Text style={styles.assessmentTypeText}>
                    {getAssessmentTypeLabel(assessment.assessment_type)}
                  </Text>
                </View>
                <Text style={styles.assessmentDate}>
                  {formatDate(assessment.assessment_date)}
                </Text>
              </View>
              <View style={styles.assessmentBody}>
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreValue}>{assessment.score}</Text>
                </View>
                {assessment.assessment_data && (
                  <View style={styles.assessmentDetails}>
                    {assessment.assessment_data.motivation_level && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Motivation</Text>
                        <Text style={styles.detailValue}>
                          {assessment.assessment_data.motivation_level}/10
                        </Text>
                      </View>
                    )}
                    {assessment.assessment_data.workout_rating && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Workout Rating</Text>
                        <Text style={styles.detailValue}>
                          {assessment.assessment_data.workout_rating}/5
                        </Text>
                      </View>
                    )}
                    {assessment.assessment_data.difficulty_level && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Difficulty</Text>
                        <Text style={styles.detailValue}>
                          {assessment.assessment_data.difficulty_level}
                        </Text>
                      </View>
                    )}
                    {assessment.assessment_data.weight && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Weight</Text>
                        <Text style={styles.detailValue}>
                          {assessment.assessment_data.weight} kg
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderSessionsTab = () => (
    <View style={styles.tabContent}>
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="fitness-outline" size={48} color={COLORS.SECONDARY[300]} />
          <Text style={styles.emptyText}>No workout sessions yet</Text>
          <Text style={styles.emptySubtext}>
            This member hasn't completed any workout sessions
          </Text>
        </View>
      ) : (
        <View style={styles.sessionsList}>
          {sessions.map((session) => {
            const isGroup = session.sessionType === 'group';
            return (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: '/workout/workout-detail',
                  params: { sessionData: JSON.stringify(session._raw || session) },
                })}
              >
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <View style={[styles.sessionIcon, { backgroundColor: isGroup ? COLORS.PRIMARY[50] : '#ECFDF5' }]}>
                      <Ionicons
                        name={isGroup ? 'people' : 'fitness'}
                        size={18}
                        color={isGroup ? COLORS.PRIMARY[600] : '#10B981'}
                      />
                    </View>
                    <View>
                      <Text style={styles.sessionName}>
                        {isGroup ? 'Group Tabata Workout' : 'Tabata Workout'}
                      </Text>
                      <Text style={styles.sessionDateSmall}>
                        {formatDate(session.date)} · {session.exercises.length} exercises
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.sessionDurationText}>{session.duration}min</Text>
                    <Text style={styles.sessionCaloriesText}>{Math.round(session.caloriesBurned)} kcal</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading member data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Details</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Member Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(member?.username || username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.memberName}>
            {member?.firstName && member?.lastName
              ? `${member.firstName} ${member.lastName}`
              : member?.username || username || 'Unknown'}
          </Text>
          <Text style={styles.memberUsername}>@{member?.username || username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{member?.role || 'Member'}</Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assessments' && styles.activeTab]}
            onPress={() => setActiveTab('assessments')}
          >
            <Text style={[styles.tabText, activeTab === 'assessments' && styles.activeTabText]}>
              Assessments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sessions' && styles.activeTab]}
            onPress={() => setActiveTab('sessions')}
          >
            <Text style={[styles.tabText, activeTab === 'sessions' && styles.activeTabText]}>
              Sessions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'assessments' && renderAssessmentsTab()}
        {activeTab === 'sessions' && renderSessionsTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
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
    padding: 8,
    width: 44,
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  headerRight: {
    width: 44,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  memberName: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  memberUsername: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textTransform: 'capitalize',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.PRIMARY[600],
  },
  tabText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
  },
  activeTabText: {
    color: COLORS.PRIMARY[600],
  },
  tabContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[100],
  },
  infoLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  infoValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 8,
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 4,
    textAlign: 'center',
  },
  assessmentsList: {
    gap: 12,
  },
  assessmentCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  assessmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.NEUTRAL[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  assessmentType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assessmentTypeText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  assessmentDate: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  assessmentBody: {
    padding: 14,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginRight: 8,
  },
  scoreValue: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  assessmentDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[100],
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  detailValue: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  sessionsList: {
    gap: 12,
  },
  sessionCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.NEUTRAL[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sessionName: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  sessionDateSmall: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  sessionDurationText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  sessionCaloriesText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
});
