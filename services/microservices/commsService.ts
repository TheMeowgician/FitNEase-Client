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
}

export const commsService = new CommsService();
