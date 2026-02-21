import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/ui/Button';
import { PageIndicator } from '../../components/ui/PageIndicator';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { capitalizeFirstLetter } from '../../utils/stringUtils';

const { width } = Dimensions.get('window');

interface DayOfWeek {
  id: string;
  label: string;
  short: string;
}

interface Duration {
  id: string;
  minutes: number;
  label: string;
  description: string;
}

export default function WeeklyGoalScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const alert = useAlert();
  const fitnessLevel = params.fitnessLevel as string;
  const preferencesData = params.preferences ? JSON.parse(params.preferences as string) : null;
  const physicalStatsData = params.physicalStats ? JSON.parse(params.physicalStats as string) : null;
  const activityLevel = params.activityLevel as string;
  const fitnessExperience = params.fitnessExperience as string;
  const fitnessGoals = params.fitnessGoals ? JSON.parse(params.fitnessGoals as string) : [];

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const daysOfWeek: DayOfWeek[] = [
    { id: 'sunday', label: 'Sunday', short: 'Sun' },
    { id: 'monday', label: 'Monday', short: 'Mon' },
    { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { id: 'thursday', label: 'Thursday', short: 'Thu' },
    { id: 'friday', label: 'Friday', short: 'Fri' },
    { id: 'saturday', label: 'Saturday', short: 'Sat' },
  ];

  const durations: Duration[] = [
    {
      id: '15',
      minutes: 15,
      label: '15 min',
      description: 'Quick Tabata session',
    },
    {
      id: '30',
      minutes: 30,
      label: '30 min',
      description: 'Standard workout',
    },
    {
      id: '45',
      minutes: 45,
      label: '45 min',
      description: 'Extended session',
    },
    {
      id: '60',
      minutes: 60,
      label: '60 min',
      description: 'Full workout',
    },
  ];

  const handleDayToggle = (dayId: string) => {
    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter((id) => id !== dayId)
      : [...selectedDays, dayId];
    setSelectedDays(newDays);
  };

  const handleDurationSelect = (durationId: string) => {
    setSelectedDuration(durationId);
  };

  const getRecommendation = () => {
    if (fitnessLevel === 'beginner') {
      return 'We recommend 3-4 Tabata workout days per week, 15-30 minutes each for beginners to build HIIT endurance safely.';
    } else if (fitnessLevel === 'intermediate') {
      return 'We recommend 4-5 workout days per week, 30-45 minutes each for intermediate level.';
    } else {
      return 'We recommend 5-6 workout days per week, 45-60 minutes each for advanced level.';
    }
  };

  const getRecommendedDays = () => {
    if (fitnessLevel === 'beginner') return 3;
    if (fitnessLevel === 'intermediate') return 4;
    return 5;
  };

  const handleContinue = async () => {
    if (!selectedDays.length || !selectedDuration) {
      alert.warning('Selection Required', 'Please select your workout days and duration to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const completeData = {
        assessment: {
          currentFitnessLevel: fitnessLevel,
          primaryGoals: fitnessGoals,
          workoutExperience: parseInt(fitnessExperience),
          weeklyActivityLevel: activityLevel,
          weight: physicalStatsData?.weight || 70,
          height: physicalStatsData?.height || 170,
          age: physicalStatsData?.age || 25,
          bmi: physicalStatsData?.bmi || 24.2,
        },
        preferences: {
          ...preferencesData,
          preferredDays: selectedDays,
          timeConstraints: parseInt(selectedDuration),
        },
        weeklyGoal: {
          workoutDays: selectedDays,
          sessionDuration: parseInt(selectedDuration),
          totalWeeklyMinutes: selectedDays.length * parseInt(selectedDuration),
        },
      };

      router.push({
        pathname: '/(onboarding)/complete',
        params: { onboardingData: JSON.stringify(completeData) }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const isValidSelection = selectedDays.length > 0 && selectedDuration;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>

        {/* Logo */}
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

        {/* Page Indicator */}
        <View style={styles.indicatorContainer}>
          <PageIndicator
            totalPages={8}
            currentIndex={6}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Final step, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            Set your <Text style={styles.titleAccent}>weekly goal</Text>
          </Text>

          <Text style={styles.subtitle}>
            {getRecommendation()}
          </Text>
        </View>

        {/* Days Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Days</Text>
          <Text style={styles.sectionSubtitle}>Choose the days you want to exercise</Text>

          <View style={styles.daysContainer}>
            {daysOfWeek.map((day) => {
              const isSelected = selectedDays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  onPress={() => handleDayToggle(day.id)}
                  style={[
                    styles.dayButton,
                    {
                      borderColor: isSelected ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[200],
                      backgroundColor: isSelected ? COLORS.PRIMARY[500] : COLORS.NEUTRAL.WHITE,
                      borderWidth: isSelected ? 3 : 2,
                      shadowColor: isSelected ? COLORS.PRIMARY[500] : '#000',
                      shadowOpacity: isSelected ? 0.2 : 0.05,
                      shadowRadius: isSelected ? 4 : 2,
                      elevation: isSelected ? 3 : 1,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[700] }
                    ]}
                  >
                    {day.short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.daysSummary}>
            <Text style={styles.daysCount}>
              Selected: {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.daysRecommended}>
              Recommended: {getRecommendedDays()} days
            </Text>
          </View>
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Duration</Text>
          <Text style={styles.sectionSubtitle}>How long should each workout be?</Text>

          <View style={styles.durationsContainer}>
            {durations.map((duration) => {
              const isSelected = selectedDuration === duration.id;
              return (
                <TouchableOpacity
                  key={duration.id}
                  onPress={() => handleDurationSelect(duration.id)}
                  style={[
                    styles.durationCard,
                    {
                      borderColor: isSelected ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[200],
                      backgroundColor: COLORS.NEUTRAL.WHITE,
                      borderWidth: isSelected ? 3 : 2,
                      shadowColor: isSelected ? COLORS.PRIMARY[500] : '#000',
                      shadowOpacity: isSelected ? 0.15 : 0.05,
                      shadowRadius: isSelected ? 8 : 4,
                      elevation: isSelected ? 4 : 2,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationLabel,
                      { color: isSelected ? COLORS.PRIMARY[500] : COLORS.SECONDARY[900] }
                    ]}
                  >
                    {duration.label}
                  </Text>
                  <Text
                    style={[
                      styles.durationDescription,
                      { color: isSelected ? COLORS.PRIMARY[500] : COLORS.SECONDARY[600] }
                    ]}
                  >
                    {duration.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Weekly Summary */}
        {isValidSelection && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="calendar" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.summaryTitle}>Your Weekly Goal</Text>
            </View>

            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Workout Days:</Text>
                <Text style={styles.summaryValue}>{selectedDays.length} days/week</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Session Duration:</Text>
                <Text style={styles.summaryValue}>
                  {durations.find(d => d.id === selectedDuration)?.label}/day
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelHighlight}>Total Weekly Time:</Text>
                <Text style={styles.summaryValueHighlight}>
                  {selectedDays.length * (durations.find(d => d.id === selectedDuration)?.minutes || 0)} minutes
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              You can always adjust your weekly goal later. Start with what feels achievable and gradually increase as you build your fitness habit.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Complete Setup"
          onPress={handleContinue}
          loading={isLoading}
          disabled={!isValidSelection}
          style={{
            ...styles.continueButton,
            backgroundColor: isValidSelection ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
            shadowColor: isValidSelection ? COLORS.PRIMARY[500] : 'transparent',
            shadowOpacity: isValidSelection ? 0.3 : 0,
            shadowRadius: isValidSelection ? 8 : 0,
            elevation: isValidSelection ? 8 : 0,
          }}
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    // Dynamic sizing applied inline
  },
  indicatorContainer: {
    marginBottom: 32,
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 18,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 12,
  },
  titleAccent: {
    color: COLORS.PRIMARY[500],
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
  },
  dayText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
  },
  daysSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysCount: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  daysRecommended: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[500],
  },
  durationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  durationCard: {
    flexBasis: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 80,
    shadowOffset: { width: 0, height: 2 },
  },
  durationLabel: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    marginBottom: 4,
  },
  durationDescription: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[700],
    marginLeft: 8,
  },
  summaryContent: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  summaryLabelHighlight: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[700],
  },
  summaryValueHighlight: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
  },
  infoNote: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  continueButton: {
    shadowOffset: { width: 0, height: 4 },
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
});