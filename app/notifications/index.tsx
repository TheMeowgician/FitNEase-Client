import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { commsService } from '../../services/microservices/commsService';
import { socialService } from '../../services/microservices/socialService';
import { reverbService } from '../../services/reverbService';

interface Notification {
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

export default function NotificationsScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const { markAsRead: markAsReadInContext, refreshUnreadCount, addNotificationListener } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();

    // Subscribe to notification events from NotificationContext
    console.log('🔌 [NOTIFICATIONS SCREEN] Setting up notification listener');
    const unsubscribe = addNotificationListener((notification) => {
      console.log('🔔 [NOTIFICATIONS SCREEN] Received notification from context:', notification);

      // Add the new notification to the top of the list
      setNotifications((prev) => [notification, ...prev]);

      console.log('📬 [NOTIFICATIONS SCREEN] Added new notification to list');

      // Show a brief alert
      alert.info(notification.title, notification.message);
    });

    console.log('✅ [NOTIFICATIONS SCREEN] Notification listener setup complete');

    return () => {
      console.log('🔌 [NOTIFICATIONS SCREEN] Cleaning up notification listener');
      unsubscribe();
    };
  }, [addNotificationListener]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const response = await commsService.getUserNotifications(Number(user.id));
      console.log('📬 [NOTIFICATIONS] Loaded notifications:', response);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      alert.error('Error', 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      // Use the context method which also updates badge count
      await markAsReadInContext(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.notification_id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );

      console.log('✅ [NOTIFICATIONS SCREEN] Marked notification as read and updated badge');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SCREEN] Error marking notification as read:', error);
    }
  };

  const handleAcceptGroupInvitation = async (notification: Notification) => {
    if (!notification.action_data?.group_code) {
      alert.error('Error', 'Invalid invitation data');
      return;
    }

    try {
      // Join group using group code
      await socialService.joinGroupWithCode(notification.action_data.group_code);

      // Mark notification as read
      await handleMarkAsRead(notification.notification_id);

      // Notify the inviter that their invitation was accepted
      if (notification.action_data?.inviter_user_id && user) {
        await commsService.sendGroupInvitationAccepted(
          notification.action_data.inviter_user_id,
          notification.action_data.group_name,
          Number(user.id)
        );
      }

      alert.success('Success', `You've joined ${notification.action_data.group_name}!`, () => router.push(`/groups/${notification.action_data.group_id}`));
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      alert.error('Error', error.message || 'Failed to join group');
    }
  };

  const handleDeclineGroupInvitation = async (notification: Notification) => {
    alert.confirm(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to ${notification.action_data?.group_name}?`,
      async () => {
        try {
          // Mark as read
          await handleMarkAsRead(notification.notification_id);

          // Notify the inviter that their invitation was declined
          if (notification.action_data?.inviter_user_id && user) {
            await commsService.sendGroupInvitationDeclined(
              notification.action_data.inviter_user_id,
              notification.action_data.group_name,
              Number(user.id)
            );
          }

          alert.info('Declined', 'Invitation declined');
        } catch (error) {
          console.error('Error declining invitation:', error);
        }
      },
      undefined,
      'Decline',
      'Cancel'
    );
  };

  const handleDeleteNotification = async (notificationId: number) => {
    try {
      // Delete from backend
      await commsService.deleteNotification(notificationId);

      // Update local state
      setNotifications((prev) => prev.filter((notif) => notif.notification_id !== notificationId));

      // Refresh unread count
      await refreshUnreadCount();

      console.log('✅ [NOTIFICATIONS SCREEN] Notification deleted successfully');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SCREEN] Error deleting notification:', error);
      alert.error('Error', 'Failed to delete notification');
    }
  };

  const handleClearAllNotifications = async () => {
    if (notifications.length === 0) {
      alert.info('No Notifications', 'You have no notifications to clear.');
      return;
    }

    alert.confirm(
      'Clear All Notifications',
      `Are you sure you want to delete all ${notifications.length} notification${notifications.length > 1 ? 's' : ''}?`,
      async () => {
        try {
          if (!user) return;

          // Delete all from backend
          const response = await commsService.deleteAllNotifications(Number(user.id));

          // Clear local state
          setNotifications([]);

          // Refresh unread count
          await refreshUnreadCount();

          console.log(`✅ [NOTIFICATIONS SCREEN] Cleared ${response.deleted_count} notifications`);
          alert.success('Success', `${response.deleted_count} notification${response.deleted_count > 1 ? 's' : ''} cleared`);
        } catch (error) {
          console.error('❌ [NOTIFICATIONS SCREEN] Error clearing all notifications:', error);
          alert.error('Error', 'Failed to clear all notifications');
        }
      },
      undefined,
      'Clear All',
      'Cancel'
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read when pressed
    if (!notification.is_read) {
      await handleMarkAsRead(notification.notification_id);
    }

    // Handle notification action based on type
    const actionType = notification.action_data?.type;
    const notificationType = notification.notification_type;

    // Group invites have action buttons - don't navigate
    if (actionType === 'group_invite') {
      return;
    }

    // Navigate based on notification type and action data
    switch (actionType) {
      case 'group_join_approved':
      case 'group_invite_accepted':
        // Navigate to the group
        if (notification.action_data?.group_id) {
          router.push(`/groups/${notification.action_data.group_id}`);
        }
        break;

      case 'group_join_request':
        // Navigate to group management to handle request
        if (notification.action_data?.group_id) {
          router.push(`/groups/${notification.action_data.group_id}/manage`);
        }
        break;

      case 'achievement_unlock':
      case 'achievement':
        // Navigate to progress/achievements
        router.push('/(tabs)/progress');
        break;

      case 'group_invite_declined':
      case 'group_join_rejected':
      case 'group_member_kicked':
        // Informational - no navigation needed
        break;

      default:
        // Handle by notification_type as fallback
        switch (notificationType) {
          case 'achievement':
            router.push('/(tabs)/progress');
            break;
          case 'workout_reminder':
            router.push('/workout');
            break;
          case 'social':
            if (notification.action_data?.group_id) {
              router.push(`/groups/${notification.action_data.group_id}`);
            }
            break;
          case 'group_join_approved':
            if (notification.action_data?.group_id) {
              router.push(`/groups/${notification.action_data.group_id}`);
            }
            break;
        }
        break;
    }
  };

  // Check if a notification is navigable (shows chevron)
  const isNotificationNavigable = (notification: Notification): boolean => {
    const actionType = notification.action_data?.type;
    const notificationType = notification.notification_type;

    // Group invites show action buttons instead of navigation
    if (actionType === 'group_invite') {
      return false;
    }

    // These types have navigation
    const navigableActionTypes = [
      'group_join_approved',
      'group_invite_accepted',
      'group_join_request',
      'achievement_unlock',
      'achievement',
    ];

    if (navigableActionTypes.includes(actionType)) {
      return true;
    }

    // Notification types with navigation
    const navigableNotificationTypes = [
      'achievement',
      'workout_reminder',
      'group_join_approved',
    ];

    if (navigableNotificationTypes.includes(notificationType)) {
      return true;
    }

    // Social notifications with group_id are navigable
    if (notificationType === 'social' && notification.action_data?.group_id) {
      return true;
    }

    return false;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    notificationId: number
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(notificationId)}
      >
        <Animated.View
          style={[
            styles.deleteButtonContent,
            {
              transform: [{ translateX: trans }],
            },
          ]}
        >
          <Ionicons name="trash" size={24} color="white" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const getNotificationIcon = (notification: Notification) => {
    // Check action_data.type first for more specific icons
    if (notification.action_data?.type === 'group_invite_declined') {
      return { name: 'person-remove' as const, color: '#EF4444' };
    }

    if (notification.action_data?.type === 'group_invite_accepted') {
      return { name: 'person-add' as const, color: '#10B981' };
    }

    // Fall back to notification_type
    switch (notification.notification_type) {
      case 'group_invite':
        return { name: 'people' as const, color: COLORS.PRIMARY[600] };
      case 'achievement':
        return { name: 'trophy' as const, color: '#10B981' };
      case 'friend_request':
        return { name: 'person-add' as const, color: '#3B82F6' };
      case 'workout_reminder':
        return { name: 'fitness' as const, color: '#8B5CF6' };
      case 'social':
        return { name: 'people-circle' as const, color: COLORS.PRIMARY[600] };
      default:
        return { name: 'notifications' as const, color: COLORS.SECONDARY[400] };
    }
  };

  const renderNotificationItem = (notification: Notification) => {
    const icon = getNotificationIcon(notification);
    const isGroupInvitation = notification.action_data?.type === 'group_invite';
    const isNavigable = isNotificationNavigable(notification);

    return (
      <Swipeable
        key={notification.notification_id}
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, notification.notification_id)
        }
        overshootRight={false}
      >
        <TouchableOpacity
          style={[
            styles.notificationCard,
            !notification.is_read && styles.notificationUnread,
          ]}
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.7}
        >
          <View style={[styles.notificationIconContainer, { backgroundColor: icon.color + '15' }]}>
            <Ionicons name={icon.name} size={24} color={icon.color} />
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              {!notification.is_read && <View style={styles.unreadDot} />}
            </View>

            <Text style={styles.notificationMessage}>{notification.message}</Text>

            <Text style={styles.notificationTime}>{formatTimeAgo(notification.created_at)}</Text>

            {/* Group Invitation Action Buttons */}
            {isGroupInvitation && !notification.is_read && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptGroupInvitation(notification)}
                >
                  <Ionicons name="checkmark" size={18} color="white" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton]}
                  onPress={() => handleDeclineGroupInvitation(notification)}
                >
                  <Ionicons name="close" size={18} color="#EF4444" />
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Chevron indicator for navigable notifications */}
          {isNavigable && !isGroupInvitation && (
            <View style={styles.chevronContainer}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleClearAllNotifications}
          style={styles.clearAllButton}
          disabled={notifications.length === 0}
        >
          <Text style={[
            styles.clearAllButtonText,
            notifications.length === 0 && styles.clearAllButtonTextDisabled
          ]}>
            Clear All
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length > 0 ? (
          notifications.map(renderNotificationItem)
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              You're all caught up! New notifications will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notificationUnread: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY[600],
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY[600],
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: COLORS.PRIMARY[600],
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  declineButton: {
    backgroundColor: '#FEE2E2',
  },
  declineButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#EF4444',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 100,
  },
  deleteButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    marginTop: 4,
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearAllButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#EF4444',
  },
  clearAllButtonTextDisabled: {
    color: COLORS.SECONDARY[300],
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
});
