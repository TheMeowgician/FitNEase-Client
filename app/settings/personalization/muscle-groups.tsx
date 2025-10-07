import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { COLORS, FONTS } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/microservices/authService';

interface PreferenceOption {
  id: string;
  title: string;
  icon: string;
  color: string;
  description?: string;
}

export default function MuscleGroupsSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const [targetMuscleGroups, setTargetMuscleGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const muscleGroups: PreferenceOption[] = [
    { id: 'upper_body', title: 'Upper Body', icon: 'body-outline', color: '#EF4444', description: 'Chest, back, shoulders, arms' },
    { id: 'lower_body', title: 'Lower Body', icon: 'walk-outline', color: '#6366F1', description: 'Legs, glutes, calves' },
    { id: 'core', title: 'Core', icon: 'ellipse-outline', color: '#EC4899', description: 'Abs and core stability' },
    { id: 'whole_body', title: 'Whole Body', icon: 'person-outline', color: '#F97316', description: 'Full body workout' },
  ];

  useEffect(() => {
    loadCurrentSettings();
  }, [user]);

  const loadCurrentSettings = () => {
    if (user?.targetMuscleGroups) {
      setTargetMuscleGroups(user.targetMuscleGroups);
    }
  };

  const handleToggleSelection = (item: string) => {
    const newList = targetMuscleGroups.includes(item)
      ? targetMuscleGroups.filter(i => i !== item)
      : [...targetMuscleGroups, item];
    setTargetMuscleGroups(newList);
  };

  const handleSave = async () => {
    if (targetMuscleGroups.length === 0) {
      Alert.alert(
        'Selection Required',
        'Please select at least one muscle group.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateUserProfile({
        target_muscle_groups: targetMuscleGroups,
      });

      await refreshUser();

      Alert.alert(
        'Success',
        'Your muscle group preferences have been updated!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving muscle groups:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const renderPreferenceCard = (option: PreferenceOption, isSelected: boolean, onPress: () => void) => {
    return (
      <TouchableOpacity
        key={option.id}
        onPress={onPress}
        style={[
          styles.preferenceCard,
          {
            borderColor: isSelected ? option.color : COLORS.NEUTRAL[200],
            backgroundColor: COLORS.NEUTRAL.WHITE,
            borderWidth: isSelected ? 3 : 2,
            shadowColor: isSelected ? option.color : '#000',
            shadowOpacity: isSelected ? 0.15 : 0.05,
            shadowRadius: isSelected ? 8 : 4,
            elevation: isSelected ? 4 : 2,
          }
        ]}
        activeOpacity={0.7}
      >
        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <View style={[styles.checkmark, { backgroundColor: option.color }]}>
              <Ionicons name="checkmark" size={12} color="white" />
            </View>
          </View>
        )}

        {/* Icon */}
        <View style={styles.cardIconContainer}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isSelected ? option.color + '15' : COLORS.NEUTRAL[100],
              }
            ]}
          >
            <Ionicons
              name={option.icon as any}
              size={20}
              color={isSelected ? option.color : option.color}
            />
          </View>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.cardTitle,
            { color: isSelected ? option.color : COLORS.SECONDARY[900] }
          ]}
        >
          {option.title}
        </Text>

        {/* Description */}
        {option.description && (
          <Text
            style={[
              styles.cardDescription,
              { color: isSelected ? option.color : COLORS.SECONDARY[600] }
            ]}
          >
            {option.description}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Target Muscle Groups</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>
            What areas do you want to <Text style={styles.titleAccent}>focus on?</Text>
          </Text>
          <Text style={styles.subtitle}>
            Select the muscle groups you want to target in your Tabata workouts.
          </Text>
        </View>

        {/* Muscle Groups Grid */}
        <View style={styles.section}>
          <View style={styles.cardGrid}>
            {muscleGroups.map((muscle) =>
              renderPreferenceCard(
                muscle,
                targetMuscleGroups.includes(muscle.id),
                () => handleToggleSelection(muscle.id)
              )
            )}
          </View>
        </View>

        {/* Selection Summary */}
        {targetMuscleGroups.length > 0 && (
          <View style={styles.selectionSummary}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.summaryTitle}>
                Selected ({targetMuscleGroups.length})
              </Text>
            </View>
            <Text style={styles.summaryText}>
              Your workouts will target these specific muscle groups for optimal results.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          disabled={targetMuscleGroups.length === 0 || isSaving}
          style={{
            ...styles.saveButton,
            backgroundColor: targetMuscleGroups.length > 0 && !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  descriptionContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
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
    marginBottom: 24,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  preferenceCard: {
    flexBasis: '47%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    alignItems: 'center',
    minHeight: 120,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconContainer: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
    lineHeight: 16,
  },
  selectionSummary: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  saveButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
