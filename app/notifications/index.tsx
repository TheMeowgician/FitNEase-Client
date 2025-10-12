import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
    setupRealtimeNotifications();

    return () => {
      // Cleanup: disconnect when component unmounts
      reverbService.disconnect();
    };
  }, []);

  const setupRealtimeNotifications = async () => {
    if (!user) return;

    try {
      console.log('🔌 Setting up real-time notifications for user:', user.id);

      // Connect to Reverb
      await reverbService.connect(user.id);

      // Subscribe to user's private notification channel
      reverbService.subscribeToPrivateChannel(`user.${user.id}`, {
        onEvent: (eventName: string, data: any) => {
          console.log('🔔 Received real-time notification:', eventName, data);

          // Check if it's a notification created event
          if (eventName === 'notification.created' || eventName === '.notification.created') {
            // Add the new notification to the top of the list
            setNotifications((prev) => [data.notification, ...prev]);

            // Show a brief alert
            Alert.alert(
              data.notification.title,
              data.notification.message,
              [{ text: 'OK' }]
            );
          }
        },
      });

      console.log('✅ Real-time notifications setup complete');
    } catch (error) {
      console.error('❌ Failed to setup real-time notifications:', error);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const response = await commsService.getUserNotifications(Number(user.id));
      console.log('📬 [NOTIFICATIONS] Loaded notifications:', response);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
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
      await commsService.markNotificationAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.notification_id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleAcceptGroupInvitation = async (notification: Notification) => {
    if (!notification.action_data?.group_code) {
      Alert.alert('Error', 'Invalid invitation data');
      return;
    }

    try {
      // Join group using group code
      await socialService.joinGroupWithCode(notification.action_data.group_code);

      // Mark notification as read
      await handleMarkAsRead(notification.notification_id);

      Alert.alert(
        'Success',
        `You've joined ${notification.action_data.group_name}!`,
        [
          {
            text: 'View Group',
            onPress: () => router.push(`/groups/${notification.action_data.group_id}`),
          },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', error.message || 'Failed to join group');
    }
  };

  const handleDeclineGroupInvitation = async (notification: Notification) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to ${notification.action_data?.group_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              // Mark as read
              await handleMarkAsRead(notification.notification_id);
              Alert.alert('Declined', 'Invitation declined');
            } catch (error) {
              console.error('Error declining invitation:', error);
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read when pressed
    if (!notification.is_read) {
      await handleMarkAsRead(notification.notification_id);
    }

    // Handle notification action based on type
    if (notification.action_data?.type === 'group_invite') {
      // Do nothing - buttons handle acceptance/decline
      return;
    }

    // Handle other notification types
    if (notification.action_data?.achievement_id) {
      // Navigate to achievements
      router.push('/(tabs)/progress');
    }
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'group_invite':
        return { name: 'people' as const, color: COLORS.PRIMARY[600] };
      case 'achievement':
        return { name: 'trophy' as const, color: '#10B981' };
      case 'friend_request':
        return { name: 'person-add' as const, color: '#3B82F6' };
      case 'workout_reminder':
        return { name: 'fitness' as const, color: '#8B5CF6' };
      default:
        return { name: 'notifications' as const, color: COLORS.SECONDARY[400] };
    }
  };

  const renderNotificationItem = (notification: Notification) => {
    const icon = getNotificationIcon(notification.notification_type);
    const isGroupInvitation = notification.action_data?.type === 'group_invite';

    return (
      <TouchableOpacity
        key={notification.notification_id}
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
      </TouchableOpacity>
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
          <View style={styles.placeholder} />
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
        <View style={styles.placeholder} />
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationUnread: {
    borderLeftWidth: 4,
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
});
