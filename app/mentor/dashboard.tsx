import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface MemberData {
  id: string;
  name: string;
  email: string;
  totalWorkouts: number;
  currentStreak: number;
  lastWorkoutDate?: string;
  weeklyProgress: number; // percentage
}

export default function MentorDashboardScreen() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call when backend is ready
      // const response = await authService.getMentorMembers();
      // setMembers(response);

      // Placeholder: Show message that feature is being developed
      setMembers([]);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load members. This feature may not be available yet.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const renderMemberCard = (member: MemberData) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberCard}
      onPress={() => router.push(`/mentor/member/${member.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.memberHeader}>
        <View style={styles.memberAvatar}>
          <Ionicons name="person" size={24} color={COLORS.PRIMARY[600]} />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberEmail}>{member.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={COLORS.SECONDARY[400]} />
      </View>

      <View style={styles.memberStats}>
        <View style={styles.statItem}>
          <Ionicons name="barbell-outline" size={20} color={COLORS.SECONDARY[600]} />
          <Text style={styles.statValue}>{member.totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="flame-outline" size={20} color={COLORS.WARNING[500]} />
          <Text style={styles.statValue}>{member.currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="trending-up-outline" size={20} color={COLORS.SUCCESS[600]} />
          <Text style={styles.statValue}>{member.weeklyProgress}%</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingSpinner message="Loading members..." />
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Members</Text>
          <View style={styles.backButton} />
        </View>

        {/* Intro */}
        <View style={styles.introSection}>
          <Ionicons name="people" size={48} color={COLORS.SUCCESS[600]} />
          <Text style={styles.introTitle}>Member Progress</Text>
          <Text style={styles.introSubtitle}>
            Track your members' fitness journeys and progress
          </Text>
        </View>

        {/* Member List or Empty State */}
        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={64} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyTitle}>No Members Yet</Text>
            <Text style={styles.emptySubtitle}>
              Members will appear here once they join your program
            </Text>
            <Text style={styles.emptyNote}>
              Note: Member management features are currently being developed
            </Text>
          </View>
        ) : (
          <View style={styles.memberList}>
            {members.map(renderMemberCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  introSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 16,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyNote: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  memberList: {
    paddingHorizontal: 20,
  },
  memberCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.NEUTRAL[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.SUCCESS[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  memberStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
});
