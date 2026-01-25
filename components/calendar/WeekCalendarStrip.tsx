import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, isSameDay, startOfWeek } from 'date-fns';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

export interface DayData {
  date: Date;
  shortName: string;
  dayNumber: string;
  isToday: boolean;
  isWorkoutDay: boolean;
  isRestDay: boolean;
  completed: boolean;
}

interface WeekCalendarStripProps {
  // Current week start date (Monday)
  weekStart: Date;
  // Selected date (for Weekly Plan)
  selectedDate?: Date;
  // Callback when day is selected
  onSelectDate?: (date: Date) => void;
  // Show navigation arrows
  showNavigation?: boolean;
  // Navigation callbacks
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  // Can navigate to previous week
  canNavigatePrev?: boolean;
  // User's workout days (e.g., ['monday', 'wednesday', 'friday'])
  workoutDays?: string[];
  // Completed dates (Set of 'yyyy-MM-dd' strings)
  completedDates?: Set<string>;
  // Show progress summary
  showProgress?: boolean;
  // Compact mode (for Dashboard)
  compact?: boolean;
}

const DAY_NAME_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const WeekCalendarStrip: React.FC<WeekCalendarStripProps> = ({
  weekStart,
  selectedDate,
  onSelectDate,
  showNavigation = false,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = true,
  workoutDays = [],
  completedDates = new Set(),
  showProgress = true,
  compact = false,
}) => {
  // Generate week days data (Monday to Sunday)
  const weekDays: DayData[] = [];
  const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayOfWeek = date.getDay();
    const dayName = DAY_NAME_MAP[dayOfWeek];
    const dateString = format(date, 'yyyy-MM-dd');

    weekDays.push({
      date,
      shortName: shortNames[i],
      dayNumber: format(date, 'd'),
      isToday: isSameDay(date, today),
      isWorkoutDay: workoutDays.includes(dayName),
      isRestDay: !workoutDays.includes(dayName),
      completed: completedDates.has(dateString),
    });
  }

  // Calculate progress
  const workoutDaysCount = weekDays.filter(d => d.isWorkoutDay).length;
  const completedCount = weekDays.filter(d => d.isWorkoutDay && d.completed).length;

  // Check if viewing current week
  const isCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(today, { weekStartsOn: 1 })
  );

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Week Navigation */}
      {showNavigation && (
        <View style={styles.navigationRow}>
          <TouchableOpacity
            style={[styles.navButton, !canNavigatePrev && styles.navButtonDisabled]}
            onPress={onNavigatePrev}
            disabled={!canNavigatePrev}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={canNavigatePrev ? COLORS.NEUTRAL[700] : COLORS.NEUTRAL[300]}
            />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </Text>
          <TouchableOpacity style={styles.navButton} onPress={onNavigateNext}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.NEUTRAL[700]} />
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Strip */}
      <View style={styles.calendarStrip}>
        {weekDays.map((day, index) => {
          const isSelected = selectedDate && isSameDay(day.date, selectedDate);

          return (
            <TouchableOpacity
              key={index}
              style={styles.dayCell}
              onPress={() => onSelectDate?.(day.date)}
              activeOpacity={onSelectDate ? 0.7 : 1}
              disabled={!onSelectDate}
            >
              {/* Day Name */}
              <Text
                style={[
                  styles.dayName,
                  isSelected && styles.dayNameSelected,
                  day.isToday && !isSelected && styles.dayNameToday,
                ]}
              >
                {day.shortName}
              </Text>

              {/* Day Number */}
              <View
                style={[
                  styles.dayNumberWrapper,
                  isSelected && styles.dayNumberWrapperSelected,
                  day.isToday && !isSelected && styles.dayNumberWrapperToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    day.isToday && !isSelected && styles.dayNumberToday,
                  ]}
                >
                  {day.dayNumber}
                </Text>
              </View>

              {/* Status Indicator */}
              <View style={styles.statusIndicator}>
                {day.completed ? (
                  <View style={styles.completedDot} />
                ) : day.isWorkoutDay ? (
                  <View style={styles.workoutDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Progress Summary */}
      {showProgress && workoutDaysCount > 0 && (
        <View style={styles.progressSummary}>
          <Text style={styles.progressText}>
            {completedCount}/{workoutDaysCount} completed
          </Text>
          <View style={styles.progressDotsContainer}>
            {weekDays.filter(d => d.isWorkoutDay).map((day, idx) => (
              <View
                key={idx}
                style={[
                  styles.progressDot,
                  day.completed && styles.progressDotCompleted,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  containerCompact: {
    paddingVertical: 12,
  },

  // Navigation
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.NEUTRAL[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: COLORS.NEUTRAL[50],
    opacity: 0.5,
  },
  weekLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[700],
  },

  // Calendar Strip
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayName: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[400],
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNameSelected: {
    color: COLORS.PRIMARY[600],
    fontFamily: FONTS.SEMIBOLD,
  },
  dayNameToday: {
    color: COLORS.PRIMARY[600],
    fontFamily: FONTS.SEMIBOLD,
  },
  dayNumberWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayNumberWrapperSelected: {
    backgroundColor: COLORS.PRIMARY[600],
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dayNumberWrapperToday: {
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[400],
  },
  dayNumber: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  dayNumberSelected: {
    color: COLORS.NEUTRAL.WHITE,
    fontFamily: FONTS.BOLD,
  },
  dayNumberToday: {
    color: COLORS.PRIMARY[700],
    fontFamily: FONTS.BOLD,
  },

  // Status Indicators
  statusIndicator: {
    height: 8,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.SUCCESS[500],
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY[400],
  },

  // Progress Summary
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[100],
  },
  progressText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
  },
  progressDotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.NEUTRAL[200],
  },
  progressDotCompleted: {
    backgroundColor: COLORS.SUCCESS[500],
  },
});

export default WeekCalendarStrip;
