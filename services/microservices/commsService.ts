import { apiClient, ApiResponse } from '../api/client';

export interface Notification {
  notification_id: number;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  action_data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export class CommsService {
  /**
   * Get all notifications for a user
   * GET /api/comms/notifications/{userId}
   */
  public async getUserNotifications(userId: number): Promise<{ data: Notification[] }> {
    try {
      console.log('📬 [COMMS] Fetching notifications for user:', userId);

      const response = await apiClient.get(
        'communications',
        `/api/comms/notifications/${userId}`
      );

      console.log('✅ [COMMS] Notifications fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to fetch notifications:', error);
      throw new Error((error as any).message || 'Failed to fetch notifications');
    }
  }

  /**
   * Get unread notification count for a user
   * GET /api/comms/notifications/{userId}/unread-count
   */
  public async getUnreadCount(userId: number): Promise<number> {
    try {
      console.log('🔔 [COMMS] Fetching unread count for user:', userId);

      const response = await apiClient.get<UnreadCountResponse>(
        'communications',
        `/api/comms/notifications/${userId}/unread-count`
      );

      const count = response.data?.unread_count || 0;
      console.log('✅ [COMMS] Unread count fetched:', count);
      return count;
    } catch (error) {
      console.error('❌ [COMMS] Failed to fetch unread count:', error);
      // Return 0 instead of throwing to prevent breaking the UI
      return 0;
    }
  }

  /**
   * Mark a notification as read
   * PUT /api/comms/notifications/{notificationId}/read
   */
  public async markNotificationAsRead(notificationId: number): Promise<{ message: string }> {
    try {
      console.log('✔️ [COMMS] Marking notification as read:', notificationId);

      const response = await apiClient.put(
        'communications',
        `/api/comms/notifications/${notificationId}/read`,
        {}
      );

      console.log('✅ [COMMS] Notification marked as read successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to mark notification as read:', error);
      throw new Error((error as any).message || 'Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read for a user
   * PUT /api/comms/notifications/{userId}/mark-all-read
   */
  public async markAllAsRead(userId: number): Promise<{ message: string }> {
    try {
      console.log('✔️✔️ [COMMS] Marking all notifications as read for user:', userId);

      const response = await apiClient.put(
        'communications',
        `/api/comms/notifications/${userId}/mark-all-read`,
        {}
      );

      console.log('✅ [COMMS] All notifications marked as read successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to mark all notifications as read:', error);
      throw new Error((error as any).message || 'Failed to mark all notifications as read');
    }
  }

  /**
   * Delete a notification
   * DELETE /api/comms/notifications/{notificationId}
   */
  public async deleteNotification(notificationId: number): Promise<{ message: string }> {
    try {
      console.log('🗑️ [COMMS] Deleting notification:', notificationId);

      const response = await apiClient.delete(
        'communications',
        `/api/comms/notifications/${notificationId}`
      );

      console.log('✅ [COMMS] Notification deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to delete notification:', error);
      throw new Error((error as any).message || 'Failed to delete notification');
    }
  }

  /**
   * Delete all notifications for a user
   * DELETE /api/comms/notifications/{userId}/delete-all
   */
  public async deleteAllNotifications(userId: number): Promise<{ message: string; deleted_count: number }> {
    try {
      console.log('🗑️🗑️ [COMMS] Deleting all notifications for user:', userId);

      const response = await apiClient.delete(
        'communications',
        `/api/comms/notifications/${userId}/delete-all`
      );

      console.log('✅ [COMMS] All notifications deleted successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to delete all notifications:', error);
      throw new Error((error as any).message || 'Failed to delete all notifications');
    }
  }

  /**
   * Send a custom notification (for testing or admin purposes)
   * POST /api/comms/notifications
   */
  public async sendNotification(data: {
    user_id: number;
    notification_type: string;
    title: string;
    message: string;
    action_data?: any;
  }): Promise<Notification> {
    try {
      console.log('📤 [COMMS] Sending notification:', data);

      const response = await apiClient.post<Notification>(
        'communications',
        '/api/comms/notifications',
        data
      );

      console.log('✅ [COMMS] Notification sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to send notification:', error);
      throw new Error((error as any).message || 'Failed to send notification');
    }
  }

  /**
   * Send notification when user declines group invitation
   * POST /api/comms/group-invitation-declined
   */
  public async sendGroupInvitationDeclined(
    inviterUserId: number,
    groupName: string,
    declinedUserId: number
  ): Promise<{ message: string }> {
    try {
      console.log('🚫 [COMMS] Sending group invitation declined notification to user:', inviterUserId);

      const response = await apiClient.post(
        'communications',
        '/api/comms/group-invitation-declined',
        {
          inviter_user_id: inviterUserId,
          group_name: groupName,
          declined_user_id: declinedUserId,
        }
      );

      console.log('✅ [COMMS] Invitation declined notification sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to send invitation declined notification:', error);
      throw new Error((error as any).message || 'Failed to send invitation declined notification');
    }
  }

  /**
   * Send notification when user accepts group invitation
   * POST /api/comms/group-invitation-accepted
   */
  public async sendGroupInvitationAccepted(
    inviterUserId: number,
    groupName: string,
    acceptedUserId: number
  ): Promise<{ message: string }> {
    try {
      console.log('✅ [COMMS] Sending group invitation accepted notification to user:', inviterUserId);

      const response = await apiClient.post(
        'communications',
        '/api/comms/group-invitation-accepted',
        {
          inviter_user_id: inviterUserId,
          group_name: groupName,
          accepted_user_id: acceptedUserId,
        }
      );

      console.log('✅ [COMMS] Invitation accepted notification sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [COMMS] Failed to send invitation accepted notification:', error);
      throw new Error((error as any).message || 'Failed to send invitation accepted notification');
    }
  }

  /**
   * Register device token for push notifications
   * POST /api/comms/device-tokens
   */
  public async registerDeviceToken(
    userId: number,
    expoPushToken: string,
    platform: 'ios' | 'android'
  ): Promise<{ message: string; device_token_id: number }> {
    try {
      console.log('[COMMS] Registering device token for user:', userId);

      const response = await apiClient.post(
        'communications',
        '/api/comms/device-tokens',
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform,
        }
      );

      console.log('[COMMS] Device token registered successfully');
      return response.data;
    } catch (error) {
      console.error('[COMMS] Failed to register device token:', error);
      throw new Error((error as any).message || 'Failed to register device token');
    }
  }

  /**
   * Remove device token (for logout or token refresh)
   * DELETE /api/comms/device-tokens
   */
  public async removeDeviceToken(expoPushToken: string): Promise<{ message: string }> {
    try {
      console.log('[COMMS] Removing device token');

      const response = await apiClient.delete(
        'communications',
        '/api/comms/device-tokens',
        {
          data: { expo_push_token: expoPushToken }
        }
      );

      console.log('[COMMS] Device token removed successfully');
      return response.data;
    } catch (error) {
      console.error('[COMMS] Failed to remove device token:', error);
      // Don't throw - token removal failure shouldn't block logout
      return { message: 'Token removal failed but continuing' };
    }
  }
}

export const commsService = new CommsService();
