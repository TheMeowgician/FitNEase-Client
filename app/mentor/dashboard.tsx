import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { socialService, Group, GroupMember } from '../../services/microservices/socialService';
import { trackingService } from '../../services/microservices/trackingService';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CreateGroupModal } from '../../components/groups/CreateGroupModal';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface TrainingGroup extends Group {
  members: GroupMember[];
  loadingMembers: boolean;
  totalSessions: number;
}

export default function MentorDashboardScreen() {
  const { user } = useAuth();
  const alert = useAlert();
  const [trainingGroups, setTrainingGroups] = useState<TrainingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadTrainingGroups();
    }, [])
  );

  const loadTrainingGroups = async () => {
    try {
      setIsLoading(true);
      console.log('🎓 [MENTOR] Loading training groups for mentor:', user?.id);

      // Fetch groups where the current mentor is the owner
      const response = await socialService.getGroups({
        user_id: user?.id ? Number(user.id) : undefined,
      });

      console.log('🎓 [MENTOR] Groups response:', response);

      // Filter to only groups owned by this mentor (safe type comparison)
      const mentorGroups = response.groups.filter(
        (group) => String(group.createdBy) === String(user?.id)
      );

      console.log('🎓 [MENTOR] Filtered mentor groups:', mentorGroups.length);

      // Initialize groups with empty members and loading state
      const groupsWithMembers: TrainingGroup[] = mentorGroups.map((group) => ({
        ...group,
        members: [],
        loadingMembers: true,
        totalSessions: 0,
      }));

      setTrainingGroups(groupsWithMembers);

      // Load members for all groups in parallel
      const memberResults = await Promise.allSettled(
        mentorGroups.map((group) => socialService.getGroupMembers(group.id))
      );

      // Collect all members per group
      const groupMembers: GroupMember[][] = memberResults.map((result) =>
        result.status === 'fulfilled' ? result.value.members : []
      );

      // Update all groups with their member results at once
      setTrainingGroups((prev) =>
        prev.map((g, index) => {
          const result = memberResults[index];
          if (result?.status === 'fulfilled') {
            console.log(`🎓 [MENTOR] Members for group ${g.name}:`, result.value.members.length);
            return { ...g, members: result.value.members, loadingMembers: false };
          } else {
            console.error(`Error loading members for group ${g.id}:`, result?.status === 'rejected' ? result.reason : 'unknown');
            return { ...g, loadingMembers: false };
          }
        })
      );

      // Fetch session stats for all unique members across all groups (for total sessions count)
      const allMemberIds = new Set<string>();
      groupMembers.forEach((members) => {
        members.forEach((m) => {
          if (m.userId) allMemberIds.add(String(m.userId));
        });
      });

      if (allMemberIds.size > 0) {
        const statsResults = await Promise.allSettled(
          Array.from(allMemberIds).map((uid) => trackingService.getMemberSessionStats(uid))
        );

        // Build userId -> completedSessions map
        const memberStatsMap = new Map<string, number>();
        const memberIdArr = Array.from(allMemberIds);
        statsResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            memberStatsMap.set(memberIdArr[idx], result.value.completedSessions || 0);
          }
        });

        // Sum sessions per group
        setTrainingGroups((prev) =>
          prev.map((g, index) => {
            const members = groupMembers[index] || [];
            const groupTotalSessions = members.reduce(
              (sum, m) => sum + (memberStatsMap.get(String(m.userId)) || 0),
              0
            );
            return { ...g, totalSessions: groupTotalSessions };
          })
        );
      }
    } catch (error) {
      console.error('Error loading training groups:', error);
      alert.error('Error', 'Failed to load training groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrainingGroups();
    setRefreshing(false);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const navigateToMemberDetail = (member: GroupMember, group: TrainingGroup) => {
    // Navigate to member detail view
    console.log('View member:', member.userId, 'from group:', group.name);
    router.push({
      pathname: '/mentor/member/[id]',
      params: {
        id: member.userId,
        username: member.username,
        groupId: group.id,
        groupName: group.name,
      },
    });
  };

  const handleCreateTrainingGroup = () => {
    setShowCreateModal(true);
  };

  const handleGroupCreated = () => {
    loadTrainingGroups();
  };

  const handleStartWorkoutSession = (group: TrainingGroup) => {
    // Navigate to group detail to start workout session
    router.push(`/groups/${group.id}`);
  };

  const renderMemberCard = (member: GroupMember, index: number, group: TrainingGroup) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberCard}
      onPress={() => navigateToMemberDetail(member, group)}
      activeOpacity={0.7}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {member.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.username}</Text>
        <Text style={styles.memberRole}>
          {member.role === 'owner' ? 'Group Owner' : member.role}
        </Text>
      </View>
      <View style={styles.memberStatus}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: member.status === 'active' ? COLORS.SUCCESS[500] : COLORS.SECONDARY[400] },
          ]}
        />
      </View>
    </TouchableOpacity>
  );

  const renderGroupCard = (group: TrainingGroup) => {
    const isExpanded = expandedGroups.has(group.id);
    const memberCount = group.members.length;

    return (
      <View key={group.id} style={styles.groupCard}>
        {/* Group Header */}
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpanded(group.id)}
          activeOpacity={0.7}
        >
          <View style={styles.groupIcon}>
            <Ionicons name="people" size={24} color={COLORS.PRIMARY[600]} />
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {memberCount} member{memberCount !== 1 ? 's' : ''}
              {group.groupCode ? ` • Code: ${group.groupCode}` : ''}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={COLORS.SECONDARY[400]}
          />
        </TouchableOpacity>

        {/* Group Actions */}
        <View style={styles.groupActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStartWorkoutSession(group)}
          >
            <Ionicons name="fitness" size={18} color={COLORS.PRIMARY[600]} />
            <Text style={styles.actionButtonText}>Start Session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => router.push(`/groups/${group.id}`)}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.SECONDARY[600]} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Manage
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expanded Member List */}
        {isExpanded && (
          <View style={styles.membersSection}>
            <Text style={styles.membersSectionTitle}>Group Members</Text>
            {group.loadingMembers ? (
              <View style={styles.loadingMembers}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : memberCount === 0 ? (
              <View style={styles.noMembers}>
                <Ionicons name="person-add-outline" size={32} color={COLORS.SECONDARY[300]} />
                <Text style={styles.noMembersText}>No members yet</Text>
                <Text style={styles.noMembersSubtext}>
                  Share the group code to invite members
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {group.members.map((member, index) => renderMemberCard(member, index, group))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingSpinner message="Loading your training groups..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.backButton}>
              <Ionicons name="home-outline" size={24} color={COLORS.SECONDARY[900]} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Mentor Dashboard</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleCreateTrainingGroup} style={styles.addButton}>
              <Ionicons name="add" size={24} color={COLORS.PRIMARY[600]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="school" size={40} color={COLORS.SUCCESS[600]} />
          </View>
          <Text style={styles.welcomeTitle}>
            Welcome, {user?.firstName || 'Mentor'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Manage your training groups and track member progress
          </Text>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={COLORS.PRIMARY[600]} />
            <Text style={styles.statValue}>{trainingGroups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="person" size={24} color={COLORS.SUCCESS[600]} />
            <Text style={styles.statValue}>
              {trainingGroups.reduce((sum, g) => sum + g.members.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="fitness" size={24} color={COLORS.WARNING[500]} />
            <Text style={styles.statValue}>
              {trainingGroups.reduce((sum, g) => sum + (g.totalSessions || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {/* Training Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Training Groups</Text>
            <Text style={styles.groupCount}>{trainingGroups.length}</Text>
          </View>

          {trainingGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={COLORS.SECONDARY[300]} />
              <Text style={styles.emptyTitle}>No Training Groups Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a training group to start supervising members
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateTrainingGroup}
              >
                <Ionicons name="add" size={20} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.createButtonText}>Create Training Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {trainingGroups.map(renderGroupCard)}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/groups')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.PRIMARY[50] }]}>
                <Ionicons name="search" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <Text style={styles.quickActionText}>Browse Groups</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.SUCCESS[50] }]}>
                <Ionicons name="person-outline" size={24} color={COLORS.SUCCESS[600]} />
              </View>
              <Text style={styles.quickActionText}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.WARNING[50] }]}>
                <Ionicons name="fitness" size={24} color={COLORS.WARNING[600]} />
              </View>
              <Text style={styles.quickActionText}>My Workouts</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Bottom Navigation Hint */}
        <View style={styles.bottomHint}>
          <Text style={styles.bottomHintText}>
            Tap on a group to expand and see members
          </Text>
        </View>
      </ScrollView>

      {/* Create Group Modal - reusing existing component */}
      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleGroupCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for safe area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  headerLeft: {
    width: 44,
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    marginBottom: 16,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.SUCCESS[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 8,
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  groupCount: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  groupMeta: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  groupActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.NEUTRAL[100],
  },
  actionButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  actionButtonTextSecondary: {
    color: COLORS.SECONDARY[600],
  },
  membersSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
    padding: 16,
  },
  membersSectionTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginBottom: 12,
  },
  loadingMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  noMembers: {
    alignItems: 'center',
    padding: 24,
  },
  noMembersText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginTop: 8,
  },
  noMembersSubtext: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 4,
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 8,
    padding: 12,
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
  memberAvatarText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  memberRole: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  memberStatus: {
    padding: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  createButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    textAlign: 'center',
  },
  bottomHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bottomHintText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
