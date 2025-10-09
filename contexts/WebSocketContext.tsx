import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { useAuth } from './AuthContext';
import reverbService from '../services/reverbService';
import { socialService } from '../services/microservices/socialService';
import GroupWorkoutInvitationModal from '../components/groups/GroupWorkoutInvitationModal';

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
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedGroupIds, setSubscribedGroupIds] = useState<string[]>([]);
  const [pendingInvitation, setPendingInvitation] = useState<WorkoutInvitation | null>(null);
  const [groupsCache, setGroupsCache] = useState<Map<string, string>>(new Map());

  // Subscribe to user's group channels when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('🔌 WebSocketContext: User authenticated, subscribing to group channels...');
      subscribeToGroupChannels();
    } else {
      console.log('🔌 WebSocketContext: User not authenticated, unsubscribing from all channels');
      unsubscribeFromGroupChannels();
    }

    return () => {
      unsubscribeFromGroupChannels();
    };
  }, [isAuthenticated, user?.id]);

  const subscribeToGroupChannels = async () => {
    if (!user) return;

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
    } catch (error) {
      console.error('❌ Failed to subscribe to group channels:', error);
    }
  };

  const unsubscribeFromGroupChannels = () => {
    console.log('🔌 Unsubscribing from all group channels...');

    for (const groupId of subscribedGroupIds) {
      const channelName = `private-group.${groupId}`;
      reverbService.unsubscribe(channelName);
    }

    setSubscribedGroupIds([]);
    setIsConnected(false);
  };

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

  const value: WebSocketContextType = {
    isConnected,
    subscribeToGroupChannels,
    unsubscribeFromGroupChannels,
    pendingInvitation,
    acceptInvitation,
    declineInvitation,
  };

  // Transform pendingInvitation to match modal's expected format
  const invitationData = pendingInvitation ? {
    group_id: parseInt(pendingInvitation.groupId),
    initiator_id: pendingInvitation.initiatorId,
    initiator_name: pendingInvitation.initiatorName,
    workout_data: pendingInvitation.workoutData,
    session_id: pendingInvitation.sessionId,
  } : null;

  return (
    <WebSocketContext.Provider value={value}>
      {children}

      {/* Global Workout Invitation Modal */}
      <GroupWorkoutInvitationModal
        visible={!!pendingInvitation}
        invitationData={invitationData}
        onAccept={acceptInvitation}
        onDecline={declineInvitation}
        countdown={30}
      />
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
