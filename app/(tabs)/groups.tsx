import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { socialService, Group } from '../../services/microservices/socialService';
import { CreateGroupModal } from '../../components/groups/CreateGroupModal';

export default function GroupsScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Join by code
  const [groupCode, setGroupCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setIsLoading(true);

      if (!user?.id) {
        console.warn('No user ID available');
        setIsLoading(false);
        return;
      }

      console.log('🔄 Loading groups for user:', user.id);

      // Load user's groups and discover public groups
      const [myGroupsData, publicGroupsData] = await Promise.all([
        socialService.getGroups({ user_id: parseInt(user.id) }), // Get groups where user is a member
        socialService.getGroups({ limit: 10 }), // Get public groups to discover
      ]);

      console.log('✅ My Groups loaded:', myGroupsData.groups.length, 'groups');
      console.log('✅ Public Groups loaded:', publicGroupsData.groups.length, 'groups');

      if (myGroupsData.groups.length > 0) {
        console.log('First group:', myGroupsData.groups[0]);
      }

      setMyGroups(myGroupsData.groups || []);
      setPublicGroups(publicGroupsData.groups || []);
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      Alert.alert('Error', 'Failed to load groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const handleJoinByCode = async () => {
    if (!groupCode.trim()) {
      Alert.alert('Invalid Code', 'Please enter a group code.');
      return;
    }

    setIsJoining(true);
    try {
      // Call join with code endpoint
      await socialService.joinGroup({ groupId: groupCode }); // Using groupId as code
      Alert.alert('Success', 'You have joined the group!', [
        { text: 'OK', onPress: () => {
          setShowJoinModal(false);
          setGroupCode('');
          loadGroups();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group. Please check the code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinGroup = async (group: Group) => {
    try {
      await socialService.joinGroup({ groupId: group.id });
      Alert.alert('Success', `You have joined ${group.name}!`);
      loadGroups();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group.');
    }
  };

  const handleViewGroup = (group: Group) => {
    router.push(`/groups/${group.id}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity onPress={handleCreateGroup} style={styles.createButton}>
          <Ionicons name="add-circle" size={28} color={COLORS.PRIMARY[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setShowJoinModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: COLORS.PRIMARY[100] }]}>
              <Ionicons name="key" size={24} color={COLORS.PRIMARY[600]} />
            </View>
            <Text style={styles.quickActionTitle}>Join by Code</Text>
            <Text style={styles.quickActionSubtitle}>Have an invite code?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleCreateGroup}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="people" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickActionTitle}>Create Group</Text>
            <Text style={styles.quickActionSubtitle}>Start your own</Text>
          </TouchableOpacity>
        </View>

        {/* My Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Groups</Text>
            <Text style={styles.sectionCount}>{myGroups.length}</Text>
          </View>

          {myGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={COLORS.SECONDARY[300]} />
              <Text style={styles.emptyStateTitle}>No Groups Yet</Text>
              <Text style={styles.emptyStateText}>
                Join or create a group to start working out together!
              </Text>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {myGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.groupCard}
                  onPress={() => handleViewGroup(group)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupCardHeader}>
                    <View style={[styles.groupAvatar, { backgroundColor: COLORS.PRIMARY[600] }]}>
                      <Ionicons name="people" size={28} color="white" />
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupMembers}>
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
                  </View>
                  {group.description && (
                    <Text style={styles.groupDescription} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <View style={styles.groupFooter}>
                    <View style={styles.groupTag}>
                      <Ionicons
                        name={group.type === 'public' ? 'globe' : group.type === 'private' ? 'lock-closed' : 'mail'}
                        size={14}
                        color={COLORS.PRIMARY[600]}
                      />
                      <Text style={styles.groupTagText}>{group.type}</Text>
                    </View>
                    {group.category && (
                      <View style={styles.groupTag}>
                        <Ionicons name="fitness" size={14} color={COLORS.SECONDARY[600]} />
                        <Text style={styles.groupTagText}>{group.category}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Discover Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discover Groups</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {publicGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color={COLORS.SECONDARY[300]} />
              <Text style={styles.emptyStateTitle}>No Public Groups</Text>
              <Text style={styles.emptyStateText}>
                Check back later for new groups to join!
              </Text>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {publicGroups.map((group) => (
                <View key={group.id} style={styles.groupCard}>
                  <View style={styles.groupCardHeader}>
                    <View style={[styles.groupAvatar, { backgroundColor: '#3B82F6' }]}>
                      <Ionicons name="globe" size={28} color="white" />
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupMembers}>
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                  </View>
                  {group.description && (
                    <Text style={styles.groupDescription} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <View style={styles.groupFooter}>
                    <View style={styles.groupTag}>
                      <Ionicons name="globe" size={14} color={COLORS.PRIMARY[600]} />
                      <Text style={styles.groupTagText}>{group.type}</Text>
                    </View>
                    {group.category && (
                      <View style={styles.groupTag}>
                        <Ionicons name="fitness" size={14} color={COLORS.SECONDARY[600]} />
                        <Text style={styles.groupTagText}>{group.category}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.joinButton}
                      onPress={() => handleJoinGroup(group)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.joinButtonText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Join by Code Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join by Code</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={28} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.codeIconContainer}>
                <Ionicons name="key" size={48} color={COLORS.PRIMARY[600]} />
              </View>
              <Text style={styles.modalDescription}>
                Enter the group code shared with you to join the group
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.SECONDARY[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter group code"
                  value={groupCode}
                  onChangeText={setGroupCode}
                  autoCapitalize="characters"
                  maxLength={8}
                  placeholderTextColor={COLORS.SECONDARY[400]}
                />
              </View>

              <TouchableOpacity
                style={[styles.modalButton, !groupCode.trim() && styles.modalButtonDisabled]}
                onPress={handleJoinByCode}
                disabled={!groupCode.trim() || isJoining}
                activeOpacity={0.7}
              >
                {isJoining ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>Join Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadGroups}
      />
    </SafeAreaView>
  );
}

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
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  createButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  sectionCount: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    marginBottom: 12,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  groupTagText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    textTransform: 'capitalize',
  },
  joinButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  codeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.PRIMARY[100],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginLeft: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  modalButton: {
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
    shadowOpacity: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
});
