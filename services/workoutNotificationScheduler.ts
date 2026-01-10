import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  morningReminderTime: string; // Format: "HH:MM" (24-hour)
  advanceNoticeMinutes: number; // Minutes before workout
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  morningReminderTime: '08:00',
  advanceNoticeMinutes: 60,
};

class WorkoutNotificationScheduler {
  /**
   * Request notification permissions from the device
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ [WORKOUT NOTIFICATIONS] Permission denied');
        return false;
      }

      console.log('✅ [WORKOUT NOTIFICATIONS] Permission granted');
      return true;
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Permission error:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Schedule morning reminders for workout days
   * @param workoutDays - Array of day names (e.g., ["Monday", "Wednesday", "Friday"])
   * @param settings - Notification settings
   */
  async scheduleWorkoutReminders(
    workoutDays: string[],
    settings: NotificationSettings = DEFAULT_SETTINGS
  ): Promise<void> {
    if (!settings.enabled) {
      console.log('⏭️ [WORKOUT NOTIFICATIONS] Notifications disabled, skipping schedule');
      return;
    }

    try {
      // Cancel all existing scheduled notifications first
      await this.cancelAllNotifications();

      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        console.warn('⚠️ [WORKOUT NOTIFICATIONS] Cannot schedule without permission');
        return;
      }

      // Map day names to weekday numbers (1 = Monday, 7 = Sunday)
      const dayMap: { [key: string]: number } = {
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
        Sunday: 7,
      };

      const [hour, minute] = settings.morningReminderTime.split(':').map(Number);

      for (const day of workoutDays) {
        const weekday = dayMap[day];
        if (!weekday) continue;

        // Schedule morning reminder
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🏋️ Workout Day!',
            body: `It's ${day}! Time to crush your Tabata workout today.`,
            data: { type: 'morning_reminder', day },
            sound: true,
          },
          trigger: {
            weekday,
            hour,
            minute,
            repeats: true,
          },
        });

        console.log(`✅ [WORKOUT NOTIFICATIONS] Scheduled morning reminder for ${day} at ${hour}:${String(minute).padStart(2, '0')}`);
      }

      console.log(`✅ [WORKOUT NOTIFICATIONS] Scheduled ${workoutDays.length} workout reminders`);
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Error scheduling notifications:', error);
      throw error;
    }
  }

  /**
   * Schedule a one-time reminder before a specific workout
   * @param workoutTime - Date/time of the workout
   * @param advanceMinutes - Minutes before workout to remind
   */
  async scheduleAdvanceReminder(
    workoutTime: Date,
    advanceMinutes: number = 60
  ): Promise<string | null> {
    try {
      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        return null;
      }

      const reminderTime = new Date(workoutTime.getTime() - advanceMinutes * 60 * 1000);
      const now = new Date();

      // Don't schedule if reminder time is in the past
      if (reminderTime <= now) {
        console.log('⏭️ [WORKOUT NOTIFICATIONS] Reminder time is in the past, skipping');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Workout Starting Soon!',
          body: `Your Tabata workout starts in ${advanceMinutes} minutes. Get ready!`,
          data: { type: 'advance_reminder' },
          sound: true,
        },
        trigger: {
          date: reminderTime,
        },
      });

      console.log(`✅ [WORKOUT NOTIFICATIONS] Scheduled advance reminder for ${reminderTime.toLocaleString()}`);
      return notificationId;
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Error scheduling advance reminder:', error);
      return null;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ [WORKOUT NOTIFICATIONS] Cancelled all scheduled notifications');
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Error cancelling notifications:', error);
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`✅ [WORKOUT NOTIFICATIONS] Cancelled notification ${notificationId}`);
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Error cancelling notification:', error);
    }
  }

  /**
   * Get all scheduled notifications (for debugging)
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`📋 [WORKOUT NOTIFICATIONS] ${notifications.length} scheduled notifications`);
      return notifications;
    } catch (error) {
      console.error('❌ [WORKOUT NOTIFICATIONS] Error getting notifications:', error);
      return [];
    }
  }
}

export const workoutNotificationScheduler = new WorkoutNotificationScheduler();
export default workoutNotificationScheduler;
