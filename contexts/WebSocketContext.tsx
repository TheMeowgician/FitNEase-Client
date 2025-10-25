import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { useAuth } from './AuthContext';
import reverbService from '../services/reverbService';
import { socialService } from '../services/microservices/socialService';
import GroupWorkoutInvitationModal from '../components/groups/GroupWorkoutInvitationModal';
import InvitationQueueModal from '../components/groups/InvitationQueueModal';
import { useInvitationStore } from '../stores/invitationStore';

export interface WorkoutInvitation {
  sessionId: string;
  groupId: string;
  groupName: string;
  initiatorId: number;
  initiatorName: string;
  workoutData: any;
  timestamp: number;
}

interface WebSocketContextType {
  isConnected: boolean;
  subscribeToGroupChannels: () => Promise<void>;
  unsubscribeFromGroupChannels: () => void;
  pendingInvitation: WorkoutInvitation | null;
  acceptInvitation: () => void;
  declineInvitation: () => void;
  connectionState: string;
  reconnectAttempts: number;
  maxRetriesReached: boolean;
  manualReconnect: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedGroupIds, setSubscribedGroupIds] = useState<string[]>([]);
  const [pendingInvitation, setPendingInvitation] = useState<WorkoutInvitation | null>(null);
  const [groupsCache, setGroupsCache] = useState<Map<string, string>>(new Map());
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [maxRetriesReached, setMaxRetriesReached] = useState<boolean>(false);

  // Access invitation store actions (user invitations now handled by NotificationContext)
  const { hydrateFromStorage, fetchPendingInvitations, cleanupExpiredInvitations } = useInvitationStore();

  // Hydrate invitations from AsyncStorage on mount
  useEffect(() => {
    hydrateFromStorage();
  }, []);

  // Listen for connection state changes
  useEffect(() => {
    const unsubscribe = reverbService.onConnectionStateChange((state) => {
      console.log('🔄 Connection state changed:', state);
      setConnectionState(state);
      setIsConnected(state === 'connected');
      setReconnectAttempts(reverbService.getReconnectAttempts());
      setMaxRetriesReached(state === 'max_retries_reached' || reverbService.hasMaxRetriesReached());
    });

    // Initial state
    setConnectionState(reverbService.getConnectionState());
    setReconnectAttempts(reverbService.getReconnectAttempts());
    setMaxRetriesReached(reverbService.hasMaxRetriesReached());

    return unsubscribe;
  }, []);

  // Set up reconnection callback
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('🔄 Setting up WebSocket reconnection callback');

      reverbService.onReconnect(() => {
        console.log('🔄 WebSocket reconnected, resubscribing to channels and fetching invitations');

        // Resubscribe to group channels only
        // NOTE: User channel is handled by NotificationContext to avoid duplicate subscriptions
        subscribeToGroupChannels();

        // Fetch any invitations that were sent while disconnected
        fetchPendingInvitations();
      });
    }
  }, [isAuthenticated, user?.id]);

  // Connect to Reverb and subscribe to channels when authenticated
  useEffect(() => {
    const setupWebSocketConnection = async () => {
      if (isAuthenticated && user) {
        console.log('🔌 WebSocketContext: User authenticated, connecting to Reverb...');

        try {
          // Connect to Reverb FIRST
          await reverbService.connect(Number(user.id));
          console.log('✅ Reverb connected, now subscribing to channels...');

          // Now subscribe to group channels only
          // NOTE: User channel is handled by NotificationContext to avoid duplicate subscriptions
          await subscribeToGroupChannels();

          // Fetch any pending invitations from backend
          fetchPendingInvitations();

          // Start cleanup interval
          const interval = setInterval(() => {
            cleanupExpiredInvitations();
          }, 30000); // Every 30 seconds

          return () => {
            clearInterval(interval);
          };
        } catch (error) {
          console.error('❌ Failed to setup WebSocket connection:', error);
        }
      } else {
        console.log('🔌 WebSocketContext: User not authenticated, unsubscribing from group channels');
        unsubscribeFromGroupChannels();
      }
    };

    setupWebSocketConnection();

    return () => {
      // Cleanup group channels only
      // NOTE: User channel is handled by NotificationContext
      unsubscribeFromGroupChannels();
    };
  }, [isAuthenticated, user?.id]);

  const subscribeToGroupChannels = async (retryCount = 0) => {
    if (!user) return;

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      console.log('📡 Fetching user groups for WebSocket subscriptions...');

      // Get all groups the user is a member of
      const response = await socialService.getGroups({
        user_id: Number(user.id),
        limit: 100
      });

      console.log(`✅ Found ${response.groups.length} groups to subscribe to`);

      // Cache group names for invitations
      const groupNameMap = new Map<string, string>();
      response.groups.forEach(group => {
        groupNameMap.set(group.id, group.name);
      });
      setGroupsCache(groupNameMap);

      // Subscribe to each group's channel
      const newSubscribedIds: string[] = [];

      for (const group of response.groups) {
        const channelName = `group.${group.id}`;
        console.log(`🔔 Subscribing to channel: private-${channelName}`);

        reverbService.subscribeToPrivateChannel(channelName, {
          onEvent: (eventName, data) => {
            console.log(`📨 Group ${group.id} event received:`, { eventName, data });

            if (eventName === 'GroupWorkoutInvitation') {
              handleGroupWorkoutInvitation(data, group.id, group.name);
            }
          },
        });

        newSubscribedIds.push(group.id);
      }

      setSubscribedGroupIds(newSubscribedIds);
      setIsConnected(true);
      console.log('✅ Subscribed to all group channels');
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isDeadlock = errorMessage.includes('Deadlock') || errorMessage.includes('1213');

      if (isDeadlock && retryCount < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, retryCount);
        console.warn(`⚠️ Database deadlock detected (attempt ${retryCount + 1}/${maxRetries}), retrying in ${delay}ms...`);

        setTimeout(() => {
          subscribeToGroupChannels(retryCount + 1);
        }, delay);
      } else {
        console.error('❌ Failed to subscribe to group channels:', error);
        if (isDeadlock && retryCount >= maxRetries) {
          console.error('❌ Max retries reached for database deadlock. Please try refreshing the app.');
        }
      }
    }
  };

  // NOTE: User channel subscription removed - now handled by NotificationContext
  // to avoid duplicate subscriptions and duplicate invitation modals

  const unsubscribeFromGroupChannels = () => {
    console.log('🔌 Unsubscribing from all group channels...');

    for (const groupId of subscribedGroupIds) {
      const channelName = `private-group.${groupId}`;
      reverbService.unsubscribe(channelName);
    }

    setSubscribedGroupIds([]);
    setIsConnected(false);
  };

  // NOTE: handleUserWorkoutInvitation removed - now handled by NotificationContext
  // to avoid duplicate invitation processing

  const handleGroupWorkoutInvitation = (data: any, groupId: string, groupName: string) => {
    console.log('🏋️ Group workout invitation received!', {
      groupId,
      groupName,
      sessionId: data.session_id,
      initiatorId: data.initiator_id,
      initiatorName: data.initiator_name,
      currentUserId: user?.id,
      currentUserIdType: typeof user?.id,
      initiatorIdType: typeof data.initiator_id
    });

    // Don't auto-navigate if user is the initiator
    // Use explicit type conversion to ensure comparison works
    if (user && Number(data.initiator_id) === Number(user.id)) {
      console.log('👤 Ignoring invitation from self');
      return;
    }

    // Store the invitation for the user to accept/decline
    setPendingInvitation({
      sessionId: data.session_id,
      groupId: groupId,
      groupName: groupName,
      initiatorId: data.initiator_id,
      initiatorName: data.initiator_name,
      workoutData: data.workout_data,
      timestamp: Date.now(),
    });
  };

  const acceptInvitation = () => {
    if (!pendingInvitation) return;

    console.log('✅ User accepted invitation, navigating to lobby...');

    // Navigate user to the workout lobby
    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: pendingInvitation.sessionId,
        groupId: pendingInvitation.groupId,
        workoutData: JSON.stringify(pendingInvitation.workoutData),
        initiatorId: pendingInvitation.initiatorId.toString(),
        isCreatingLobby: 'false',
      },
    });

    // Clear the invitation
    setPendingInvitation(null);
  };

  const declineInvitation = () => {
    if (!pendingInvitation) return;

    console.log('❌ User declined invitation');

    // Clear the invitation
    setPendingInvitation(null);
  };

  const manualReconnect = async () => {
    console.log('🔄 Manual reconnect requested by user');
    try {
      const success = await reverbService.manualReconnect();
      if (success) {
        console.log('✅ Manual reconnect successful');
        // Resubscribe to group channels only
        // NOTE: User channel is handled by NotificationContext
        await subscribeToGroupChannels();
        fetchPendingInvitations();
      } else {
        console.error('❌ Manual reconnect failed');
      }
    } catch (error) {
      console.error('❌ Manual reconnect error:', error);
    }
  };

  const value: WebSocketContextType = {
    isConnected,
    subscribeToGroupChannels,
    unsubscribeFromGroupChannels,
    pendingInvitation,
    acceptInvitation,
    declineInvitation,
    connectionState,
    reconnectAttempts,
    maxRetriesReached,
    manualReconnect,
  };

  // Transform pendingInvitation to match modal's expected format
  const invitationData = pendingInvitation ? {
    group_id: parseInt(pendingInvitation.groupId),
    initiator_id: pendingInvitation.initiatorId,
    initiator_name: pendingInvitation.initiatorName,
    workout_data: pendingInvitation.workoutData,
    session_id: pendingInvitation.sessionId,
  } : null;

  // Check if user is currently in a session or lobby
  // Don't show invitation modal if they're already in a workout
  const isInSessionOrLobby = pathname?.includes('/workout/session') || pathname?.includes('/workout/group-lobby');
  const shouldShowModal = !!pendingInvitation && !isInSessionOrLobby;

  // Log modal visibility decision
  useEffect(() => {
    if (pendingInvitation) {
      console.log('📨 Invitation modal visibility check:', {
        hasPendingInvitation: !!pendingInvitation,
        currentPath: pathname,
        isInSessionOrLobby,
        shouldShowModal,
        invitationFrom: pendingInvitation.initiatorName
      });
    }
  }, [pendingInvitation, pathname, isInSessionOrLobby, shouldShowModal]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}

      {/* Legacy: Group Workout Invitation Modal (for backward compatibility with old group channel invitations) */}
      <GroupWorkoutInvitationModal
        visible={shouldShowModal}
        invitationData={invitationData}
        onAccept={acceptInvitation}
        onDecline={declineInvitation}
        countdown={30}
      />

      {/* Professional: Invitation Queue Modal (new persistent user-channel based system) */}
      {/* Shows invitations one at a time from the queue, persists across app restarts */}
      {!isInSessionOrLobby && <InvitationQueueModal />}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
