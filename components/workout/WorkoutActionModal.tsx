import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS } from '../../constants/colors';
import { socialService, Group } from '../../services/microservices/socialService';
import { useAuth } from '../../contexts/AuthContext';
import NetInfo from '@react-native-community/netinfo';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TAB_BLUE = '#6184FB';

type ModalStep = 'choose' | 'groups';

interface WorkoutActionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WorkoutActionModal: React.FC<WorkoutActionModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<ModalStep>('choose');
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const loadingRef = useRef(false);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      overlayAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isModalVisible) {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsModalVisible(false);
        // Reset state after close animation completes
        setStep('choose');
        setGroups([]);
        setGroupsError(null);
      });
    }
  }, [visible]);

  const fetchUserGroups = async () => {
    if (!user?.id || loadingRef.current) return;

    // Skip API call when offline
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setGroupsError('No internet connection. Please check your Wi-Fi or mobile data.');
      return;
    }

    loadingRef.current = true;
    setIsLoadingGroups(true);
    setGroupsError(null);
    try {
      const result = await socialService.getGroups({ user_id: parseInt(user.id) });
      const rawGroups = result.groups || [];

      // Fetch actual member counts (current_member_count column can be stale)
      const groupsWithCounts = await Promise.all(
        rawGroups.map(async (group) => {
          try {
            const membersData = await socialService.getGroupMembers(group.id, 1, 1);
            return { ...group, memberCount: membersData.total || group.memberCount };
          } catch {
            return group;
          }
        })
      );

      setGroups(groupsWithCounts);
    } catch (error: any) {
      setGroupsError(error.message || 'Failed to load groups');
    } finally {
      setIsLoadingGroups(false);
      loadingRef.current = false;
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleIndividualWorkout = () => {
    onClose();
    setTimeout(() => {
      router.push('/(tabs)/weekly-plan');
    }, 100);
  };

  const handleGroupWorkout = () => {
    setStep('groups');
    fetchUserGroups();
  };

  const handleSelectGroup = (group: Group) => {
    onClose();
    setTimeout(() => {
      router.push(`/groups/${group.id}`);
    }, 100);
  };

  const handleBrowseGroups = () => {
    onClose();
    setTimeout(() => {
      router.push('/(tabs)/groups');
    }, 100);
  };

  if (!isModalVisible) return null;

  return (
    <Modal transparent visible={isModalVisible} statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.overlayBackground, { opacity: overlayAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {step === 'choose' ? renderChooseStep() : renderGroupsStep()}
        </Animated.View>
      </View>
    </Modal>
  );

  function renderChooseStep() {
    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Start a Workout</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={COLORS.SECONDARY[500]} />
          </TouchableOpacity>
        </View>

        {/* Choices */}
        <View style={styles.choicesContainer}>
          <TouchableOpacity
            style={styles.choiceCard}
            activeOpacity={0.7}
            onPress={handleIndividualWorkout}
          >
            <View style={styles.choiceIconWrap}>
              <Ionicons name="fitness-outline" size={24} color={TAB_BLUE} />
            </View>
            <View style={styles.choiceTextWrap}>
              <Text style={styles.choiceTitle}>Individual Workout</Text>
              <Text style={styles.choiceSubtitle}>Follow your personal plan</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.choiceCard}
            activeOpacity={0.7}
            onPress={handleGroupWorkout}
          >
            <View style={[styles.choiceIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="people-outline" size={24} color="#16A34A" />
            </View>
            <View style={styles.choiceTextWrap}>
              <Text style={styles.choiceTitle}>Group Workout</Text>
              <Text style={styles.choiceSubtitle}>Work out with your group</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderGroupsStep() {
    return (
      <>
        {/* Header with back */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setStep('choose')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.SECONDARY[700]} />
          </TouchableOpacity>
          <Text style={[styles.title, { flex: 1 }]}>Select a Group</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={COLORS.SECONDARY[500]} />
          </TouchableOpacity>
        </View>

        {/* Groups content */}
        {isLoadingGroups ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={TAB_BLUE} />
            <Text style={styles.stateText}>Loading your groups...</Text>
          </View>
        ) : groupsError ? (
          <View style={styles.centerState}>
            <Ionicons name="warning-outline" size={40} color={COLORS.ERROR[400]} />
            <Text style={styles.stateText}>{groupsError}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={fetchUserGroups}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="people-outline" size={40} color={COLORS.SECONDARY[300]} />
            <Text style={styles.stateText}>You haven't joined any groups yet</Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleBrowseGroups}>
              <Text style={styles.actionButtonText}>Browse Groups</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.groupsList}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupItem}
                activeOpacity={0.7}
                onPress={() => handleSelectGroup(group)}
              >
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={20} color={TAB_BLUE} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    {group.type === 'private' ? ' • Private' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </>
    );
  }
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  choicesContainer: {
    padding: 20,
    gap: 12,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.SECONDARY[200],
  },
  choiceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  choiceSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 12,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TAB_BLUE,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  groupsList: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  groupMeta: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
});
