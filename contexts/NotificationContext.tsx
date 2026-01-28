import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { reverbService } from '../services/reverbService';
import { commsService } from '../services/microservices/commsService';
import { pushNotificationService } from '../services/pushNotificationService';
import { router } from 'expo-router';
import GroupWorkoutInvitationModal from '../components/groups/GroupWorkoutInvitationModal';
import { useInvitationStore } from '../stores/invitationStore';

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

type NotificationEventListener = (notification: Notification) => void;

interface InvitationData {
  invitation_id: string;
  session_id: string;
  group_id: number;
  initiator_id: number;
  initiator_name: string;
  invited_user_id: number;
  workout_data: any;
  expires_at: number;
}

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  setupRealtimeNotifications: () => Promise<void>;
  addNotificationListener: (listener: NotificationEventListener) => () => void;
  registerPushToken: () => Promise<void>;
  // Invitation modal state
  showInvitationModal: boolean;
  invitationData: InvitationData | null;
  setShowInvitationModal: (show: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isSetupRef = useRef(false);
  const listenersRef = useRef<Set<NotificationEventListener>>(new Set());

  // Invitation modal state (legacy - kept for backward compatibility)
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);

  // Access invitation store for persistent queue-based invitations
  const { addInvitation } = useInvitationStore();

  // Track if push token has been registered
  const pushTokenRegisteredRef = useRef(false);

  useEffect(() => {
    if (user) {
      refreshUnreadCount();

      // Setup real-time notifications only once
      if (!isSetupRef.current) {
        setupRealtimeNotifications();
        isSetupRef.current = true;
      }

      // Initialize push notifications and register token
      if (!pushTokenRegisteredRef.current) {
        initializePushNotifications();
        pushTokenRegisteredRef.current = true;
      }
    }

    return () => {
      // Clean up on unmount
      if (user) {
        reverbService.unsubscribe(`private-user.${user.id}`);
      }
    };
  }, [user]);

  /**
   * Initialize push notification service and register device token
   */
  const initializePushNotifications = async () => {
    try {
      console.log('[NOTIFICATION CONTEXT] Initializing push notifications...');

      // Initialize the push notification service (sets up listeners)
      await pushNotificationService.initialize();

      // Register the device token with the backend
      await registerPushToken();

      console.log('[NOTIFICATION CONTEXT] Push notifications initialized');
    } catch (error) {
      console.error('[NOTIFICATION CONTEXT] Failed to initialize push notifications:', error);
    }
  };

  /**
   * Register device push token with the backend
   */
  const registerPushToken = async () => {
    if (!user) {
      console.warn('[NOTIFICATION CONTEXT] No user, skipping push token registration');
      return;
    }

    try {
      const token = await pushNotificationService.getExpoPushToken();

      if (!token) {
        console.warn('[NOTIFICATION CONTEXT] Could not get push token');
        return;
      }

      const platform = pushNotificationService.getPlatform();

      await commsService.registerDeviceToken(Number(user.id), token, platform);
      console.log('[NOTIFICATION CONTEXT] Push token registered successfully');
    } catch (error) {
      console.error('[NOTIFICATION CONTEXT] Failed to register push token:', error);
      // Don't throw - push token registration failure shouldn't break the app
    }
  };

  const refreshUnreadCount = async () => {
    if (!user) return;

    try {
      const count = await commsService.getUnreadCount(Number(user.id));
      console.log('🔔 [NOTIFICATION CONTEXT] Unread count:', count);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[NOTIFICATION CONTEXT] Failed to load unread count:', error);
    }
  };

  const setupRealtimeNotifications = async () => {
    if (!user) {
      console.warn('⚠️ [NOTIFICATION CONTEXT] No user found, skipping setup');
      return;
    }

    try {
      console.log('🔌 [NOTIFICATION CONTEXT] Setting up real-time notifications for user:', user.id);
      console.log('🔌 [NOTIFICATION CONTEXT] User object:', JSON.stringify(user, null, 2));

      // Connect to Reverb
      console.log('🔌 [NOTIFICATION CONTEXT] Connecting to Reverb...');
      await reverbService.connect(Number(user.id));
      console.log('✅ [NOTIFICATION CONTEXT] Connected to Reverb successfully');

      // Subscribe to user's private notification channel
      const channelName = `user.${user.id}`;
      console.log(`🔌 [NOTIFICATION CONTEXT] Subscribing to channel: ${channelName}`);

      reverbService.subscribeToPrivateChannel(channelName, {
        onEvent: (eventName: string, data: any) => {
          console.log('🔔 [NOTIFICATION CONTEXT] ===== RECEIVED EVENT =====');
          console.log('🔔 [NOTIFICATION CONTEXT] Event Name:', eventName);
          console.log('🔔 [NOTIFICATION CONTEXT] Event Data:', JSON.stringify(data, null, 2));

          // REAL-TIME UNREAD COUNT UPDATE (Most Efficient)
          if (eventName === 'unread.count.updated' || eventName === '.unread.count.updated') {
            console.log('📊 [NOTIFICATION CONTEXT] Unread count update received from server!');
            const newCount = data.unread_count;
            setUnreadCount(newCount);
            console.log(`📊 [NOTIFICATION CONTEXT] Badge updated instantly: ${newCount}`);
            return;
          }

          // Check if it's a notification created event
          if (eventName === 'notification.created' || eventName === '.notification.created') {
            console.log('📬 [NOTIFICATION CONTEXT] This is a notification.created event!');

            const notification = data.notification;

            // Increment unread count (backup - server should send unread.count.updated)
            setUnreadCount((prev) => {
              const newCount = prev + 1;
              console.log(`📬 [NOTIFICATION CONTEXT] Incrementing badge count: ${prev} -> ${newCount}`);
              return newCount;
            });

            // Notify all listeners about the new notification
            console.log(`📬 [NOTIFICATION CONTEXT] Notifying ${listenersRef.current.size} listeners`);
            listenersRef.current.forEach((listener) => {
              try {
                listener(notification);
              } catch (error) {
                console.error('❌ [NOTIFICATION CONTEXT] Error in listener:', error);
              }
            });

            console.log('✅ [NOTIFICATION CONTEXT] Badge count updated and listeners notified successfully');
          }
          // Handle UserWorkoutInvitation events
          else if (eventName === 'UserWorkoutInvitation' || eventName === '.UserWorkoutInvitation') {
            console.log('💪 [NOTIFICATION CONTEXT] UserWorkoutInvitation received!');
            console.log('💪 [NOTIFICATION CONTEXT] Invitation data:', JSON.stringify(data, null, 2));

            // Don't process invitation from self
            if (user && Number(data.initiator_id) === Number(user.id)) {
              console.log('👤 [NOTIFICATION CONTEXT] Ignoring invitation from self');
              return;
            }

            // Add to persistent invitation store (queue-based system)
            addInvitation({
              invitation_id: data.invitation_id,
              session_id: data.session_id,
              group_id: data.group_id,
              initiator_id: data.initiator_id,
              initiator_name: data.initiator_name,
              workout_data: data.workout_data,
              expires_at: data.expires_at,
              received_at: Date.now()
            });

            console.log('✅ [NOTIFICATION CONTEXT] Invitation added to store');
          }
          else {
            console.log(`⚠️ [NOTIFICATION CONTEXT] Event type "${eventName}" - ignoring`);
          }
        },
      });

      console.log('✅ [NOTIFICATION CONTEXT] Real-time notifications setup complete');
      console.log('✅ [NOTIFICATION CONTEXT] Listening on channel:', channelName);
    } catch (error) {
      console.error('❌ [NOTIFICATION CONTEXT] Failed to setup real-time notifications:', error);
      console.error('❌ [NOTIFICATION CONTEXT] Error details:', JSON.stringify(error, null, 2));
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await commsService.markNotificationAsRead(notificationId);

      // Server will broadcast updated unread count via WebSocket
      // No need to manually decrement - real-time update will arrive
      console.log('✅ [NOTIFICATION CONTEXT] Marked notification as read, waiting for server count update');
    } catch (error) {
      console.error('[NOTIFICATION CONTEXT] Error marking notification as read:', error);
      // On error, refresh count from server
      refreshUnreadCount();
      throw error;
    }
  };

  const addNotificationListener = useCallback((listener: NotificationEventListener) => {
    console.log('➕ [NOTIFICATION CONTEXT] Adding notification listener');
    listenersRef.current.add(listener);
    console.log(`📊 [NOTIFICATION CONTEXT] Total listeners: ${listenersRef.current.size}`);

    // Return unsubscribe function
    return () => {
      console.log('➖ [NOTIFICATION CONTEXT] Removing notification listener');
      listenersRef.current.delete(listener);
      console.log(`📊 [NOTIFICATION CONTEXT] Total listeners: ${listenersRef.current.size}`);
    };
  }, []);

  const handleAcceptInvitation = () => {
    if (!invitationData) return;

    console.log('✅ [NOTIFICATION CONTEXT] User accepted invitation');
    setShowInvitationModal(false);

    // Navigate to group workout lobby
    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: invitationData.session_id,
        groupId: invitationData.group_id.toString(),
        workoutData: JSON.stringify(invitationData.workout_data),
        initiatorId: invitationData.initiator_id.toString(),
      },
    });

    setInvitationData(null);
  };

  const handleDeclineInvitation = () => {
    console.log('❌ [NOTIFICATION CONTEXT] User declined invitation');
    setShowInvitationModal(false);
    setInvitationData(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        markAsRead,
        setupRealtimeNotifications,
        addNotificationListener,
        registerPushToken,
        // Invitation modal state
        showInvitationModal,
        invitationData,
        setShowInvitationModal,
      }}
    >
      {children}
      <GroupWorkoutInvitationModal
        visible={showInvitationModal}
        invitationData={invitationData}
        onAccept={handleAcceptInvitation}
        onDecline={handleDeclineInvitation}
        countdown={30}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
