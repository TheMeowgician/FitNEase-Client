import React, { useEffect, useState } from 'react';
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
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { contentService, Exercise } from '../../services/microservices/contentService';

export default function LobbyWorkoutPreviewScreen() {
  const { sessionId, exercises } = useLocalSearchParams();
  const [exerciseDetails, setExerciseDetails] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExerciseDetails();
  }, []);

  const loadExerciseDetails = async () => {
    try {
      setIsLoading(true);
      const exercisesData = JSON.parse(exercises as string);

      const exerciseIds = exercisesData.map((ex: any) => ex.exercise_id || ex.id);
      console.log('📥 [PREVIEW] Fetching details for', exerciseIds.length, 'exercises');

      const detailsPromises = exerciseIds.map((id: number) => contentService.getExercise(String(id)));
      const details = await Promise.all(detailsPromises);

      const validDetails = details.filter((d): d is Exercise => d !== null);
      setExerciseDetails(validDetails);

      console.log('✅ [PREVIEW] Loaded', validDetails.length, 'exercise details');
    } catch (error) {
      console.error('❌ [PREVIEW] Error fetching exercise details:', error);
      setExerciseDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const totalDuration = exerciseDetails.length * 4; // 4 minutes per exercise (Tabata)
  const totalCalories = exerciseDetails.reduce((sum, ex) => {
    return sum + Math.round((ex.calories_burned_per_minute * ex.default_duration_seconds * 8) / 60);
  }, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Workout Details</Text>
          <Text style={styles.headerSubtitle}>Tabata • {exerciseDetails.length} exercises</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading workout details...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Workout Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="barbell" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <Text style={styles.statLabel}>Exercises</Text>
              <Text style={styles.statValue}>{exerciseDetails.length}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="timer" size={24} color={COLORS.SUCCESS[600]} />
              </View>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{totalDuration} min</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="flame" size={24} color={COLORS.WARNING[600]} />
              </View>
              <Text style={styles.statLabel}>Est. Calories</Text>
              <Text style={styles.statValue}>~{totalCalories}</Text>
            </View>
          </View>

          {/* Exercise List */}
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            {exerciseDetails.map((exercise, index) => (
              <View key={`exercise-${exercise.exercise_id}-${index}`} style={styles.exerciseCard}>
                {/* Card Header */}
                <View style={styles.exerciseCardHeader}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {exercise.exercise_name}
                  </Text>
                </View>

                {/* Card Body */}
                <View style={styles.exerciseCardBody}>
                  {/* Stats Row */}
                  <View style={styles.exerciseStatsRow}>
                    <View style={styles.exerciseStatItem}>
                      <Ionicons name="body" size={16} color={COLORS.PRIMARY[600]} />
                      <Text style={styles.exerciseStatText} numberOfLines={1}>
                        {exercise.target_muscle_group?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View style={styles.exerciseStatItem}>
                      <Ionicons name="time" size={16} color={COLORS.SUCCESS[600]} />
                      <Text style={styles.exerciseStatText}>
                        {exercise.default_duration_seconds}s × 8 sets
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Row - Difficulty and Calories */}
                  <View style={styles.exerciseCardFooter}>
                    <View style={styles.difficultyContainer}>
                      <Text style={styles.difficultyLabel}>Difficulty</Text>
                      <View style={styles.difficultyStars}>
                        {[...Array(3)].map((_, i) => {
                          // Convert to number to ensure proper comparison
                          const difficultyLevel = Number(exercise.difficulty_level);
                          return (
                            <Ionicons
                              key={`diff-${i}`}
                              name={i < difficultyLevel ? "star" : "star-outline"}
                              size={14}
                              color={i < difficultyLevel ? COLORS.WARNING[500] : COLORS.SECONDARY[300]}
                            />
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.caloriesBadge}>
                      <Ionicons name="flame" size={16} color="#F59E0B" />
                      <Text style={styles.caloriesText}>
                        ~{Math.round((exercise.calories_burned_per_minute * exercise.default_duration_seconds * 8) / 60)} cal
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  headerSpacer: {
    width: 40, // Balance the back button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  exercisesSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  exerciseNumber: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  exerciseName: {
    flex: 1,
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseCardBody: {
    gap: 12,
  },
  exerciseStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exerciseStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.SECONDARY[50],
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  exerciseStatText: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    textTransform: 'capitalize',
  },
  exerciseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[100],
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  difficultyStars: {
    flexDirection: 'row',
    gap: 3,
  },
  caloriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  caloriesText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: '#92400E',
  },
  bottomSpacing: {
    height: 32,
  },
});
