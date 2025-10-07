import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/colors';

interface WorkoutDayStatusProps {
  workoutDays?: string[];
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBREVIATIONS: Record<string, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

export const WorkoutDayStatus: React.FC<WorkoutDayStatusProps> = ({ workoutDays = [] }) => {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayName = DAYS_OF_WEEK[today];
  const isWorkoutDay = workoutDays.includes(todayName);

  // Get upcoming workout days
  const upcomingDays = DAYS_OF_WEEK.filter((day, index) => {
    if (index <= today) return false;
    return workoutDays.includes(day);
  }).slice(0, 2);

  const nextWorkoutDay = upcomingDays[0] || workoutDays[0];

  return (
    <LinearGradient
      colors={isWorkoutDay ? ['#0091FF', '#0072CC'] : ['#F5F5F7', '#E8E8ED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: isWorkoutDay ? 'rgba(255,255,255,0.3)' : 'rgba(0,145,255,0.1)' }]}>
          <Ionicons
            name={isWorkoutDay ? "fitness" : "calendar-outline"}
            size={24}
            color={isWorkoutDay ? "#FFFFFF" : COLORS.PRIMARY[500]}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: isWorkoutDay ? "#FFFFFF" : COLORS.SECONDARY[900] }]}>
            {isWorkoutDay ? "Today's Workout Day" : "Rest Day"}
          </Text>
          <Text style={[styles.subtitle, { color: isWorkoutDay ? "rgba(255,255,255,0.9)" : COLORS.SECONDARY[600] }]}>
            {isWorkoutDay
              ? "Time to push your limits"
              : nextWorkoutDay ? `Next: ${DAY_ABBREVIATIONS[nextWorkoutDay]}` : "No workouts scheduled"
            }
          </Text>
        </View>
      </View>

      <View style={styles.weekContainer}>
        {DAYS_OF_WEEK.map((day, index) => {
          const isToday = index === today;
          const isScheduled = workoutDays.includes(day);

          return (
            <View key={day} style={styles.dayWrapper}>
              <View
                style={[
                  styles.dayCircle,
                  isToday && styles.dayCircleToday,
                  isScheduled && !isToday && (isWorkoutDay ? styles.dayCircleScheduledLight : styles.dayCircleScheduled),
                  isScheduled && isToday && (isWorkoutDay ? styles.dayCircleTodayScheduledLight : styles.dayCircleTodayScheduled),
                ]}
              >
                {isScheduled && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={
                      isToday && isWorkoutDay
                        ? COLORS.PRIMARY[500]
                        : isToday
                        ? "#FFFFFF"
                        : isWorkoutDay
                        ? "rgba(255,255,255,0.9)"
                        : COLORS.PRIMARY[500]
                    }
                  />
                )}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  { color: isWorkoutDay ? "rgba(255,255,255,0.8)" : COLORS.SECONDARY[500] },
                  isToday && { color: isWorkoutDay ? "#FFFFFF" : COLORS.PRIMARY[500], fontFamily: FONTS.SEMIBOLD },
                ]}
              >
                {DAY_ABBREVIATIONS[day]}
              </Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 0,
    padding: 20,
    marginVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  dayWrapper: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dayCircleToday: {
    backgroundColor: COLORS.PRIMARY[500],
  },
  dayCircleScheduled: {
    backgroundColor: COLORS.PRIMARY[100],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[500],
  },
  dayCircleTodayScheduled: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[500],
  },
  dayCircleScheduledLight: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  dayCircleTodayScheduledLight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
  },
});
