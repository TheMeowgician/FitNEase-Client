import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface UserProfileData {
  userId: string | number;
  username: string;
  userRole?: string; // 'mentor' | 'trainee'
  groupRole?: string; // 'owner' | 'moderator' | 'member'
  fitnessLevel?: string; // 'beginner' | 'intermediate' | 'advanced'
  joinedAt?: string;
  isOnline?: boolean;
  isReady?: boolean; // For lobby context
}

interface UserProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfileData | null;
  context?: 'group' | 'lobby'; // Context determines which info to show
}

export const UserProfilePreviewModal: React.FC<UserProfilePreviewModalProps> = ({
  visible,
  onClose,
  user,
  context = 'group',
}) => {
  // Animation values for smooth fade in/out
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!user) return null;

  const getFitnessLevelColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return COLORS.SUCCESS[500];
      case 'intermediate':
        return COLORS.WARNING[500];
      case 'advanced':
        return COLORS.ERROR[500];
      default:
        return COLORS.SECONDARY[400];
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return { backgroundColor: COLORS.PRIMARY[600], color: '#FFFFFF' };
      case 'moderator':
        return { backgroundColor: '#10B981', color: '#FFFFFF' };
      default:
        return { backgroundColor: COLORS.SECONDARY[200], color: COLORS.SECONDARY[700] };
    }
  };

  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const roleStyle = getRoleBadgeStyle(user.groupRole);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.SECONDARY[500]} />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={48} color="#FFFFFF" />
              {user.isOnline && <View style={styles.onlineIndicatorLarge} />}
            </View>
          </View>

          {/* Username */}
          <Text style={styles.username}>{user.username}</Text>

          {/* Badges Row */}
          <View style={styles.badgesRow}>
            {/* Mentor Badge */}
            {user.userRole === 'mentor' && (
              <View style={styles.mentorBadge}>
                <Ionicons name="school" size={14} color="#FFFFFF" />
                <Text style={styles.mentorBadgeText}>Mentor</Text>
              </View>
            )}

            {/* Group Role Badge */}
            {user.groupRole && (
              <View style={[styles.roleBadge, { backgroundColor: roleStyle.backgroundColor }]}>
                <Text style={[styles.roleBadgeText, { color: roleStyle.color }]}>
                  {user.groupRole.charAt(0).toUpperCase() + user.groupRole.slice(1)}
                </Text>
              </View>
            )}

            {/* Ready Badge (for lobby) */}
            {context === 'lobby' && user.isReady !== undefined && (
              <View style={[styles.readyBadge, user.isReady ? styles.readyBadgeActive : styles.readyBadgeInactive]}>
                <Ionicons
                  name={user.isReady ? 'checkmark-circle' : 'time'}
                  size={14}
                  color={user.isReady ? '#FFFFFF' : COLORS.SECONDARY[600]}
                />
                <Text style={[styles.readyBadgeText, user.isReady ? styles.readyTextActive : styles.readyTextInactive]}>
                  {user.isReady ? 'Ready' : 'Not Ready'}
                </Text>
              </View>
            )}
          </View>

          {/* Info Cards */}
          <View style={styles.infoSection}>
            {/* Online Status */}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name={user.isOnline ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={user.isOnline ? COLORS.SUCCESS[500] : COLORS.SECONDARY[400]}
                />
              </View>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, user.isOnline ? styles.onlineText : styles.offlineText]}>
                {user.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>

            {/* Fitness Level */}
            {user.fitnessLevel && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="fitness" size={18} color={getFitnessLevelColor(user.fitnessLevel)} />
                </View>
                <Text style={styles.infoLabel}>Fitness Level</Text>
                <View style={[styles.fitnessLevelBadge, { backgroundColor: getFitnessLevelColor(user.fitnessLevel) + '20' }]}>
                  <Text style={[styles.fitnessLevelText, { color: getFitnessLevelColor(user.fitnessLevel) }]}>
                    {user.fitnessLevel.charAt(0).toUpperCase() + user.fitnessLevel.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Joined Date (for group context) */}
            {context === 'group' && user.joinedAt && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.SECONDARY[500]} />
                </View>
                <Text style={styles.infoLabel}>Joined</Text>
                <Text style={styles.infoValue}>{formatJoinDate(user.joinedAt)}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 60,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.PRIMARY[500],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineIndicatorLarge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.SUCCESS[500],
    borderWidth: 3,
    borderColor: COLORS.NEUTRAL.WHITE,
  },
  username: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[600],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  mentorBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  readyBadgeActive: {
    backgroundColor: COLORS.SUCCESS[500],
  },
  readyBadgeInactive: {
    backgroundColor: COLORS.SECONDARY[200],
  },
  readyBadgeText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
  readyTextActive: {
    color: '#FFFFFF',
  },
  readyTextInactive: {
    color: COLORS.SECONDARY[600],
  },
  infoSection: {
    width: '100%',
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 28,
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  infoValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  onlineText: {
    color: COLORS.SUCCESS[600],
  },
  offlineText: {
    color: COLORS.SECONDARY[500],
  },
  fitnessLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fitnessLevelText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
  },
});

export default UserProfilePreviewModal;
