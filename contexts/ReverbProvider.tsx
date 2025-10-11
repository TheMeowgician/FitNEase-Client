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
}

const ReverbContext = createContext<ReverbContextType>({ isConnected: false });

export function ReverbProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [userGroups, setUserGroups] = useState<number[]>([]);

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
        console.log('🔌 Setting up global Reverb connection for user:', user.id);

        // Connect to Reverb
        await reverbService.connect(Number(user.id));
        setIsConnected(true);

        // Fetch all groups the user is a member of
        const groupsResponse = await socialService.getGroups({ user_id: Number(user.id) });
        const groups = groupsResponse.groups || [];
        const groupIds = groups.map((group: any) => group.id);

        console.log('📋 User is a member of groups:', groupIds);
        setUserGroups(groupIds);

        // Subscribe to all groups for workout invitations AND presence
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

          // Subscribe to presence channel to broadcast online status
          console.log(`🟢 Subscribing to presence channel for group ${groupId}`);
          reverbService.subscribeToGroupPresence(groupId, {
            onMemberOnline: (member: any) => {
              console.log(`👤 Member came online in group ${groupId}:`, {
                id: member.id,
                info: member.info
              });
            },
            onMemberOffline: (member: any) => {
              console.log(`👋 Member went offline in group ${groupId}:`, {
                id: member.id
              });
            },
            onInitialMembers: (members: any[]) => {
              console.log(`👥 Initial online members in group ${groupId}:`, {
                count: members.length,
                memberIds: members.map(m => m.id)
              });
            },
          });
        });

      } catch (error) {
        console.error('❌ Failed to setup Reverb:', error);
        setIsConnected(false);
      }
    };

    setupReverb();

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up Reverb connection');
      userGroups.forEach((groupId) => {
        reverbService.unsubscribe(`private-group.${groupId}`);
        reverbService.unsubscribe(`presence-group.${groupId}`);
      });
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

  return (
    <ReverbContext.Provider value={{ isConnected }}>
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
