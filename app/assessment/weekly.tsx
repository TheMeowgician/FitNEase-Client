import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/microservices/authService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

export default function WeeklyAssessmentScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [weight, setWeight] = useState('');
  const [motivationLevel, setMotivationLevel] = useState(3);
  const [workoutRating, setWorkoutRating] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!weight || workoutRating === 0 || !difficultyLevel) {
      Alert.alert('Missing Information', 'Please fill in all required fields (weight, workout rating, and difficulty level).');
      return;
    }

    setIsLoading(true);
    try {
      const assessmentData = {
        weight: parseFloat(weight),
        motivation_level: motivationLevel,
        workout_rating: workoutRating,
        difficulty_level: difficultyLevel,
        notes: notes.trim(),
        assessment_date: new Date().toISOString(),
      };

      await authService.saveFitnessAssessment({
        assessment_type: 'weekly',
        assessment_data: assessmentData,
        score: workoutRating,
      });

      Alert.alert(
        'Assessment Saved! 🎉',
        'Thank you for your feedback. This helps us improve your workout recommendations.',
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving weekly assessment:', error);
      Alert.alert('Error', 'Failed to save assessment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStarRating = () => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setWorkoutRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= workoutRating ? 'star' : 'star-outline'}
              size={40}
              color={star <= workoutRating ? '#FFD700' : COLORS.SECONDARY[300]}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMotivationSlider = () => {
    return (
      <View style={styles.motivationContainer}>
        <View style={styles.motivationLabels}>
          <Text style={styles.motivationLabel}>Low</Text>
          <Text style={styles.motivationLabel}>High</Text>
        </View>
        <View style={styles.motivationButtons}>
          {[1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => setMotivationLevel(level)}
              style={[
                styles.motivationButton,
                motivationLevel === level && styles.motivationButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.motivationButtonText,
                  motivationLevel === level && styles.motivationButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDifficultyOptions = () => {
    const options: Array<{ value: 'too_easy' | 'just_right' | 'too_hard'; label: string; icon: string; color: string }> = [
      { value: 'too_easy', label: 'Too Easy', icon: 'happy-outline', color: '#10B981' },
      { value: 'just_right', label: 'Just Right', icon: 'checkmark-circle-outline', color: '#3B82F6' },
      { value: 'too_hard', label: 'Too Hard', icon: 'alert-circle-outline', color: '#EF4444' },
    ];

    return (
      <View style={styles.difficultyContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => setDifficultyLevel(option.value)}
            style={[
              styles.difficultyOption,
              difficultyLevel === option.value && {
                borderColor: option.color,
                backgroundColor: `${option.color}10`,
              },
            ]}
          >
            <Ionicons
              name={option.icon as any}
              size={32}
              color={difficultyLevel === option.value ? option.color : COLORS.SECONDARY[400]}
            />
            <Text
              style={[
                styles.difficultyLabel,
                difficultyLevel === option.value && { color: option.color, fontFamily: FONTS.SEMIBOLD },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weekly Check-In</Text>
          <View style={styles.backButton} />
        </View>

        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>How was your week?</Text>
          <Text style={styles.introSubtitle}>
            Your feedback helps us personalize your workouts and track your progress
          </Text>
        </View>

        {/* Weight Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Weight *</Text>
          <Input
            placeholder="Enter your weight (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            leftIcon={<Ionicons name="scale-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />
        </View>

        {/* Workout Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Your Workouts This Week *</Text>
          <Text style={styles.sectionSubtitle}>How satisfied are you with your workout recommendations?</Text>
          {renderStarRating()}
        </View>

        {/* Difficulty Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Difficulty *</Text>
          <Text style={styles.sectionSubtitle}>How challenging were the workouts?</Text>
          {renderDifficultyOptions()}
        </View>

        {/* Motivation Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motivation Level</Text>
          <Text style={styles.sectionSubtitle}>How motivated do you feel to continue?</Text>
          {renderMotivationSlider()}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <Input
            placeholder="Any feedback or comments..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
        </View>

        {/* Submit Button */}
        <Button
          title={isLoading ? 'Saving...' : 'Submit Assessment'}
          onPress={handleSubmit}
          loading={isLoading}
          style={styles.submitButton}
        />
      </ScrollView>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  introSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  introTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 12,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  starButton: {
    padding: 4,
  },
  motivationContainer: {
    marginTop: 8,
  },
  motivationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  motivationLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  motivationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motivationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.SECONDARY[300],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  motivationButtonActive: {
    borderColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
  motivationButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  motivationButtonTextActive: {
    color: COLORS.PRIMARY[500],
    fontFamily: FONTS.SEMIBOLD,
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  difficultyOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  difficultyLabel: {
    marginTop: 8,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginHorizontal: 20,
    marginTop: 32,
    backgroundColor: COLORS.PRIMARY[500],
  },
});
