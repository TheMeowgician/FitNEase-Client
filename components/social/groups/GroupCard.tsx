import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface Group {
  group_id: string;
  group_name: string;
  description: string;
  current_member_count: number;
  max_members: number;
  is_private: boolean;
  group_image?: string;
  created_by: string;
}

interface GroupCardProps {
  group: Group;
  onPress: (group: Group) => void;
  onJoin?: (groupId: string) => void;
  showJoinButton?: boolean;
  style?: ViewStyle;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onPress,
  onJoin,
  showJoinButton = false,
  style,
}) => {
  const isGroupFull = group.current_member_count >= group.max_members;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress(group)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.group_name}
        </Text>
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyText}>
            {group.is_private ? 'Private' : 'Public'}
          </Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {group.description}
      </Text>

      <View style={styles.footer}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberCount}>
            {group.current_member_count}/{group.max_members} members
          </Text>
          {isGroupFull && (
            <Text style={styles.fullText}>Full</Text>
          )}
        </View>

        {showJoinButton && onJoin && !isGroupFull && (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => onJoin(group.group_id)}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.SECONDARY[900],
    flex: 1,
    marginRight: 8,
  },
  privacyBadge: {
    backgroundColor: COLORS.SECONDARY[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyText: {
    fontSize: 12,
    color: COLORS.SECONDARY[600],
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: COLORS.SECONDARY[600],
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: COLORS.SECONDARY[500],
    marginRight: 8,
  },
  fullText: {
    fontSize: 12,
    color: COLORS.ERROR[500],
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinButtonText: {
    fontSize: 12,
    color: COLORS.NEUTRAL.WHITE,
    fontWeight: '600',
  },
});