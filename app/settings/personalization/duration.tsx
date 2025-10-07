import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { COLORS, FONTS } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/microservices/authService';

interface DurationOption {
  value: number;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export default function DurationSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isSaving, setIsSaving] = useState(false);

  const durations: DurationOption[] = [
    { value: 15, label: '15 min', description: 'Quick session', icon: 'flash-outline', color: '#10B981' },
    { value: 30, label: '30 min', description: 'Standard workout', icon: 'fitness-outline', color: '#F59E0B' },
    { value: 45, label: '45 min', description: 'Extended session', icon: 'barbell-outline', color: '#8B5CF6' },
    { value: 60, label: '60 min', description: 'Full workout', icon: 'trophy-outline', color: '#EF4444' },
    { value: 90, label: '90 min', description: 'Intensive training', icon: 'flame-outline', color: '#EC4899' },
  ];

  useEffect(() => {
    loadCurrentSettings();
  }, [user]);

  const loadCurrentSettings = () => {
    if (user?.timeConstraints) {
      setSelectedDuration(user.timeConstraints);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authService.updateUserProfile({
        time_constraints_minutes: selectedDuration,
      });

      await refreshUser();

      Alert.alert(
        'Success',
        'Your workout duration preference has been updated!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving duration:', error);
      Alert.alert('Error', 'Failed to save your preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const renderDurationCard = (duration: DurationOption) => {
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
            shadowColor: isSelected ? duration.color : '#000',
            shadowOpacity: isSelected ? 0.15 : 0.05,
            shadowRadius: isSelected ? 8 : 4,
            elevation: isSelected ? 4 : 2,
          }
        ]}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <View style={[styles.checkmark, { backgroundColor: duration.color }]}>
              <Ionicons name="checkmark" size={12} color="white" />
            </View>
          </View>
        )}

        <View style={styles.cardIconContainer}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isSelected ? duration.color + '15' : COLORS.NEUTRAL[100] }
            ]}
          >
            <Ionicons
              name={duration.icon as any}
              size={24}
              color={isSelected ? duration.color : duration.color}
            />
          </View>
        </View>

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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Duration</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>
            How much <Text style={styles.titleAccent}>time</Text> can you commit?
          </Text>
          <Text style={styles.subtitle}>
            Choose your preferred workout duration for Tabata sessions.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.cardGrid}>
            {durations.map((duration) => renderDurationCard(duration))}
          </View>
        </View>

        <View style={styles.infoNote}>
          <Ionicons name="information-circle" size={20} color={COLORS.SECONDARY[500]} />
          <Text style={styles.infoText}>
            Your workouts will be customized to fit within your selected time frame.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={{
            ...styles.saveButton,
            backgroundColor: !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300],
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
  durationCard: {
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationLabel: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    marginBottom: 4,
  },
  durationDescription: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
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
