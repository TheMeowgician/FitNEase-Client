import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useLobby } from '../../contexts/LobbyContext';
import reverbService from '../../services/reverbService';
import { socialService, GroupMember } from '../../services/microservices/socialService';
import { mlService } from '../../services/microservices/mlService';
import LobbyChat, { ChatMessage } from '../../components/lobby/LobbyChat';

interface Exercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level: number;
  estimated_calories_burned: number;
  muscle_group: string;
}

interface WorkoutData {
  exercises: Exercise[];
  tabata_structure?: {
    rounds: number;
    work_duration_seconds: number;
    rest_duration_seconds: number;
    total_duration_minutes: number;
  };
  group_analysis?: {
    avg_fitness_level: number;
    min_fitness_level: number;
    max_fitness_level: number;
    fitness_level_range: string;
    total_members: number;
  };
}

interface Member {
  user_id: number;
  name: string;
  status: 'waiting' | 'ready';
}

export default function GroupWorkoutLobby() {
  const { user } = useAuth();
  const { lobbyState: globalLobbyState, joinLobby, minimizeLobby, leaveLobby, updateLobbyMembers, updateLobbyChatMessages } = useLobby();
  const params = useLocalSearchParams();
  const { sessionId, groupId, workoutData: workoutDataString, initiatorId, isCreatingLobby } = params;

  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isGeneratingExercises, setIsGeneratingExercises] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);
  const [myStatus, setMyStatus] = useState<'waiting' | 'ready'>('waiting');
  const workoutDataRef = useRef<WorkoutData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const isChatVisibleRef = useRef(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [currentInitiatorId, setCurrentInitiatorId] = useState<string>(initiatorId as string);
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(new Set());
  const [isRestoringFromMinimized, setIsRestoringFromMinimized] = useState(false);
  const isLeavingRef = useRef(false);

  // Initial mount effect - runs once
  useEffect(() => {
    console.log('🏋️ Lobby mounted with params:', {
      sessionId,
      groupId,
      initiatorId,
      currentUserId: user?.id,
      isCreatingLobby
    });

    // Check if we're restoring from a minimized lobby
    const isRestoring = globalLobbyState?.sessionId === sessionId &&
                       globalLobbyState?.members &&
                       globalLobbyState?.members.length > 0;

    if (isRestoring) {
      console.log('🔄 Restoring lobby from minimized state - fetching fresh state from server');

      setIsRestoringFromMinimized(true);

      // Fetch fresh state from server instead of trusting in-memory state
      (async () => {
        try {
          const freshState = await socialService.getLobbyState(sessionId as string);
          console.log('✅ Fresh lobby state fetched:', {
            membersCount: freshState.members.length,
            messagesCount: freshState.messages.length
          });

          // Transform server members to component format
          const freshMembers: Member[] = freshState.members.map(m => ({
            user_id: m.user_id,
            name: m.username,
            status: m.status
          }));

          // Transform server messages to component format
          const freshMessages: ChatMessage[] = freshState.messages.map(msg => ({
            id: msg.message_id,
            userId: msg.user_id || 0,
            userName: msg.username,
            message: msg.message,
            timestamp: msg.timestamp * 1000, // Convert to milliseconds
            isOwnMessage: msg.user_id === Number(user?.id),
            isSystemMessage: msg.is_system_message
          }));

          console.log('👥 Restoring members from server:', freshMembers);
          console.log('💬 Restoring messages from server:', freshMessages.length);

          setMembers(freshMembers);
          setChatMessages(freshMessages);

          // Mark restoration as complete after state updates
          setTimeout(() => setIsRestoringFromMinimized(false), 100);
        } catch (error: any) {
          console.error('❌ Failed to fetch fresh lobby state:', error);

          // Check if lobby was deleted (404)
          if (error.message?.includes('not found') || error.message?.includes('deleted')) {
            Alert.alert(
              'Lobby Closed',
              'This lobby has been closed or deleted.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    leaveLobby();
                    router.back();
                  },
                },
              ]
            );
          } else {
            // For other errors, fallback to in-memory state
            console.log('⚠️ Falling back to in-memory state due to error');
            setMembers(globalLobbyState.members || []);
            setChatMessages(globalLobbyState.chatMessages || []);
            setTimeout(() => setIsRestoringFromMinimized(false), 100);
          }
        }
      })();
    } else {
      console.log('🆕 Creating new lobby or first time joining');

      // Add self to members list immediately with 'waiting' status
      if (user) {
        console.log('👤 Adding self to members list (waiting)');
        const initialMembers = [{
          user_id: Number(user.id),
          name: user.username || 'You',
          status: 'waiting' as const
        }];
        setMembers(initialMembers);
      }
    }

    // Register this lobby with the global context
    joinLobby({
      sessionId: sessionId as string,
      groupId: groupId as string,
      workoutData: workoutDataString as string,
      initiatorId: initiatorId as string,
      isCreatingLobby: isCreatingLobby as string,
    });

    if (workoutDataString) {
      const data = JSON.parse(workoutDataString as string);
      setWorkoutData(data);
      workoutDataRef.current = data; // Store in ref for event handlers
      console.log('📋 Workout data loaded:', data);
    }

    // Check if current user is the initiator
    const isInit = Number(user?.id) === Number(initiatorId);
    setIsInitiator(isInit);
    console.log('👤 Is initiator:', isInit);

    // Subscribe to lobby updates first, then broadcast status
    console.log('🔌 Setting up lobby subscription...');
    setupLobbySubscription();

    // Small delay to ensure subscription is established before broadcasting
    // This ensures we receive status updates from others who re-broadcast
    setTimeout(() => {
      // Mark self as waiting (NOT ready by default)
      console.log('📡 Broadcasting initial member status...');
      broadcastMemberStatus('waiting');
    }, 500);

    return () => {
      console.log('🔌 Unsubscribing from lobby channel on unmount');
      reverbService.unsubscribe(`private-lobby.${sessionId}`);

      // Only auto-minimize if user didn't explicitly leave/get kicked
      // Use ref to check if user is leaving intentionally
      if (isLeavingRef.current) {
        console.log('🚫 Skipping auto-minimize - user explicitly left lobby');
      } else if (globalLobbyState && globalLobbyState.sessionId === sessionId) {
        console.log('📉 Auto-minimizing lobby on unmount (user navigated away)');
        minimizeLobby();
      } else {
        console.log('🚫 Skipping auto-minimize - lobby state already cleared (kicked)');
      }
    };
  }, []); // Empty dependency - only run on mount/unmount

  // Sync members to global lobby state whenever they change
  useEffect(() => {
    // Don't sync during initial restoration to avoid overwriting
    if (isRestoringFromMinimized) {
      console.log('⏳ Skipping members sync during restoration');
      return;
    }

    if (members.length > 0) {
      console.log('💾 Syncing members to global lobby state:', members.length);
      updateLobbyMembers(members);
    }
  }, [members, isRestoringFromMinimized]);

  // Sync chat messages to global lobby state whenever they change
  useEffect(() => {
    if (chatMessages.length > 0) {
      console.log('💾 Syncing chat messages to global lobby state:', chatMessages.length);
      updateLobbyChatMessages(chatMessages);
    }
  }, [chatMessages]);

  // Separate effect to handle initiator changes
  useEffect(() => {
    const isInit = Number(user?.id) === Number(currentInitiatorId);
    console.log('👑 Initiator check update:', {
      userId: user?.id,
      currentInitiatorId,
      isInit
    });
    setIsInitiator(isInit);
  }, [currentInitiatorId, user?.id]);

  // Subscribe to group presence channel for online status
  useEffect(() => {
    if (!groupId) return;

    console.log(`🟢 Setting up presence listeners for group ${groupId}`);

    // Get the existing presence channel (already subscribed globally)
    const channelName = `presence-group.${groupId}`;
    const pusher = (reverbService as any).pusher;
    const channel = pusher?.channel(channelName);

    if (!channel) {
      console.warn(`⚠️ Presence channel not found for group ${groupId}`);
      return;
    }

    console.log(`✅ Found presence channel for group ${groupId}`);

    // Check if channel is already subscribed and has members
    if (channel.members) {
      const currentMembers = channel.members.members || {};
      const memberIds = Object.keys(currentMembers);
      console.log('👥 Channel already has members:', {
        count: channel.members.count,
        memberIds
      });
      setOnlineMemberIds(new Set(memberIds));
    }

    // Bind to presence events
    const handleMemberAdded = (member: any) => {
      const userId = member.id?.toString();
      if (userId) {
        console.log('✅ Adding online member:', userId);
        setOnlineMemberIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(userId);
          return newSet;
        });
      }
    };

    const handleMemberRemoved = (member: any) => {
      const userId = member.id?.toString();
      if (userId) {
        console.log('❌ Removing offline member:', userId);
        setOnlineMemberIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    };

    const handleSubscriptionSucceeded = (members: any) => {
      const memberIds = Object.keys(members.members || {});
      console.log('✅ Initial online user IDs:', memberIds);
      setOnlineMemberIds(new Set(memberIds));
    };

    channel.bind('pusher:member_added', handleMemberAdded);
    channel.bind('pusher:member_removed', handleMemberRemoved);
    channel.bind('pusher:subscription_succeeded', handleSubscriptionSucceeded);

    // Cleanup: unbind events when component unmounts
    return () => {
      console.log(`🔴 Removing presence listeners for group ${groupId}`);
      channel.unbind('pusher:member_added', handleMemberAdded);
      channel.unbind('pusher:member_removed', handleMemberRemoved);
      channel.unbind('pusher:subscription_succeeded', handleSubscriptionSucceeded);
    };
  }, [groupId]);

  const setupLobbySubscription = () => {
    console.log('🔌 Subscribing to lobby channel:', `lobby.${sessionId}`);

    // Listen for member updates
    reverbService.subscribeToPrivateChannel(`lobby.${sessionId}`, {
      onEvent: (eventName, data) => {
        console.log('📨 Lobby event received:', { eventName, data });

        if (eventName === 'MemberStatusUpdate') {
          console.log('👥 Member status update:', data);
          updateMemberStatus(data.user_id, data.name, data.status);
        } else if (eventName === 'ExercisesGenerated') {
          console.log('🏋️ Exercises generated event received!', data);
          // Update workout data for all members
          const receivedWorkout: WorkoutData = data.workout_data;
          setWorkoutData(receivedWorkout);
          workoutDataRef.current = receivedWorkout;
          console.log('✅ Workout data updated from broadcast:', receivedWorkout);
          Alert.alert('Exercises Ready!', 'The workout exercises have been generated.');
        } else if (eventName === 'LobbyMessageSent') {
          console.log('💬 Chat message received:', data);
          // Add message to chat
          const newMessage: ChatMessage = {
            id: data.message_id,
            userId: data.user_id,
            userName: data.user_name,
            message: data.message,
            timestamp: data.timestamp * 1000, // Convert to milliseconds
            isOwnMessage: data.user_id === Number(user?.id),
            isSystemMessage: data.is_system_message || false,
          };
          setChatMessages((prev) => [...prev, newMessage]);

          // Increment unread count only if chat is not visible and message is not from self
          if (!isChatVisibleRef.current && data.user_id !== Number(user?.id)) {
            setUnreadMessagesCount((prev) => prev + 1);
          }
        } else if (eventName === 'WorkoutStarted') {
          console.log('🚀 Workout started event received! Starting workout...');
          // All members navigate to workout session
          startWorkout();
        } else if (eventName === 'PassInitiatorRole') {
          console.log('👑 Initiator role transfer received:', data);
          // Update the current initiator ID - backend sends camelCase
          setCurrentInitiatorId(data.newInitiatorId.toString());

          // Check if current user is now the initiator
          const isNowInitiator = Number(user?.id) === Number(data.newInitiatorId);
          setIsInitiator(isNowInitiator);

          // Show notification
          Alert.alert(
            'Role Transfer',
            isNowInitiator
              ? `You are now the lobby creator! You can generate exercises and start the workout.`
              : `${data.newInitiatorName} is now the lobby creator.`
          );
        } else if (eventName === 'MemberKicked') {
          console.log('🚫 Member kicked event received:', data);

          // Check if current user was kicked
          if (Number(data.kickedUserId) === Number(user?.id)) {
            // Set flag to indicate user was kicked (not navigating away)
            isLeavingRef.current = true;

            Alert.alert(
              'Removed from Lobby',
              'You have been removed from the workout lobby by the creator.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    leaveLobby();
                    router.back();
                  },
                },
              ]
            );
          } else {
            // Remove the kicked member from the list
            // System message will be broadcast separately and restored from server
            setMembers((prev) => prev.filter((m) => m.user_id !== Number(data.kickedUserId)));
            Alert.alert('Member Removed', `${data.kickedUserName} has been removed from the lobby.`);
          }
        } else if (eventName === 'LobbyDeleted') {
          console.log('🗑️ Lobby deleted event received');
          // Set flag to indicate lobby was deleted (not navigating away)
          isLeavingRef.current = true;

          // Lobby was deleted (all members left or expired)
          Alert.alert(
            'Lobby Closed',
            'This lobby has been closed.',
            [
              {
                text: 'OK',
                onPress: () => {
                  leaveLobby();
                  router.back();
                },
              },
            ]
          );
        } else {
          console.log('❓ Unknown event:', eventName);
        }
      },
    });
  };

  const updateMemberStatus = (userId: number, name: string, status: 'waiting' | 'ready') => {
    setMembers((prev) => {
      const existing = prev.find((m) => m.user_id === userId);
      if (existing) {
        return prev.map((m) =>
          m.user_id === userId ? { ...m, status } : m
        );
      } else {
        // New member joined! Re-broadcast our own status so they can see us
        console.log('🆕 New member joined, re-broadcasting own status');
        setTimeout(() => broadcastMemberStatus(myStatus), 100);

        // System message for member join will be created by backend and broadcast
        // No need to create it locally - it will be restored from server

        return [...prev, { user_id: userId, name, status }];
      }
    });
  };

  const handleToggleReady = async () => {
    const newStatus = myStatus === 'waiting' ? 'ready' : 'waiting';
    setMyStatus(newStatus);

    // Update own status in members list
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === Number(user?.id) ? { ...m, status: newStatus } : m
      )
    );

    // Broadcast status to other members
    await broadcastMemberStatus(newStatus);
  };

  const broadcastMemberStatus = async (status: 'waiting' | 'ready') => {
    try {
      await socialService.updateLobbyStatus(sessionId as string, status);
      console.log(`✅ Status broadcasted: ${status}`);
    } catch (error) {
      console.error('❌ Failed to broadcast status:', error);
    }
  };

  const handleGenerateExercises = async () => {
    if (!isInitiator) {
      Alert.alert('Permission Denied', 'Only the lobby creator can generate exercises.');
      return;
    }

    // Check if there are members in the lobby
    if (members.length === 0) {
      Alert.alert(
        'No Members in Lobby',
        'Wait for members to join the lobby before generating exercises. The ML service needs member profiles to create a balanced workout.'
      );
      return;
    }

    // Check if all members are ready
    const allReady = members.every((m) => m.status === 'ready');
    if (!allReady) {
      const notReadyMembers = members.filter((m) => m.status === 'waiting');
      Alert.alert(
        'Not All Members Ready',
        `Waiting for ${notReadyMembers.length} member(s) to be ready:\n${notReadyMembers.map(m => `• ${m.name}`).join('\n')}`
      );
      return;
    }

    try {
      setIsGeneratingExercises(true);
      console.log('🔥 Generating exercises for lobby members:', members.length);

      // Use CURRENT LOBBY MEMBERS (not all group members)
      // This ensures ML generates balanced workout based on who's actually joining
      const userIds = members.map((m) => m.user_id);

      console.log('👥 Lobby member IDs for ML service:', userIds);

      // Call ML service to generate group workout recommendations
      // ML service will analyze each member's profile and create balanced exercises
      const mlResponse = await mlService.getGroupWorkoutRecommendations(userIds, {
        workout_format: 'tabata',
        target_exercises: 8,
      });

      console.log('✅ ML Response:', mlResponse);

      if (!mlResponse || !mlResponse.workout || !mlResponse.workout.exercises) {
        throw new Error('No exercises generated');
      }

      // Create workout data with ML-generated exercises
      const generatedWorkout: WorkoutData = {
        exercises: mlResponse.workout.exercises,
        tabata_structure: mlResponse.workout.tabata_structure,
        group_analysis: mlResponse.workout.group_analysis,
      };

      // Update local state
      setWorkoutData(generatedWorkout);
      workoutDataRef.current = generatedWorkout;

      console.log('✅ Exercises generated and stored locally');
      console.log('📊 Group Analysis:', mlResponse.workout.group_analysis);

      // Broadcast exercises to all lobby members
      console.log('📡 Broadcasting exercises to all lobby members...');
      await socialService.broadcastExercises(sessionId as string, generatedWorkout);
      console.log('✅ Exercises broadcast complete');

      Alert.alert('Success', 'Exercises generated and shared with all members!');
    } catch (error: any) {
      console.error('❌ Failed to generate exercises:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to generate exercises. Please try again.'
      );
    } finally {
      setIsGeneratingExercises(false);
    }
  };

  const handleStartWorkout = () => {
    console.log('🎯 handleStartWorkout called, isInitiator:', isInitiator);

    if (!isInitiator) {
      Alert.alert('Permission Denied', 'Only the workout initiator can start the session.');
      return;
    }

    // Check if all members are ready
    const allReady = members.every((m) => m.status === 'ready');
    if (!allReady) {
      const notReadyMembers = members.filter((m) => m.status === 'waiting');
      Alert.alert(
        'Not All Members Ready',
        `Waiting for ${notReadyMembers.length} member(s) to be ready:\n${notReadyMembers.map(m => `• ${m.name}`).join('\n')}`
      );
      return;
    }

    Alert.alert(
      'Start Workout',
      'Are you ready to start the workout for all members?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Now',
          onPress: async () => {
            try {
              console.log('🚀 Initiator starting workout for all members...');
              console.log('📡 Calling API: startWorkout with sessionId:', sessionId);

              const response = await socialService.startWorkout(sessionId as string);
              console.log('✅ API response:', response);

              // The WorkoutStarted event will trigger startWorkout() for all members
              console.log('⏳ Waiting for WorkoutStarted event...');
            } catch (error) {
              console.error('❌ Failed to start workout:', error);
              Alert.alert('Error', 'Failed to start workout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const startWorkout = () => {
    const currentWorkoutData = workoutDataRef.current || workoutData;
    console.log('🏃 startWorkout called, workoutData exists:', !!currentWorkoutData);

    if (!currentWorkoutData) {
      console.error('❌ No workout data available!');
      Alert.alert('Error', 'Workout data not loaded. Please try again.');
      return;
    }

    // Create TabataWorkoutSession format
    const tabataSession = {
      exercises: currentWorkoutData.exercises,
      total_duration_minutes: currentWorkoutData.tabata_structure?.total_duration_minutes || 32,
      rounds: currentWorkoutData.tabata_structure?.rounds || 8,
      work_duration_seconds: currentWorkoutData.tabata_structure?.work_duration_seconds || 20,
      rest_duration_seconds: currentWorkoutData.tabata_structure?.rest_duration_seconds || 10,
      session_id: sessionId as string,
      group_id: groupId as string,
    };

    console.log('🎬 Navigating to workout session with data:', tabataSession);

    router.replace({
      pathname: '/workout/session',
      params: {
        sessionData: JSON.stringify(tabataSession),
        type: 'group_tabata',
        initiatorId: initiatorId as string,
        groupId: groupId as string,
      },
    });
  };

  const handleMinimize = () => {
    console.log('📉 Minimizing lobby');
    minimizeLobby();
    router.back();
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave the workout lobby? You will be removed from the session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Set flag to indicate user is intentionally leaving
              // This prevents auto-minimize in cleanup function
              console.log('🚪 User is leaving lobby - setting flag');
              isLeavingRef.current = true;

              // Clear lobby state
              console.log('🚪 Clearing lobby state');
              leaveLobby();

              // Call API to broadcast member left event
              await socialService.leaveLobby(sessionId as string);
              console.log('✅ Left lobby and broadcasted to other members');
            } catch (error) {
              console.error('❌ Failed to broadcast leave:', error);
            } finally {
              // Navigate back regardless of API success
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleInviteMembers = async () => {
    try {
      setLoadingGroupMembers(true);
      setShowInviteModal(true);

      // Fetch all group members
      const response = await socialService.getGroupMembers(groupId as string, 1, 50);
      setGroupMembers(response.members || []);
    } catch (error) {
      console.error('Failed to load group members:', error);
      Alert.alert('Error', 'Failed to load group members');
      setShowInviteModal(false);
    } finally {
      setLoadingGroupMembers(false);
    }
  };

  const handleInviteMember = async (member: GroupMember) => {
    try {
      console.log('📤 Sending lobby invitation to:', {
        userId: member.userId,
        username: member.username,
        sessionId,
        groupId
      });

      // Call the backend API to send the invitation via WebSocket
      await socialService.inviteMemberToLobby(
        sessionId as string,
        parseInt(member.userId),
        groupId as string,
        workoutData || { workout_format: 'tabata', exercises: [] }
      );

      Alert.alert(
        'Invitation Sent',
        `Invited ${member.username} to join the workout lobby!\n\nNote: Make sure ${member.username} is online and in the app to receive the invitation.`
      );

      console.log('✅ Invitation sent successfully');
    } catch (error) {
      console.error('❌ Failed to send invitation:', error);
      Alert.alert('Error', 'Failed to send invitation. Please try again.');
    }
  };

  const handleSendMessage = async (message: string) => {
    try {
      console.log('💬 Sending chat message:', message);
      await socialService.sendLobbyMessage(sessionId as string, message);
      console.log('✅ Chat message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send chat message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleOpenChat = () => {
    setIsChatVisible(true);
    isChatVisibleRef.current = true;
    // Clear unread count when opening chat
    setUnreadMessagesCount(0);
  };

  const handleCloseChat = () => {
    setIsChatVisible(false);
    isChatVisibleRef.current = false;
  };

  const handlePassInitiatorRole = (member: Member) => {
    if (!isInitiator) {
      Alert.alert('Permission Denied', 'Only the lobby creator can transfer the role.');
      return;
    }

    if (member.user_id === Number(user?.id)) {
      Alert.alert('Invalid Action', 'You cannot transfer the role to yourself.');
      return;
    }

    Alert.alert(
      'Transfer Creator Role',
      `Are you sure you want to transfer the lobby creator role to ${member.name}? You will no longer be able to generate exercises or start the workout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('👑 Transferring initiator role to:', {
                memberId: member.user_id,
                memberName: member.name,
                sessionId
              });

              await socialService.passInitiatorRole(sessionId as string, member.user_id);

              console.log('✅ Initiator role transferred successfully');
            } catch (error) {
              console.error('❌ Failed to transfer initiator role:', error);
              Alert.alert('Error', 'Failed to transfer role. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleKickMember = (member: Member) => {
    if (!isInitiator) {
      Alert.alert('Permission Denied', 'Only the lobby creator can remove members.');
      return;
    }

    if (member.user_id === Number(user?.id)) {
      Alert.alert('Invalid Action', 'You cannot kick yourself from the lobby.');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the lobby?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚫 Kicking member from lobby:', {
                memberId: member.user_id,
                memberName: member.name,
                sessionId
              });

              await socialService.kickUserFromLobby(sessionId as string, member.user_id);

              // Remove member from local state immediately
              setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));

              console.log('✅ Member kicked successfully');
            } catch (error) {
              console.error('❌ Failed to kick member:', error);
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getDifficultyLabel = (level: number) => {
    switch (level) {
      case 1: return 'Beginner';
      case 2: return 'Intermediate';
      case 3: return 'Advanced';
      default: return 'Unknown';
    }
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return COLORS.SUCCESS[500];
      case 2: return COLORS.WARNING[500];
      case 3: return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[500];
    }
  };

  const formatMuscleGroup = (muscleGroup: string) => {
    // Convert snake_case to Title Case (e.g., "upper_body" -> "Upper Body")
    return muscleGroup
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // If we're in lobby creation mode (no exercises yet), we'll show a different UI
  const isLobbyMode = isCreatingLobby === 'true' || !workoutData;

  // Only show loading if we're not in lobby creation mode and have no data
  if (!workoutData && isCreatingLobby !== 'true') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
            <Text style={styles.loadingText}>Loading workout...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const exercises = workoutData?.exercises || [];
  const tabata_structure = workoutData?.tabata_structure;
  const group_analysis = workoutData?.group_analysis;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMinimize} style={styles.backButton}>
          <Ionicons name="chevron-down" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Workout Lobby</Text>
          <Text style={styles.headerSubtitle}>Waiting for all members...</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
            <Ionicons name="chatbubbles" size={24} color={COLORS.PRIMARY[600]} />
            {unreadMessagesCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{unreadMessagesCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLeave} style={styles.menuButton}>
            <Ionicons name="exit-outline" size={24} color={COLORS.ERROR[600]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ready Status Toggle */}
        <View style={styles.readyToggleSection}>
          <View style={styles.readyToggleCard}>
            <View style={styles.readyToggleLeft}>
              <Ionicons
                name={myStatus === 'ready' ? 'checkmark-circle' : 'time-outline'}
                size={32}
                color={myStatus === 'ready' ? COLORS.SUCCESS[600] : COLORS.WARNING[600]}
              />
              <View style={styles.readyToggleText}>
                <Text style={styles.readyToggleTitle}>
                  {myStatus === 'ready' ? "You're Ready!" : 'Not Ready Yet'}
                </Text>
                <Text style={styles.readyToggleSubtitle}>
                  {myStatus === 'ready'
                    ? 'Waiting for others to be ready'
                    : 'Tap the button when ready'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.readyToggleButton,
                myStatus === 'ready' ? styles.readyToggleButtonReady : styles.readyToggleButtonWaiting,
              ]}
              onPress={handleToggleReady}
            >
              <Text
                style={[
                  styles.readyToggleButtonText,
                  myStatus === 'ready' && styles.readyToggleButtonTextReady,
                ]}
              >
                {myStatus === 'ready' ? 'Not Ready' : 'Ready'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={COLORS.PRIMARY[600]} />
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
            {isInitiator && (
              <TouchableOpacity style={styles.inviteButton} onPress={handleInviteMembers}>
                <Ionicons name="person-add" size={18} color={COLORS.PRIMARY[600]} />
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.membersList}>
            {members.length > 0 ? (
              members.map((member) => (
                <View key={member.user_id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={20} color={COLORS.PRIMARY[600]} />
                  </View>
                  <View style={styles.memberNameContainer}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.user_id === Number(currentInitiatorId) && (
                      <View style={styles.initiatorBadge}>
                        <Ionicons name="star" size={14} color={COLORS.WARNING[600]} />
                        <Text style={styles.initiatorText}>Creator</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.memberActionsContainer}>
                    {/* Show Pass Role and Kick buttons if current user is initiator and this member is not the initiator */}
                    {isInitiator && member.user_id !== Number(currentInitiatorId) && (
                      <>
                        <TouchableOpacity
                          style={styles.passRoleButton}
                          onPress={() => handlePassInitiatorRole(member)}
                        >
                          <Ionicons name="swap-horizontal" size={16} color={COLORS.PRIMARY[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.kickButton}
                          onPress={() => handleKickMember(member)}
                        >
                          <Ionicons name="close-circle" size={16} color={COLORS.ERROR[600]} />
                        </TouchableOpacity>
                      </>
                    )}
                    <View style={[styles.statusBadge, member.status === 'ready' && styles.statusReady]}>
                      <Ionicons
                        name={member.status === 'ready' ? 'checkmark-circle' : 'time'}
                        size={16}
                        color={member.status === 'ready' ? COLORS.SUCCESS[600] : COLORS.WARNING[600]}
                      />
                      <Text style={[styles.statusText, member.status === 'ready' && styles.statusReadyText]}>
                        {member.status === 'ready' ? 'Ready' : 'Waiting'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyMembersCard}>
                <Ionicons name="people-outline" size={32} color={COLORS.SECONDARY[400]} />
                <Text style={styles.emptyMembersText}>No members yet. Invite friends to join!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Generate/Regenerate Exercises Section - Show ALWAYS when user is initiator */}
        {isInitiator && (
          <View style={styles.section}>
            {!workoutData || exercises.length === 0 ? (
              // Show generate card when no exercises
              <View style={styles.emptyStateCard}>
                <Ionicons name="barbell-outline" size={48} color={COLORS.SECONDARY[400]} />
                <Text style={styles.emptyStateTitle}>No Exercises Yet</Text>
                <Text style={styles.emptyStateText}>
                  Generate personalized exercises for your group members
                </Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleGenerateExercises}
                  disabled={isGeneratingExercises}
                >
                  {isGeneratingExercises ? (
                    <>
                      <ActivityIndicator color="white" size="small" />
                      <Text style={styles.generateButtonText}>Generating...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="flash" size={20} color={COLORS.NEUTRAL.WHITE} />
                      <Text style={styles.generateButtonText}>Generate Exercises</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Show regenerate button when exercises exist
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleGenerateExercises}
                disabled={isGeneratingExercises}
              >
                {isGeneratingExercises ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={styles.regenerateButtonText}>Regenerating...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color={COLORS.NEUTRAL.WHITE} />
                    <Text style={styles.regenerateButtonText}>Regenerate Exercises</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tabata Structure */}
        {tabata_structure && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="timer" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Tabata Structure</Text>
            </View>
            <View style={styles.tabataContainer}>
              <View style={styles.tabataRow}>
                <View style={styles.tabataCard}>
                  <Ionicons name="repeat" size={24} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.tabataValue}>{tabata_structure.rounds}</Text>
                  <Text style={styles.tabataLabel}>Rounds</Text>
                </View>
                <View style={styles.tabataCard}>
                  <Ionicons name="timer" size={24} color={COLORS.SUCCESS[600]} />
                  <Text style={styles.tabataValue}>{tabata_structure.work_duration_seconds}s</Text>
                  <Text style={styles.tabataLabel}>Work</Text>
                </View>
              </View>
              <View style={styles.tabataRow}>
                <View style={styles.tabataCard}>
                  <Ionicons name="pause" size={24} color={COLORS.WARNING[600]} />
                  <Text style={styles.tabataValue}>{tabata_structure.rest_duration_seconds}s</Text>
                  <Text style={styles.tabataLabel}>Rest</Text>
                </View>
                <View style={styles.tabataCard}>
                  <Ionicons name="time" size={24} color={COLORS.SECONDARY[600]} />
                  <Text style={styles.tabataValue}>{tabata_structure.total_duration_minutes}</Text>
                  <Text style={styles.tabataLabel}>Total Minutes</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Group Analysis */}
        {group_analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Group Fitness Level</Text>
            </View>
            <View style={styles.analysisCard}>
              <View style={styles.analysisRow}>
                <Text style={styles.analysisLabel}>Level Range:</Text>
                <Text style={styles.analysisValue}>
                  {getDifficultyLabel(group_analysis.min_fitness_level)} - {getDifficultyLabel(group_analysis.max_fitness_level)}
                </Text>
              </View>
              <View style={styles.analysisRow}>
                <Text style={styles.analysisLabel}>Group Type:</Text>
                <Text style={styles.analysisValue}>
                  {group_analysis.fitness_level_range === 'homogeneous' ? 'Similar Levels' : 'Mixed Levels'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Exercises Section - Only show if exercises exist */}
        {exercises.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="fitness" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
            </View>
            {exercises.map((exercise, index) => (
              <View key={exercise.exercise_id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                </View>
                <View style={styles.exerciseDetails}>
                  <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '20' }]}>
                    <Text style={[styles.difficultyText, { color: getDifficultyColor(exercise.difficulty_level) }]}>
                      {getDifficultyLabel(exercise.difficulty_level)}
                    </Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Ionicons name="body-outline" size={14} color={COLORS.SECONDARY[600]} />
                    <Text style={styles.exerciseStatText}>{formatMuscleGroup(exercise.muscle_group)}</Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Ionicons name="flame-outline" size={14} color={COLORS.WARNING[500]} />
                    <Text style={styles.exerciseStatText}>{exercise.estimated_calories_burned} cal</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        {workoutData && exercises.length > 0 ? (
          // Show start button only when exercises are generated
          isInitiator ? (
            <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
              <Ionicons name="play-circle" size={24} color={COLORS.NEUTRAL.WHITE} />
              <Text style={styles.startButtonText}>Start Workout for Everyone</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
              <Text style={styles.waitingText}>Waiting for workout to start...</Text>
            </View>
          )
        ) : (
          // When no exercises yet, show appropriate message
          <View style={styles.waitingContainer}>
            <Ionicons name="time-outline" size={20} color={COLORS.SECONDARY[600]} />
            <Text style={styles.waitingText}>
              {isInitiator ? 'Generate exercises to continue' : 'Waiting for exercises...'}
            </Text>
          </View>
        )}
      </View>

      {/* Invite Members Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Members</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            {loadingGroupMembers ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {groupMembers
                  .filter((gm) => {
                    // Filter out members already in lobby
                    const isInLobby = members.find((m) => m.user_id === parseInt(gm.userId));
                    // Filter out current user (don't invite yourself)
                    const isCurrentUser = parseInt(gm.userId) === Number(user?.id);
                    return !isInLobby && !isCurrentUser;
                  })
                  .map((member) => {
                    const isOnline = onlineMemberIds.has(member.userId);
                    return (
                      <View key={member.id} style={styles.inviteMemberCard}>
                        <View style={styles.memberAvatarContainer}>
                          <View style={styles.memberAvatar}>
                            <Ionicons name="person" size={20} color={COLORS.PRIMARY[600]} />
                          </View>
                          {isOnline && <View style={styles.onlineIndicator} />}
                        </View>
                        <View style={styles.inviteMemberInfo}>
                          <Text style={styles.memberName}>{member.username}</Text>
                          <Text style={styles.inviteMemberRole}>{member.role}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.inviteIconButton}
                          onPress={() => handleInviteMember(member)}
                        >
                          <Ionicons name="send" size={20} color={COLORS.PRIMARY[600]} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                {groupMembers.filter((gm) => {
                  const isInLobby = members.find((m) => m.user_id === parseInt(gm.userId));
                  const isCurrentUser = parseInt(gm.userId) === Number(user?.id);
                  return !isInLobby && !isCurrentUser;
                }).length === 0 && (
                  <View style={styles.emptyInviteState}>
                    <Ionicons name="checkmark-done-circle" size={48} color={COLORS.SUCCESS[400]} />
                    <Text style={styles.emptyInviteText}>All group members are already in the lobby!</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Lobby Chat */}
      <LobbyChat
        messages={chatMessages}
        currentUserId={Number(user?.id)}
        onSendMessage={handleSendMessage}
        visible={isChatVisible}
        onClose={handleCloseChat}
      />
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginLeft: 8,
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberNameContainer: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  initiatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  initiatorText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[700],
  },
  memberActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    padding: 8,
  },
  passRoleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.ERROR[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusReady: {
    backgroundColor: COLORS.SUCCESS[50],
  },
  statusText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[600],
    marginLeft: 4,
  },
  statusReadyText: {
    color: COLORS.SUCCESS[600],
  },
  tabataContainer: {
    gap: 12,
  },
  tabataRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tabataCard: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  tabataValue: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  tabataLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  analysisCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 16,
    borderRadius: 12,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analysisLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  analysisValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseName: {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  exerciseStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseStatText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
  },
  waitingText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginLeft: 12,
  },
  emptyStateCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
  regenerateButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  regenerateButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginLeft: 8,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
    gap: 4,
  },
  inviteButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  emptyMembersCard: {
    backgroundColor: COLORS.SECONDARY[50],
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyMembersText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  modalTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inviteMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.SUCCESS[500],
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  inviteMemberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteMemberRole: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
    textTransform: 'capitalize',
  },
  inviteIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInviteState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInviteText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 16,
    textAlign: 'center',
  },
  readyToggleSection: {
    marginBottom: 16,
  },
  readyToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.SECONDARY[50],
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.SECONDARY[200],
  },
  readyToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  readyToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  readyToggleTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  readyToggleSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  readyToggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  readyToggleButtonWaiting: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  readyToggleButtonReady: {
    backgroundColor: COLORS.SECONDARY[300],
  },
  readyToggleButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  readyToggleButtonTextReady: {
    color: COLORS.SECONDARY[700],
  },
  chatButton: {
    padding: 8,
    position: 'relative',
  },
  chatBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.ERROR[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
});
