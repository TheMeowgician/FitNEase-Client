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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useSmartBack } from '../../hooks/useSmartBack';
import { Avatar } from '../../components/ui/Avatar';
import { trackingService } from '../../services/microservices/trackingService';
import { authService } from '../../services/microservices/authService';

export default function WorkoutDetailScreen() {
  const { goBack } = useSmartBack();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionData: string }>();

  const workout = params.sessionData ? JSON.parse(params.sessionData) : null;

  // Fetch group members if this is a group workout
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  useEffect(() => {
    if (workout?.sessionType === 'group' && workout?.groupId) {
      loadParticipants(workout.groupId, workout.createdAt || workout.startTime);
    }
  }, []);

  const loadParticipants = async (groupId: string, sessionDate?: string) => {
    try {
      setLoadingParticipants(true);

      // Extract date (YYYY-MM-DD) from session timestamp to find same-day participants
      const date = sessionDate ? sessionDate.split('T')[0] : undefined;

      // Step 1: Get participant user_ids from tracking service (actual session data)
      const { participants: sessionParticipants } = await trackingService.getGroupSessionParticipants(groupId, date);

      if (sessionParticipants.length === 0) {
        setParticipants([]);
        return;
      }

      // Step 2: Get user profiles from auth service
      const userIds = sessionParticipants.map(p => p.userId);
      const profiles = await authService.batchUserProfiles(userIds);

      // Step 3: Merge session data with profile data
      const merged = sessionParticipants.map(sp => {
        const profile = profiles.find(p => p.userId === sp.userId);
        return {
          userId: sp.userId.toString(),
          username: profile?.username || `User #${sp.userId}`,
          profilePicture: profile?.profilePicture || null,
          userRole: profile?.userRole || 'member',
          isCompleted: sp.isCompleted,
          durationMinutes: sp.durationMinutes,
          completionPercentage: sp.completionPercentage,
        };
      });

      setParticipants(merged);
    } catch (error) {
      console.warn('Failed to load group participants:', error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.SECONDARY[300]} />
          <Text style={styles.emptyText}>No workout data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGroup = workout.sessionType === 'group';
  const exercises = workout.exercises || [];
  const date = workout.createdAt || workout.startTime;
  const duration = workout.actualDuration || workout.duration || 0;
  const calories = workout.actualCaloriesBurned || workout.caloriesBurned || 0;
  const completion = workout.completionPercentage ?? 100;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Badge */}
        <View style={[styles.typeBadge, isGroup ? styles.typeBadgeGroup : styles.typeBadgeSolo]}>
          <Ionicons
            name={isGroup ? 'people' : 'fitness'}
            size={18}
            color={isGroup ? COLORS.PRIMARY[700] : '#059669'}
          />
          <Text style={[styles.typeBadgeText, isGroup ? styles.typeBadgeTextGroup : styles.typeBadgeTextSolo]}>
            {isGroup ? 'Group Workout' : 'Individual Workout'}
          </Text>
        </View>

        {/* Date */}
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        {date && <Text style={styles.timeText}>{formatTime(date)}</Text>}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={22} color={COLORS.PRIMARY[600]} />
            <Text style={styles.statValue}>{duration}</Text>
            <Text style={styles.statLabel}>minutes</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={22} color="#EF4444" />
            <Text style={styles.statValue}>{Math.round(calories)}</Text>
            <Text style={styles.statLabel}>calories</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
            <Text style={styles.statValue}>{Math.round(completion)}%</Text>
            <Text style={styles.statLabel}>completed</Text>
          </View>
        </View>

        {/* Debug: User ID */}
        <View style={styles.debugRow}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.SECONDARY[400]} />
          <Text style={styles.debugText}>User ID: {workout.userId || 'Unknown'}</Text>
          {workout.groupId && (
            <>
              <Text style={styles.debugDot}>·</Text>
              <Ionicons name="people-outline" size={16} color={COLORS.SECONDARY[400]} />
              <Text style={styles.debugText}>Group ID: {workout.groupId}</Text>
            </>
          )}
        </View>

        {/* Group Participants */}
        {isGroup && (
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              Participants {participants.length > 0 ? `(${participants.length})` : ''}
            </Text>
            {loadingParticipants ? (
              <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} style={{ paddingVertical: 16 }} />
            ) : participants.length > 0 ? (
              participants.map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={styles.participantCard}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/profile/[id]', params: { id: member.userId } })}
                >
                  <Avatar profilePicture={member.profilePicture} size="sm" />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName} numberOfLines={1}>{member.username}</Text>
                    <Text style={styles.participantRole}>
                      {member.isCompleted ? `Completed · ${member.durationMinutes}min` : 'Did not finish'}
                    </Text>
                  </View>
                  {member.userRole === 'mentor' && (
                    <View style={styles.mentorBadge}>
                      <Ionicons name="school" size={12} color="#FFFFFF" />
                      <Text style={styles.mentorBadgeText}>Mentor</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>
              ))
            ) : workout.groupId ? (
              <Text style={styles.noParticipantsText}>Could not load participants</Text>
            ) : (
              <Text style={styles.noParticipantsText}>No group ID available</Text>
            )}
          </View>
        )}

        {/* Exercises Section */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>
            Exercises ({exercises.length})
          </Text>

          {exercises.length === 0 ? (
            <View style={styles.noExercises}>
              <Ionicons name="barbell-outline" size={32} color={COLORS.SECONDARY[300]} />
              <Text style={styles.noExercisesText}>No exercise details available</Text>
            </View>
          ) : (
            exercises.map((exercise: any, index: number) => {
              const name = exercise.exercise_name || exercise.exerciseName || exercise.name || `Exercise ${index + 1}`;
              const muscleGroup = exercise.target_muscle_group || exercise.muscleGroup || exercise.muscle_group || '';
              const completed = exercise.completed !== false;

              return (
                <View key={exercise.exercise_id || exercise.id || index} style={styles.exerciseCard}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{name}</Text>
                    {muscleGroup ? (
                      <Text style={styles.exerciseMuscle}>{muscleGroup}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.exerciseStatus, completed && styles.exerciseStatusCompleted]}>
                    <Ionicons
                      name={completed ? 'checkmark' : 'close'}
                      size={16}
                      color={completed ? '#10B981' : COLORS.SECONDARY[400]}
                    />
                  </View>
                </View>
              );
            })
          )}
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  typeBadgeGroup: {
    backgroundColor: COLORS.PRIMARY[50],
  },
  typeBadgeSolo: {
    backgroundColor: '#ECFDF5',
  },
  typeBadgeText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
  },
  typeBadgeTextGroup: {
    color: COLORS.PRIMARY[700],
  },
  typeBadgeTextSolo: {
    color: '#059669',
  },
  dateText: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  timeText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
    fontSize: 22,
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
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  debugText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
  },
  debugDot: {
    fontSize: 12,
    color: COLORS.SECONDARY[300],
    marginHorizontal: 4,
  },
  participantsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  participantRole: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 1,
    textTransform: 'capitalize',
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    marginRight: 8,
  },
  mentorBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  noParticipantsText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    textAlign: 'center',
    paddingVertical: 16,
  },
  exercisesSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  noExercises: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noExercisesText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 8,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  exerciseNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseMuscle: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  exerciseStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.SECONDARY[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseStatusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 12,
  },
});
