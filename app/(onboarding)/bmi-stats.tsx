import React, { useState, useEffect } from 'react';
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
import { calculateAge } from '../../utils/dateUtils';
import { capitalizeFirstLetter } from '../../utils/stringUtils';

const { width } = Dimensions.get('window');

interface PhysicalStats {
  weight: number;
  height: number;
  age: number;
}

export default function BMIStatsScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const alert = useAlert();
  const fitnessLevel = params.fitnessLevel as string;

  // Build preferences object from params (coming from workout-duration page)
  const targetMuscleGroups = params.targetMuscleGroups ? JSON.parse(params.targetMuscleGroups as string) : [];
  const availableEquipment = params.availableEquipment ? JSON.parse(params.availableEquipment as string) : [];
  const timeConstraints = params.timeConstraints ? parseInt(params.timeConstraints as string) : 30;

  const preferencesData = {
    targetMuscleGroups,
    availableEquipment,
    timeConstraints,
  };

  // Calculate age from user's birthdate
  const userAge = user?.dateOfBirth ? calculateAge(user.dateOfBirth) : 25;

  // Debug logging
  useEffect(() => {
    console.log('🎂 [BMI-STATS] User date of birth:', user?.dateOfBirth);
    console.log('🎂 [BMI-STATS] Calculated age:', userAge);
  }, [user?.dateOfBirth, userAge]);

  const [physicalStats, setPhysicalStats] = useState<PhysicalStats>({
    weight: 70,
    height: 170,
    age: userAge,
  });
  const [bmi, setBmi] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Update age when user data loads
  useEffect(() => {
    if (user?.dateOfBirth) {
      const age = calculateAge(user.dateOfBirth);
      console.log('🎂 [BMI-STATS] Age recalculated in useEffect:', age);
      setPhysicalStats(prev => ({ ...prev, age }));
    }
  }, [user?.dateOfBirth]);

  // Calculate BMI whenever weight or height changes
  useEffect(() => {
    const heightInMeters = physicalStats.height / 100;
    const calculatedBmi = physicalStats.weight / (heightInMeters * heightInMeters);
    setBmi(calculatedBmi);
  }, [physicalStats.weight, physicalStats.height]);

  const getBMICategory = (bmiValue: number) => {
    if (bmiValue < 18.5) return { category: 'Underweight', color: '#3B82F6' };
    if (bmiValue < 25) return { category: 'Normal weight', color: '#10B981' };
    if (bmiValue < 30) return { category: 'Overweight', color: '#F59E0B' };
    return { category: 'Obese', color: '#EF4444' };
  };

  const getBMIBarPosition = (bmiValue: number) => {
    const maxBMI = 40;
    const minBMI = 15;
    const position = ((bmiValue - minBMI) / (maxBMI - minBMI)) * 100;
    return Math.max(0, Math.min(100, position));
  };

  const renderCustomSlider = (
    value: number,
    setValue: (value: number) => void,
    min: number,
    max: number,
    step: number = 1,
    unit: string,
    field: keyof PhysicalStats
  ) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderMinMax}>{min} {unit}</Text>
          <Text style={styles.sliderValue}>{value} {unit}</Text>
          <Text style={styles.sliderMinMax}>{max} {unit}</Text>
        </View>

        {/* Slider Track */}
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
        </View>

        {/* Controls */}
        <View style={styles.sliderControls}>
          <TouchableOpacity
            onPress={() => setValue(Math.max(min, value - step))}
            style={styles.sliderButton}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Ionicons name="remove" size={20} color={COLORS.SECONDARY[600]} />
          </TouchableOpacity>

          <View style={styles.sliderQuickControls}>
            <TouchableOpacity
              onPress={() => setValue(Math.max(min, value - step * 5))}
              style={styles.quickButton}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <Text style={styles.quickButtonText}>-5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setValue(Math.max(min, value - step))}
              style={styles.quickButton}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <Text style={styles.quickButtonText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setValue(Math.min(max, value + step))}
              style={styles.quickButton}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <Text style={styles.quickButtonText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setValue(Math.min(max, value + step * 5))}
              style={styles.quickButton}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <Text style={styles.quickButtonText}>+5</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setValue(Math.min(max, value + step))}
            style={styles.sliderButton}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Ionicons name="add" size={20} color={COLORS.SECONDARY[600]} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      router.push({
        pathname: '/(onboarding)/activity-level',
        params: {
          fitnessLevel,
          preferences: JSON.stringify(preferencesData),
          physicalStats: JSON.stringify({
            ...physicalStats,
            bmi: parseFloat(bmi.toFixed(1))
          })
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const bmiInfo = getBMICategory(bmi);

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
            currentIndex={2}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Tell us about yourself, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            Your <Text style={styles.titleAccent}>body metrics</Text>
          </Text>

          <Text style={styles.subtitle}>
            Help us understand your physical stats to create perfectly tailored Tabata workouts.
          </Text>
        </View>

        {/* Physical Stats */}
        <View style={styles.section}>
          {/* Weight */}
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Ionicons name="fitness-outline" size={24} color={COLORS.PRIMARY[500]} />
              <Text style={styles.statLabel}>Weight</Text>
            </View>
            {renderCustomSlider(
              physicalStats.weight,
              (value) => setPhysicalStats(prev => ({ ...prev, weight: value })),
              40, 150, 1, 'kg', 'weight'
            )}
          </View>

          {/* Height */}
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Ionicons name="resize-outline" size={24} color={COLORS.PRIMARY[500]} />
              <Text style={styles.statLabel}>Height</Text>
            </View>
            {renderCustomSlider(
              physicalStats.height,
              (value) => setPhysicalStats(prev => ({ ...prev, height: value })),
              140, 220, 1, 'cm', 'height'
            )}
          </View>

          {/* Age - Auto-calculated from birthdate */}
          <View style={styles.statItem}>
            <View style={styles.statHeader}>
              <Ionicons name="calendar-outline" size={24} color={COLORS.PRIMARY[500]} />
              <Text style={styles.statLabel}>Age</Text>
            </View>
            <View style={styles.readOnlyContainer}>
              <Text style={styles.readOnlyValue}>{physicalStats.age} years</Text>
              <Text style={styles.readOnlyLabel}>Calculated from your birthdate</Text>
            </View>
          </View>
        </View>

        {/* BMI Results */}
        <View style={styles.bmiSection}>
          <Text style={styles.sectionTitle}>Your BMI</Text>
          <View style={styles.bmiCard}>
            {/* BMI Value */}
            <View style={styles.bmiValue}>
              <Text style={styles.bmiNumber}>{bmi.toFixed(1)}</Text>
              <Text style={[styles.bmiCategory, { color: bmiInfo.color }]}>
                {bmiInfo.category}
              </Text>
            </View>

            {/* BMI Scale */}
            <View style={styles.bmiScale}>
              <View style={styles.bmiScaleTrack}>
                {/* BMI Categories Background */}
                <View style={styles.bmiCategoryColors}>
                  <View style={[styles.bmiColorSegment, { backgroundColor: '#3B82F6' }]} />
                  <View style={[styles.bmiColorSegment, { backgroundColor: '#10B981' }]} />
                  <View style={[styles.bmiColorSegment, { backgroundColor: '#F59E0B' }]} />
                  <View style={[styles.bmiColorSegment, { backgroundColor: '#EF4444' }]} />
                </View>

                {/* BMI Indicator */}
                <View
                  style={[
                    styles.bmiIndicator,
                    { left: `${getBMIBarPosition(bmi)}%` }
                  ]}
                />
              </View>

              {/* Scale Labels */}
              <View style={styles.bmiLabels}>
                <Text style={styles.bmiLabel}>18.5</Text>
                <Text style={styles.bmiLabel}>25</Text>
                <Text style={styles.bmiLabel}>30</Text>
              </View>
            </View>

            <Text style={styles.bmiInfo}>
              BMI helps us customize workout intensity for your body type and fitness goals.
            </Text>
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              All your personal data is encrypted and used only to create your personalized fitness experience.
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
          style={{
            ...styles.continueButton,
            backgroundColor: COLORS.PRIMARY[500],
            shadowColor: COLORS.PRIMARY[500],
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
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
  statItem: {
    marginBottom: 32,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginLeft: 8,
  },
  sliderContainer: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sliderMinMax: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  sliderValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
  },
  sliderTrack: {
    height: 12,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[500],
    borderRadius: 6,
  },
  sliderControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sliderQuickControls: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 8,
  },
  quickButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
    elevation: 1,
  },
  quickButtonText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  bmiSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  bmiCard: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 20,
    padding: 24,
    shadowColor: COLORS.PRIMARY[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bmiValue: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bmiNumber: {
    fontSize: 48,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
    marginBottom: 4,
  },
  bmiCategory: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
  },
  bmiScale: {
    marginBottom: 20,
  },
  bmiScaleTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  bmiCategoryColors: {
    flexDirection: 'row',
    height: '100%',
  },
  bmiColorSegment: {
    flex: 1,
  },
  bmiIndicator: {
    position: 'absolute',
    top: 0,
    width: 4,
    height: '100%',
    backgroundColor: COLORS.SECONDARY[800],
    borderRadius: 2,
  },
  bmiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  bmiLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  bmiInfo: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
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
  readOnlyContainer: {
    backgroundColor: COLORS.NEUTRAL[100],
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    alignItems: 'center',
  },
  readOnlyValue: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
    marginBottom: 8,
  },
  readOnlyLabel: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
});