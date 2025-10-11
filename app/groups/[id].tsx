import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { socialService, Group, GroupMember } from '../../services/microservices/socialService';
import { useMLService } from '../../services/microservices/mlService';
import { GroupWorkoutModal } from '../../components/groups/GroupWorkoutModal';
import { useSmartBack } from '../../hooks/useSmartBack';
import reverbService from '../../services/reverbService';

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { goBack } = useSmartBack();
  const { getGroupWorkoutRecommendations } = useMLService();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'moderator' | 'member' | null>(null);
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(new Set());

  // Group workout states
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [showGroupWorkoutModal, setShowGroupWorkoutModal] = useState(false);
  const [groupWorkout, setGroupWorkout] = useState<any>(null);

  useEffect(() => {
    loadGroupDetails();
  }, [id]);

  // Listen to presence channel events for real-time online status
  // Note: The global subscription is already done in ReverbProvider
  // We just need to listen for the events and update local state
  useEffect(() => {
    if (!id) return;

    console.log(`🟢 Setting up presence listeners for group ${id}`);

    // Get the existing presence channel (already subscribed globally)
    const channelName = `presence-group.${id}`;
    const pusher = (reverbService as any).pusher;
    const channel = pusher?.channel(channelName);

    if (!channel) {
      console.warn(`⚠️ Presence channel not found for group ${id}`);
      return;
    }

    console.log(`✅ Found presence channel for group ${id}`, {
      channelName,
      subscriptionState: channel.subscriptionState,
      hasMembers: !!channel.members
    });

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
      console.log('👤 Member came online - FULL OBJECT:', JSON.stringify(member, null, 2));
      console.log('👤 Member structure:', {
        id: member.id,
        user_id: member.user_id,
        info: member.info,
        keys: Object.keys(member)
      });

      // Pusher presence channels use member.id as the user identifier
      const userId = member.id?.toString();
      if (userId) {
        console.log('✅ Adding online member with userId:', userId);
        setOnlineMemberIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(userId);
          console.log('📊 Online members after add:', Array.from(newSet));
          return newSet;
        });
      }
    };

    const handleMemberRemoved = (member: any) => {
      console.log('👋 Member went offline - FULL OBJECT:', JSON.stringify(member, null, 2));
      const userId = member.id?.toString();
      if (userId) {
        console.log('❌ Removing offline member with userId:', userId);
        setOnlineMemberIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          console.log('📊 Online members after remove:', Array.from(newSet));
          return newSet;
        });
      }
    };

    const handleSubscriptionSucceeded = (members: any) => {
      console.log('👥 Subscription succeeded event - FULL OBJECT:', JSON.stringify(members, null, 2));
      console.log('👥 Members structure:', {
        members: members.members,
        count: members.count,
        keys: Object.keys(members)
      });

      // Extract user IDs from presence members
      const memberIds = Object.keys(members.members || {});
      console.log('✅ Initial online user IDs:', memberIds);
      setOnlineMemberIds(new Set(memberIds));
    };

    channel.bind('pusher:member_added', handleMemberAdded);
    channel.bind('pusher:member_removed', handleMemberRemoved);
    channel.bind('pusher:subscription_succeeded', handleSubscriptionSucceeded);

    // Cleanup: unbind events when component unmounts (but don't unsubscribe)
    return () => {
      console.log(`🔴 Removing presence listeners for group ${id}`);
      channel.unbind('pusher:member_added', handleMemberAdded);
      channel.unbind('pusher:member_removed', handleMemberRemoved);
      channel.unbind('pusher:subscription_succeeded', handleSubscriptionSucceeded);
    };
  }, [id]);

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
      setMembers(membersData.members || []);

      // Determine user's role
      const userMember = membersData.members?.find((m: GroupMember) => m.userId === user?.id);
      setUserRole(userMember?.role || null);
    } catch (error) {
      console.error('Error loading group details:', error);
      Alert.alert('Error', 'Failed to load group details.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroupDetails();
    setRefreshing(false);
  };

  const handleCopyCode = () => {
    if (!group?.groupCode) {
      Alert.alert('Error', 'No group code available');
      return;
    }

    try {
      Clipboard.setString(group.groupCode);
      Alert.alert('Copied!', 'Group code copied to clipboard');
    } catch (error) {
      console.error('Error copying group code:', error);
      Alert.alert('Error', 'Failed to copy group code');
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
    if (!group) return;

    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialService.leaveGroup(group.id);
              Alert.alert('Success', 'You have left the group.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/groups') }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    if (!group) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to permanently delete "${group.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialService.deleteGroup(group.id);
              Alert.alert('Success', 'Group deleted successfully.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/groups') }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete group.');
            }
          },
        },
      ]
    );
  };

  const handleManageGroup = () => {
    Alert.alert('Coming Soon', 'Group management features will be available soon!');
  };

  const handleGenerateGroupWorkout = async () => {
    if (!group || !members || members.length === 0) {
      Alert.alert('No Members', 'Cannot create lobby for an empty group. Please add members first.');
      return;
    }

    try {
      setIsGeneratingWorkout(true);
      console.log('🚪 Creating workout lobby for', members.length, 'members...');

      // Create a workout session immediately with minimal workout data
      // This allows WebSocket to work from the start
      // Exercises will be generated later when user clicks "Generate Exercises"
      console.log('📡 Creating workout session on backend...');
      const sessionResponse = await socialService.initiateGroupWorkout(
        id as string,
        {
          workout_format: 'tabata',
          exercises: [], // Empty exercises initially - will be populated when user generates them
        }
      );

      console.log('✅ Workout session created:', sessionResponse);

      // Navigate to lobby with the session ID
      // The lobby will show online members and have a "Generate Exercises" button
      router.push({
        pathname: '/workout/group-lobby',
        params: {
          sessionId: sessionResponse.session_id,
          groupId: id as string,
          workoutData: '', // Empty - exercises will be generated in lobby
          initiatorId: user?.id.toString() || '',
          isCreatingLobby: 'true', // Flag to indicate we're just creating lobby
        },
      });
    } catch (error: any) {
      console.error('❌ Error creating lobby:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create lobby. Please try again.'
      );
    } finally {
      setIsGeneratingWorkout(false);
    }
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
        {(userRole === 'owner' || userRole === 'moderator') && (
          <TouchableOpacity onPress={handleManageGroup} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={COLORS.SECONDARY[700]} />
          </TouchableOpacity>
        )}
        {!userRole && <View style={styles.placeholder} />}
        {userRole === 'member' && <View style={styles.placeholder} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Info Card */}
        <View style={styles.groupInfoCard}>
          <View style={[styles.groupAvatarLarge, { backgroundColor: COLORS.PRIMARY[600] }]}>
            <Ionicons name="people" size={48} color="white" />
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

          {/* Create Lobby Button */}
          <TouchableOpacity
            style={styles.startWorkoutButton}
            onPress={handleGenerateGroupWorkout}
            disabled={isGeneratingWorkout}
            activeOpacity={0.8}
          >
            {isGeneratingWorkout ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.startWorkoutButtonText}>Creating Lobby...</Text>
              </>
            ) : (
              <>
                <Ionicons name="people" size={24} color="white" />
                <Text style={styles.startWorkoutButtonText}>Create Lobby</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShareCode}>
              <Ionicons name="share-social" size={20} color={COLORS.PRIMARY[600]} />
              <Text style={styles.actionButtonText}>Share Code</Text>
            </TouchableOpacity>

            {userRole === 'owner' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={handleDeleteGroup}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete Group</Text>
              </TouchableOpacity>
            )}

            {userRole && userRole !== 'owner' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={handleLeaveGroup}
              >
                <Ionicons name="exit-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Leave Group</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Group Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Code</Text>
          <TouchableOpacity style={styles.codeCard} onPress={handleCopyCode} activeOpacity={0.7}>
            <View style={styles.codeIconContainer}>
              <Ionicons name="key" size={24} color={COLORS.PRIMARY[600]} />
            </View>
            <View style={styles.codeContent}>
              <Text style={styles.codeLabel}>Tap to copy code</Text>
              <Text style={styles.codeText}>{group.groupCode || 'N/A'}</Text>
            </View>
            <Ionicons name="copy-outline" size={24} color={COLORS.PRIMARY[600]} />
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
              const isOnline = onlineMemberIds.has(member.userId);
              console.log(`🔍 Checking member ${member.username}:`, {
                userId: member.userId,
                isOnline,
                onlineMemberIds: Array.from(onlineMemberIds)
              });
              return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberAvatarContainer}>
                    <View style={styles.memberAvatar}>
                      <Ionicons name="person" size={24} color="white" />
                    </View>
                    {isOnline && (
                      <View style={styles.onlineIndicator} />
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.username}</Text>
                      {isOnline && (
                        <Text style={styles.onlineText}>Online</Text>
                      )}
                    </View>
                    <Text style={styles.memberJoinDate}>
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
                    <Text style={[styles.roleBadgeText, getRoleBadgeTextStyle(member.role)]}>
                      {member.role}
                    </Text>
                  </View>
                </View>
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
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
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
});
