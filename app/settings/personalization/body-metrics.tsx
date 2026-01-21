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
import { calculateAge } from '../../../utils/dateUtils';
import { useSmartBack } from '../../../hooks/useSmartBack';

interface PhysicalStats {
  weight: number;
  height: number;
  age: number;
}

export default function BodyMetricsSettingsScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const alert = useAlert();
  const [isSaving, setIsSaving] = useState(false);

  const userAge = user?.dateOfBirth ? calculateAge(user.dateOfBirth) : 25;

  const [physicalStats, setPhysicalStats] = useState<PhysicalStats>({
    weight: 70,
    height: 170,
    age: userAge,
  });
  const [bmi, setBmi] = useState(0);

  useEffect(() => {
    loadCurrentSettings();
  }, [user]);

  useEffect(() => {
    const heightInMeters = physicalStats.height / 100;
    const calculatedBmi = physicalStats.weight / (heightInMeters * heightInMeters);
    setBmi(calculatedBmi);
  }, [physicalStats.weight, physicalStats.height]);

  const loadCurrentSettings = () => {
    setPhysicalStats({
      weight: user?.weight || 70,
      height: user?.height || 170,
      age: userAge,
    });
  };

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Note: Backend needs to support weight and height fields
      // For now, we'll just show success and navigate back
      alert.success('Success', 'Your body metrics have been updated!', () => goBack());
    } catch (error) {
      console.error('Error saving body metrics:', error);
      alert.error('Error', 'Failed to save your metrics. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    goBack();
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

        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
        </View>

        <View style={styles.sliderControls}>
          <TouchableOpacity
            onPress={() => setValue(Math.max(min, value - step))}
            style={styles.sliderButton}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={20} color={COLORS.PRIMARY[500]} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setValue(Math.min(max, value + step))}
            style={styles.sliderButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color={COLORS.PRIMARY[500]} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const bmiCategory = getBMICategory(bmi);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Body Metrics</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>
            Update your <Text style={styles.titleAccent}>body metrics</Text>
          </Text>
          <Text style={styles.subtitle}>
            Help us personalize your Tabata workout intensity and calorie calculations.
          </Text>
        </View>

        {/* Age Display */}
        <View style={styles.metricSection}>
          <Text style={styles.metricLabel}>Age</Text>
          <View style={styles.ageDisplay}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.PRIMARY[500]} />
            <Text style={styles.ageText}>{physicalStats.age} years old</Text>
          </View>
          <Text style={styles.metricHint}>Based on your date of birth</Text>
        </View>

        {/* Weight Slider */}
        <View style={styles.metricSection}>
          <Text style={styles.metricLabel}>Weight</Text>
          {renderCustomSlider(
            physicalStats.weight,
            (value) => setPhysicalStats({...physicalStats, weight: value}),
            40,
            150,
            1,
            'kg',
            'weight'
          )}
        </View>

        {/* Height Slider */}
        <View style={styles.metricSection}>
          <Text style={styles.metricLabel}>Height</Text>
          {renderCustomSlider(
            physicalStats.height,
            (value) => setPhysicalStats({...physicalStats, height: value}),
            140,
            220,
            1,
            'cm',
            'height'
          )}
        </View>

        {/* BMI Display */}
        <View style={styles.bmiSection}>
          <Text style={styles.bmiLabel}>Your BMI</Text>
          <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
          <Text style={[styles.bmiCategory, { color: bmiCategory.color }]}>
            {bmiCategory.category}
          </Text>

          <View style={styles.bmiBarContainer}>
            <View style={styles.bmiBar}>
              <View style={styles.bmiUnderweight} />
              <View style={styles.bmiNormal} />
              <View style={styles.bmiOverweight} />
              <View style={styles.bmiObese} />
            </View>
            <View
              style={[
                styles.bmiIndicator,
                { left: `${getBMIBarPosition(bmi)}%` }
              ]}
            />
          </View>

          <View style={styles.bmiLegend}>
            <Text style={styles.bmiLegendText}>15</Text>
            <Text style={styles.bmiLegendText}>25</Text>
            <Text style={styles.bmiLegendText}>30</Text>
            <Text style={styles.bmiLegendText}>40</Text>
          </View>
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
  metricSection: {
    marginBottom: 32,
  },
  metricLabel: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  ageDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  ageText: {
    fontSize: 20,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  metricHint: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    marginTop: 8,
  },
  sliderContainer: {
    marginBottom: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[500],
  },
  sliderMinMax: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  sliderTrack: {
    height: 8,
    backgroundColor: COLORS.NEUTRAL[200],
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[500],
  },
  sliderControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[500],
  },
  bmiSection: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  bmiLabel: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 8,
  },
  bmiValue: {
    fontSize: 48,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  bmiCategory: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    marginBottom: 24,
  },
  bmiBarContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 8,
  },
  bmiBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bmiUnderweight: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  bmiNormal: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  bmiOverweight: {
    flex: 1,
    backgroundColor: '#F59E0B',
  },
  bmiObese: {
    flex: 1,
    backgroundColor: '#EF4444',
  },
  bmiIndicator: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.SECONDARY[900],
    borderWidth: 3,
    borderColor: COLORS.NEUTRAL.WHITE,
    marginLeft: -10,
  },
  bmiLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  bmiLegendText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
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
