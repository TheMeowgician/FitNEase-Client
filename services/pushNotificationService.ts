import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';

// Conditional import for expo-notifications
let Notifications: any = null;

try {
  Notifications = require('expo-notifications');

  // Configure notification behavior
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (error) {
  console.warn('[PUSH] expo-notifications not available. Rebuild dev client to enable push notifications.');
}

export interface PushNotificationData {
  type?: string;
  notification_type?: string;
  notification_id?: number;
  group_id?: number;
  achievement_id?: number;
  day?: string;
  [key: string]: any;
}

class PushNotificationService {
  private notificationListener: any = null;
  private responseListener: any = null;
  private isInitialized = false;

  /**
   * Initialize push notification handlers
   * Should be called once when the app starts
   */
  async initialize(): Promise<void> {
    if (!Notifications || this.isInitialized) {
      return;
    }

    try {
      // Setup listeners for when notifications are received or tapped
      this.setupNotificationListeners();
      this.isInitialized = true;
      console.log('[PUSH] Push notification service initialized');
    } catch (error) {
      console.error('[PUSH] Failed to initialize push notification service:', error);
    }
  }

  /**
   * Get Expo push token for this device
   * Returns null if push notifications are not available
   */
  async getExpoPushToken(): Promise<string | null> {
    if (!Notifications) {
      console.warn('[PUSH] expo-notifications not available');
      return null;
    }

    try {
      // Check for permission first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PUSH] Push notification permission denied');
        return null;
      }

      // Get project ID from app config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error('[PUSH] No project ID found in app config');
        return null;
      }

      // Get the token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('[PUSH] Expo push token obtained:', tokenData.data);
      return tokenData.data;
    } catch (error) {
      console.error('[PUSH] Failed to get Expo push token:', error);
      return null;
    }
  }

  /**
   * Setup listeners for notification events
   */
  private setupNotificationListeners(): void {
    if (!Notifications) return;

    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        console.log('[PUSH] Notification received in foreground:', notification);
        // The notification will be displayed by the notification handler
        // No additional action needed here
      }
    );

    // Listen for notification responses (user tapped notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        console.log('[PUSH] Notification response received:', response);
        this.handleNotificationResponse(response);
      }
    );

    console.log('[PUSH] Notification listeners setup complete');
  }

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  private handleNotificationResponse(response: any): void {
    const data = response.notification?.request?.content?.data as PushNotificationData;

    if (!data) {
      console.log('[PUSH] No data in notification response');
      return;
    }

    console.log('[PUSH] Handling notification tap with data:', data);

    const actionType = data.type;
    const notificationType = data.notification_type;

    // Navigate based on notification type
    switch (actionType) {
      case 'group_invite':
        // Navigate to notifications screen to handle invite
        router.push('/notifications');
        break;

      case 'group_join_approved':
      case 'group_invite_accepted':
        // Navigate to the group
        if (data.group_id) {
          router.push(`/groups/${data.group_id}`);
        } else {
          router.push('/notifications');
        }
        break;

      case 'group_join_request':
        // Navigate to group management
        if (data.group_id) {
          router.push(`/groups/${data.group_id}/manage`);
        } else {
          router.push('/notifications');
        }
        break;

      case 'achievement_unlock':
      case 'achievement':
        // Navigate to progress/achievements
        router.push('/(tabs)/progress');
        break;

      case 'workout_reminder':
      case 'morning_reminder':
      case 'advance_reminder':
        // Navigate to workout screen
        router.push('/workout');
        break;

      default:
        // Handle by notification_type as fallback
        this.handleByNotificationType(notificationType, data);
        break;
    }
  }

  /**
   * Fallback navigation handler based on notification_type
   */
  private handleByNotificationType(notificationType: string | undefined, data: PushNotificationData): void {
    switch (notificationType) {
      case 'achievement':
        router.push('/(tabs)/progress');
        break;

      case 'workout_reminder':
        router.push('/workout');
        break;

      case 'social':
      case 'group_invite':
        if (data.group_id) {
          router.push(`/groups/${data.group_id}`);
        } else {
          router.push('/notifications');
        }
        break;

      case 'group_join_approved':
        if (data.group_id) {
          router.push(`/groups/${data.group_id}`);
        } else {
          router.push('/notifications');
        }
        break;

      case 'group_join_request':
        if (data.group_id) {
          router.push(`/groups/${data.group_id}/manage`);
        } else {
          router.push('/notifications');
        }
        break;

      default:
        // Default to notifications screen
        router.push('/notifications');
        break;
    }
  }

  /**
   * Clean up listeners when service is no longer needed
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications?.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications?.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }

    this.isInitialized = false;
    console.log('[PUSH] Push notification service cleaned up');
  }

  /**
   * Get the current platform (ios/android)
   */
  getPlatform(): 'ios' | 'android' {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }

  /**
   * Check if push notifications are available
   */
  isAvailable(): boolean {
    return Notifications !== null;
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    if (!Notifications) return 0;

    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('[PUSH] Failed to get badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    if (!Notifications) return;

    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('[PUSH] Badge count set to:', count);
    } catch (error) {
      console.error('[PUSH] Failed to set badge count:', error);
    }
  }

  /**
   * Clear all delivered notifications
   */
  async clearAllNotifications(): Promise<void> {
    if (!Notifications) return;

    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('[PUSH] All notifications cleared');
    } catch (error) {
      console.error('[PUSH] Failed to clear notifications:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
