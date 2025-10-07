import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { COLORS, FONTS } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/microservices/authService';

export default function FitnessExperienceSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const [fitnessExperience, setFitnessExperience] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.workoutExperience !== undefined) {
      setFitnessExperience(user.workoutExperience);
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authService.updateUserProfile({
        workout_experience_years: fitnessExperience,
      });
      await refreshUser();
      Alert.alert('Success', 'Your fitness experience has been updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving fitness experience:', error);
      Alert.alert('Error', 'Failed to save your preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const percentage = (fitnessExperience / 20) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fitness Experience</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>How many years of <Text style={styles.titleAccent}>workout experience</Text> do you have?</Text>
          <Text style={styles.subtitle}>This helps us adjust exercise difficulty and progression.</Text>
        </View>

        <View style={styles.sliderSection}>
          <Text style={styles.experienceValue}>{fitnessExperience} {fitnessExperience === 1 ? 'year' : 'years'}</Text>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
          </View>
          <View style={styles.sliderControls}>
            <TouchableOpacity onPress={() => setFitnessExperience(Math.max(0, fitnessExperience - 1))} style={styles.sliderButton} activeOpacity={0.7}>
              <Ionicons name="remove" size={24} color={COLORS.PRIMARY[500]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFitnessExperience(Math.min(20, fitnessExperience + 1))} style={styles.sliderButton} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={COLORS.PRIMARY[500]} />
            </TouchableOpacity>
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0 years</Text>
            <Text style={styles.sliderLabel}>20+ years</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button title={isSaving ? "Saving..." : "Save Changes"} onPress={handleSave} loading={isSaving} disabled={isSaving} style={{ ...styles.saveButton, backgroundColor: !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300] }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.NEUTRAL.WHITE },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.NEUTRAL[200] },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  descriptionContainer: { marginBottom: 48, alignItems: 'center' },
  title: { fontSize: 24, fontFamily: FONTS.BOLD, color: COLORS.SECONDARY[900], textAlign: 'center', marginBottom: 12 },
  titleAccent: { color: COLORS.PRIMARY[500] },
  subtitle: { fontSize: 16, fontFamily: FONTS.REGULAR, color: COLORS.SECONDARY[600], textAlign: 'center', lineHeight: 24 },
  sliderSection: { marginBottom: 32 },
  experienceValue: { fontSize: 48, fontFamily: FONTS.BOLD, color: COLORS.PRIMARY[500], textAlign: 'center', marginBottom: 32 },
  sliderTrack: { height: 12, backgroundColor: COLORS.NEUTRAL[200], borderRadius: 6, marginBottom: 24, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: COLORS.PRIMARY[500] },
  sliderControls: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sliderButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.PRIMARY[50], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.PRIMARY[500] },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  sliderLabel: { fontSize: 14, fontFamily: FONTS.REGULAR, color: COLORS.SECONDARY[500] },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  saveButton: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
