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
import { capitalizeFirstLetter } from '../../utils/stringUtils';

const { width } = Dimensions.get('window');

export default function FitnessExperienceScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const fitnessLevel = params.fitnessLevel as string;
  const preferencesData = params.preferences ? JSON.parse(params.preferences as string) : null;
  const physicalStatsData = params.physicalStats ? JSON.parse(params.physicalStats as string) : null;
  const activityLevel = params.activityLevel as string;

  const [fitnessExperience, setFitnessExperience] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      router.push({
        pathname: '/(onboarding)/fitness-goals',
        params: {
          fitnessLevel,
          preferences: JSON.stringify(preferencesData),
          physicalStats: JSON.stringify(physicalStatsData),
          activityLevel,
          fitnessExperience: fitnessExperience.toString()
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const percentage = (fitnessExperience / 20) * 100;

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
            currentIndex={4}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Share your experience, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            How much <Text style={styles.titleAccent}>experience</Text> do you have?
          </Text>

          <Text style={styles.subtitle}>
            Tell us about your fitness journey so we can create the perfect Tabata workout intensity for you.
          </Text>
        </View>

        {/* Fitness Experience Slider */}
        <View style={styles.experienceContainer}>
          <View style={styles.experienceHeader}>
            <Text style={styles.experienceLabel}>Fitness Experience</Text>
            <Text style={styles.experienceValue}>{fitnessExperience} years</Text>
          </View>

          <Text style={styles.experienceSubtitle}>
            How many years have you been exercising regularly?
          </Text>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
            </View>

            <View style={styles.sliderControls}>
              <TouchableOpacity
                onPress={() => setFitnessExperience(Math.max(0, fitnessExperience - 1))}
                style={styles.sliderButton}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color={COLORS.SECONDARY[600]} />
              </TouchableOpacity>

              <View style={styles.sliderQuickControls}>
                <TouchableOpacity
                  onPress={() => setFitnessExperience(0)}
                  style={styles.quickButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFitnessExperience(2)}
                  style={styles.quickButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickButtonText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFitnessExperience(5)}
                  style={styles.quickButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickButtonText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFitnessExperience(10)}
                  style={styles.quickButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickButtonText}>10+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setFitnessExperience(Math.min(20, fitnessExperience + 1))}
                style={styles.sliderButton}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={COLORS.SECONDARY[600]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              Your experience level helps us determine the right workout intensity and progression pace for your Tabata training.
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
  experienceContainer: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[200],
    shadowColor: COLORS.PRIMARY[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  experienceLabel: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  experienceValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
  },
  experienceSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderTrack: {
    height: 12,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 24,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sliderQuickControls: {
    flexDirection: 'row',
    marginHorizontal: 16,
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
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  },
  quickButtonText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
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
