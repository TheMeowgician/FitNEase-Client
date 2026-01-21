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

interface ActivityLevelOption {
  id: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  examples: string[];
}

export default function ActivityLevelScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const alert = useAlert();
  const fitnessLevel = params.fitnessLevel as string;
  const preferencesData = params.preferences ? JSON.parse(params.preferences as string) : null;
  const physicalStatsData = params.physicalStats ? JSON.parse(params.physicalStats as string) : null;

  const [selectedLevel, setSelectedLevel] = useState<'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  const activityLevels: ActivityLevelOption[] = [
    {
      id: 'sedentary',
      title: 'Sedentary',
      subtitle: 'Just getting started',
      description: 'Mostly sedentary lifestyle with little to no regular exercise',
      icon: 'walk-outline',
      color: '#3B82F6',
      examples: [
        'Exercise 0-1 times per week',
        'Mostly desk/office work',
        'Limited physical activity',
        'New to fitness routines',
      ],
    },
    {
      id: 'lightly_active',
      title: 'Lightly Active',
      subtitle: 'Some movement',
      description: 'Light exercise or sports 1-2 times per week',
      icon: 'walk-outline',
      color: '#8B5CF6',
      examples: [
        'Exercise 1-2 times per week',
        'Light walking or activities',
        'Starting to build habits',
        'Some daily movement',
      ],
    },
    {
      id: 'moderately_active',
      title: 'Moderately Active',
      subtitle: 'Regular activity',
      description: 'Regularly active with moderate exercise',
      icon: 'bicycle-outline',
      color: '#F59E0B',
      examples: [
        'Exercise 3-4 times per week',
        'Mix of active and sedentary time',
        'Some sports or fitness activities',
        'Building consistent habits',
      ],
    },
    {
      id: 'very_active',
      title: 'Very Active',
      subtitle: 'Highly active lifestyle',
      description: 'Regularly engaged in vigorous physical activities',
      icon: 'barbell-outline',
      color: '#10B981',
      examples: [
        'Exercise 5+ times per week',
        'Active job or lifestyle',
        'Regular sports participation',
        'Strong fitness foundation',
      ],
    },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (!selectedLevel) {
      alert.warning('Selection Required', 'Please select your current activity level to continue.');
      return;
    }

    setIsLoading(true);

    try {
      router.push({
        pathname: '/(onboarding)/fitness-experience',
        params: {
          fitnessLevel,
          preferences: JSON.stringify(preferencesData),
          physicalStats: JSON.stringify(physicalStatsData),
          activityLevel: selectedLevel,
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const renderActivityCard = (level: ActivityLevelOption) => {
    const isSelected = selectedLevel === level.id;

    return (
      <TouchableOpacity
        key={level.id}
        onPress={() => setSelectedLevel(level.id)}
        style={[
          styles.activityCard,
          {
            borderColor: isSelected ? level.color : COLORS.NEUTRAL[200],
            backgroundColor: COLORS.NEUTRAL.WHITE,
            borderWidth: isSelected ? 3 : 2,
            shadowColor: isSelected ? level.color : '#000',
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
            <View style={[styles.checkmark, { backgroundColor: level.color }]}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          </View>
        )}

        {/* Icon */}
        <View style={styles.cardIconContainer}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isSelected ? level.color + '15' : COLORS.NEUTRAL[100],
              }
            ]}
          >
            <Ionicons
              name={level.icon as any}
              size={32}
              color={isSelected ? level.color : level.color}
            />
          </View>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.cardTitle,
            { color: isSelected ? level.color : COLORS.SECONDARY[900] }
          ]}
        >
          {level.title}
        </Text>

        <Text
          style={[
            styles.cardSubtitle,
            { color: isSelected ? level.color : COLORS.SECONDARY[600] }
          ]}
        >
          {level.subtitle}
        </Text>

        {/* Description */}
        <Text style={styles.cardDescription}>
          {level.description}
        </Text>

        {/* Examples */}
        <View style={styles.examplesContainer}>
          {level.examples.map((example, index) => (
            <View key={index} style={styles.exampleRow}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={isSelected ? level.color : COLORS.SECONDARY[400]}
              />
              <Text
                style={[
                  styles.exampleText,
                  { color: isSelected ? level.color : COLORS.SECONDARY[600] }
                ]}
              >
                {example}
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
            currentIndex={3}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Tell us about your routine, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            Your current <Text style={styles.titleAccent}>activity level</Text>
          </Text>

          <Text style={styles.subtitle}>
            This helps us understand your starting point and create workouts that match your current fitness habits.
          </Text>
        </View>

        {/* Activity Level Cards */}
        <View style={styles.levelsContainer}>
          {activityLevels.map(renderActivityCard)}
        </View>

        {/* Selection Summary */}
        {selectedLevel && (
          <View style={styles.selectionSummary}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.summaryTitle}>
                Selected: {activityLevels.find(l => l.id === selectedLevel)?.title}
              </Text>
            </View>
            <Text style={styles.summaryText}>
              We'll design your Tabata workouts to match your current activity level and gradually help you progress.
            </Text>
          </View>
        )}

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="bulb-outline" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              Don't worry about being perfect - our AI adapts to your actual performance and adjusts recommendations over time.
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
          disabled={!selectedLevel}
          style={{
            ...styles.continueButton,
            backgroundColor: selectedLevel ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
            shadowColor: selectedLevel ? COLORS.PRIMARY[500] : 'transparent',
            shadowOpacity: selectedLevel ? 0.3 : 0,
            shadowRadius: selectedLevel ? 8 : 0,
            elevation: selectedLevel ? 8 : 0,
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
  levelsContainer: {
    marginBottom: 32,
  },
  activityCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    alignItems: 'center',
    marginBottom: 20,
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
  cardIconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  examplesContainer: {
    alignSelf: 'stretch',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  exampleText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  section: {
    marginBottom: 32,
  },
  experienceContainer: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 16,
    padding: 20,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  experienceLabel: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  experienceValue: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
  },
  experienceSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 20,
    textAlign: 'center',
  },
  sliderContainer: {
    alignItems: 'center',
  },
  sliderTrack: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[500],
    borderRadius: 4,
  },
  sliderControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderQuickControls: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
  },
  quickButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickButtonText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
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