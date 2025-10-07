import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/ui/Button';
import { PageIndicator } from '../../components/ui/PageIndicator';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../contexts/AuthContext';
import { capitalizeFirstLetter } from '../../utils/stringUtils';

const { width } = Dimensions.get('window');

interface WorkoutPreferences {
  targetMuscleGroups: string[];
}

interface PreferenceOption {
  id: string;
  title: string;
  icon: string;
  color: string;
  description?: string;
}

export default function PreferencesScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const fitnessLevel = params.fitnessLevel as string;

  const [targetMuscleGroups, setTargetMuscleGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const muscleGroups: PreferenceOption[] = [
    { id: 'upper_body', title: 'Upper Body', icon: 'body-outline', color: '#EF4444', description: 'Chest, back, shoulders, arms' },
    { id: 'lower_body', title: 'Lower Body', icon: 'walk-outline', color: '#6366F1', description: 'Legs, glutes, calves' },
    { id: 'core', title: 'Core', icon: 'ellipse-outline', color: '#EC4899', description: 'Abs and core stability' },
    { id: 'whole_body', title: 'Whole Body', icon: 'person-outline', color: '#F97316', description: 'Full body workout' },
  ];

  const handleToggleSelection = (item: string) => {
    const newList = targetMuscleGroups.includes(item)
      ? targetMuscleGroups.filter(i => i !== item)
      : [...targetMuscleGroups, item];
    setTargetMuscleGroups(newList);
  };

  const handleContinue = async () => {
    if (targetMuscleGroups.length === 0) {
      Alert.alert(
        'Selection Required',
        'Please select at least one muscle group to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);

    try {
      // Navigate to workout duration page
      router.push({
        pathname: '/(onboarding)/workout-duration',
        params: {
          fitnessLevel,
          targetMuscleGroups: JSON.stringify(targetMuscleGroups),
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
              color={isSelected ? 'white' : option.color}
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
            currentIndex={0}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Looking good, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            What are your <Text style={styles.titleAccent}>preferences?</Text>
          </Text>

          <Text style={styles.subtitle}>
            Tell us what you prefer so we can create the perfect Tabata workouts tailored just for you.
          </Text>
        </View>

        {/* Muscle Groups Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Muscle Groups *</Text>
          <Text style={styles.sectionSubtitle}>Choose what you want to focus on</Text>
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

        {/* Selection Summary for Muscle Groups */}
        {targetMuscleGroups.length > 0 && (
          <View style={styles.selectionSummary}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.summaryTitle}>
                Selected Muscle Groups ({targetMuscleGroups.length})
              </Text>
            </View>
            <Text style={styles.summaryText}>
              Your Tabata workouts will target these specific muscle groups for optimal results.
            </Text>
          </View>
        )}


        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              Your preferences help us create personalized Tabata workouts that fit your lifestyle and goals.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          loading={isLoading}
          disabled={targetMuscleGroups.length === 0}
          style={{
            ...styles.continueButton,
            backgroundColor: targetMuscleGroups.length > 0 ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
            shadowColor: targetMuscleGroups.length > 0 ? COLORS.PRIMARY[500] : 'transparent',
            shadowOpacity: targetMuscleGroups.length > 0 ? 0.3 : 0,
            shadowRadius: targetMuscleGroups.length > 0 ? 8 : 0,
            elevation: targetMuscleGroups.length > 0 ? 8 : 0,
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
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 65,
  },
  timeText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
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
});