import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { progressionService, ProgressionProgress } from '../services/microservices/progressionService';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONTS, FONT_SIZES } from '../constants/colors';

export default function ProgressionCard() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🏃 Loading progression data for user:', user.id);

      const data = await progressionService.getProgress(parseInt(user.id));
      console.log('✅ Progression data loaded:', data);
      console.log('🔍 Next level value:', data.next_level, 'Type:', typeof data.next_level);
      setProgress(data);
    } catch (error: any) {
      console.error('❌ Failed to load progression:', error);
      setError(error?.message || 'Failed to load progression data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
        <Text style={styles.loadingText}>Loading progression...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.WARNING[500]} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProgress}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!progress) {
    return null;
  }

  const progressPercentage = progress.progress_percentage;
  const nextLevel = progressionService.getFitnessLevelName(progress.next_level);
  const currentLevel = user?.fitnessLevel || 'beginner';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={24} color={COLORS.PRIMARY[600]} />
          <Text style={styles.title}>Progress to {nextLevel}</Text>
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={COLORS.SECONDARY[600]}
          />
        </TouchableOpacity>
      </View>

      {/* Overall Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Text style={styles.progressLabel}>Overall Progress</Text>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercentage}%`, backgroundColor: COLORS.PRIMARY[600] },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progressPercentage}%</Text>
      </View>

      {/* Individual Progress Bars */}
      <View style={styles.miniProgressContainer}>
        <View style={styles.miniProgress}>
          <Text style={styles.miniProgressLabel}>Score: {progress.score_progress}%</Text>
          <View style={styles.miniProgressBar}>
            <View
              style={[
                styles.miniProgressFill,
                {
                  width: `${progress.score_progress}%`,
                  backgroundColor: progress.requirements.meets_score_requirement
                    ? COLORS.SUCCESS[500]
                    : COLORS.WARNING[500],
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.miniProgress}>
          <Text style={styles.miniProgressLabel}>Time: {progress.time_progress}%</Text>
          <View style={styles.miniProgressBar}>
            <View
              style={[
                styles.miniProgressFill,
                {
                  width: `${progress.time_progress}%`,
                  backgroundColor: progress.requirements.meets_time_requirement
                    ? COLORS.SUCCESS[500]
                    : COLORS.WARNING[500],
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Message */}
      <Text style={styles.message}>{progress.message}</Text>

      {/* Expanded Details */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Score Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Score Breakdown</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Current Score:</Text>
              <Text style={styles.scoreValue}>{Math.round(progress.current_score)}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Required Score:</Text>
              <Text style={styles.scoreValue}>{progress.required_score}</Text>
            </View>
            {progress.breakdown && (
              <>
                <View style={styles.divider} />
                <View style={styles.scoreRow}>
                  <Text style={styles.breakdownLabel}>Workouts:</Text>
                  <Text style={styles.breakdownValue}>
                    {Math.round(progress.breakdown.workouts_points)} pts
                  </Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.breakdownLabel}>Minutes:</Text>
                  <Text style={styles.breakdownValue}>
                    {Math.round(progress.breakdown.minutes_points)} pts
                  </Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.breakdownLabel}>Completion Rate:</Text>
                  <Text style={styles.breakdownValue}>
                    {Math.round(progress.breakdown.completion_rate_points)} pts
                  </Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.breakdownLabel}>Weeks Active:</Text>
                  <Text style={styles.breakdownValue}>
                    {Math.round(progress.breakdown.weeks_active_points)} pts
                  </Text>
                </View>
                {progress.breakdown.profile_points !== undefined && (
                  <View style={styles.scoreRow}>
                    <Text style={styles.breakdownLabel}>Profile:</Text>
                    <Text style={styles.breakdownValue}>
                      {Math.round(progress.breakdown.profile_points)} pts
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Requirements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementRow}>
              <Ionicons
                name={progress.requirements.meets_time_requirement ? 'checkmark-circle' : 'time'}
                size={20}
                color={
                  progress.requirements.meets_time_requirement ? COLORS.SUCCESS[500] : COLORS.WARNING[500]
                }
              />
              <Text style={styles.requirementText}>
                {progress.requirements.current_days} / {progress.requirements.min_days} active days
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Ionicons
                name={progress.requirements.meets_score_requirement ? 'checkmark-circle' : 'time'}
                size={20}
                color={
                  progress.requirements.meets_score_requirement ? COLORS.SUCCESS[500] : COLORS.WARNING[500]
                }
              />
              <Text style={styles.requirementText}>
                {progress.requirements.completed_workouts} workouts completed
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Ionicons name="flash" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.requirementText}>
                {progressionService.formatDuration(progress.requirements.workout_minutes)} of
                exercise
              </Text>
            </View>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity style={styles.refreshButton} onPress={loadProgress}>
            <Ionicons name="refresh" size={16} color={COLORS.PRIMARY[600]} />
            <Text style={styles.refreshText}>Refresh Progress</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.NEUTRAL.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.NEUTRAL.WHITE,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: COLORS.SECONDARY[100],
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    textAlign: 'right',
  },
  miniProgressContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  miniProgress: {
    flex: 1,
  },
  miniProgressLabel: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginBottom: 4,
  },
  miniProgressBar: {
    height: 6,
    backgroundColor: COLORS.SECONDARY[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  message: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    marginBottom: 8,
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[100],
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  scoreValue: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  breakdownLabel: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    paddingLeft: 8,
  },
  breakdownValue: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.SECONDARY[100],
    marginVertical: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  refreshText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
});
