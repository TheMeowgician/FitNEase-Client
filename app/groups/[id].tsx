import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
  Clipboard,
  Modal,
  TextInput,
  Animated,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useLobby } from '../../contexts/LobbyContext';
import { useReverb } from '../../contexts/ReverbProvider';
import { socialService, Group, GroupMember } from '../../services/microservices/socialService';
import { useMLService } from '../../services/microservices/mlService';
import { GroupWorkoutModal } from '../../components/groups/GroupWorkoutModal';
import { JoinRequestsModal } from '../../components/groups/JoinRequestsModal';
import { UserProfilePreviewModal } from '../../components/groups/UserProfilePreviewModal';
import { Avatar } from '../../components/ui/Avatar';
import { useSmartBack } from '../../hooks/useSmartBack';
import reverbService from '../../services/reverbService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { mediaService } from '../../services/microservices/mediaService';

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const alert = useAlert();
  const { goBack } = useSmartBack();
  const { getGroupWorkoutRecommendations } = useMLService();
  const { activeLobby, saveLobbySession, checkForActiveLobby: refreshLobbyState, forceCleanupAllLobbies } = useLobby();
  const { onlineUsers } = useReverb(); // Get global online users from Reverb context
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'moderator' | 'member' | null>(null);

  // Group workout states
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [showGroupWorkoutModal, setShowGroupWorkoutModal] = useState(false);
  const [groupWorkout, setGroupWorkout] = useState<any>(null);

  // Active lobby state - derived from LobbyContext
  const activeLobbySession = activeLobby?.groupId === id ? activeLobby.sessionId : null;

  // Invite by username states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Edit group states
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showEditDescModal, setShowEditDescModal] = useState(false);

  const [editNameValue, setEditNameValue] = useState('');
  const [editDescValue, setEditDescValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Race condition guard for destructive actions (kick, leave, delete)
  const isProcessingAction = useRef(false);

  // Group image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Remove members modal state
  const [showRemoveMembersModal, setShowRemoveMembersModal] = useState(false);
  const [isRemoveMembersVisible, setIsRemoveMembersVisible] = useState(false);
  const removeMembersOverlayAnim = useRef(new Animated.Value(0)).current;
  const removeMembersSlideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Join requests modal state
  const [showJoinRequestsModal, setShowJoinRequestsModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Member profile preview state
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [showMemberPreview, setShowMemberPreview] = useState(false);

  // Image picker modal state
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Track if settings modal should reopen after a sub-modal closes
  const shouldReopenSettings = useRef(false);

  // Animation values for smooth modal fade in/out
  const inviteModalFade = useRef(new Animated.Value(0)).current;
  const inviteModalScale = useRef(new Animated.Value(0.9)).current;
  const settingsModalFade = useRef(new Animated.Value(0)).current;
  const settingsModalScale = useRef(new Animated.Value(0.9)).current;
  const imagePickerModalFade = useRef(new Animated.Value(0)).current;
  const imagePickerModalScale = useRef(new Animated.Value(0.9)).current;

  // Animate invite modal
  useEffect(() => {
    if (showInviteModal) {
      inviteModalFade.setValue(0);
      inviteModalScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(inviteModalFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(inviteModalScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [showInviteModal]);

  // Animate settings modal
  useEffect(() => {
    if (showSettingsModal) {
      settingsModalFade.setValue(0);
      settingsModalScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(settingsModalFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(settingsModalScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [showSettingsModal]);

  // Animate image picker modal
  useEffect(() => {
    if (showImagePickerModal) {
      imagePickerModalFade.setValue(0);
      imagePickerModalScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(imagePickerModalFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(imagePickerModalScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [showImagePickerModal]);

  // Animate remove members modal (overlay fade + content slide-up)
  const screenHeight = Dimensions.get('window').height;
  useEffect(() => {
    if (showRemoveMembersModal) {
      setIsRemoveMembersVisible(true);
      removeMembersOverlayAnim.setValue(0);
      removeMembersSlideAnim.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(removeMembersOverlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(removeMembersSlideAnim, { toValue: 0, friction: 9, tension: 50, useNativeDriver: true }),
      ]).start();
    } else if (isRemoveMembersVisible) {
      Animated.parallel([
        Animated.timing(removeMembersOverlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(removeMembersSlideAnim, { toValue: screenHeight, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setIsRemoveMembersVisible(false);
      });
    }
  }, [showRemoveMembersModal]);

  // Auto-reopen settings modal after a sub-modal closes
  useEffect(() => {
    if (
      shouldReopenSettings.current &&
      !showImagePickerModal &&
      !showEditNameModal &&
      !showEditDescModal &&
      !showInviteModal &&
      !showJoinRequestsModal &&
      !showRemoveMembersModal
    ) {
      shouldReopenSettings.current = false;
      setShowSettingsModal(true);
    }
  }, [showImagePickerModal, showEditNameModal, showEditDescModal, showInviteModal, showJoinRequestsModal, showRemoveMembersModal]);

  useEffect(() => {
    loadGroupDetails();
  }, [id]);

  // Refresh lobby state and group details when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshLobbyState();
      loadGroupDetails();
    }, [id])
  );

  // Listen for real-time group member updates (joins/leaves/kicks)
  useEffect(() => {
    if (!id) return;

    console.log(`🔔 Setting up group member update listener for group ${id}`);

    const channelName = `group.${id}`;

    // Subscribe to group's private channel for member updates
    reverbService.subscribeToPrivateChannel(channelName, {
      onEvent: (eventName: string, data: any) => {
        console.log('🔔 [GROUP DETAILS] Received event:', eventName, data);

        // Handle group member updates
        if (eventName === 'group.members.updated' || eventName === '.group.members.updated') {
          console.log('👥 [GROUP DETAILS] Group members updated!', {
            memberCount: data.member_count,
            membersReceived: data.members?.length
          });

          // Update members list in real-time
          // Normalize broadcast data to match the same format as HTTP API
          if (data.members && Array.isArray(data.members)) {
            const normalizedMembers: GroupMember[] = data.members.map((m: any) => {
              // Map backend 'admin' role to frontend 'owner'
              let role: 'owner' | 'moderator' | 'member' = 'member';
              if (m.role === 'admin' || m.role === 'owner') {
                role = 'owner';
              } else if (m.role === 'moderator') {
                role = 'moderator';
              }

              return {
                id: m.id?.toString(),
                userId: m.userId?.toString(),
                username: m.username || `User ${m.userId}`,
                profilePicture: m.profilePicture,
                role: role,
                userRole: m.userRole === 'mentor' ? 'mentor' : undefined,
                joinedAt: m.joinedAt,
                lastActive: m.joinedAt,
                contributions: { workoutsShared: 0, challengesCreated: 0, helpfulPosts: 0 },
                status: 'active' as const,
              };
            });
            setMembers(normalizedMembers);
          }

          // Update member count
          if (data.member_count !== undefined && group) {
            setGroup({
              ...group,
              memberCount: data.member_count
            });
          }

          console.log('✅ [GROUP DETAILS] Member list updated in real-time');
        }

        // Handle group stats updates
        if (eventName === 'group.stats.updated' || eventName === '.group.stats.updated') {
          console.log('📊 [GROUP DETAILS] Group stats updated!', data.stats);

          if (data.stats && group) {
            setGroup({
              ...group,
              stats: data.stats
            });
          }

          console.log('✅ [GROUP DETAILS] Stats updated in real-time');
        }
      }
    });

    return () => {
      console.log(`🔴 Unsubscribing from group ${id} member updates`);
      reverbService.unsubscribe(`private-${channelName}`);
    };
  }, [id, group]);

  // Online status is now tracked globally via ReverbProvider
  // No need for per-group presence channels anymore!

  const loadGroupDetails = async () => {
    try {
      setIsLoading(true);

      // Load group details and members
      const [groupData, membersData] = await Promise.all([
        socialService.getGroup(id as string),
        socialService.getGroupMembers(id as string, 1, 50),
      ]);

      console.log('📋 Group Details Loaded:', {
        id: groupData.id,
        name: groupData.name,
        groupCode: groupData.groupCode,
        hasGroupCode: !!groupData.groupCode,
        memberCount: groupData.memberCount,
        actualMemberCount: membersData.total,
        totalMembers: membersData.members.length
      });

      // Update group with actual member count from members API
      const updatedGroup = {
        ...groupData,
        memberCount: membersData.total || groupData.memberCount
      };

      setGroup(updatedGroup);

      // Enrich current user's profilePicture from auth context (always fresh)
      // to avoid stale data from social service's Redis cache
      const enrichedMembers = (membersData.members || []).map((m: GroupMember) =>
        m.userId === user?.id ? { ...m, profilePicture: user.profilePicture || m.profilePicture } : m
      );
      setMembers(enrichedMembers);

      // Determine user's role
      const userMember = membersData.members?.find((m: GroupMember) => m.userId === user?.id);
      setUserRole(userMember?.role || null);
    } catch (error) {
      console.error('Error loading group details:', error);
      alert.error('Error', 'Failed to load group details.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroupDetails();
    setRefreshing(false);
  };

  // Load pending join requests count for owners/moderators
  const loadPendingRequestsCount = async () => {
    try {
      const response = await socialService.getJoinRequestCount(id as string);
      setPendingRequestsCount(response || 0);
    } catch (error) {
      console.error('Failed to load pending requests count:', error);
    }
  };

  // Load pending requests when user is owner/moderator
  useEffect(() => {
    if (userRole === 'owner' || userRole === 'moderator') {
      loadPendingRequestsCount();
    }
  }, [userRole, id]);

  const handleCopyCode = () => {
    if (!group?.groupCode) {
      alert.error('Error', 'No group code available');
      return;
    }

    try {
      Clipboard.setString(group.groupCode);
      alert.success('Copied!', 'Group code copied to clipboard');
    } catch (error) {
      console.error('Error copying group code:', error);
      alert.error('Error', 'Failed to copy group code');
    }
  };

  const handleShareCode = async () => {
    if (!group) return;

    try {
      await Share.share({
        message: `Join my workout group "${group.name}" on FitNEase!\n\nGroup Code: ${group.groupCode || 'N/A'}\n\nUse this code in the app to join the group.`,
        title: `Join ${group.name}`,
      });
    } catch (error) {
      console.error('Error sharing group code:', error);
    }
  };

  const handleLeaveGroup = () => {
    if (!group || isProcessingAction.current) return;

    alert.confirm(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      async () => {
        if (isProcessingAction.current) return;
        isProcessingAction.current = true;
        try {
          await socialService.leaveGroup(group.id);
          alert.success('Success', 'You have left the group.', () => router.push('/(tabs)/groups'));
        } catch (error: any) {
          alert.error('Error', error.message || 'Failed to leave group.');
        } finally {
          isProcessingAction.current = false;
        }
      },
      undefined,
      'Leave',
      'Cancel'
    );
  };

  const handleDeleteGroup = () => {
    if (!group || isProcessingAction.current) return;

    alert.confirm(
      'Delete Group',
      `Are you sure you want to permanently delete "${group.name}"? This action cannot be undone.`,
      async () => {
        if (isProcessingAction.current) return;
        isProcessingAction.current = true;
        try {
          await socialService.deleteGroup(group.id);
          alert.success('Success', 'Group deleted successfully.', () => router.push('/(tabs)/groups'));
        } catch (error: any) {
          alert.error('Error', error.message || 'Failed to delete group.');
        } finally {
          isProcessingAction.current = false;
        }
      },
      undefined,
      'Delete',
      'Cancel'
    );
  };

  const handleManageGroup = () => {
    setShowSettingsModal(true);
  };

  const handleGroupImagePress = () => {
    if (userRole !== 'owner' || isUploadingImage) return;
    setShowImagePickerModal(true);
  };

  const pickGroupImage = async (source: 'camera' | 'gallery') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });

    if (result.canceled) return;

    setIsUploadingImage(true);
    try {
      const uploadResponse = await mediaService.uploadGroupImage(result.assets[0].uri);
      await socialService.updateGroup(group!.id, { group_image: uploadResponse.data.url });
      await loadGroupDetails();
      alert.success('Success', 'Group image updated!');
    } catch (error) {
      console.error('Group image upload error:', error);
      alert.error('Error', 'Failed to upload group image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveGroupImage = async () => {
    if (!group) return;
    setIsUploadingImage(true);
    try {
      await socialService.updateGroup(group.id, { group_image: '' });
      await loadGroupDetails();
      alert.success('Success', 'Group image removed.');
    } catch (error) {
      alert.error('Error', 'Failed to remove group image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditGroupName = () => {
    setEditNameValue(group?.name || '');
    setShowEditNameModal(true);
    setShowSettingsModal(false);
    shouldReopenSettings.current = true;
  };

  const handleSaveGroupName = async () => {
    if (!group || !editNameValue.trim()) return;

    setIsUpdating(true);
    try {
      await socialService.updateGroup(group.id, { group_name: editNameValue.trim() });
      alert.success('Success', 'Group name updated successfully');
      setShowEditNameModal(false);
      loadGroupDetails(); // Refresh group data
    } catch (error: any) {
      alert.error('Error', error.message || 'Failed to update group name');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditDescription = () => {
    setEditDescValue(group?.description || '');
    setShowEditDescModal(true);
    setShowSettingsModal(false);
    shouldReopenSettings.current = true;
  };

  const handleSaveDescription = async () => {
    if (!group) return;

    setIsUpdating(true);
    try {
      await socialService.updateGroup(group.id, { description: editDescValue.trim() || undefined });
      alert.success('Success', 'Description updated successfully');
      setShowEditDescModal(false);
      loadGroupDetails(); // Refresh group data
    } catch (error: any) {
      alert.error('Error', error.message || 'Failed to update description');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!group) return;

    const newType = group.type === 'public' ? 'private' : 'public';

    alert.confirm(
      'Change Privacy',
      `Are you sure you want to make this group ${newType}?`,
      async () => {
        setIsUpdating(true);
        try {
          await socialService.updateGroup(group.id, { is_private: newType === 'private' });
          alert.success('Success', `Group is now ${newType}`);
          loadGroupDetails(); // Refresh group data
        } catch (error: any) {
          alert.error('Error', error.message || 'Failed to update privacy');
        } finally {
          setIsUpdating(false);
        }
      }
    );
  };


  const handleKickMember = (member: GroupMember) => {
    if (!group || member.userId === user?.id || isProcessingAction.current) return;

    alert.confirm(
      'Remove Member',
      `Are you sure you want to remove ${member.username} from the group?`,
      async () => {
        if (isProcessingAction.current) return;
        isProcessingAction.current = true;
        try {
          await socialService.removeGroupMember(id as string, member.userId);
          alert.success('Success', `${member.username} has been removed from the group.`);
          await loadGroupDetails();
        } catch (error: any) {
          alert.error('Error', error.message || 'Failed to remove member.');
        } finally {
          isProcessingAction.current = false;
        }
      },
      undefined,
      'Remove',
      'Cancel'
    );
  };

  const handleInviteByUsername = async () => {
    if (!usernameInput.trim()) {
      alert.warning('Error', 'Please enter a username');
      return;
    }

    try {
      setIsInviting(true);

      // Invite user to group directly by username
      // The backend will handle the username lookup and validation
      await socialService.inviteUser(id as string, usernameInput.trim());

      alert.success('Invitation Sent!', `Successfully invited ${usernameInput.trim()} to join the group.`, () => {
        setShowInviteModal(false);
        setUsernameInput('');
        // Refresh group details to show new member if they accepted
        setTimeout(() => loadGroupDetails(), 1000);
      });
    } catch (error: any) {
      console.error('Error inviting user:', error);
      alert.error('Error', error.message || 'Failed to invite user. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleGenerateGroupWorkout = async () => {
    if (!group || !members || members.length === 0) {
      alert.warning('No Members', 'Cannot create lobby for an empty group. Please add members first.');
      return;
    }

    try {
      setIsGeneratingWorkout(true);
      console.log('🚪 Creating workout lobby for', members.length, 'members...');

      // Create a V2 event-sourced lobby session
      // This creates an event-sourced lobby that works with the new architecture
      // Exercises will be generated later when user clicks "Generate Exercises"
      console.log('📡 Creating V2 lobby session on backend...');

      let sessionResponse;
      try {
        sessionResponse = await socialService.createLobbyV2(
          parseInt(id as string),
          {
            workout_format: 'tabata',
            exercises: [], // Empty exercises initially - will be populated when user generates them
          }
        );
      } catch (error: any) {
        // If error is "already in another lobby", automatically force cleanup and retry
        if (error.message && error.message.includes('already in another lobby')) {
          console.log('⚠️ Stale lobby detected - running NUCLEAR CLEANUP and retrying...');

          try {
            // NUCLEAR CLEANUP - Force cleanup all lobbies (backend + frontend)
            // This new implementation works even if backend has bugs
            const cleanupResult = await forceCleanupAllLobbies();
            console.log('✅ Nuclear cleanup complete:', cleanupResult);

            // Wait 1 second to let backend process the cleanup
            // Backend may need time to update its state
            console.log('⏳ Waiting 1 second for backend to update...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('🔄 Retrying lobby creation after cleanup...');

            // Retry lobby creation automatically
            sessionResponse = await socialService.createLobbyV2(
              parseInt(id as string),
              {
                workout_format: 'tabata',
                exercises: [],
              }
            );

            console.log('✅ Lobby created successfully after nuclear cleanup!');
          } catch (retryError: any) {
            console.error('❌ Retry failed after cleanup:', retryError);

            // Even after nuclear cleanup, if it still fails, it's a backend issue
            // Provide user with options
            alert.confirm(
              'Unable to Create Lobby',
              'We performed emergency cleanup but the backend is still reporting you\'re in a lobby. This is a backend issue.\n\nOptions:\n1. Wait 1 minute and try again\n2. Contact support if issue persists',
              () => {
                // User can manually retry by clicking the button again
                console.log('User will try again manually');
              },
              undefined,
              'Try Again',
              'OK'
            );
            throw retryError;
          }
        } else {
          throw error; // Re-throw if it's a different error
        }
      }

      console.log('✅ V2 Lobby session created:', sessionResponse);

      // Store active lobby session using LobbyContext
      const sessionId = sessionResponse.data.session_id;
      await saveLobbySession(sessionId, id as string, group?.name || `Group ${id}`);

      // Navigate to lobby with the session ID from V2 response
      // The lobby is already created, so we're JOINING it
      router.push({
        pathname: '/workout/group-lobby',
        params: {
          sessionId: sessionResponse.data.session_id,
          groupId: id as string,
          workoutData: JSON.stringify({ workout_format: 'tabata', exercises: [] }),
          initiatorId: user?.id.toString() || '',
          isCreatingLobby: 'false', // Lobby already created, just joining
        },
      });
    } catch (error: any) {
      console.error('❌ Error creating lobby:', error);
      alert.error('Error', error.message || 'Failed to create lobby. Please try again.');
    } finally {
      setIsGeneratingWorkout(false);
    }
  };

  const handleReturnToLobby = () => {
    if (!activeLobbySession) return;

    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: activeLobbySession,
        groupId: id as string,
        workoutData: '',
        initiatorId: user?.id.toString() || '',
        isCreatingLobby: 'false',
      },
    });
  };

  const handleStartGroupWorkout = (workout?: any, sessionId?: string) => {
    const workoutToUse = workout || groupWorkout;
    if (!workoutToUse || !user) return;

    // Close modals
    setShowGroupWorkoutModal(false);

    // Navigate to group workout lobby
    router.push({
      pathname: '/workout/group-lobby',
      params: {
        sessionId: sessionId || '',
        groupId: id as string,
        workoutData: JSON.stringify(workoutToUse),
        initiatorId: user.id.toString(),
      },
    });
  };


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading group...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.SECONDARY[400]} />
          <Text style={styles.errorTitle}>Group Not Found</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => goBack()}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Details</Text>
        {userRole ? (
          <TouchableOpacity onPress={handleManageGroup} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={COLORS.SECONDARY[700]} />
            {(userRole === 'owner' || userRole === 'moderator') && pendingRequestsCount > 0 && (
              <View style={styles.settingsGearBadge}>
                <Text style={styles.settingsGearBadgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Info Card */}
        <View style={styles.groupInfoCard}>
          <View
            style={[styles.groupAvatarLarge, { backgroundColor: COLORS.PRIMARY[600] }]}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="large" color="white" />
            ) : group.groupImage ? (
              <Image
                source={{ uri: mediaService.getFullMediaUrl(group.groupImage) }}
                style={{ width: '100%', height: '100%', borderRadius: 50 }}
              />
            ) : (
              <Ionicons name="people" size={48} color="white" />
            )}
          </View>

          <Text style={styles.groupNameLarge}>{group.name}</Text>

          <View style={styles.groupMetaRow}>
            <View style={styles.groupMetaItem}>
              <Ionicons name="people-outline" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.groupMetaText}>
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <View style={styles.groupMetaDivider} />
            <View style={styles.groupMetaItem}>
              <Ionicons
                name={group.type === 'public' ? 'globe' : group.type === 'private' ? 'lock-closed' : 'mail'}
                size={20}
                color={COLORS.PRIMARY[600]}
              />
              <Text style={styles.groupMetaText}>{group.type}</Text>
            </View>
          </View>

          {group.description && (
            <Text style={styles.groupDescriptionLarge}>{group.description}</Text>
          )}

          {/* Active Lobby Indicator - Shows when user is in a lobby */}
          {activeLobbySession && (
            <TouchableOpacity
              style={styles.activeLobbyBanner}
              onPress={handleReturnToLobby}
              activeOpacity={0.8}
            >
              <View style={styles.activeLobbyIcon}>
                <Ionicons name="people" size={20} color="white" />
              </View>
              <View style={styles.activeLobbyContent}>
                <Text style={styles.activeLobbyTitle}>Active Lobby</Text>
                <Text style={styles.activeLobbySubtitle}>Tap to return to your workout lobby</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.SUCCESS[600]} />
            </TouchableOpacity>
          )}

          {/* Create Lobby Button - Disabled if already in lobby */}
          <TouchableOpacity
            style={[
              styles.startWorkoutButton,
              (isGeneratingWorkout || activeLobbySession) && styles.startWorkoutButtonDisabled
            ]}
            onPress={handleGenerateGroupWorkout}
            disabled={isGeneratingWorkout || !!activeLobbySession}
            activeOpacity={0.8}
          >
            {isGeneratingWorkout ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.startWorkoutButtonText}>Creating Lobby...</Text>
              </>
            ) : activeLobbySession ? (
              <>
                <Ionicons name="checkmark-circle" size={24} color="white" />
                <Text style={styles.startWorkoutButtonText}>Already in Lobby</Text>
              </>
            ) : (
              <>
                <Ionicons name="people" size={24} color="white" />
                <Text style={styles.startWorkoutButtonText}>Create Lobby</Text>
              </>
            )}
          </TouchableOpacity>

        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>

          <View style={styles.membersList}>
            {members.map((member) => {
              const isOnline = onlineUsers.has(member.userId);
              console.log(`🔍 Checking member ${member.username}:`, {
                userId: member.userId,
                isOnline,
                globalOnlineUsers: Array.from(onlineUsers)
              });
              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedMember(member);
                    setShowMemberPreview(true);
                  }}
                >
                  <View style={styles.memberAvatarContainer}>
                    <Avatar profilePicture={member.profilePicture} size="sm" />
                    {isOnline && (
                      <View style={styles.onlineIndicator} />
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{member.username}</Text>
                      {isOnline && (
                        <Text style={styles.onlineText}>Online</Text>
                      )}
                    </View>
                    <Text style={styles.memberJoinDate}>
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.badgesContainer}>
                    {/* Mentor badge */}
                    {member.userRole === 'mentor' && (
                      <View style={styles.mentorBadge}>
                        <Ionicons name="school" size={12} color="#FFFFFF" />
                        <Text style={styles.mentorBadgeText}>Mentor</Text>
                      </View>
                    )}
                    {/* Group role badge */}
                    <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
                      <Text style={[styles.roleBadgeText, getRoleBadgeTextStyle(member.role)]}>
                        {member.role}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stats Section */}
        {group.stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="fitness" size={32} color={COLORS.PRIMARY[600]} />
                <Text style={styles.statNumber}>{group.stats.totalWorkouts || 0}</Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="time" size={32} color="#10B981" />
                <Text style={styles.statNumber}>{group.stats.totalMinutes || 0}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="calendar" size={32} color="#8B5CF6" />
                <Text style={styles.statNumber}>{group.stats.averageWeeklyActivity || 0}</Text>
                <Text style={styles.statLabel}>Weekly Avg</Text>
              </View>
            </View>
          </View>
        )}

        {/* Categories/Tags */}
        {group.tags && group.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {group.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Group Workout Modal */}
      <GroupWorkoutModal
        visible={showGroupWorkoutModal}
        onClose={() => setShowGroupWorkoutModal(false)}
        groupWorkout={groupWorkout}
        onStartWorkout={handleStartGroupWorkout}
        groupName={group.name}
      />

      {/* Join Requests Modal */}
      <JoinRequestsModal
        visible={showJoinRequestsModal}
        onClose={() => setShowJoinRequestsModal(false)}
        groupId={id as string}
        groupName={group.name}
        onRequestHandled={() => {
          loadPendingRequestsCount();
          loadGroupDetails();
        }}
      />

      {/* Invite by Username Modal */}
      <Modal
        visible={showInviteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.inviteModalContent, { opacity: inviteModalFade, transform: [{ scale: inviteModalScale }] }]}>
            <View style={styles.inviteModalHeader}>
              <Text style={styles.inviteModalTitle}>Invite by Username</Text>
              <TouchableOpacity onPress={() => {
                setShowInviteModal(false);
                setUsernameInput('');
              }}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteModalBody}>
              <Text style={styles.inviteModalLabel}>Enter username</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="username"
                placeholderTextColor={COLORS.SECONDARY[400]}
                value={usernameInput}
                onChangeText={setUsernameInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[
                  styles.inviteButton,
                  (!usernameInput.trim() || isInviting) && styles.inviteButtonDisabled,
                ]}
                onPress={handleInviteByUsername}
                disabled={!usernameInput.trim() || isInviting}
              >
                {isInviting ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={styles.inviteButtonText}>Inviting...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={COLORS.NEUTRAL.WHITE} />
                    <Text style={styles.inviteButtonText}>Send Invite</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Group Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.settingsModalContent, { opacity: settingsModalFade, transform: [{ scale: settingsModalScale }] }]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Group Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsModalBody} showsVerticalScrollIndicator={false}>
              {/* Share & Code Section — visible to all members */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Share</Text>

                <TouchableOpacity style={styles.settingsOption} onPress={handleShareCode}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="share-social-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Share Group Code</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={handleCopyCode}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="key-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <View>
                      <Text style={styles.settingsOptionText}>Copy Group Code</Text>
                      <Text style={styles.settingsOptionSubtext}>{group?.groupCode || 'N/A'}</Text>
                    </View>
                  </View>
                  <Ionicons name="copy-outline" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>
              </View>

              {/* Group Info Section — owner/moderator only */}
              {(userRole === 'owner' || userRole === 'moderator') && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Group Information</Text>

                <TouchableOpacity style={styles.settingsOption} onPress={() => {
                  setShowSettingsModal(false);
                  setTimeout(() => {
                    shouldReopenSettings.current = true;
                    setShowImagePickerModal(true);
                  }, 300);
                }}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="camera-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Change Group Image</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={handleEditGroupName}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="create-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Edit Group Name</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={handleEditDescription}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="document-text-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Edit Description</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={handleTogglePrivacy}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name={group?.type === 'public' ? 'globe' : 'lock-closed'} size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Privacy: {group?.type === 'public' ? 'Public' : 'Private'}</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>
              </View>
              )}

              {/* Member Management Section — owner/moderator only */}
              {(userRole === 'owner' || userRole === 'moderator') && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Member Management</Text>

                <TouchableOpacity style={styles.settingsOption} onPress={() => {
                  setShowSettingsModal(false);
                  setShowInviteModal(true);
                  shouldReopenSettings.current = true;
                }}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="person-add-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.settingsOptionText}>Invite Members</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={() => {
                  setShowSettingsModal(false);
                  setShowJoinRequestsModal(true);
                  shouldReopenSettings.current = true;
                }}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="people-outline" size={22} color={COLORS.PRIMARY[600]} />
                    <View style={styles.settingsOptionWithBadge}>
                      <Text style={styles.settingsOptionText}>Join Requests</Text>
                      {pendingRequestsCount > 0 && (
                        <View style={styles.settingsBadge}>
                          <Text style={styles.settingsBadgeText}>{pendingRequestsCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsOption} onPress={() => {
                  setShowSettingsModal(false);
                  setShowRemoveMembersModal(true);
                  shouldReopenSettings.current = true;
                }}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="remove-circle-outline" size={22} color={COLORS.ERROR[500]} />
                    <Text style={[styles.settingsOptionText, { color: COLORS.ERROR[500] }]}>Remove Members</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                </TouchableOpacity>
              </View>
              )}

              {/* Danger Zone — role-based */}
              <View style={[styles.settingsSection, styles.dangerSection]}>
                <Text style={[styles.settingsSectionTitle, { color: COLORS.ERROR[500] }]}>Danger Zone</Text>

                {userRole === 'owner' && (
                <TouchableOpacity style={styles.settingsOption} onPress={handleDeleteGroup}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="trash-outline" size={22} color={COLORS.ERROR[500]} />
                    <Text style={[styles.settingsOptionText, { color: COLORS.ERROR[500] }]}>Delete Group</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.ERROR[500]} />
                </TouchableOpacity>
                )}

                {userRole && userRole !== 'owner' && (
                <TouchableOpacity style={styles.settingsOption} onPress={handleLeaveGroup}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="exit-outline" size={22} color={COLORS.ERROR[500]} />
                    <Text style={[styles.settingsOptionText, { color: COLORS.ERROR[500] }]}>Leave Group</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.ERROR[500]} />
                </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.settingsModalContent, { opacity: imagePickerModalFade, transform: [{ scale: imagePickerModalScale }] }]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Group Image</Text>
              <TouchableOpacity onPress={() => setShowImagePickerModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity style={styles.settingsOption} onPress={() => {
                setShowImagePickerModal(false);
                pickGroupImage('camera');
              }}>
                <View style={styles.settingsOptionLeft}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.settingsOptionText}>Take Photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsOption} onPress={() => {
                setShowImagePickerModal(false);
                pickGroupImage('gallery');
              }}>
                <View style={styles.settingsOptionLeft}>
                  <Ionicons name="images-outline" size={22} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.settingsOptionText}>Choose from Gallery</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>

              {group?.groupImage && (
                <TouchableOpacity style={styles.settingsOption} onPress={() => {
                  setShowImagePickerModal(false);
                  handleRemoveGroupImage();
                }}>
                  <View style={styles.settingsOptionLeft}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    <Text style={[styles.settingsOptionText, { color: '#EF4444' }]}>Remove Image</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Edit Group Name Modal */}
      <Modal
        visible={showEditNameModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Group Name</Text>
              <TouchableOpacity onPress={() => setShowEditNameModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editInput}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Enter group name"
              placeholderTextColor={COLORS.SECONDARY[400]}
              maxLength={100}
              autoFocus
            />
            <Text style={styles.charCount}>{editNameValue.length}/100</Text>
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditNameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!editNameValue.trim() || isUpdating) && styles.saveButtonDisabled]}
                onPress={handleSaveGroupName}
                disabled={!editNameValue.trim() || isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Description Modal */}
      <Modal
        visible={showEditDescModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEditDescModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Description</Text>
              <TouchableOpacity onPress={() => setShowEditDescModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              value={editDescValue}
              onChangeText={setEditDescValue}
              placeholder="Enter group description (optional)"
              placeholderTextColor={COLORS.SECONDARY[400]}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <Text style={styles.charCount}>{editDescValue.length}/500</Text>
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditDescModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                onPress={handleSaveDescription}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Profile Preview Modal */}
      <UserProfilePreviewModal
        visible={showMemberPreview}
        onClose={() => {
          setShowMemberPreview(false);
          setSelectedMember(null);
        }}
        user={selectedMember ? {
          userId: selectedMember.userId,
          username: selectedMember.username,
          userRole: selectedMember.userRole,
          groupRole: selectedMember.role,
          joinedAt: selectedMember.joinedAt,
          isOnline: onlineUsers.has(selectedMember.userId),
          profilePicture: selectedMember.profilePicture,
        } : null}
        context="group"
      />

      {/* Remove Members Modal */}
      {isRemoveMembersVisible && (
        <Modal transparent visible statusBarTranslucent onRequestClose={() => setShowRemoveMembersModal(false)}>
          <View style={styles.removeMembersOverlay}>
            <Animated.View style={[styles.removeMembersBackdrop, { opacity: removeMembersOverlayAnim }]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowRemoveMembersModal(false)} />
            </Animated.View>
            <Animated.View style={[styles.removeMembersContainer, { transform: [{ translateY: removeMembersSlideAnim }] }]}>
              <View style={styles.removeMembersHeader}>
                <Text style={styles.removeMembersTitle}>Remove Members</Text>
                <TouchableOpacity onPress={() => setShowRemoveMembersModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.SECONDARY[600]} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.removeMembersList}>
                {members.filter(m => m.userId !== user?.id && m.role !== 'owner').length === 0 ? (
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={48} color={COLORS.SECONDARY[300]} />
                    <Text style={{ color: COLORS.SECONDARY[500], marginTop: 12, fontSize: 14 }}>No removable members</Text>
                  </View>
                ) : (
                  members.filter(m => m.userId !== user?.id && m.role !== 'owner').map((member) => (
                    <View key={member.userId} style={styles.removeMemberRow}>
                      <Avatar
                        size="sm"
                        profilePicture={member.profilePicture}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 15, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] }}>{member.username}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.SECONDARY[500] }}>{member.role}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => {
                          setShowRemoveMembersModal(false);
                          handleKickMember(member);
                        }}
                      >
                        <Ionicons name="person-remove" size={16} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontSize: 13, fontFamily: FONTS.SEMIBOLD, marginLeft: 4 }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'owner':
      return { backgroundColor: COLORS.PRIMARY[600] };
    case 'moderator':
      return { backgroundColor: '#10B981' };
    default:
      return { backgroundColor: COLORS.SECONDARY[300] };
  }
};

const getRoleBadgeTextStyle = (role: string) => {
  switch (role) {
    case 'owner':
    case 'moderator':
      return { color: 'white' };
    default:
      return { color: COLORS.SECONDARY[700] };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
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
  settingsButton: {
    padding: 8,
    position: 'relative',
  },
  settingsGearBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.ERROR[500],
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  settingsGearBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  groupInfoCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  groupAvatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.SECONDARY[700],
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  groupNameLarge: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 12,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupMetaDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.SECONDARY[300],
    marginHorizontal: 16,
  },
  groupMetaText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textTransform: 'capitalize',
  },
  groupDescriptionLarge: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  startWorkoutButton: {
    backgroundColor: COLORS.PRIMARY[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 10,
    width: '100%',
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startWorkoutButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[400],
    shadowColor: COLORS.SECONDARY[400],
  },
  startWorkoutButtonText: {
    fontSize: 17,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY[100],
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  pendingRequestsButton: {
    flex: 1,
    position: 'relative',
  },
  pendingBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.ERROR[500],
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 16,
  },
  sectionCount: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  codeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  codeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  codeContent: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginBottom: 4,
  },
  codeText: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  codeActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  memberAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: 'white',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  memberName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    flexShrink: 1,
  },
  onlineText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: '#10B981',
  },
  memberJoinDate: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[600],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  mentorBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.SEMIBOLD,
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[300],
  },
  tagText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[700],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteModalContent: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteModalTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  inviteModalBody: {
    gap: 16,
  },
  inviteModalLabel: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  usernameInput: {
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
    padding: 16,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  inviteButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY[600],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
  },
  inviteButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  kickButton: {
    padding: 8,
    marginLeft: 8,
  },
  settingsModalContent: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsModalTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  settingsModalBody: {
    maxHeight: 500,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 12,
    marginBottom: 8,
  },
  settingsOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsOptionText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  settingsOptionSubtext: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 2,
  },
  settingsOptionWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsBadge: {
    backgroundColor: COLORS.ERROR[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  settingsBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: '#FFFFFF',
  },
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
    paddingTop: 16,
  },
  // Edit Modal Styles
  editModalContent: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  editInput: {
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[300],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    backgroundColor: COLORS.SECONDARY[50],
  },
  editTextArea: {
    height: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SECONDARY[100],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
  },
  saveButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  noMembersText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    paddingVertical: 20,
  },
  activeLobbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[50],
    borderColor: COLORS.SUCCESS[300],
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    width: '100%',
  },
  activeLobbyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SUCCESS[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeLobbyContent: {
    flex: 1,
  },
  activeLobbyTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SUCCESS[700],
  },
  activeLobbySubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SUCCESS[600],
    marginTop: 2,
  },
  removeMembersOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  removeMembersBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  removeMembersContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  removeMembersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  removeMembersTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  removeMembersList: {
    paddingHorizontal: 20,
  },
  removeMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  removeMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
});
