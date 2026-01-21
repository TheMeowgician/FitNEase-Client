import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { workoutNotificationScheduler, NotificationSettings } from '../../services/workoutNotificationScheduler';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const STORAGE_KEY = '@notification_settings';

const MORNING_TIMES = [
  { label: '6:00 AM', value: '06:00' },
  { label: '7:00 AM', value: '07:00' },
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
];

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState('08:00');
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermission();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const settings: NotificationSettings = JSON.parse(stored);
        setIsEnabled(settings.enabled);
        setMorningTime(settings.morningReminderTime);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const checkPermission = async () => {
    const enabled = await workoutNotificationScheduler.areNotificationsEnabled();
    setHasPermission(enabled);
  };

  const requestPermission = async () => {
    const granted = await workoutNotificationScheduler.requestPermissions();
    setHasPermission(granted);

    if (!granted) {
      alert.warning('Permission Required', 'Please enable notifications in your device settings to receive workout reminders.');
    }
  };

  const saveSettings = async () => {
    if (!user?.workoutDays || user.workoutDays.length === 0) {
      alert.confirm(
        'No Workout Days Set',
        'Please set your preferred workout days first in the Weekly Plan settings.',
        () => router.push('/settings/personalization/workout-days'),
        undefined,
        'Set Workout Days',
        'Cancel'
      );
      return;
    }

    setIsLoading(true);
    try {
      const settings: NotificationSettings = {
        enabled: isEnabled,
        morningReminderTime: morningTime,
        advanceNoticeMinutes: 60,
      };

      // Save to local storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // Schedule notifications if enabled
      if (isEnabled && hasPermission) {
        await workoutNotificationScheduler.scheduleWorkoutReminders(user.workoutDays, settings);
        alert.success('Settings Saved!', `You'll receive workout reminders on ${user.workoutDays.join(', ')} at ${formatTime(morningTime)}.`);
      } else if (isEnabled && !hasPermission) {
        await requestPermission();
      } else {
        // Disabled - cancel all notifications
        await workoutNotificationScheduler.cancelAllNotifications();
        alert.info('Notifications Disabled', 'All workout reminders have been cancelled.');
      }

      router.back();
    } catch (error) {
      console.error('Error saving notification settings:', error);
      alert.error('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time24: string): string => {
    const [hour, minute] = time24.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout Reminders</Text>
          <View style={styles.backButton} />
        </View>

        {/* Intro */}
        <View style={styles.introSection}>
          <Ionicons name="notifications" size={48} color={COLORS.PRIMARY[500]} />
          <Text style={styles.introTitle}>Stay on Track</Text>
          <Text style={styles.introSubtitle}>
            Get reminders for your scheduled workout days so you never miss a session
          </Text>
        </View>

        {/* Permission Status */}
        {!hasPermission && (
          <View style={styles.permissionWarning}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <View style={styles.permissionWarningContent}>
              <Text style={styles.permissionWarningTitle}>Notifications Disabled</Text>
              <Text style={styles.permissionWarningText}>
                Enable notifications to receive workout reminders
              </Text>
            </View>
            <TouchableOpacity onPress={requestPermission} style={styles.enableButton}>
              <Text style={styles.enableButtonText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Enable Toggle */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.SECONDARY[700]} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Workout Reminders</Text>
                <Text style={styles.settingSubtitle}>
                  {isEnabled ? 'Notifications enabled' : 'Notifications disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: COLORS.NEUTRAL[300], true: COLORS.PRIMARY[500] }}
              thumbColor={COLORS.NEUTRAL.WHITE}
            />
          </View>
        </View>

        {isEnabled && (
          <>
            {/* Morning Reminder Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Morning Reminder</Text>
              <Text style={styles.sectionSubtitle}>
                Get a reminder in the morning on your workout days
              </Text>
              <View style={styles.optionsGrid}>
                {MORNING_TIMES.map((time) => (
                  <TouchableOpacity
                    key={time.value}
                    style={[
                      styles.optionButton,
                      morningTime === time.value && styles.optionButtonActive,
                    ]}
                    onPress={() => setMorningTime(time.value)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={morningTime === time.value ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        morningTime === time.value && styles.optionTextActive,
                      ]}
                    >
                      {time.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.PRIMARY[500]} />
          <Text style={styles.infoText}>
            Notifications will be sent on your selected workout days. You can change your workout days in the Weekly Plan settings.
          </Text>
        </View>

        {/* Save Button */}
        <Button
          title={isLoading ? 'Saving...' : 'Save Settings'}
          onPress={saveSettings}
          loading={isLoading}
          style={styles.saveButton}
        />
      </ScrollView>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  introSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 16,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  permissionWarningContent: {
    flex: 1,
    marginLeft: 12,
  },
  permissionWarningTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: '#DC2626',
    marginBottom: 2,
  },
  permissionWarningText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: '#B91C1C',
  },
  enableButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  enableButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.NEUTRAL[50],
    padding: 16,
    borderRadius: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
    gap: 8,
  },
  optionButtonActive: {
    borderColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
  optionText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  optionTextActive: {
    color: COLORS.PRIMARY[500],
    fontFamily: FONTS.SEMIBOLD,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.PRIMARY[50],
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[100],
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    lineHeight: 20,
  },
  saveButton: {
    marginHorizontal: 20,
    backgroundColor: COLORS.PRIMARY[500],
  },
});
