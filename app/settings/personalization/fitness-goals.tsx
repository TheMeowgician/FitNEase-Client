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

const GOALS = [
  { id: 'weight_loss', title: 'Weight Loss', icon: 'trending-down-outline', color: '#EF4444' },
  { id: 'muscle_gain', title: 'Muscle Gain', icon: 'fitness-outline', color: '#8B5CF6' },
  { id: 'endurance', title: 'Endurance', icon: 'heart-outline', color: '#F59E0B' },
  { id: 'strength', title: 'Strength', icon: 'barbell-outline', color: '#10B981' },
  { id: 'flexibility', title: 'Flexibility', icon: 'accessibility-outline', color: '#6366F1' },
  { id: 'general_fitness', title: 'General Fitness', icon: 'body-outline', color: '#EC4899' },
];

export default function FitnessGoalsSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const alert = useAlert();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.goals) setSelectedGoals(user.goals);
  }, [user]);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]);
  };

  const handleSave = async () => {
    if (selectedGoals.length === 0) {
      alert.warning('Selection Required', 'Please select at least one fitness goal.');
      return;
    }
    setIsSaving(true);
    try {
      await authService.updateUserProfile({ fitness_goals: selectedGoals });
      await refreshUser();
      alert.success('Success', 'Your fitness goals have been updated!', () => goBack());
    } catch (error) {
      console.error('Error saving fitness goals:', error);
      alert.error('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Fitness Goals</Text>
        <View style={s.placeholder} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.descriptionContainer}>
          <Text style={s.title}>What are your <Text style={s.titleAccent}>fitness goals?</Text></Text>
          <Text style={s.subtitle}>Select all that apply to personalize your workout plan.</Text>
        </View>

        <View style={s.section}>
          <View style={s.cardGrid}>
            {GOALS.map((goal) => {
              const isSelected = selectedGoals.includes(goal.id);
              return (
                <TouchableOpacity
                  key={goal.id}
                  onPress={() => toggleGoal(goal.id)}
                  style={[s.goalCard, { borderColor: isSelected ? goal.color : COLORS.NEUTRAL[200], borderWidth: isSelected ? 3 : 2 }]}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={s.selectionIndicator}>
                      <View style={[s.checkmark, { backgroundColor: goal.color }]}>
                        <Ionicons name="checkmark" size={12} color="white" />
                      </View>
                    </View>
                  )}
                  <View style={s.cardIconContainer}>
                    <View style={[s.iconCircle, { backgroundColor: isSelected ? goal.color + '15' : COLORS.NEUTRAL[100] }]}>
                      <Ionicons name={goal.icon as any} size={24} color={isSelected ? goal.color : goal.color} />
                    </View>
                  </View>
                  <Text style={[s.cardTitle, { color: isSelected ? goal.color : COLORS.SECONDARY[900] }]}>{goal.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedGoals.length > 0 && (
          <View style={s.selectionSummary}>
            <View style={s.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={s.summaryTitle}>Selected ({selectedGoals.length})</Text>
            </View>
            <Text style={s.summaryText}>Your workouts will be tailored to help you achieve these goals.</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.buttonContainer}>
        <Button title={isSaving ? "Saving..." : "Save Changes"} onPress={handleSave} loading={isSaving} disabled={selectedGoals.length === 0 || isSaving} style={{ ...s.saveButton, backgroundColor: selectedGoals.length > 0 && !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300] }} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.NEUTRAL.WHITE },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.NEUTRAL[200] },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  descriptionContainer: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 24, fontFamily: FONTS.BOLD, color: COLORS.SECONDARY[900], textAlign: 'center', marginBottom: 12 },
  titleAccent: { color: COLORS.PRIMARY[500] },
  subtitle: { fontSize: 16, fontFamily: FONTS.REGULAR, color: COLORS.SECONDARY[600], textAlign: 'center', lineHeight: 24 },
  section: { marginBottom: 24 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  goalCard: { flexBasis: '47%', padding: 16, borderRadius: 16, backgroundColor: COLORS.NEUTRAL.WHITE, alignItems: 'center', minHeight: 120, position: 'relative' },
  selectionIndicator: { position: 'absolute', top: 12, right: 12 },
  checkmark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardIconContainer: { marginBottom: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontFamily: FONTS.SEMIBOLD, textAlign: 'center' },
  selectionSummary: { backgroundColor: COLORS.PRIMARY[50], borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  summaryTitle: { fontSize: 14, fontFamily: FONTS.SEMIBOLD, color: COLORS.PRIMARY[700], marginLeft: 8 },
  summaryText: { fontSize: 12, fontFamily: FONTS.REGULAR, color: COLORS.SECONDARY[600], lineHeight: 18 },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  saveButton: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
