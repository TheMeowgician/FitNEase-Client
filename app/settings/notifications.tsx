import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { workoutNotificationScheduler, NotificationSettings } from '../../services/workoutNotificationScheduler';
import { COLORS, FONTS } from '../../constants/colors';

const { width } = Dimensions.get('window');
const STORAGE_KEY = '@notification_settings';

type Period = 'morning' | 'afternoon' | 'evening';

const TIME_OPTIONS: Record<Period, { label: string; value: string }[]> = {
  morning: [
    { label: '5:00 AM', value: '05:00' },
    { label: '6:00 AM', value: '06:00' },
    { label: '7:00 AM', value: '07:00' },
    { label: '8:00 AM', value: '08:00' },
    { label: '9:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:00 AM', value: '11:00' },
  ],
  afternoon: [
    { label: '12:00 PM', value: '12:00' },
    { label: '1:00 PM', value: '13:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '3:00 PM', value: '15:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '5:00 PM', value: '17:00' },
  ],
  evening: [
    { label: '6:00 PM', value: '18:00' },
    { label: '7:00 PM', value: '19:00' },
    { label: '8:00 PM', value: '20:00' },
    { label: '9:00 PM', value: '21:00' },
  ],
};

const PERIOD_META: Record<Period, { label: string; icon: string; color: string; bgColor: string }> = {
  morning: { label: 'Morning', icon: 'sunny', color: '#F59E0B', bgColor: '#FEF3C7' },
  afternoon: { label: 'Afternoon', icon: 'partly-sunny', color: '#F97316', bgColor: '#FFF7ED' },
  evening: { label: 'Evening', icon: 'moon', color: '#8B5CF6', bgColor: '#F3E8FF' },
};

function getPeriodForTime(value: string): Period {
  const hour = parseInt(value.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState('08:00');
  const [hasPermission, setHasPermission] = useState(false);
  const [activePeriod, setActivePeriod] = useState<Period>('morning');
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
        setActivePeriod(getPeriodForTime(settings.morningReminderTime));
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

  const handlePeriodChange = (period: Period) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setActivePeriod(period);
  };

  const handleTimeSelect = (value: string) => {
    setMorningTime(value);
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

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      if (isEnabled && hasPermission) {
        await workoutNotificationScheduler.scheduleWorkoutReminders(user.workoutDays, settings);
        alert.success('Settings Saved!', `You'll receive workout reminders at ${formatTime(morningTime)} on your workout days.`);
      } else if (isEnabled && !hasPermission) {
        await requestPermission();
      } else {
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

  const currentPeriodMeta = PERIOD_META[activePeriod];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminders</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroIconContainer}>
            <View style={styles.heroIconOuter}>
              <View style={styles.heroIconInner}>
                <Ionicons name="notifications" size={32} color={COLORS.PRIMARY[500]} />
              </View>
            </View>
            <View style={styles.bellRing} />
          </View>
          <Text style={styles.heroTitle}>Never Miss a Workout</Text>
          <Text style={styles.heroSubtitle}>
            Get timely reminders to stay consistent with your fitness goals
          </Text>
        </LinearGradient>

        {/* Permission Warning */}
        {!hasPermission && (
          <TouchableOpacity onPress={requestPermission} activeOpacity={0.8}>
            <View style={styles.permissionCard}>
              <View style={styles.permissionIconContainer}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
              </View>
              <View style={styles.permissionContent}>
                <Text style={styles.permissionTitle}>Enable Notifications</Text>
                <Text style={styles.permissionText}>
                  Tap here to allow notifications
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
            </View>
          </TouchableOpacity>
        )}

        {/* Main Toggle Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={[styles.iconBadge, { backgroundColor: isEnabled ? COLORS.PRIMARY[100] : COLORS.NEUTRAL[100] }]}>
                <Ionicons
                  name={isEnabled ? "notifications" : "notifications-off"}
                  size={22}
                  color={isEnabled ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]}
                />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Workout Reminders</Text>
                <Text style={[styles.toggleStatus, isEnabled && styles.toggleStatusActive]}>
                  {isEnabled ? 'Active' : 'Paused'}
                </Text>
              </View>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: COLORS.NEUTRAL[200], true: COLORS.PRIMARY[400] }}
              thumbColor={COLORS.NEUTRAL.WHITE}
              ios_backgroundColor={COLORS.NEUTRAL[200]}
              style={styles.switch}
            />
          </View>
        </View>

        {isEnabled && (
          <>
            {/* Time Picker Section */}
            <View style={styles.card}>
              <View style={styles.timePickerHeader}>
                <Text style={styles.timePickerTitle}>Reminder Time</Text>
                <View style={styles.selectedTimeBadge}>
                  <Ionicons name="time-outline" size={14} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.selectedTimeText}>{formatTime(morningTime)}</Text>
                </View>
              </View>

              {/* Period Tabs */}
              <View style={styles.periodTabs}>
                {(Object.keys(PERIOD_META) as Period[]).map((period) => {
                  const meta = PERIOD_META[period];
                  const isActive = activePeriod === period;
                  return (
                    <TouchableOpacity
                      key={period}
                      onPress={() => handlePeriodChange(period)}
                      activeOpacity={0.7}
                      style={[
                        styles.periodTab,
                        isActive && { backgroundColor: meta.bgColor, borderColor: meta.color },
                      ]}
                    >
                      <Ionicons
                        name={meta.icon as any}
                        size={16}
                        color={isActive ? meta.color : COLORS.SECONDARY[400]}
                      />
                      <Text style={[
                        styles.periodTabLabel,
                        isActive && { color: meta.color, fontFamily: FONTS.SEMIBOLD },
                      ]}>
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time Chips */}
              <Animated.View style={[styles.timeChipsContainer, { opacity: fadeAnim }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timeChipsScroll}
                >
                  {TIME_OPTIONS[activePeriod].map((time) => {
                    const isSelected = morningTime === time.value;
                    return (
                      <TouchableOpacity
                        key={time.value}
                        onPress={() => handleTimeSelect(time.value)}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <LinearGradient
                            colors={[COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.timeChipSelected}
                          >
                            <Text style={styles.timeChipTextSelected}>{time.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.timeChip}>
                            <Text style={styles.timeChipText}>{time.label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            </View>

            {/* Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="phone-portrait-outline" size={16} color={COLORS.SECONDARY[500]} />
                <Text style={styles.previewTitle}>Notification Preview</Text>
              </View>
              <View style={styles.notificationPreview}>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationApp}>FitNEase</Text>
                    <Text style={styles.notificationTime}>{formatTime(morningTime)}</Text>
                  </View>
                  <Text style={styles.notificationTitleText}>Workout Day!</Text>
                  <Text style={styles.notificationBody}>
                    Time to crush your Tabata workout today.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={saveSettings}
          disabled={isLoading}
          activeOpacity={0.9}
          style={styles.saveButtonContainer}
        >
          <LinearGradient
            colors={isLoading ? [COLORS.NEUTRAL[300], COLORS.NEUTRAL[400]] : [COLORS.PRIMARY[500], COLORS.PRIMARY[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButton}
          >
            {isLoading ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[100],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroIconContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  heroIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellRing: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    borderWidth: 3,
    borderColor: COLORS.PRIMARY[500],
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  permissionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#92400E',
  },
  permissionText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#B45309',
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    marginLeft: 14,
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  toggleStatus: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[400],
    marginTop: 2,
  },
  toggleStatusActive: {
    color: COLORS.PRIMARY[500],
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },

  // Redesigned Time Picker
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  timePickerTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  selectedTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  selectedTimeText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },

  // Period Tabs
  periodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  periodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.NEUTRAL[50],
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  periodTabLabel: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[500],
  },

  // Time Chips
  timeChipsContainer: {
    marginHorizontal: -20,
  },
  timeChipsScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  timeChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.NEUTRAL[50],
    borderWidth: 1.5,
    borderColor: COLORS.NEUTRAL[200],
  },
  timeChipSelected: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  timeChipText: {
    fontSize: 14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[700],
  },
  timeChipTextSelected: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },

  // Preview Card
  previewCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[500],
  },
  notificationPreview: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[100],
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationApp: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
  },
  notificationTime: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
  },
  notificationTitleText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  saveButtonContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
});
