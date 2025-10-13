import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { reverbService } from '../services/reverbService';
import { commsService } from '../services/microservices/commsService';

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

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  setupRealtimeNotifications: () => Promise<void>;
  addNotificationListener: (listener: NotificationEventListener) => () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isSetupRef = useRef(false);
  const listenersRef = useRef<Set<NotificationEventListener>>(new Set());

  useEffect(() => {
    if (user) {
      refreshUnreadCount();

      // Setup real-time notifications only once
      if (!isSetupRef.current) {
        setupRealtimeNotifications();
        isSetupRef.current = true;
      }
    }

    return () => {
      // Clean up on unmount
      if (user) {
        reverbService.unsubscribe(`private-user.${user.id}`);
      }
    };
  }, [user]);

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

          // Check if it's a notification created event
          if (eventName === 'notification.created' || eventName === '.notification.created') {
            console.log('📬 [NOTIFICATION CONTEXT] This is a notification.created event!');

            const notification = data.notification;

            // Increment unread count
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
          } else {
            console.log(`⚠️ [NOTIFICATION CONTEXT] Event type "${eventName}" does not match notification.created`);
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

      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));

      console.log('✅ [NOTIFICATION CONTEXT] Marked notification as read, decremented badge count');
    } catch (error) {
      console.error('[NOTIFICATION CONTEXT] Error marking notification as read:', error);
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

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        markAsRead,
        setupRealtimeNotifications,
        addNotificationListener,
      }}
    >
      {children}
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
