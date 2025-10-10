import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/microservices/authService';
import { COLORS, FONTS } from '../../constants/colors';
import { capitalizeFirstLetter } from '../../utils/stringUtils';
import { useSmartBack } from '../../hooks/useSmartBack';

export default function UserPersonalizationScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const [isLoading, setIsLoading] = useState(false);

  const personalizationItems = [
    {
      icon: 'calendar-outline',
      title: 'Workout Days',
      subtitle: user?.workoutDays?.length
        ? `${user.workoutDays.length} days per week`
        : 'Not set',
      route: '/settings/personalization/workout-days',
    },
    {
      icon: 'fitness-outline',
      title: 'Target Muscle Groups',
      subtitle: user?.targetMuscleGroups?.length
        ? `${user.targetMuscleGroups.length} selected`
        : 'Not set',
      route: '/settings/personalization/muscle-groups',
    },
    {
      icon: 'time-outline',
      title: 'Workout Duration',
      subtitle: user?.timeConstraints
        ? `${user.timeConstraints} minutes`
        : 'Not set',
      route: '/settings/personalization/duration',
    },
    {
      icon: 'body-outline',
      title: 'Body Metrics',
      subtitle: 'Update height, weight, age',
      route: '/settings/personalization/body-metrics',
    },
    {
      icon: 'walk-outline',
      title: 'Activity Level',
      subtitle: user?.activityLevel
        ? capitalizeFirstLetter(user.activityLevel.replace('_', ' '))
        : 'Not set',
      route: '/settings/personalization/activity-level',
    },
    {
      icon: 'pulse-outline',
      title: 'Fitness Experience',
      subtitle: user?.workoutExperience !== undefined
        ? `${user.workoutExperience} ${user.workoutExperience === 1 ? 'year' : 'years'}`
        : 'Not set',
      route: '/settings/personalization/fitness-experience',
    },
    {
      icon: 'trophy-outline',
      title: 'Fitness Goals',
      subtitle: user?.goals?.length
        ? `${user.goals.length} goals`
        : 'Not set',
      route: '/settings/personalization/fitness-goals',
    },
  ];

  const handleBack = () => {
    goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.NEUTRAL.WHITE} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Personalization</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            Customize your workout preferences to get better personalized recommendations.
          </Text>
        </View>

        {/* Personalization Items */}
        <View style={styles.itemsContainer}>
          {personalizationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.item}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.itemIcon}>
                <Ionicons name={item.icon as any} size={24} color={COLORS.PRIMARY[500]} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
          <Text style={styles.infoText}>
            Changes will update your workout recommendations immediately.
          </Text>
        </View>
      </ScrollView>
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
    paddingBottom: 32,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    textAlign: 'center',
  },
  itemsContainer: {
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 18,
  },
});
