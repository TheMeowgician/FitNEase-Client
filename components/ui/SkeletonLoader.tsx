import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** A single shimmer placeholder box */
const SkeletonBox: React.FC<SkeletonBoxProps> = ({ width, height, borderRadius = 8, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: COLORS.SECONDARY[200], opacity },
        style,
      ]}
    />
  );
};

/* =====================================================================
   DASHBOARD SKELETON — matches app/(tabs)/index.tsx
   ===================================================================== */
export const DashboardSkeleton: React.FC = () => (
  <View style={{ flex: 1 }}>
    {/* Fixed Header: "Dashboard" + notification bell */}
    <View style={s.header}>
      <SkeletonBox width={150} height={28} borderRadius={6} />
      <SkeletonBox width={40} height={40} borderRadius={20} />
    </View>

    {/* ScrollView content */}
    <View style={{ paddingTop: 16 }}>
      {/* Profile Section — marginHorizontal: 24, marginBottom: 32 */}
      <View style={{ marginHorizontal: 24, marginBottom: 32, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Avatar 70x70 */}
          <SkeletonBox width={70} height={70} borderRadius={35} style={{ marginRight: 16 }} />
          <View style={{ flex: 1 }}>
            {/* "Welcome back," */}
            <SkeletonBox width={100} height={14} borderRadius={4} />
            {/* User name */}
            <SkeletonBox width={160} height={22} borderRadius={6} style={{ marginTop: 4 }} />
            {/* Badge */}
            <SkeletonBox width={90} height={22} borderRadius={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>

      {/* Stats Section — marginHorizontal: 24, marginBottom: 24 */}
      <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
        {/* Section header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SkeletonBox width={170} height={18} borderRadius={6} />
          <SkeletonBox width={60} height={22} borderRadius={12} />
        </View>

        {/* Stats card — white, borderRadius: 16, padding: 20 */}
        <View style={s.statsCard}>
          {/* Stat row 1 */}
          <View style={s.statRow}>
            <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 16 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width={80} height={14} borderRadius={4} />
              <SkeletonBox width={100} height={16} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
          <View style={s.divider} />
          {/* Stat row 2 */}
          <View style={s.statRow}>
            <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 16 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width={110} height={14} borderRadius={4} />
              <SkeletonBox width={80} height={16} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
          <View style={s.divider} />
          {/* Stat row 3 */}
          <View style={s.statRow}>
            <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 16 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width={90} height={14} borderRadius={4} />
              <SkeletonBox width={70} height={16} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>
      </View>

      {/* Workout Section — marginHorizontal: 24 */}
      <View style={{ marginHorizontal: 24 }}>
        {/* Section header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SkeletonBox width={120} height={20} borderRadius={6} />
          <SkeletonBox width={100} height={26} borderRadius={12} />
        </View>

        {/* Workout card — borderRadius: 20, padding: 20 */}
        <View style={s.workoutCard}>
          {/* Title + subtitle */}
          <SkeletonBox width={140} height={20} borderRadius={6} />
          <SkeletonBox width={200} height={14} borderRadius={4} style={{ marginTop: 4 }} />

          {/* Exercise preview area */}
          <View style={s.exercisePreviewArea}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <SkeletonBox width={24} height={24} borderRadius={12} style={{ marginRight: 12 }} />
                <SkeletonBox width="70%" height={14} borderRadius={4} />
              </View>
            ))}
          </View>

          {/* Stats row */}
          <View style={s.workoutStatsRow}>
            <SkeletonBox width={70} height={18} borderRadius={4} />
            <View style={{ width: 1, height: 20, backgroundColor: COLORS.SECONDARY[200] }} />
            <SkeletonBox width={70} height={18} borderRadius={4} />
            <View style={{ width: 1, height: 20, backgroundColor: COLORS.SECONDARY[200] }} />
            <SkeletonBox width={70} height={18} borderRadius={4} />
          </View>

          {/* Start button */}
          <SkeletonBox width="100%" height={48} borderRadius={12} />
        </View>
      </View>
    </View>
  </View>
);

/* =====================================================================
   GROUPS LIST SKELETON — matches app/(tabs)/groups.tsx
   ===================================================================== */
export const GroupsListSkeleton: React.FC = () => (
  <View style={{ flex: 1 }}>
    {/* Quick Actions — paddingHorizontal: 24, marginTop: 24, gap: 12 */}
    <View style={{ flexDirection: 'row', paddingHorizontal: 24, marginTop: 24, gap: 12 }}>
      {/* Card 1 */}
      <View style={s.quickActionCard}>
        <SkeletonBox width={56} height={56} borderRadius={28} style={{ marginBottom: 12 }} />
        <SkeletonBox width={80} height={16} borderRadius={4} style={{ marginBottom: 4 }} />
        <SkeletonBox width={100} height={13} borderRadius={4} />
      </View>
      {/* Card 2 */}
      <View style={s.quickActionCard}>
        <SkeletonBox width={56} height={56} borderRadius={28} style={{ marginBottom: 12 }} />
        <SkeletonBox width={80} height={16} borderRadius={4} style={{ marginBottom: 4 }} />
        <SkeletonBox width={100} height={13} borderRadius={4} />
      </View>
    </View>

    {/* My Groups section — marginTop: 32, paddingHorizontal: 24 */}
    <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
      {/* Section header row — marginBottom: 16 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SkeletonBox width={100} height={20} borderRadius={6} />
        <SkeletonBox width={20} height={16} borderRadius={4} />
      </View>

      {/* Group cards — gap: 12 */}
      <View style={{ gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={s.groupCard}>
            {/* Card header — row, marginBottom: 12 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <SkeletonBox width={56} height={56} borderRadius={28} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <SkeletonBox width={120} height={16} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonBox width={80} height={13} borderRadius={4} />
              </View>
              <SkeletonBox width={20} height={20} borderRadius={4} />
            </View>
            {/* Description */}
            <SkeletonBox width="90%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
            {/* Footer tag */}
            <SkeletonBox width={70} height={26} borderRadius={8} />
          </View>
        ))}
      </View>
    </View>
  </View>
);

/* =====================================================================
   WORKOUTS LIST SKELETON — matches app/(tabs)/workouts.tsx
   ===================================================================== */
export const WorkoutsListSkeleton: React.FC = () => (
  <View style={{ padding: 20 }}>
    {/* Section header — "Today's Tabata" + "Personalized" badge */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <SkeletonBox width={130} height={20} borderRadius={6} />
      <SkeletonBox width={105} height={26} borderRadius={12} />
    </View>

    {/* Workout card — borderRadius: 20, padding: 20 */}
    <View style={s.workoutCard}>
      {/* Card header — title + subtitle, marginBottom: 20 */}
      <View style={{ marginBottom: 20 }}>
        <SkeletonBox width={150} height={20} borderRadius={6} />
        <SkeletonBox width={210} height={14} borderRadius={4} style={{ marginTop: 4 }} />
      </View>

      {/* Exercise preview — bg neutral, borderRadius: 12, padding: 14, marginBottom: 16 */}
      <View style={s.exercisePreviewArea}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <SkeletonBox width={24} height={24} borderRadius={12} style={{ marginRight: 12 }} />
            <SkeletonBox width="70%" height={14} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Stats row — paddingVertical: 14, borderTop, marginBottom: 16 */}
      <View style={s.workoutStatsRow}>
        <SkeletonBox width={70} height={18} borderRadius={4} />
        <View style={{ width: 1, height: 20, backgroundColor: COLORS.SECONDARY[200] }} />
        <SkeletonBox width={70} height={18} borderRadius={4} />
        <View style={{ width: 1, height: 20, backgroundColor: COLORS.SECONDARY[200] }} />
        <SkeletonBox width={70} height={18} borderRadius={4} />
      </View>

      {/* Start button */}
      <SkeletonBox width="100%" height={48} borderRadius={12} />
    </View>

    {/* Info card — borderRadius: 12, padding: 14 */}
    <View style={s.infoCard}>
      <SkeletonBox width={20} height={20} borderRadius={10} />
      <SkeletonBox width="85%" height={13} borderRadius={4} />
    </View>
  </View>
);

/* =====================================================================
   WEEKLY PLAN SKELETON — matches app/(tabs)/weekly-plan.tsx
   ===================================================================== */
export const WeeklyPlanSkeleton: React.FC = () => (
  <View style={{ flex: 1 }}>
    {/* Calendar strip placeholder */}
    <View style={s.calendarStrip}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <SkeletonBox width={28} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
            <SkeletonBox width={40} height={40} borderRadius={12} />
          </View>
        ))}
      </View>
    </View>

    {/* Content area — padding: 20 */}
    <View style={{ padding: 20 }}>
      {/* Day section header + badges */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SkeletonBox width={100} height={20} borderRadius={6} />
        <SkeletonBox width={60} height={24} borderRadius={12} />
      </View>

      {/* Quick stats row — 3 items */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={s.weeklyStatItem}>
            <SkeletonBox width={32} height={32} borderRadius={10} style={{ marginBottom: 6 }} />
            <SkeletonBox width={24} height={18} borderRadius={4} style={{ marginBottom: 2 }} />
            <SkeletonBox width={50} height={12} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Exercises section */}
      <View style={s.exercisesContainer}>
        <SkeletonBox width={80} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={s.exerciseItem}>
            <SkeletonBox width={28} height={28} borderRadius={14} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width="65%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonBox width="40%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>

      {/* Action button */}
      <SkeletonBox width="100%" height={48} borderRadius={12} style={{ marginTop: 16 }} />
    </View>
  </View>
);

/* =====================================================================
   PROGRESS SKELETON — matches app/(tabs)/progress.tsx
   ===================================================================== */
export const ProgressSkeleton: React.FC = () => (
  <View style={{ paddingTop: 20, paddingHorizontal: 20 }}>
    {/* Level card — white, borderRadius: 20, padding: 24, marginBottom: 20 */}
    <View style={s.levelCard}>
      {/* Content row — image + text, marginBottom: 20 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <SkeletonBox width={56} height={56} borderRadius={28} style={{ marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBox width={120} height={22} borderRadius={6} style={{ marginBottom: 4 }} />
          <SkeletonBox width={180} height={14} borderRadius={4} />
        </View>
      </View>
      {/* Stats row — bg neutral, borderRadius: 16, padding: 16 */}
      <View style={s.levelStatsRow}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <SkeletonBox width={20} height={20} borderRadius={10} />
          <SkeletonBox width={30} height={20} borderRadius={4} style={{ marginTop: 8 }} />
          <SkeletonBox width={55} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={{ width: 1, backgroundColor: COLORS.SECONDARY[200], marginHorizontal: 12 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <SkeletonBox width={20} height={20} borderRadius={10} />
          <SkeletonBox width={30} height={20} borderRadius={4} style={{ marginTop: 8 }} />
          <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={{ width: 1, backgroundColor: COLORS.SECONDARY[200], marginHorizontal: 12 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <SkeletonBox width={20} height={20} borderRadius={10} />
          <SkeletonBox width={30} height={20} borderRadius={4} style={{ marginTop: 8 }} />
          <SkeletonBox width={55} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>

    {/* Quick Stats section — marginBottom: 24 */}
    <View style={{ marginBottom: 24 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <SkeletonBox width={20} height={20} borderRadius={10} />
        <SkeletonBox width={90} height={18} borderRadius={6} />
      </View>
      {/* 2x2 grid — gap: 12 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={s.quickStatGridCard}>
            <SkeletonBox width={48} height={48} borderRadius={24} style={{ marginBottom: 12 }} />
            <SkeletonBox width={40} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBox width={80} height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>

    {/* Achievements section */}
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <SkeletonBox width={20} height={20} borderRadius={10} />
        <SkeletonBox width={100} height={18} borderRadius={6} style={{ flex: 1 }} />
        <SkeletonBox width={55} height={14} borderRadius={4} />
      </View>
      <View style={s.achievementCard}>
        {/* Achievement icons row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginBottom: 6 }} />
              <SkeletonBox width={50} height={12} borderRadius={4} />
            </View>
          ))}
        </View>
        {/* Progress bar */}
        <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 6 }} />
        <SkeletonBox width={120} height={12} borderRadius={4} />
      </View>
    </View>
  </View>
);

/* =====================================================================
   Shared styles
   ===================================================================== */
const s = StyleSheet.create({
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
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  exercisePreviewArea: {
    backgroundColor: COLORS.NEUTRAL[50] || '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 16,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[100] || '#F3F4F6',
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[50] || '#EEF2FF',
    padding: 14,
    borderRadius: 12,
    gap: 10,
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
  calendarStrip: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weeklyStatItem: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  exercisesContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  levelCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL[50] || '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  quickStatGridCard: {
    width: (SCREEN_WIDTH - 52) / 2,
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
  achievementCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
