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

export default function WorkoutDurationScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const fitnessLevel = params.fitnessLevel as string;
  const targetMuscleGroups = params.targetMuscleGroups ? JSON.parse(params.targetMuscleGroups as string) : [];

  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);

  const durations = [
    { value: 15, label: '15 min', description: 'Quick session', icon: 'flash-outline', color: '#10B981' },
    { value: 30, label: '30 min', description: 'Standard workout', icon: 'fitness-outline', color: '#F59E0B' },
    { value: 45, label: '45 min', description: 'Extended session', icon: 'barbell-outline', color: '#8B5CF6' },
    { value: 60, label: '60 min', description: 'Full workout', icon: 'trophy-outline', color: '#EF4444' },
    { value: 90, label: '90 min', description: 'Intensive training', icon: 'flame-outline', color: '#EC4899' },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      // Auto-set equipment to bodyweight only
      const availableEquipment = ['bodyweight'];

      router.push({
        pathname: '/(onboarding)/bmi-stats',
        params: {
          fitnessLevel,
          targetMuscleGroups: JSON.stringify(targetMuscleGroups),
          availableEquipment: JSON.stringify(availableEquipment),
          timeConstraints: selectedDuration.toString(),
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
            currentIndex={1}
            activeColor={COLORS.PRIMARY[500]}
            inactiveColor={COLORS.NEUTRAL[300]}
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          {user?.firstName && (
            <Text style={styles.greeting}>
              Great choice, {capitalizeFirstLetter(user.firstName)}!
            </Text>
          )}

          <Text style={styles.title}>
            How long do you <Text style={styles.titleAccent}>want to train?</Text>
          </Text>

          <Text style={styles.subtitle}>
            Choose your preferred Tabata workout duration. You can always adjust this later.
          </Text>
        </View>

        {/* Duration Cards */}
        <View style={styles.section}>
          {durations.map((duration) => {
            const isSelected = selectedDuration === duration.value;
            return (
              <TouchableOpacity
                key={duration.value}
                onPress={() => setSelectedDuration(duration.value)}
                style={[
                  styles.durationCard,
                  {
                    borderColor: isSelected ? duration.color : COLORS.NEUTRAL[200],
                    borderWidth: isSelected ? 3 : 2,
                    backgroundColor: COLORS.NEUTRAL.WHITE,
                    shadowColor: isSelected ? duration.color : '#000',
                    shadowOpacity: isSelected ? 0.2 : 0.05,
                    shadowRadius: isSelected ? 12 : 4,
                    elevation: isSelected ? 6 : 2,
                  }
                ]}
                activeOpacity={0.7}
              >
                {/* Selection Indicator */}
                {isSelected && (
                  <View style={styles.selectionIndicator}>
                    <View style={[styles.checkmark, { backgroundColor: duration.color }]}>
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                  </View>
                )}

                {/* Content */}
                <View style={styles.cardContent}>
                  {/* Icon */}
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isSelected ? duration.color + '20' : COLORS.NEUTRAL[100],
                      }
                    ]}
                  >
                    <Ionicons
                      name={duration.icon as any}
                      size={28}
                      color={isSelected ? duration.color : COLORS.SECONDARY[600]}
                    />
                  </View>

                  {/* Text */}
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.durationLabel,
                        { color: isSelected ? duration.color : COLORS.SECONDARY[900] }
                      ]}
                    >
                      {duration.label}
                    </Text>
                    <Text
                      style={[
                        styles.durationDescription,
                        { color: isSelected ? duration.color : COLORS.SECONDARY[600] }
                      ]}
                    >
                      {duration.description}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
            <Text style={styles.infoText}>
              All workouts use bodyweight exercises only - no equipment needed! Perfect for training anywhere, anytime.
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
    marginBottom: 24,
  },
  durationCard: {
    padding: 20,
    borderRadius: 16,
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  durationLabel: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    marginBottom: 4,
  },
  durationDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
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
