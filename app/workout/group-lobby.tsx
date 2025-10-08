import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import reverbService from '../../services/reverbService';
import { socialService } from '../../services/microservices/socialService';

interface Exercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level: number;
  estimated_calories_burned: number;
  muscle_group: string;
}

interface WorkoutData {
  exercises: Exercise[];
  tabata_structure?: {
    rounds: number;
    work_duration_seconds: number;
    rest_duration_seconds: number;
    total_duration_minutes: number;
  };
  group_analysis?: {
    avg_fitness_level: number;
    min_fitness_level: number;
    max_fitness_level: number;
    fitness_level_range: string;
    total_members: number;
  };
}

interface Member {
  user_id: number;
  name: string;
  status: 'waiting' | 'ready';
}

export default function GroupWorkoutLobby() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { sessionId, groupId, workoutData: workoutDataString, initiatorId } = params;

  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isInitiator, setIsInitiator] = useState(false);
  const workoutDataRef = useRef<WorkoutData | null>(null);

  useEffect(() => {
    console.log('🏋️ Lobby mounted with params:', {
      sessionId,
      groupId,
      initiatorId,
      currentUserId: user?.id
    });

    if (workoutDataString) {
      const data = JSON.parse(workoutDataString as string);
      setWorkoutData(data);
      workoutDataRef.current = data; // Store in ref for event handlers
      console.log('📋 Workout data loaded:', data);
    }

    // Check if current user is the initiator
    const isInit = Number(user?.id) === Number(initiatorId);
    setIsInitiator(isInit);
    console.log('👤 Is initiator:', isInit);

    // Subscribe to lobby updates
    setupLobbySubscription();

    // Mark self as ready
    broadcastMemberStatus('ready');

    return () => {
      console.log('🔌 Unsubscribing from lobby channel');
      reverbService.unsubscribe(`private-lobby.${sessionId}`);
    };
  }, []);

  const setupLobbySubscription = () => {
    console.log('🔌 Subscribing to lobby channel:', `lobby.${sessionId}`);

    // Listen for member updates
    reverbService.subscribeToPrivateChannel(`lobby.${sessionId}`, {
      onEvent: (eventName, data) => {
        console.log('📨 Lobby event received:', { eventName, data });

        if (eventName === 'MemberStatusUpdate') {
          console.log('👥 Member status update:', data);
          updateMemberStatus(data.user_id, data.name, data.status);
        } else if (eventName === 'WorkoutStarted') {
          console.log('🚀 Workout started event received! Starting workout...');
          // All members navigate to workout session
          startWorkout();
        } else {
          console.log('❓ Unknown event:', eventName);
        }
      },
    });
  };

  const updateMemberStatus = (userId: number, name: string, status: 'waiting' | 'ready') => {
    setMembers((prev) => {
      const existing = prev.find((m) => m.user_id === userId);
      if (existing) {
        return prev.map((m) =>
          m.user_id === userId ? { ...m, status } : m
        );
      } else {
        return [...prev, { user_id: userId, name, status }];
      }
    });
  };

  const broadcastMemberStatus = async (status: 'waiting' | 'ready') => {
    try {
      await socialService.updateLobbyStatus(sessionId as string, status);
      console.log(`✅ Status broadcasted: ${status}`);
    } catch (error) {
      console.error('❌ Failed to broadcast status:', error);
    }
  };

  const handleStartWorkout = () => {
    console.log('🎯 handleStartWorkout called, isInitiator:', isInitiator);

    if (!isInitiator) {
      Alert.alert('Permission Denied', 'Only the workout initiator can start the session.');
      return;
    }

    Alert.alert(
      'Start Workout',
      'Are you ready to start the workout for all members?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Now',
          onPress: async () => {
            try {
              console.log('🚀 Initiator starting workout for all members...');
              console.log('📡 Calling API: startWorkout with sessionId:', sessionId);

              const response = await socialService.startWorkout(sessionId as string);
              console.log('✅ API response:', response);

              // The WorkoutStarted event will trigger startWorkout() for all members
              console.log('⏳ Waiting for WorkoutStarted event...');
            } catch (error) {
              console.error('❌ Failed to start workout:', error);
              Alert.alert('Error', 'Failed to start workout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const startWorkout = () => {
    const currentWorkoutData = workoutDataRef.current || workoutData;
    console.log('🏃 startWorkout called, workoutData exists:', !!currentWorkoutData);

    if (!currentWorkoutData) {
      console.error('❌ No workout data available!');
      Alert.alert('Error', 'Workout data not loaded. Please try again.');
      return;
    }

    // Create TabataWorkoutSession format
    const tabataSession = {
      exercises: currentWorkoutData.exercises,
      total_duration_minutes: currentWorkoutData.tabata_structure?.total_duration_minutes || 32,
      rounds: currentWorkoutData.tabata_structure?.rounds || 8,
      work_duration_seconds: currentWorkoutData.tabata_structure?.work_duration_seconds || 20,
      rest_duration_seconds: currentWorkoutData.tabata_structure?.rest_duration_seconds || 10,
      session_id: sessionId as string,
      group_id: groupId as string,
    };

    console.log('🎬 Navigating to workout session with data:', tabataSession);

    router.replace({
      pathname: '/workout/session',
      params: {
        sessionData: JSON.stringify(tabataSession),
        type: 'group_tabata',
        initiatorId: initiatorId as string,
        groupId: groupId as string,
      },
    });
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave the workout lobby?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            broadcastMemberStatus('waiting');
            router.back();
          },
        },
      ]
    );
  };

  const getDifficultyLabel = (level: number) => {
    switch (level) {
      case 1: return 'Beginner';
      case 2: return 'Intermediate';
      case 3: return 'Advanced';
      default: return 'Unknown';
    }
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return COLORS.SUCCESS[500];
      case 2: return COLORS.WARNING[500];
      case 3: return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[500];
    }
  };

  if (!workoutData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
            <Text style={styles.loadingText}>Loading workout...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const { exercises, tabata_structure, group_analysis } = workoutData;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Workout Lobby</Text>
          <Text style={styles.headerSubtitle}>Waiting for all members...</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          </View>
          <View style={styles.membersList}>
            {members.map((member) => (
              <View key={member.user_id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person" size={20} color={COLORS.PRIMARY[600]} />
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={[styles.statusBadge, member.status === 'ready' && styles.statusReady]}>
                  <Ionicons
                    name={member.status === 'ready' ? 'checkmark-circle' : 'time'}
                    size={16}
                    color={member.status === 'ready' ? COLORS.SUCCESS[600] : COLORS.WARNING[600]}
                  />
                  <Text style={[styles.statusText, member.status === 'ready' && styles.statusReadyText]}>
                    {member.status === 'ready' ? 'Ready' : 'Waiting'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Tabata Structure */}
        {tabata_structure && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="timer" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Tabata Structure</Text>
            </View>
            <View style={styles.tabataGrid}>
              <View style={styles.tabataCard}>
                <Text style={styles.tabataValue}>{tabata_structure.rounds}</Text>
                <Text style={styles.tabataLabel}>Rounds</Text>
              </View>
              <View style={styles.tabataCard}>
                <Text style={styles.tabataValue}>{tabata_structure.work_duration_seconds}s</Text>
                <Text style={styles.tabataLabel}>Work</Text>
              </View>
              <View style={styles.tabataCard}>
                <Text style={styles.tabataValue}>{tabata_structure.rest_duration_seconds}s</Text>
                <Text style={styles.tabataLabel}>Rest</Text>
              </View>
              <View style={styles.tabataCard}>
                <Text style={styles.tabataValue}>{tabata_structure.total_duration_minutes}min</Text>
                <Text style={styles.tabataLabel}>Total</Text>
              </View>
            </View>
          </View>
        )}

        {/* Group Analysis */}
        {group_analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Group Fitness Level</Text>
            </View>
            <View style={styles.analysisCard}>
              <View style={styles.analysisRow}>
                <Text style={styles.analysisLabel}>Level Range:</Text>
                <Text style={styles.analysisValue}>
                  {getDifficultyLabel(group_analysis.min_fitness_level)} - {getDifficultyLabel(group_analysis.max_fitness_level)}
                </Text>
              </View>
              <View style={styles.analysisRow}>
                <Text style={styles.analysisLabel}>Group Type:</Text>
                <Text style={styles.analysisValue}>
                  {group_analysis.fitness_level_range === 'homogeneous' ? 'Similar Levels' : 'Mixed Levels'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Exercises Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
          </View>
          {exercises.map((exercise, index) => (
            <View key={exercise.exercise_id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseNumber}>
                  <Text style={styles.exerciseNumberText}>#{index + 1}</Text>
                </View>
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
              </View>
              <View style={styles.exerciseDetails}>
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '20' }]}>
                  <Text style={[styles.difficultyText, { color: getDifficultyColor(exercise.difficulty_level) }]}>
                    {getDifficultyLabel(exercise.difficulty_level)}
                  </Text>
                </View>
                <View style={styles.exerciseStat}>
                  <Ionicons name="body-outline" size={14} color={COLORS.SECONDARY[600]} />
                  <Text style={styles.exerciseStatText}>{exercise.muscle_group}</Text>
                </View>
                <View style={styles.exerciseStat}>
                  <Ionicons name="flame-outline" size={14} color={COLORS.WARNING[500]} />
                  <Text style={styles.exerciseStatText}>{exercise.estimated_calories_burned} cal</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        {isInitiator ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
            <Ionicons name="play-circle" size={24} color={COLORS.NEUTRAL.WHITE} />
            <Text style={styles.startButtonText}>Start Workout for Everyone</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
            <Text style={styles.waitingText}>Waiting for workout to start...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginLeft: 8,
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberName: {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusReady: {
    backgroundColor: COLORS.SUCCESS[50],
  },
  statusText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[600],
    marginLeft: 4,
  },
  statusReadyText: {
    color: COLORS.SUCCESS[600],
  },
  tabataGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  tabataCard: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY[50],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabataValue: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  tabataLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 4,
  },
  analysisCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 16,
    borderRadius: 12,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analysisLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  analysisValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseName: {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  exerciseStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseStatText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
  },
  waitingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginLeft: 12,
  },
});
