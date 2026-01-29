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

interface GoalOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  benefits: string[];
}

export default function FitnessGoalsScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const alert = useAlert();
  const fitnessLevel = params.fitnessLevel as string;
  const preferencesData = params.preferences ? JSON.parse(params.preferences as string) : null;
  const physicalStatsData = params.physicalStats ? JSON.parse(params.physicalStats as string) : null;
  const activityLevel = params.activityLevel as string;
  const fitnessExperience = params.fitnessExperience as string;

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fitnessGoals: GoalOption[] = [
    {
      id: 'weight_loss',
      title: 'Weight Loss',
      description: 'Burn calories and reduce body fat through high-intensity workouts',
      icon: 'trending-down-outline',
      color: '#EF4444',
      benefits: [
        'Burn calories efficiently',
        'Boost metabolism',
        'Reduce body fat percentage',
        'Improve cardiovascular health',
      ],
    },
    {
      id: 'muscle_gain',
      title: 'Muscle Gain',
      description: 'Build lean muscle mass and increase strength',
      icon: 'fitness-outline',
      color: '#8B5CF6',
      benefits: [
        'Increase muscle mass',
        'Improve strength',
        'Better body composition',
        'Enhanced metabolism',
      ],
    },
    {
      id: 'endurance',
      title: 'Endurance',
      description: 'Improve cardiovascular fitness and stamina',
      icon: 'heart-outline',
      color: '#F59E0B',
      benefits: [
        'Better cardiovascular health',
        'Increased stamina',
        'Improved oxygen efficiency',
        'Enhanced energy levels',
      ],
    },
    {
      id: 'strength',
      title: 'Strength',
      description: 'Increase power, force, and functional movement',
      icon: 'barbell-outline',
      color: '#10B981',
      benefits: [
        'Increase functional strength',
        'Better power output',
        'Improved daily activities',
        'Enhanced bone density',
      ],
    },
    {
      id: 'flexibility',
      title: 'Flexibility',
      description: 'Improve mobility, range of motion, and recovery',
      icon: 'accessibility-outline',
      color: '#6366F1',
      benefits: [
        'Better range of motion',
        'Reduced injury risk',
        'Improved posture',
        'Enhanced recovery',
      ],
    },
    {
      id: 'general_fitness',
      title: 'General Fitness',
      description: 'Overall health, wellness, and balanced fitness',
      icon: 'body-outline',
      color: '#EC4899',
      benefits: [
        'Balanced fitness development',
        'Overall health improvement',
        'Better quality of life',
        'Stress reduction',
      ],
    },
  ];

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (selectedGoals.length === 0) {
      alert.warning('Selection Required', 'Please select at least one fitness goal to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const completeData = {
        assessment: {
          currentFitnessLevel: fitnessLevel,
          primaryGoals: selectedGoals,
          workoutExperience: parseInt(fitnessExperience),
          weeklyActivityLevel: activityLevel,
          medicalConditions: '',
          injuries: '',
          weight: physicalStatsData?.weight || 70,
          height: physicalStatsData?.height || 170,
          age: physicalStatsData?.age || 25,
          bmi: physicalStatsData?.bmi || 24.2,
        },
        preferences: preferencesData || {
          targetMuscleGroups: [],
          availableEquipment: [],
          timeConstraints: 30,
          workoutTypes: [],
          preferredDays: [],
        },
      };

      router.push({
        pathname: '/(onboarding)/weekly-goal',
        params: {
          fitnessLevel,
          preferences: JSON.stringify(preferencesData),
          physicalStats: JSON.stringify(physicalStatsData),
          activityLevel: activityLevel,
          fitnessExperience: fitnessExperience,
          fitnessGoals: JSON.stringify(selectedGoals)
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderGoalCard = (goal: GoalOption) => {
    const isSelected = selectedGoals.includes(goal.id);

    return (
      <TouchableOpacity
        key={goal.id}
        onPress={() => toggleGoal(goal.id)}
        style={[
          styles.goalCard,
          {
            borderColor: isSelected ? goal.color : COLORS.NEUTRAL[200],
            backgroundColor: COLORS.NEUTRAL.WHITE,
            borderWidth: isSelected ? 3 : 2,
            shadowColor: isSelected ? goal.color : '#000',
            shadowOpacity: isSelected ? 0.15 : 0.05,
            shadowRadius: isSelected ? 12 : 4,
            elevation: isSelected ? 6 : 2,
          }
        ]}
        activeOpacity={0.7}
      >
        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <View style={[styles.checkmark, { backgroundColor: goal.color }]}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          </View>
        )}

        {/* Icon */}
        <View style={styles.goalIconContainer}>
          <View
            style={[
              styles.goalIconCircle,
              {
                backgroundColor: isSelected ? goal.color + '15' : COLORS.NEUTRAL[100],
              }
            ]}
          >
            <Ionicons
              name={goal.icon as any}
              size={28}
              color={isSelected ? goal.color : goal.color}
            />
          </View>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.goalTitle,
            { color: isSelected ? goal.color : COLORS.SECONDARY[900] }
          ]}
        >
          {goal.title}
        </Text>

        {/* Description */}
        <Text style={styles.goalDescription}>
          {goal.description}
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          {goal.benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={isSelected ? goal.color : COLORS.SECONDARY[400]}
              />
              <Text
                style={[
                  styles.benefitText,
                  { color: isSelected ? goal.color : COLORS.SECONDARY[600] }
                ]}
              >
                {benefit}
              </Text>
            </View>
          ))}
        </View>
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
            currentIndex={5}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              What drives you, {capitalizeFirstLetter(user.firstName)}?
            </Text>
          )}

          <Text style={styles.title}>
            What are your <Text style={styles.titleAccent}>fitness goals?</Text>
          </Text>

          <Text style={styles.subtitle}>
            Select one or more goals to personalize your Tabata workout experience. You can always change these later.
          </Text>
        </View>

        {/* Goals Grid */}
        <View style={styles.goalsContainer}>
          {fitnessGoals.map(renderGoalCard)}
        </View>

        {/* Selection Summary */}
        {selectedGoals.length > 0 && (
          <View style={styles.selectionSummary}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.summaryTitle}>
                Selected Goals ({selectedGoals.length})
              </Text>
            </View>
            <Text style={styles.summaryText}>
              Your Tabata workouts will be designed to help you achieve these specific fitness goals through targeted high-intensity intervals.
            </Text>
          </View>
        )}

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              You can select multiple goals. Our AI will create balanced workouts that address all your fitness objectives effectively.
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
          disabled={selectedGoals.length === 0}
          style={{
            ...styles.continueButton,
            backgroundColor: selectedGoals.length > 0 ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
            shadowColor: selectedGoals.length > 0 ? COLORS.PRIMARY[500] : 'transparent',
            shadowOpacity: selectedGoals.length > 0 ? 0.3 : 0,
            shadowRadius: selectedGoals.length > 0 ? 8 : 0,
            elevation: selectedGoals.length > 0 ? 8 : 0,
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
  goalsContainer: {
    marginBottom: 24,
  },
  goalCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    marginBottom: 16,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  goalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  benefitsContainer: {
    alignSelf: 'stretch',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  benefitText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    marginLeft: 8,
    flex: 1,
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