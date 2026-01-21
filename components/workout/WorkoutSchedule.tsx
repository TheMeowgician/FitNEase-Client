import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { planningService, WorkoutScheduleRequest, WorkoutPlanSchedule } from '../../services/microservices/planningService';
import { authService } from '../../services/microservices/authService';
import { Button } from '../ui/Button';
import { COLORS, FONTS } from '../../constants/colors';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const WORKOUT_TYPES = [
  { key: 'tabata', label: 'Tabata', icon: 'flash', color: '#10B981' },
  { key: 'strength', label: 'Strength', icon: 'barbell', color: '#3B82F6' },
  { key: 'cardio', label: 'Cardio', icon: 'heart', color: '#EF4444' },
  { key: 'flexibility', label: 'Flexibility', icon: 'body', color: '#8B5CF6' },
  { key: 'mixed', label: 'Mixed', icon: 'fitness', color: '#F59E0B' },
];

interface WorkoutScheduleProps {
  onClose: () => void;
  initialFitnessLevel?: string;
  initialFitnessAssessment?: any;
}

export function WorkoutSchedule({ onClose, initialFitnessLevel, initialFitnessAssessment }: WorkoutScheduleProps) {
  const { user } = useAuth();
  const alert = useAlert();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedWorkoutTypes, setSelectedWorkoutTypes] = useState<string[]>(['tabata']);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(30);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<WorkoutPlanSchedule[]>([]);

  useEffect(() => {
    loadCurrentSchedule();
  }, []);

  const loadCurrentSchedule = async () => {
    if (!user) {
      console.log('❌ No user found - skipping schedule load');
      return;
    }

    console.log('🚀 Starting loadCurrentSchedule for user:', user.id);

    try {
      // Use pre-loaded fitness assessment if available (faster)
      const fitnessAssessment = initialFitnessAssessment || await authService.getFitnessAssessment();

      // Load workout plan in parallel with assessment (if needed)
      console.log('🔄 Loading current workout plan for user:', user.id);
      const plan = await planningService.getWorkoutPlan(user.id);

      // Check if we actually have a valid plan (not just a response object)
      if (plan && plan.id) {
        console.log('✅ Found existing plan:', plan);
        const schedule = await planningService.getWorkoutSchedule(plan.id);
        setCurrentSchedule(schedule);

        // Pre-populate form with current settings from schedule
        const workoutDays = schedule
          .filter(s => !s.is_rest_day)
          .map(s => s.day_of_week);
        setSelectedDays(workoutDays);
        setSessionsPerWeek(workoutDays.length);

        // Get fitness level from assessment (already loaded)
        if (fitnessAssessment && fitnessAssessment.length > 0) {
          const assessmentFitnessLevel = fitnessAssessment[0].assessment_data.fitness_level;
          const assessmentDuration = fitnessAssessment[0].assessment_data.time_constraints_minutes;
          setDifficulty(assessmentFitnessLevel || 'beginner');
          setSessionDuration(assessmentDuration || 30);
        }

        console.log('📋 Pre-populated with existing plan data');
      } else {
        console.log('ℹ️ No existing plan found - using fitness assessment data');
        setCurrentSchedule([]);

        if (fitnessAssessment && fitnessAssessment.length > 0) {
          const assessmentData = fitnessAssessment[0].assessment_data;

          // Use personalized settings from onboarding
          const personalizedDays = assessmentData.preferred_workout_days || ['monday', 'wednesday', 'friday'];
          const personalizedDuration = assessmentData.time_constraints_minutes || 30;
          const personalizedDifficulty = assessmentData.fitness_level || initialFitnessLevel || 'beginner';

          setSelectedDays(personalizedDays);
          setSessionsPerWeek(personalizedDays.length);
          setSessionDuration(personalizedDuration);
          setDifficulty(personalizedDifficulty);

          console.log('✅ Applied personalized defaults from assessment');
        } else {
          // Fallback to app defaults
          setSelectedDays(['monday', 'wednesday', 'friday']);
          setSessionsPerWeek(3);
          setSessionDuration(30);
          setDifficulty(initialFitnessLevel || 'beginner');
          console.log('⚠️ Using app defaults');
        }
      }
    } catch (error) {
      console.error('❌ Error in loadCurrentSchedule:', error);
      // Set default values when error occurs
      setCurrentSchedule([]);
      setSelectedDays(['monday', 'wednesday', 'friday']);
      setSessionsPerWeek(3);
      setSessionDuration(30);
      setDifficulty(initialFitnessLevel || 'beginner');
    }
  };

  const toggleDay = (dayKey: string) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey];

      setSessionsPerWeek(newDays.length);
      return newDays;
    });
  };

  const toggleWorkoutType = (typeKey: string) => {
    setSelectedWorkoutTypes(prev => {
      if (prev.includes(typeKey)) {
        return prev.filter(t => t !== typeKey);
      } else {
        return [...prev, typeKey];
      }
    });
  };

  const handleSaveSchedule = async () => {
    if (selectedDays.length === 0) {
      alert.warning('No Days Selected', 'Please select at least one workout day.');
      return;
    }

    // App is Tabata-focused, so we always use tabata as the workout type

    setIsLoading(true);
    try {
      const restDays = DAYS_OF_WEEK
        .map(d => d.key)
        .filter(day => !selectedDays.includes(day));

      const scheduleRequest: WorkoutScheduleRequest = {
        selected_days: selectedDays,
        sessions_per_week: sessionsPerWeek,
        preferred_workout_types: ['tabata'],
        session_duration: sessionDuration,
        rest_days: restDays,
        goals: ['fitness', 'strength'], // Default goals, could be customizable
        difficulty: difficulty,
      };

      // Save schedule to planning service
      const result = await planningService.createWorkoutSchedule(scheduleRequest, user?.id);

      // Also update user profile with fitness level
      console.log('💾 Updating user profile with fitness level:', difficulty);
      await authService.updateProfile({
        fitnessLevel: difficulty,
      });

      // Update fitness assessment with ALL workout schedule settings
      console.log('💾 Updating fitness assessment with all workout settings:', {
        fitness_level: difficulty,
        preferred_workout_days: selectedDays,
        time_constraints_minutes: sessionDuration,
      });
      const fitnessAssessment = await authService.getFitnessAssessment();
      if (fitnessAssessment && fitnessAssessment.length > 0) {
        const assessment = fitnessAssessment[0];
        const updatedAssessmentData = {
          ...assessment.assessment_data,
          fitness_level: difficulty,
          preferred_workout_days: selectedDays,
          time_constraints_minutes: sessionDuration,
        };
        await authService.updateFitnessAssessment(assessment.assessment_id, {
          assessment_data: updatedAssessmentData,
        });
        console.log('✅ Fitness assessment updated with all settings');
      }

      alert.success('Schedule Saved!', `Your workout schedule has been created with ${selectedDays.length} workout days per week.`, onClose);
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert.error('Schedule Error', 'Could not save your workout schedule. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Schedule</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Schedule Summary or Welcome Message */}
        <View style={styles.section}>
          {currentSchedule.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Current Schedule</Text>
              <View style={styles.currentScheduleCard}>
                <View style={styles.scheduleRow}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.scheduleText}>
                    {currentSchedule.filter(s => !s.is_rest_day).length} workouts per week
                  </Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.scheduleText}>
                    ~{currentSchedule[0]?.estimated_duration || 30} min sessions
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Create Your First Workout Schedule</Text>
              <View style={styles.welcomeCard}>
                <View style={styles.welcomeIcon}>
                  <Ionicons name="fitness" size={32} color={COLORS.PRIMARY[600]} />
                </View>
                <Text style={styles.welcomeTitle}>Welcome Back!</Text>
                <Text style={styles.welcomeText}>
                  {selectedDays.length > 0 && sessionDuration > 0 ?
                    `Based on your onboarding, we've pre-selected ${selectedDays.length} workout days per week with ${sessionDuration}-minute sessions. You can adjust these settings below.` :
                    'Create a personalized workout schedule that fits your lifestyle and goals.'
                  }
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Select Workout Days */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Workout Days</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the days you want to work out each week
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysContainer}
            style={styles.daysScrollView}
          >
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayCircle,
                  selectedDays.includes(day.key) && styles.dayCircleSelected,
                ]}
                onPress={() => toggleDay(day.key)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.dayShortLabel,
                  selectedDays.includes(day.key) && styles.dayShortLabelSelected,
                ]}>
                  {day.short}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sessionsInfo}>
            <Text style={styles.sessionsText}>
              {selectedDays.length} workout{selectedDays.length !== 1 ? 's' : ''} per week
            </Text>
          </View>
        </View>

        {/* Workout Type Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Type</Text>
          <Text style={styles.sectionSubtitle}>
            Your workouts will be Tabata-focused for maximum efficiency
          </Text>

          <View style={styles.tabataCard}>
            <View style={[styles.workoutTypeIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="flash" size={24} color="white" />
            </View>
            <View style={styles.tabataInfo}>
              <Text style={styles.tabataTitle}>Tabata Training</Text>
              <Text style={styles.tabataDescription}>
                High-intensity interval training for optimal results
              </Text>
            </View>
          </View>
        </View>

        {/* Session Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Duration</Text>
          <Text style={styles.sectionSubtitle}>
            How long do you want each workout to be?
          </Text>

          <View style={styles.durationOptions}>
            {[20, 30, 45, 60].map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.durationCard,
                  sessionDuration === duration && styles.durationCardSelected,
                ]}
                onPress={() => setSessionDuration(duration)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.durationText,
                  sessionDuration === duration && styles.durationTextSelected,
                ]}>
                  {duration} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Difficulty Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Level</Text>
          <Text style={styles.sectionSubtitle}>
            What's your current fitness level?
          </Text>

          <View style={styles.difficultyOptions}>
            {[
              { key: 'beginner', label: 'Beginner', desc: 'New to fitness' },
              { key: 'intermediate', label: 'Intermediate', desc: 'Some experience' },
              { key: 'advanced', label: 'Advanced', desc: 'Very experienced' },
            ].map((level) => (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.difficultyCard,
                  difficulty === level.key && styles.difficultyCardSelected,
                ]}
                onPress={() => setDifficulty(level.key as any)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.difficultyLabel,
                  difficulty === level.key && styles.difficultyLabelSelected,
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.difficultyDesc,
                  difficulty === level.key && styles.difficultyDescSelected,
                ]}>
                  {level.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <Button
            title={isLoading ? 'Saving...' : 'Save Schedule'}
            onPress={handleSaveSchedule}
            disabled={isLoading || selectedDays.length === 0}
            style={styles.saveButton}
          />
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
              <Text style={styles.loadingText}>Creating your personalized schedule...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginBottom: 16,
  },
  currentScheduleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#374151',
    marginLeft: 8,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[100],
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  daysScrollView: {
    flexGrow: 0,
  },
  daysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  dayCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'white',
    borderWidth: 2.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  dayCircleSelected: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[600],
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  dayShortLabel: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: '#6B7280',
  },
  dayShortLabelSelected: {
    color: 'white',
  },
  sessionsInfo: {
    marginTop: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  sessionsText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  tabataCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabataInfo: {
    flex: 1,
    marginLeft: 16,
  },
  tabataTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#10B981',
    marginBottom: 4,
  },
  tabataDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#374151',
    lineHeight: 20,
  },
  workoutTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  durationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  durationCardSelected: {
    backgroundColor: COLORS.PRIMARY[50],
    borderColor: COLORS.PRIMARY[600],
  },
  durationText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
  },
  durationTextSelected: {
    color: COLORS.PRIMARY[600],
  },
  difficultyOptions: {
    gap: 12,
  },
  difficultyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  difficultyCardSelected: {
    backgroundColor: COLORS.PRIMARY[50],
    borderColor: COLORS.PRIMARY[600],
  },
  difficultyLabel: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#374151',
    marginBottom: 4,
  },
  difficultyLabelSelected: {
    color: COLORS.PRIMARY[600],
  },
  difficultyDesc: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  difficultyDescSelected: {
    color: COLORS.PRIMARY[500],
  },
  saveSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  saveButton: {
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
});