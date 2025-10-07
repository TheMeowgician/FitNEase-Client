import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageIndicator } from '../../components/ui/PageIndicator';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { authService } from '../../services/microservices/authService';
import { useAuth } from '../../contexts/AuthContext';
import { capitalizeFirstLetter } from '../../utils/stringUtils';

const { width } = Dimensions.get('window');

interface OnboardingData {
  assessment: {
    currentFitnessLevel: string;
    primaryGoals: string[];
    workoutExperience: number;
    weeklyActivityLevel: string;
    medicalConditions: string;
    injuries: string;
    weight: number;
    height: number;
    age: number;
    bmi: number;
  };
  preferences: {
    targetMuscleGroups: string[];
    availableEquipment: string[];
    timeConstraints: number;
    workoutTypes: string[];
    preferredDays: string[];
  };
}

export default function CompleteScreen() {
  const params = useLocalSearchParams();
  const { refreshUser, user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onboardingData: OnboardingData | null = params.onboardingData
    ? JSON.parse(params.onboardingData as string)
    : null;

  useEffect(() => {
    if (onboardingData) {
      processOnboarding();
    } else {
      setError('No onboarding data found');
      setIsProcessing(false);
    }
  }, []);

  const processOnboarding = async () => {
    try {
      if (!onboardingData) return;

      console.log('🎯 Processing onboarding data:', onboardingData);

      // 1. Save fitness assessment with workout preferences
      const assessmentPayload = {
        assessment_type: 'initial_onboarding',
        assessment_data: {
          // Assessment data
          fitness_level: onboardingData.assessment.currentFitnessLevel,
          goals: onboardingData.assessment.primaryGoals,
          experience_years: onboardingData.assessment.workoutExperience,
          activity_level: onboardingData.assessment.weeklyActivityLevel,
          medical_conditions: onboardingData.assessment.medicalConditions,
          injuries: onboardingData.assessment.injuries,
          weight: onboardingData.assessment.weight,
          height: onboardingData.assessment.height,
          age: onboardingData.assessment.age,
          bmi: onboardingData.assessment.bmi,
          // Workout preferences for ML model
          target_muscle_groups: onboardingData.preferences.targetMuscleGroups,
          available_equipment: onboardingData.preferences.availableEquipment,
          time_constraints_minutes: onboardingData.preferences.timeConstraints,
          preferred_workout_types: onboardingData.preferences.workoutTypes,
          preferred_workout_days: onboardingData.preferences.preferredDays,
          onboarding_completed: true,
        },
        score: calculateFitnessScore(onboardingData.assessment)
      };

      console.log('💾 Saving fitness assessment:', assessmentPayload);
      await authService.saveFitnessAssessment(assessmentPayload);

      // 2. Update user profile with personalization data and onboarding completed status
      console.log('📝 Updating user profile with personalization data...');
      await authService.updateUserProfile({
        target_muscle_groups: onboardingData.preferences.targetMuscleGroups,
        available_equipment: onboardingData.preferences.availableEquipment,
        time_constraints_minutes: onboardingData.preferences.timeConstraints,
        preferred_workout_days: onboardingData.preferences.preferredDays,
        fitness_goals: onboardingData.assessment.primaryGoals,
        activity_level: onboardingData.assessment.weeklyActivityLevel,
        medical_conditions: onboardingData.assessment.medicalConditions,
        workout_experience_years: onboardingData.assessment.workoutExperience,
        age: onboardingData.assessment.age,
        onboarding_completed: true
      });
      console.log('✅ User profile and fitness assessment saved successfully with all onboarding data');

      // 4. Refresh user data first to get updated onboarding_completed status
      await refreshUser();

      // 5. Initialize ML profile (non-blocking - errors are logged but don't fail onboarding)
      console.log('🤖 Initializing ML profile...');
      authService.initializeMLProfile().catch((mlError) => {
        console.warn('⚠️ ML profile initialization failed (non-critical):', mlError);
        // Silently fail - this is a non-critical operation that shouldn't block onboarding
      });

      setIsComplete(true);
      setIsProcessing(false);

      console.log('✅ Onboarding completed successfully!');
    } catch (error) {
      console.error('❌ Onboarding failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete onboarding');
      setIsProcessing(false);
    }
  };

  const calculateFitnessScore = (assessment: OnboardingData['assessment']): number => {
    let score = 0;

    // Fitness level scoring
    switch (assessment.currentFitnessLevel) {
      case 'beginner': score += 20; break;
      case 'intermediate': score += 50; break;
      case 'advanced': score += 80; break;
    }

    // Experience scoring
    score += Math.min(assessment.workoutExperience * 5, 20);

    // Activity level scoring
    switch (assessment.weeklyActivityLevel) {
      case 'low': score += 10; break;
      case 'moderate': score += 20; break;
      case 'high': score += 30; break;
    }

    // Goals variety bonus
    score += Math.min(assessment.primaryGoals.length * 3, 15);

    return Math.min(score, 100);
  };

  const formatGoals = (goalIds: string[] | null | undefined): string => {
    if (!goalIds || goalIds.length === 0) {
      return 'General Fitness';
    }

    const goalNames: { [key: string]: string } = {
      weight_loss: 'Weight Loss',
      muscle_gain: 'Muscle Gain',
      endurance: 'Endurance',
      strength: 'Strength',
      flexibility: 'Flexibility',
      general_fitness: 'General Fitness',
    };
    return goalIds.map((id) => goalNames[id] || id).join(', ');
  };

  const formatFitnessLevel = (level: string): string => {
    return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Beginner';
  };

  const formatActivityLevel = (level: string): string => {
    const levelNames: { [key: string]: string } = {
      low: 'Low Activity',
      moderate: 'Moderate Activity',
      high: 'High Activity',
    };
    return levelNames[level] || level;
  };

  const getBMICategory = (bmiValue: number) => {
    if (bmiValue < 18.5) return { category: 'Underweight', color: '#3B82F6' };
    if (bmiValue < 25) return { category: 'Normal', color: '#10B981' };
    if (bmiValue < 30) return { category: 'Overweight', color: '#F59E0B' };
    return { category: 'Obese', color: '#EF4444' };
  };

  const formatEquipment = (equipment: string[] | null | undefined): string => {
    if (!equipment || equipment.length === 0) {
      return 'Bodyweight only';
    }

    const equipmentNames: { [key: string]: string } = {
      dumbbells: 'Dumbbells',
      barbells: 'Barbells',
      resistance_bands: 'Resistance Bands',
      kettlebells: 'Kettlebells',
      pull_up_bar: 'Pull-up Bar',
      yoga_mat: 'Yoga Mat',
      bench: 'Bench',
      bodyweight: 'Bodyweight',
    };
    return (equipment || []).slice(0, 3).map((item) => equipmentNames[item] || item).join(', ') +
           (equipment.length > 3 ? ` +${equipment.length - 3} more` : '');
  };

  const handleGetStarted = () => {
    router.replace('/(tabs)');
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={() => {
              setError(null);
              setIsProcessing(true);
              processOnboarding();
            }}
            style={styles.button}
          />
          <Button
            title="Skip for Now"
            onPress={handleGetStarted}
            variant="outline"
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/FitNEase_logo_without_text.png')}
              style={[
                styles.logo,
                {
                  width: width * 0.25,
                  height: width * 0.25,
                }
              ]}
              resizeMode="contain"
            />
          </View>
          <LoadingSpinner size="large" />
          <Text style={styles.processingTitle}>Setting up your personalized experience</Text>
          <Text style={styles.processingText}>
            We're creating your fitness profile and configuring recommendations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const bmiInfo = onboardingData ? getBMICategory(onboardingData.assessment.bmi) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/FitNEase_logo_without_text.png')}
            style={[
              styles.logo,
              {
                width: width * 0.3,
                height: width * 0.3,
              }
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Page Indicator */}
        <View style={styles.indicatorContainer}>
          <PageIndicator
            totalPages={8}
            currentIndex={7}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={32} color="white" />
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            <Text style={styles.titleAccent}>Setup</Text> Complete!
          </Text>
          <Text style={styles.subtitle}>
            {user?.firstName ? `Welcome ${capitalizeFirstLetter(user.firstName)}! ` : 'Welcome! '}
            Your personalized Tabata plan is ready. Let's start your fitness journey!
          </Text>
        </View>

        {onboardingData && (
          <>
            {/* Profile Summary Card */}
            <View style={styles.profileCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle" size={24} color={COLORS.PRIMARY[500]} />
                <Text style={styles.cardHeaderText}>Your Fitness Profile</Text>
              </View>

              <View style={styles.profileDetails}>
                {/* BMI & Body Info */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Body Profile:</Text>
                  <Text style={styles.profileValue}>
                    {onboardingData.assessment.height}cm, {onboardingData.assessment.weight}kg (BMI: {onboardingData.assessment.bmi.toFixed(1)})
                  </Text>
                </View>

                {bmiInfo && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>BMI Category:</Text>
                    <Text style={[styles.profileValue, { color: bmiInfo.color }]}>
                      {bmiInfo.category}
                    </Text>
                  </View>
                )}

                {/* Age */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Age:</Text>
                  <Text style={styles.profileValue}>{onboardingData.assessment.age} years</Text>
                </View>

                {/* Fitness Level */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Fitness Level:</Text>
                  <Text style={styles.profileValue}>
                    {formatFitnessLevel(onboardingData.assessment.currentFitnessLevel)}
                  </Text>
                </View>

                {/* Activity Level */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Activity Level:</Text>
                  <Text style={styles.profileValue}>
                    {formatActivityLevel(onboardingData.assessment.weeklyActivityLevel)}
                  </Text>
                </View>

                {/* Goals */}
                {onboardingData.assessment.primaryGoals.length > 0 && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>Goals:</Text>
                    <Text style={[styles.profileValue, styles.profileValueMultiline]}>
                      {formatGoals(onboardingData.assessment.primaryGoals)}
                    </Text>
                  </View>
                )}

                {/* Experience */}
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Experience:</Text>
                  <Text style={styles.profileValue}>
                    {onboardingData.assessment.workoutExperience} years
                  </Text>
                </View>
              </View>
            </View>

            {/* Workout Plan Card */}
            <View style={styles.planCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="fitness" size={24} color={COLORS.PRIMARY[500]} />
                <Text style={styles.cardHeaderText}>Your Workout Plan</Text>
              </View>

              <View style={styles.planDetails}>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Session Duration:</Text>
                  <Text style={styles.profileValue}>{onboardingData.preferences.timeConstraints} minutes</Text>
                </View>

                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Equipment:</Text>
                  <Text style={[styles.profileValue, styles.profileValueMultiline]}>
                    {formatEquipment(onboardingData.preferences.availableEquipment)}
                  </Text>
                </View>

                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Focus Areas:</Text>
                  <Text style={[styles.profileValue, styles.profileValueMultiline]}>
                    {(onboardingData.preferences.targetMuscleGroups || []).slice(0, 3).join(', ') || 'Full Body'}
                    {(onboardingData.preferences.targetMuscleGroups || []).length > 3 ? ` +${onboardingData.preferences.targetMuscleGroups.length - 3} more` : ''}
                  </Text>
                </View>

                <View style={[styles.profileRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Recommended Frequency:</Text>
                  <Text style={styles.totalValue}>3-4 sessions/week</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Motivational Section */}
        <View style={styles.motivationalCard}>
          <View style={styles.motivationalContent}>
            <Text style={styles.motivationalTitle}>You're All Set!</Text>
            <Text style={styles.motivationalText}>
              Your personalized Tabata workouts are designed specifically for your goals, fitness level, and available equipment. Ready to transform your fitness?
            </Text>
          </View>
        </View>

        {/* What to Expect */}
        <View style={styles.expectationCard}>
          <Text style={styles.expectationTitle}>What to Expect 📊</Text>

          <View style={styles.expectationList}>
            <View style={styles.expectationItem}>
              <View style={[styles.expectationBullet, { backgroundColor: COLORS.SUCCESS[100] }]}>
                <Text style={styles.expectationIcon}>✓</Text>
              </View>
              <Text style={styles.expectationText}>
                Personalized Tabata workouts based on your profile
              </Text>
            </View>

            <View style={styles.expectationItem}>
              <View style={[styles.expectationBullet, { backgroundColor: COLORS.PRIMARY[100] }]}>
                <Text style={styles.expectationIcon}>📈</Text>
              </View>
              <Text style={styles.expectationText}>
                Progress tracking and workout history
              </Text>
            </View>

            <View style={styles.expectationItem}>
              <View style={[styles.expectationBullet, { backgroundColor: COLORS.SECONDARY[100] }]}>
                <Text style={styles.expectationIcon}>🎯</Text>
              </View>
              <Text style={styles.expectationText}>
                Smart recommendations that adapt as you progress
              </Text>
            </View>

            <View style={styles.expectationItem}>
              <View style={[styles.expectationBullet, { backgroundColor: COLORS.WARNING[100] }]}>
                <Text style={styles.expectationIcon}>🤖</Text>
              </View>
              <Text style={styles.expectationText}>
                AI-powered workouts that learn your preferences
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Get Started Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Start Your Fitness Journey 🚀"
          onPress={handleGetStarted}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    // Dynamic sizing applied inline
  },
  indicatorContainer: {
    marginBottom: 24,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.SUCCESS[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.SUCCESS[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  titleAccent: {
    color: COLORS.PRIMARY[500],
  },
  subtitle: {
    fontSize: 18,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 26,
  },
  profileCard: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.PRIMARY[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  planCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
    marginLeft: 8,
  },
  profileDetails: {
    gap: 12,
  },
  planDetails: {
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileLabel: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    flex: 1,
  },
  profileValue: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flex: 1,
    textAlign: 'right',
  },
  profileValueMultiline: {
    flex: 1.5,
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
    flex: 1,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
    flex: 1,
    textAlign: 'right',
  },
  motivationalCard: {
    backgroundColor: COLORS.PRIMARY[500],
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  motivationalContent: {
    alignItems: 'center',
  },
  motivationalTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  motivationalText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[100],
    textAlign: 'center',
    lineHeight: 24,
  },
  expectationCard: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  expectationTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 20,
  },
  expectationList: {
    gap: 12,
  },
  expectationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expectationBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expectationIcon: {
    fontSize: 14,
  },
  expectationText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  button: {
    shadowColor: COLORS.PRIMARY[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  processingTitle: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  processingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.ERROR[600],
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});