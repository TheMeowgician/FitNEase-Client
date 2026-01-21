import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { COLORS, FONTS } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { useAlert } from '../../../contexts/AlertContext';
import { authService } from '../../../services/microservices/authService';
import { useSmartBack } from '../../../hooks/useSmartBack';

interface ActivityLevelOption {
  id: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  examples: string[];
}

export default function ActivityLevelSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const alert = useAlert();
  const [selectedLevel, setSelectedLevel] = useState<'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | ''>('');
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    loadCurrentSettings();
  }, [user]);

  const loadCurrentSettings = () => {
    if (user?.activityLevel) {
      setSelectedLevel(user.activityLevel as any);
    }
  };

  const handleSave = async () => {
    if (!selectedLevel) {
      alert.warning('Selection Required', 'Please select your current activity level.');
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateUserProfile({
        activity_level: selectedLevel,
      });

      await refreshUser();

      alert.success('Success', 'Your activity level has been updated!', () => goBack());
    } catch (error) {
      console.error('Error saving activity level:', error);
      alert.error('Error', 'Failed to save your preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    goBack();
  };

  const renderActivityCard = (option: ActivityLevelOption) => {
    const isSelected = selectedLevel === option.id;

    return (
      <TouchableOpacity
        key={option.id}
        onPress={() => setSelectedLevel(option.id)}
        style={[
          styles.activityCard,
          {
            borderColor: isSelected ? option.color : COLORS.NEUTRAL[200],
            borderWidth: isSelected ? 3 : 2,
            backgroundColor: isSelected ? option.color + '10' : COLORS.NEUTRAL.WHITE,
          }
        ]}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <View style={[styles.checkmark, { backgroundColor: option.color }]}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: option.color + '20' }]}>
            <Ionicons name={option.icon as any} size={28} color={option.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: isSelected ? option.color : COLORS.SECONDARY[900] }]}>
              {option.title}
            </Text>
            <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
          </View>
        </View>

        <Text style={styles.cardDescription}>{option.description}</Text>

        <View style={styles.examplesContainer}>
          {option.examples.map((example, idx) => (
            <View key={idx} style={styles.exampleRow}>
              <Ionicons name="checkmark-circle" size={14} color={isSelected ? option.color : COLORS.SECONDARY[400]} />
              <Text style={[styles.exampleText, { color: isSelected ? option.color : COLORS.SECONDARY[600] }]}>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Level</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>
            What's your <Text style={styles.titleAccent}>activity level?</Text>
          </Text>
          <Text style={styles.subtitle}>
            This helps us customize your Tabata workout intensity.
          </Text>
        </View>

        <View style={styles.section}>
          {activityLevels.map((level) => renderActivityCard(level))}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          disabled={!selectedLevel || isSaving}
          style={{
            ...styles.saveButton,
            backgroundColor: selectedLevel && !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
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
    gap: 16,
  },
  activityCard: {
    padding: 20,
    borderRadius: 16,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    marginBottom: 16,
    lineHeight: 20,
  },
  examplesContainer: {
    gap: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    flex: 1,
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
