import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';
import { usePlanningService } from '../../hooks/api/usePlanningService';
import { trackingService } from '../../services/microservices/trackingService';
import { WorkoutSetModal } from '../../components/workout/WorkoutSetModal';
import { ExerciseCard } from '../../components/exercise/ExerciseCard';
import { COLORS, FONTS } from '../../constants/colors';

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

// ====================================================================
// 🧪 TESTING FLAG: Daily Workout Limit Control
// ====================================================================
// TODO: RESTORE TO TRUE BEFORE PRODUCTION DEPLOYMENT!
// Set to false during testing to allow unlimited workouts per day
// Set to true in production to enforce one workout per day limit
const ENABLE_DAILY_WORKOUT_LIMIT = false; // 🧪 TESTING MODE - UNLIMITED WORKOUTS
// ====================================================================

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const { getTodayExercises } = usePlanningService();

  // State for today's exercises from backend weekly plan
  const [mlRecommendations, setMlRecommendations] = useState<any[]>([]);
  const [algorithm] = useState<string>('backend_plan');
  const [algorithmDisplay] = useState<string>('Backend Plan');

  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWorkoutSetModal, setShowWorkoutSetModal] = useState(false);
  const [currentWorkoutSet, setCurrentWorkoutSet] = useState<any>(null);
  const [isTodayWorkoutCompleted, setIsTodayWorkoutCompleted] = useState(false); // Track if today's workout is done

  useEffect(() => {
    loadWorkoutData();
  }, [difficultyFilter]);

  // Check if today is a workout day
  const isWorkoutDay = () => {
    if (!user?.workoutDays || user.workoutDays.length === 0) {
      return true; // Show workouts if no schedule set
    }
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = DAYS_OF_WEEK[today];
    return user.workoutDays.includes(todayName);
  };

  /**
   * Check if user has completed a workout TODAY
   * If completed, hide exercises and show completion message
   */
  const checkTodayWorkoutCompletion = async () => {
    if (!user) return;

    // 🧪 TESTING MODE: Skip check if daily limit is disabled
    if (!ENABLE_DAILY_WORKOUT_LIMIT) {
      console.log('🧪 [WORKOUTS] Daily workout limit DISABLED - unlimited workouts allowed');
      setIsTodayWorkoutCompleted(false);
      return;
    }

    try {
      console.log('✅ [WORKOUTS] Checking if today\'s workout is completed...');

      const userId = String(user.id);
      const sessions = await trackingService.getSessions({
        userId,
        status: 'completed',
        limit: 50, // Get recent sessions
      });

      // Get today's date range (start and end of day)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      console.log(`📅 [WORKOUTS] Today range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

      // Check if any session was completed today
      const todaySession = sessions.sessions.find((session: any) => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= todayStart && sessionDate <= todayEnd;
      });

      if (todaySession) {
        console.log(`✅ [WORKOUTS] Found completed workout today (session: ${todaySession.id})`);
        setIsTodayWorkoutCompleted(true);
      } else {
        console.log(`📅 [WORKOUTS] No completed workout today`);
        setIsTodayWorkoutCompleted(false);
      }
    } catch (error) {
      console.error('❌ [WORKOUTS] Failed to check today\'s workout completion:', error);
      setIsTodayWorkoutCompleted(false);
    }
  };

  const loadWorkoutData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('💪 [WORKOUTS] Fetching today\'s exercises from backend plan...');

      const userId = String(user.id);
      const todayExercises = await getTodayExercises(userId);
      setMlRecommendations(todayExercises);

      console.log(`💪 [WORKOUTS] Got ${todayExercises?.length || 0} exercises for today from backend plan`);

      // Check if today's workout is completed
      await checkTodayWorkoutCompletion();

      // 🐛 DEBUG: Log exercises to compare with other pages
      if (todayExercises && todayExercises.length > 0) {
        const fitnessLvl = user.fitnessLevel || 'beginner';
        const count = fitnessLvl === 'beginner' ? 4 : fitnessLvl === 'intermediate' ? 5 : 6;
        const firstExercises = todayExercises.slice(0, count);
        console.log(`🐛 [WORKOUTS DEBUG] Fitness Level: ${fitnessLvl}, Count: ${count}`);
        console.log(`🐛 [WORKOUTS DEBUG] First exercise: ${firstExercises[0]?.exercise_name} (ID: ${firstExercises[0]?.exercise_id})`);
        console.log(`🐛 [WORKOUTS DEBUG] All ${count} exercises:`, firstExercises.map((e: any) => `${e.exercise_name} (${e.exercise_id})`));
      }

      // Alert user if no exercises were loaded
      if (!todayExercises || todayExercises.length === 0) {
        console.log('📅 [WORKOUTS] No exercises scheduled for today (might be rest day)');
      }
    } catch (error) {
      console.error('❌ [WORKOUTS] Fatal error loading workout data:', error);

      // Show error to user
      Alert.alert(
        'Error Loading Workouts',
        'An unexpected error occurred while loading your workout plan. Please try again.',
        [
          { text: 'Retry', onPress: () => loadWorkoutData() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkoutData();
    setRefreshing(false);
  };

  const handleViewWorkoutSet = () => {
    if (!mlRecommendations || mlRecommendations.length === 0) {
      Alert.alert(
        'No Recommendations',
        'Please wait while we load your workout recommendations.'
      );
      return;
    }

    // Get user's fitness level
    const fitnessLevel = user?.fitnessLevel || 'beginner';

    // Determine number of exercises based on fitness level (same as Dashboard)
    const exerciseCount = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'intermediate' ? 5 : 6;
    const exercises = mlRecommendations.slice(0, Math.min(exerciseCount, mlRecommendations.length));

    // Calculate total duration and calories
    const totalDuration = exercises.length * 4; // 4 minutes per exercise (Tabata protocol)
    const totalCalories = exercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 0), 0);

    const workoutSet = {
      exercises,
      total_duration: totalDuration,
      total_calories: totalCalories,
      difficulty: fitnessLevel,
    };

    setCurrentWorkoutSet(workoutSet);
    setShowWorkoutSetModal(true);
  };

  const handleStartWorkoutSet = () => {
    if (!currentWorkoutSet || !user) return;

    // Close modal
    setShowWorkoutSetModal(false);

    // Generate a proper Tabata session like the dashboard does
    const session = {
      session_id: `tabata_${user.id}_${Date.now()}`,
      session_name: `${currentWorkoutSet.algorithm || 'AI'} Tabata Workout`,
      difficulty_level: currentWorkoutSet.difficulty || user.fitnessLevel || 'beginner',
      total_exercises: currentWorkoutSet.exercises.length,
      total_duration_minutes: currentWorkoutSet.total_duration,
      estimated_calories: currentWorkoutSet.total_calories,
      exercises: currentWorkoutSet.exercises,
      created_at: new Date().toISOString(),
    };

    // Navigate to workout session with proper sessionData parameter
    router.push({
      pathname: '/workout/session',
      params: {
        sessionData: JSON.stringify(session),
        type: 'tabata'
      }
    });
  };

  const handleStartTabataExercise = (recommendation: any) => {
    const difficultyText = getDifficultyText(recommendation.difficulty_level);
    Alert.alert(
      'Start Tabata Exercise',
      `Ready to start "${recommendation.exercise_name}"? This is a ${difficultyText} level exercise.\n\nConfidence: ${Math.round(recommendation.recommendation_score * 100)}%\n\nReason: ${recommendation.recommendation_reason}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Exercise',
          onPress: () => {
            // Navigate to workout session screen
            router.push({
              pathname: '/workout/session',
              params: {
                workoutId: recommendation.workout_id.toString(),
                exerciseId: recommendation.exercise_id.toString(),
                type: 'individual'
              }
            });
          }
        }
      ]
    );
  };

  const handleRefreshRecommendations = async () => {
    if (!user) return;
    console.log('🔄 [WORKOUTS] REFRESH button pressed - reloading from backend...');
    setIsLoading(true);

    try {
      const userId = String(user.id);
      const todayExercises = await getTodayExercises(userId);
      setMlRecommendations(todayExercises);
      console.log('🔄 [WORKOUTS] Refreshed with', todayExercises?.length || 0, 'exercises from backend plan');
    } catch (error) {
      console.error('❌ [WORKOUTS] Error refreshing:', error);
      Alert.alert('Error', 'Failed to refresh workouts. Please try again.');
    } finally {
      setIsLoading(false);
      console.log('🔄 [WORKOUTS] REFRESH completed');
    }
  };

  // Add missing function definitions
  const handleCreateGroup = () => {
    Alert.alert('Coming Soon', 'Group creation feature coming soon!');
  };

  const handleJoinGroup = (group: any) => {
    Alert.alert('Join Group', `Join ${group.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Join', onPress: () => Alert.alert('Joined!', `You've joined ${group.name}`) }
    ]);
  };

  // Mock data for groups (since they're referenced but not defined)
  const myGroups: any[] = [];
  const publicGroups: any[] = [];

  const handleViewDetails = (recommendation: any) => {
    const duration = recommendation.default_duration_seconds || 0;
    const durationText = duration >= 60 ? `${Math.floor(duration / 60)} minutes` : `${duration} seconds`;

    Alert.alert(
      recommendation.exercise_name || 'Exercise',
      `Confidence: ${Math.round((recommendation.recommendation_score || 0) * 100)}%\nTarget: ${formatMuscleGroup(recommendation.target_muscle_group || 'N/A')}\nDuration: ${durationText}\nCalories: ~${recommendation.estimated_calories_burned || 0}\nEquipment: ${recommendation.equipment_needed || 'Not specified'}\n\n${recommendation.recommendation_reason || 'ML recommended'}`,
      [{ text: 'Close' }]
    );
  };



  // Smart algorithm selection based on user data
  const getRecommendedAlgorithm = (): string => {
    // Simulate user rating count (in real app, get from API)
    const userRatingCount = 0; // New user for now

    if (userRatingCount >= 10) {
      return 'hybrid'; // Best performance with sufficient data
    } else if (userRatingCount >= 3) {
      return 'content_based'; // Good fallback with some data
    } else {
      return 'content_based'; // New user - use content-based
    }
  };

  const getCurrentAlgorithmInfo = () => {
    const algorithm = getRecommendedAlgorithm();
    const info = {
      'hybrid': {
        name: 'AI Hybrid',
        description: 'Combines your preferences with similar users',
        confidence: 95,
        icon: 'analytics' as const,
        color: '#10B981'
      },
      'content_based': {
        name: 'Smart Match',
        description: 'Based on exercise characteristics and fitness goals',
        confidence: 85,
        icon: 'fitness' as const,
        color: '#3B82F6'
      },
      'collaborative': {
        name: 'Community',
        description: 'Based on users with similar preferences',
        confidence: 75,
        icon: 'people' as const,
        color: '#8B5CF6'
      }
    };
    return info[algorithm as keyof typeof info];
  };


  const renderFilterButtons = () => (
    <View>
      {/* Difficulty Filter Only - Algorithm is automatically selected */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'beginner', 'intermediate', 'advanced'] as DifficultyFilter[]).map((difficultyOption) => (
          <TouchableOpacity
            key={difficultyOption}
            style={[styles.filterButton, difficultyFilter === difficultyOption && styles.filterButtonActive]}
            onPress={() => setDifficultyFilter(difficultyOption)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterButtonText, difficultyFilter === difficultyOption && styles.filterButtonTextActive]}>
              {difficultyOption === 'all' ? 'All Levels' :
               (difficultyOption && difficultyOption.charAt(0).toUpperCase() + difficultyOption.slice(1)) || 'All Levels'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search exercises..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#9CA3AF"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <TouchableOpacity style={styles.quickActionButton} onPress={handleRefreshRecommendations} activeOpacity={0.7}>
        <View style={[styles.quickActionIcon, { backgroundColor: '#10B981' }]}>
          <Ionicons name="refresh" size={24} color="white" />
        </View>
        <Text style={styles.quickActionText}>Refresh</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => Alert.alert('How It Works', 'FitNEase analyzes your:\n\n• Fitness level and goals\n• Workout history\n• Exercise preferences\n• Community patterns\n\nTo create personalized Tabata workouts that match your needs!')}
        activeOpacity={0.7}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F6' }]}>
          <Ionicons name="information-circle" size={24} color="white" />
        </View>
        <Text style={styles.quickActionText}>How It Works</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => router.push('/profile')}
        activeOpacity={0.7}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF6' }]}>
          <Ionicons name="person" size={24} color="white" />
        </View>
        <Text style={styles.quickActionText}>My Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMLRecommendations = () => {
    const filteredRecommendations = getFilteredRecommendations();

    // Group recommendations by algorithm for workout sets
    // 🔥 UNIFIED: Single workout set from ML service (same as Dashboard)
    const workoutSets = filteredRecommendations.length > 0 ? [
      { name: 'AI Recommended', recs: filteredRecommendations, icon: 'flash', color: '#10B981' },
    ] : [];

    return (
      <View>
        {/* Main Recommendations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended Workout Sets</Text>
            <View style={styles.mlBadge}>
              <Ionicons name="sparkles" size={16} color="#10B981" />
              <Text style={styles.mlBadgeText}>Personalized</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Personalized Tabata workout sets tailored to your fitness level
          </Text>

          {isTodayWorkoutCompleted ? (
            // Show completion message if today's workout is done
            <View style={styles.completedWorkoutCard}>
              <View style={styles.completedWorkoutIconContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.completedWorkoutTitle}>Today's Workout Complete!</Text>
              <Text style={styles.completedWorkoutText}>
                Excellent work! You've finished your Tabata workout for today.
                Come back tomorrow for your next session.
              </Text>
              <View style={styles.completedWorkoutStats}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
                <Text style={styles.completedWorkoutStatsText}>
                  Keep your streak going!
                </Text>
              </View>
            </View>
          ) : filteredRecommendations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="fitness-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No recommendations yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your filters or check back later for ML-powered exercise suggestions
              </Text>
            </View>
          ) : (
            <>
              {/* Workout Set Cards */}
              {workoutSets.map((set, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.workoutSetCard}
                  onPress={() => handleViewWorkoutSet()}
                  activeOpacity={0.92}
                >
                  {/* Header */}
                  <View style={styles.workoutSetHeader}>
                    <View style={[styles.algorithmIconLarge, { backgroundColor: set.color }]}>
                      <Ionicons name={set.icon as any} size={36} color={COLORS.NEUTRAL.WHITE} />
                    </View>
                    <View style={styles.workoutSetTitleContainer}>
                      <Text style={styles.workoutSetTitle}>{set.name} Tabata</Text>
                      <Text style={styles.workoutSetSubtitle}>
                        {Math.min(set.recs.length, user?.fitnessLevel === 'beginner' ? 4 : user?.fitnessLevel === 'intermediate' ? 5 : 6)} exercises • Tabata protocol
                      </Text>
                    </View>
                  </View>

                  {/* Exercise Preview */}
                  <View style={styles.exercisePreviewList}>
                    {(set.recs || []).slice(0, 3).map((ex: any, idx: number) => (
                      <ExerciseCard
                        key={ex.exercise_id}
                        exercise={ex}
                        index={idx}
                        showCompletionIcon={true}
                        showMLBadge={true} // 🧪 Testing: Show ML model type
                        mlModelType={algorithmDisplay || 'Hybrid'} // Dynamic: shows actual algorithm
                      />
                    ))}
                    {set.recs.length > 3 && (
                      <Text style={styles.moreExercises}>+{set.recs.length - 3} more</Text>
                    )}
                  </View>

                  {/* Stats */}
                  <View style={styles.workoutSetStats}>
                    <View style={styles.workoutSetStat}>
                      <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
                      <Text style={styles.workoutSetStatText}>
                        {Math.min(set.recs.length, user?.fitnessLevel === 'beginner' ? 4 : user?.fitnessLevel === 'intermediate' ? 5 : 6) * 4} min
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.workoutSetStat}>
                      <Ionicons name="flame-outline" size={20} color="#F59E0B" />
                      <Text style={styles.workoutSetStatText}>
                        ~{(set.recs || []).slice(0, user?.fitnessLevel === 'beginner' ? 4 : user?.fitnessLevel === 'intermediate' ? 5 : 6)
                          .reduce((sum: number, ex: any) => sum + (ex.estimated_calories_burned || 0), 0)} cal
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.workoutSetStat}>
                      <Ionicons name="fitness-outline" size={20} color="#8B5CF6" />
                      <Text style={styles.workoutSetStatText}>
                        {(() => {
                          const workoutExercises = (set.recs || []).slice(0, user?.fitnessLevel === 'beginner' ? 4 : user?.fitnessLevel === 'intermediate' ? 5 : 6);
                          const muscleGroups = new Set<string>();
                          workoutExercises.forEach((ex: any) => {
                            if (ex.target_muscle_group) {
                              ex.target_muscle_group.split(',').forEach((mg: string) => muscleGroups.add(mg.trim()));
                            }
                          });
                          const uniqueGroups = Array.from(muscleGroups);
                          if (uniqueGroups.length >= 3) {
                            return 'Full Body';
                          } else if (uniqueGroups.length > 0) {
                            return uniqueGroups.map((g: string) =>
                              g.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                            ).join(' & ');
                          }
                          return 'Full Body';
                        })()}
                      </Text>
                    </View>
                  </View>

                  {/* View Button */}
                  <View style={styles.viewDetailsButton}>
                    <Text style={styles.viewDetailsText}>View Workout Set</Text>
                    <Ionicons name="chevron-forward" size={22} color={COLORS.NEUTRAL.WHITE} />
                  </View>
                </TouchableOpacity>
              ))}

              {/* Individual Exercise List (Collapsed) */}
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => Alert.alert('Individual Exercises', 'Tap on any workout set above to see individual exercises in detail.')}
                activeOpacity={0.7}
              >
                <Ionicons name="list-outline" size={20} color="#6B7280" />
                <Text style={styles.expandButtonText}>View Individual Exercises</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderGroupWorkouts = () => (
    <View>
      {/* Quick Actions for Groups */}
      <View style={styles.groupQuickActions}>
        <TouchableOpacity style={styles.groupActionButton} onPress={handleCreateGroup} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={24} color={COLORS.PRIMARY[600]} />
          <Text style={styles.groupActionText}>Create Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.groupActionButton}
          onPress={() => Alert.alert('Coming Soon', 'Join public workout coming soon!')}
          activeOpacity={0.7}
        >
          <Ionicons name="globe" size={24} color={COLORS.PRIMARY[600]} />
          <Text style={styles.groupActionText}>Join Public</Text>
        </TouchableOpacity>
      </View>

      {/* My Groups */}
      {myGroups.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          {myGroups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => router.push(`/groups/${group.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.groupCardContent}>
                <View style={styles.groupCardLeft}>
                  <View style={styles.groupAvatar}>
                    <Ionicons name="people" size={24} color="white" />
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupDescription}>{group.description}</Text>
                    <Text style={styles.groupMembersCount}>{group.memberCount} members</Text>
                  </View>
                </View>
                <View style={styles.groupCardRight}>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Discover Groups */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discover Groups</Text>
        {publicGroups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.groupCard}
            onPress={() => handleJoinGroup(group)}
            activeOpacity={0.7}
          >
            <View style={styles.groupCardContent}>
              <View style={styles.groupCardLeft}>
                <View style={[styles.groupAvatar, { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name="globe" size={24} color="white" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupDescription}>{group.description}</Text>
                  <Text style={styles.groupMembersCount}>{group.memberCount} members</Text>
                </View>
              </View>
              <View style={styles.groupCardRight}>
                <TouchableOpacity style={styles.joinButton} onPress={() => handleJoinGroup(group)}>
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const getDifficultyTagStyle = (difficulty: number | string) => {
    // Convert to normalized difficulty level (1-3)
    let diffLevel = 1; // Default to beginner

    if (typeof difficulty === 'string') {
      switch (difficulty.toLowerCase()) {
        case 'beginner': diffLevel = 1; break;
        case 'medium':
        case 'intermediate': diffLevel = 2; break;
        case 'advanced':
        case 'expert': diffLevel = 3; break;
        default:
          const parsed = parseInt(difficulty);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
            diffLevel = parsed;
          }
      }
    } else if (typeof difficulty === 'number' && difficulty >= 1 && difficulty <= 3) {
      diffLevel = difficulty;
    }

    switch (diffLevel) {
      case 1: return { backgroundColor: '#10B981' + '20' };
      case 2: return { backgroundColor: '#F59E0B' + '20' };
      case 3: return { backgroundColor: '#EF4444' + '20' };
      default: return { backgroundColor: '#6B7280' + '20' };
    }
  };

  const getDifficultyTagTextStyle = (difficulty: number | string) => {
    // Convert to normalized difficulty level (1-3)
    let diffLevel = 1; // Default to beginner

    if (typeof difficulty === 'string') {
      switch (difficulty.toLowerCase()) {
        case 'beginner': diffLevel = 1; break;
        case 'medium':
        case 'intermediate': diffLevel = 2; break;
        case 'advanced':
        case 'expert': diffLevel = 3; break;
        default:
          const parsed = parseInt(difficulty);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
            diffLevel = parsed;
          }
      }
    } else if (typeof difficulty === 'number' && difficulty >= 1 && difficulty <= 3) {
      diffLevel = difficulty;
    }

    switch (diffLevel) {
      case 1: return { color: '#10B981' };
      case 2: return { color: '#F59E0B' };
      case 3: return { color: '#EF4444' };
      default: return { color: '#6B7280' };
    }
  };

  const getDifficultyText = (difficulty: number | string) => {
    // Handle both numeric and text difficulty levels
    if (typeof difficulty === 'string') {
      switch (difficulty.toLowerCase()) {
        case 'beginner': return 'Beginner';
        case 'medium':
        case 'intermediate': return 'Intermediate';
        case 'advanced':
        case 'expert': return 'Advanced';
        default:
          // Try to parse as number if it's a string number
          const parsed = parseInt(difficulty);
          if (!isNaN(parsed)) {
            return getDifficultyText(parsed);
          }
          return 'Beginner'; // Default to Beginner instead of Unknown
      }
    }

    // Handle numeric difficulty levels
    switch (difficulty) {
      case 1: return 'Beginner';
      case 2: return 'Intermediate';
      case 3: return 'Advanced';
      default: return 'Beginner'; // Default to Beginner instead of Unknown
    }
  };

  const getAlgorithmColor = (algorithm: string) => {
    switch (algorithm) {
      case 'hybrid': return '#10B981';          // Green - Most advanced
      case 'content_based': return '#3B82F6';   // Blue - Content analysis
      case 'collaborative': return '#8B5CF6';   // Purple - Social analysis
      case 'random_forest': return '#F59E0B';   // Orange - ML classifier
      default: return '#6B7280';                // Gray - Unknown
    }
  };

  const getAlgorithmLabel = (algorithm: string) => {
    switch (algorithm) {
      case 'hybrid': return 'HYBRID AI';
      case 'content_based': return 'CONTENT ML';
      case 'collaborative': return 'COLLABORATIVE';
      case 'random_forest': return 'RF ML';
      default: return 'ML';
    }
  };

  const getAlgorithmIcon = (algorithm: string) => {
    switch (algorithm) {
      case 'hybrid': return 'analytics';
      case 'content_based': return 'fitness';
      case 'collaborative': return 'people';
      case 'random_forest': return 'leaf';
      default: return 'flash';
    }
  };

  const formatMuscleGroup = (muscleGroup: string) => {
    return muscleGroup
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getFilteredRecommendations = (): any[] => {
    // Use the intelligently selected recommendations
    let recommendations = mlRecommendations || [];

    // Filter by difficulty only (algorithm is automatically selected)
    if (difficultyFilter !== 'all' && recommendations.length > 0) {
      const difficultyLevel = difficultyFilter === 'beginner' ? 1 :
                             difficultyFilter === 'intermediate' ? 2 : 3;
      recommendations = recommendations.filter((r: any) => r.difficulty_level === difficultyLevel);
    }

    // Filter by search query
    if (searchQuery.trim() && recommendations.length > 0) {
      recommendations = recommendations.filter((r: any) =>
        (r.exercise_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.target_muscle_group || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return recommendations;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading ML recommendations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workouts</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isWorkoutDay() ? (
          <>
            {/* Search Bar */}
            {renderSearchBar()}

            {/* Filters */}
            {renderFilterButtons()}

            {/* Quick Actions */}
            {renderQuickActions()}

            {/* ML Recommendations */}
            {renderMLRecommendations()}
          </>
        ) : (
          <View style={styles.restDayContainer}>
            <View style={styles.restDayCard}>
              <View style={styles.restDayIconContainer}>
                <Ionicons name="bed-outline" size={64} color={COLORS.SECONDARY[400]} />
              </View>
              <Text style={styles.restDayTitle}>Rest Day</Text>
              <Text style={styles.restDayMessage}>
                Your body needs time to recover and build strength. Enjoy your rest day!
              </Text>
              <Text style={styles.restDaySubtext}>
                Come back on your next scheduled workout day for personalized exercise recommendations.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Workout Set Modal */}
      <WorkoutSetModal
        visible={showWorkoutSetModal}
        onClose={() => setShowWorkoutSetModal(false)}
        workoutSet={currentWorkoutSet}
        onStartWorkout={handleStartWorkoutSet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginTop: 12,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: COLORS.PRIMARY[600],
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#111827',
  },
  clearButton: {
    marginLeft: 8,
  },
  filterContainer: {
    marginTop: 16,
  },
  filterContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[600],
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  difficultyButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  difficultyButtonActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  difficultyButtonText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
  },
  difficultyButtonTextActive: {
    color: 'white',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#374151',
    textAlign: 'center',
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginBottom: 16,
  },
  mlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  mlBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#10B981',
  },
  rfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  rfBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
  },
  recommendationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workoutCardContent: {
    flexDirection: 'row',
    padding: 20,
  },
  workoutCardLeft: {
    flex: 1,
    marginRight: 16,
  },
  workoutCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 60,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  algorithmBadge: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    letterSpacing: 0.5,
  },
  confidenceScore: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  workoutConfidenceText: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: '#374151',
  },
  workoutTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  workoutTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyTagText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    textTransform: 'capitalize',
  },
  muscleGroupTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  muscleGroupTagText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  infoButton: {
    marginBottom: 8,
  },
  workoutDuration: {
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
    marginBottom: 8,
  },
  workoutDurationText: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  workoutCalories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutCaloriesText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: '#374151',
  },
  algorithmBreakdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  algorithmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  algorithmDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  algorithmBreakdownName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#374151',
  },
  algorithmCount: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  groupQuickActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 16,
  },
  groupActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupActionText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  groupCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupCardRight: {
    marginLeft: 16,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 6,
  },
  groupMembersCount: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
  },
  joinButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  modalCancelButton: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  modalSaveButton: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContentText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  completedWorkoutCard: {
    backgroundColor: '#F0FDF4', // Light green background
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completedWorkoutIconContainer: {
    marginBottom: 16,
  },
  completedWorkoutTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: '#065F46',
    marginBottom: 12,
    textAlign: 'center',
  },
  completedWorkoutText: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: '#047857',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  completedWorkoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  completedWorkoutStatsText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#065F46',
    marginLeft: 8,
  },
  mlInsightsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  algorithmCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  algorithmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  algorithmHeaderName: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  algorithmConfidenceText: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
  algorithmDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    lineHeight: 20,
  },
  // Workout Set Card Styles
  workoutSetCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  workoutSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  algorithmIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  workoutSetTitleContainer: {
    flex: 1,
  },
  workoutSetTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  workoutSetSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  exercisePreviewList: {
    marginBottom: 18,
  },
  miniDifficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniDifficultyText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
  },
  moreExercises: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'center',
    marginTop: 4,
  },
  workoutSetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[100],
  },
  workoutSetStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutSetStatText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.SECONDARY[200],
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 16,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginRight: 5,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginTop: 8,
  },
  expandButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    marginLeft: 8,
  },
  restDayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  restDayCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  restDayIconContainer: {
    marginBottom: 24,
    opacity: 0.8,
  },
  restDayTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
    textAlign: 'center',
  },
  restDayMessage: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  restDaySubtext: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    lineHeight: 22,
  },
});