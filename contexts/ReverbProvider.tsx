import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import reverbService from '../services/reverbService';
import GroupWorkoutInvitationModal from '../components/groups/GroupWorkoutInvitationModal';
import { socialService } from '../services/microservices/socialService';

interface InvitationData {
  group_id: number;
  initiator_id: number;
  initiator_name: string;
  workout_data: {
    workout_format: string;
    exercises: Array<{
      exercise_id: number;
      exercise_name: string;
      difficulty_level: number;
      estimated_calories_burned: number;
      muscle_group: string;
    }>;
    group_analysis?: {
      avg_fitness_level: number;
      min_fitness_level: number;
      max_fitness_level: number;
      fitness_level_range: string;
      total_members: number;
    };
    tabata_structure?: {
      rounds: number;
      work_duration_seconds: number;
      rest_duration_seconds: number;
      total_duration_minutes: number;
    };
  };
  session_id: string;
}

interface ReverbContextType {
  isConnected: boolean;
  onlineUsers: Set<string>;
  refreshGroupSubscriptions: () => Promise<void>;
}

const ReverbContext = createContext<ReverbContextType>({
  isConnected: false,
  onlineUsers: new Set(),
  refreshGroupSubscriptions: async () => {},
});

export function ReverbProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [userGroups, setUserGroups] = useState<number[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Connect to Reverb and fetch user's groups when user logs in
  useEffect(() => {
    if (!user) {
      // User logged out - disconnect
      reverbService.disconnect();
      setIsConnected(false);
      setUserGroups([]);
      return;
    }

    const setupReverb = async () => {
      try {
        console.log('🔌 [REVERB PROVIDER] Setting up global Reverb connection for user:', user.id);

        // Connect to Reverb
        await reverbService.connect(Number(user.id));
        console.log('✅ [REVERB PROVIDER] Connected to Reverb');
        setIsConnected(true);

        // Fetch all groups the user is a member of
        console.log('📋 [REVERB PROVIDER] Fetching user groups...');
        const groupsResponse = await socialService.getGroups({ user_id: Number(user.id) });
        const groups = groupsResponse.groups || [];
        const groupIds = groups.map((group: any) => group.id);

        console.log('📋 [REVERB PROVIDER] User is a member of groups:', groupIds);
        setUserGroups(groupIds);

        // Subscribe to GLOBAL presence channel for online status
        console.log('🌍 [REVERB PROVIDER] About to subscribe to GLOBAL online users presence channel');

        // Unsubscribe first if already subscribed (in case of reconnection)
        reverbService.unsubscribe('presence-online-users');

        const presenceChannel = reverbService.subscribeToGlobalPresence({
          onMemberOnline: (member: any) => {
            console.log('🟢 User came online globally:', member.id);
            setOnlineUsers((prev) => {
              const newSet = new Set(prev);
              newSet.add(member.id.toString());
              console.log('📊 Updated online users after member online:', Array.from(newSet));
              return newSet;
            });
          },
          onMemberOffline: (member: any) => {
            console.log('🔴 User went offline globally:', member.id);
            setOnlineUsers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(member.id.toString());
              console.log('📊 Updated online users after member offline:', Array.from(newSet));
              return newSet;
            });
          },
          onInitialMembers: (members: any[]) => {
            const userIds = members.map(m => m.id.toString());
            console.log('👥 Initial online users:', {
              count: members.length,
              userIds: userIds
            });
            setOnlineUsers(new Set(userIds));
            console.log('📊 Set online users state to:', userIds);
          },
        });

        console.log('✅ [REVERB PROVIDER] Global presence channel subscribed:', presenceChannel ? 'success' : 'failed');

        // Subscribe to all groups for workout invitations
        groupIds.forEach((groupId: number) => {
          console.log(`✅ Subscribing to group ${groupId} for invitations`);
          reverbService.subscribeToGroupWorkoutInvitations(groupId, (data) => {
            console.log('📨 Received group workout invitation:', data);
            console.log('👤 User comparison:', {
              initiator_id: data.initiator_id,
              user_id: user.id,
              initiator_type: typeof data.initiator_id,
              user_type: typeof user.id,
              match: Number(data.initiator_id) === Number(user.id)
            });

            // Don't show invitation to the initiator
            if (Number(data.initiator_id) === Number(user.id)) {
              console.log('👤 Ignoring invitation from self');
              return;
            }

            // Show the invitation modal
            setInvitationData(data);
            setShowInvitationModal(true);
          });
        });

      } catch (error) {
        console.error('❌ [REVERB PROVIDER] Failed to setup Reverb:', error);
        console.error('❌ [REVERB PROVIDER] Error details:', JSON.stringify(error, null, 2));
        setIsConnected(false);
      }
    };

    setupReverb();

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up Reverb connection');
      userGroups.forEach((groupId) => {
        reverbService.unsubscribe(`private-group.${groupId}`);
      });
      // Unsubscribe from global presence
      reverbService.unsubscribe('presence-online-users');
    };
  }, [user]);

  const handleAcceptInvitation = () => {
    if (!invitationData) return;

    console.log('✅ User accepted invitation');
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
    console.log('❌ User declined invitation');
    setShowInvitationModal(false);
    setInvitationData(null);
  };

  /**
   * Refresh group subscriptions
   * Called after completing workouts or when group memberships change
   */
  const refreshGroupSubscriptions = async () => {
    if (!user) {
      console.log('⚠️ [REFRESH] No user logged in, skipping refresh');
      return;
    }

    try {
      console.log('🔄 [REFRESH] Refreshing group subscriptions...');

      // Unsubscribe from existing group channels
      userGroups.forEach((groupId) => {
        console.log(`🔕 [REFRESH] Unsubscribing from group ${groupId}`);
        reverbService.unsubscribe(`private-group.${groupId}`);
      });

      // Fetch updated list of groups
      console.log('📋 [REFRESH] Fetching updated user groups...');
      const groupsResponse = await socialService.getGroups({ user_id: Number(user.id) });
      const groups = groupsResponse.groups || [];
      const groupIds = groups.map((group: any) => group.id);

      console.log('📋 [REFRESH] User is now a member of groups:', groupIds);
      setUserGroups(groupIds);

      // Subscribe to updated group list
      groupIds.forEach((groupId: number) => {
        console.log(`✅ [REFRESH] Subscribing to group ${groupId} for invitations`);
        reverbService.subscribeToGroupWorkoutInvitations(groupId, (data) => {
          console.log('📨 [REFRESH] Received group workout invitation:', data);

          // Don't show invitation to the initiator
          if (Number(data.initiator_id) === Number(user.id)) {
            console.log('👤 Ignoring invitation from self');
            return;
          }

          // Show the invitation modal
          setInvitationData(data);
          setShowInvitationModal(true);
        });
      });

      console.log('✅ [REFRESH] Group subscriptions refreshed successfully');
    } catch (error) {
      console.error('❌ [REFRESH] Failed to refresh group subscriptions:', error);
    }
  };

  return (
    <ReverbContext.Provider value={{ isConnected, onlineUsers, refreshGroupSubscriptions }}>
      {children}
      <GroupWorkoutInvitationModal
        visible={showInvitationModal}
        invitationData={invitationData}
        onAccept={handleAcceptInvitation}
        onDecline={handleDeclineInvitation}
        countdown={30}
      />
    </ReverbContext.Provider>
  );
}

export const useReverb = () => useContext(ReverbContext);
