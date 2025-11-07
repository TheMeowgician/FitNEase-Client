import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { COLORS, FONTS } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/microservices/authService';
import { planningService } from '../../../services/microservices/planningService';
import { useSmartBack } from '../../../hooks/useSmartBack';

interface DayOfWeek {
  id: string;
  label: string;
  short: string;
}

export default function WorkoutDaysSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const daysOfWeek: DayOfWeek[] = [
    { id: 'sunday', label: 'Sunday', short: 'Sun' },
    { id: 'monday', label: 'Monday', short: 'Mon' },
    { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { id: 'thursday', label: 'Thursday', short: 'Thu' },
    { id: 'friday', label: 'Friday', short: 'Fri' },
    { id: 'saturday', label: 'Saturday', short: 'Sat' },
  ];

  useEffect(() => {
    if (user?.workoutDays && user.workoutDays.length > 0) {
      setSelectedDays(user.workoutDays);
    }
  }, [user]);

  const handleDayToggle = (dayId: string) => {
    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter((id) => id !== dayId)
      : [...selectedDays, dayId];
    setSelectedDays(newDays);
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one workout day.', [{ text: 'OK' }]);
      return;
    }

    setIsSaving(true);

    try {
      // Step 1: Check if weekly plan exists
      let weeklyPlan = null;
      try {
        const response = await planningService.getCurrentWeekPlan(parseInt(user!.id));
        weeklyPlan = (response.data as any)?.plan || response.data;
      } catch (error) {
        console.log('[WORKOUT_DAYS] No weekly plan exists yet');
      }

      // Step 2: Detect changes
      const oldDays = user?.workoutDays || [];
      const newDays = selectedDays;
      const arraysEqual = (a: string[], b: string[]) =>
        a.length === b.length && a.every((val, idx) => val === b[idx]);
      const hasChanges = !arraysEqual([...oldDays].sort(), [...newDays].sort());

      // Step 3: If plan exists and days changed, show intelligent alert
      if (weeklyPlan && hasChanges) {
        Alert.alert(
          'Update Your Weekly Plan?',
          `You've changed your workout days.\n\nOld: ${oldDays.join(', ')}\nNew: ${newDays.join(', ')}\n\nWould you like to update this week's plan to match your new schedule?`,
          [
            {
              text: 'Keep Old Plan',
              style: 'cancel',
              onPress: async () => {
                try {
                  // Just update profile, don't touch weekly plan
                  await authService.updateUserProfile({ preferred_workout_days: newDays });
                  await refreshUser();
                  Alert.alert('Success', 'Your workout days have been updated!', [
                    { text: 'OK', onPress: () => goBack() },
                  ]);
                } catch (error) {
                  console.error('Error saving workout days:', error);
                  Alert.alert('Error', 'Failed to save your preferences. Please try again.');
                } finally {
                  setIsSaving(false);
                }
              },
            },
            {
              text: 'Update Plan',
              onPress: async () => {
                try {
                  // Update profile
                  await authService.updateUserProfile({ preferred_workout_days: newDays });
                  await refreshUser();

                  // Smart adaptation: Reallocate exercises from removed days to new days
                  console.log('[WORKOUT_DAYS] Adapting weekly plan...');
                  await planningService.adaptWeeklyPlan(weeklyPlan.plan_id, {
                    old_days: oldDays,
                    new_days: newDays,
                    preserve_completed: true,
                    adaptation_strategy: 'reallocate',
                  });

                  Alert.alert(
                    'Success',
                    'Your workout days and weekly plan have been smartly adapted! Exercises from removed days have been moved to your new schedule.',
                    [
                      {
                        text: 'View Plan',
                        onPress: () => {
                          goBack();
                          setTimeout(() => router.push('/(tabs)/weekly-plan'), 100);
                        },
                      },
                    ]
                  );
                } catch (error) {
                  console.error('Error adapting plan:', error);
                  Alert.alert('Error', 'Failed to adapt your plan. Please try again.');
                } finally {
                  setIsSaving(false);
                }
              },
            },
          ]
        );
      } else {
        // No plan exists or no changes - simple update
        await authService.updateUserProfile({ preferred_workout_days: newDays });
        await refreshUser();
        Alert.alert('Success', 'Your workout days have been updated!', [
          { text: 'OK', onPress: () => goBack() },
        ]);
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
      setIsSaving(false);
    }
  };

  const getRecommendation = () => {
    if (selectedDays.length < 3) {
      return 'We recommend at least 3 workout days per week for effective Tabata training.';
    } else if (selectedDays.length >= 3 && selectedDays.length <= 5) {
      return 'Great choice! This is an ideal frequency for building strength and endurance.';
    } else {
      return 'Remember to include rest days for recovery to prevent overtraining.';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Days</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>
            Set your <Text style={styles.titleAccent}>workout schedule</Text>
          </Text>
          <Text style={styles.subtitle}>Choose the days you want to exercise each week.</Text>
        </View>

        <View style={styles.section}>
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
                  <Text style={[styles.dayShort, { color: isSelected ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[700] }]}>
                    {day.short}
                  </Text>
                  <Text style={[styles.dayLabel, { color: isSelected ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[600] }]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDays.length > 0 && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryHeader}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
                <Text style={styles.summaryTitle}>Selected ({selectedDays.length} days)</Text>
              </View>
              <Text style={styles.summaryText}>{getRecommendation()}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          disabled={selectedDays.length === 0 || isSaving}
          style={{
            ...styles.saveButton,
            backgroundColor: selectedDays.length > 0 && !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.NEUTRAL.WHITE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  descriptionContainer: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 24, fontFamily: FONTS.BOLD, color: COLORS.SECONDARY[900], textAlign: 'center', marginBottom: 12 },
  titleAccent: { color: COLORS.PRIMARY[500] },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  section: { marginBottom: 24 },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  dayButton: {
    width: 100,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayShort: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
  },
  summaryContainer: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[700],
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 18,
  },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  saveButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
