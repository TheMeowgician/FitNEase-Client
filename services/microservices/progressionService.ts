import { apiClient } from '../api/client';

export interface ProgressionRequirements {
  min_days: number;
  current_days: number;
  meets_time_requirement: boolean;
  meets_score_requirement: boolean;
  completed_workouts: number;
  workout_minutes: number;
  profile_completeness?: number;
  weeks_active?: number;
  advanced_workouts?: number;
  goals_achieved?: number;
  group_workouts?: number;
  longest_streak?: number;
  min_days_at_intermediate?: number;
  current_days_at_intermediate?: number;
  meets_intermediate_duration?: boolean;
}

export interface ProgressionBreakdown {
  workouts_points: number;
  minutes_points: number;
  completion_rate_points: number;
  weeks_active_points: number;
  profile_points?: number;
  advanced_workouts_points?: number;
  goals_achieved_points?: number;
  group_workouts_points?: number;
  streak_points?: number;
}

export interface ProgressionEligibility {
  eligible: boolean;
  newLevel: string | null;
  score: number;
  threshold?: number;
  requirements: ProgressionRequirements;
  breakdown?: ProgressionBreakdown;
  message: string;
}

export interface ProgressionProgress {
  eligible_for_promotion: boolean;
  current_score: number;
  required_score: number;
  score_progress: number;
  time_progress: number;
  progress_percentage: number;
  next_level: string;
  requirements: ProgressionRequirements;
  breakdown: ProgressionBreakdown;
  message: string;
}

class ProgressionService {
  /**
   * Check if user is eligible for promotion
   */
  async checkEligibility(userId: number): Promise<ProgressionEligibility> {
    try {
      const response = await apiClient.get<{ success: boolean; data: ProgressionEligibility }>(
        'tracking',
        `/api/tracking/progression/check/${userId}`
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to check progression eligibility:', error);
      throw new Error(error.message || 'Failed to check progression eligibility');
    }
  }

  /**
   * Get detailed progression progress for user
   */
  async getProgress(userId: number): Promise<ProgressionProgress> {
    try {
      const response = await apiClient.get<{ success: boolean; data: ProgressionProgress }>(
        'tracking',
        `/api/tracking/progression/progress/${userId}`
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to get progression progress:', error);
      throw new Error(error.message || 'Failed to get progression progress');
    }
  }

  /**
   * Manually promote user (admin function)
   */
  async promoteUser(userId: number): Promise<{ message: string; new_level: string }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        new_level: string;
      }>('tracking', '/api/tracking/progression/promote', {
        user_id: userId,
      });
      return {
        message: response.data.message,
        new_level: response.data.new_level,
      };
    } catch (error: any) {
      console.error('Failed to promote user:', error);
      throw new Error(error.message || 'Failed to promote user');
    }
  }

  /**
   * Get fitness level display name
   */
  getFitnessLevelName(level: string): string {
    const levels: Record<string, string> = {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    };

    // Handle special cases
    if (!level || level === 'Max level reached' || level === 'null') {
      return 'Max Level';
    }

    return levels[level.toLowerCase()] || level;
  }

  /**
   * Get fitness level color
   */
  getFitnessLevelColor(level: string): string {
    const colors: Record<string, string> = {
      beginner: '#10B981', // Green
      intermediate: '#3B82F6', // Blue
      advanced: '#8B5CF6', // Purple
    };
    return colors[level] || '#6B7280'; // Gray
  }

  /**
   * Get fitness level emoji
   */
  getFitnessLevelEmoji(level: string): string {
    const emojis: Record<string, string> = {
      beginner: '🌱',
      intermediate: '🔥',
      advanced: '⭐',
    };
    return emojis[level] || '💪';
  }

  /**
   * Format time duration (minutes to readable format)
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hr${hours !== 1 ? 's' : ''} ${remainingMinutes} min`;
  }

  /**
   * Calculate percentage towards next level
   */
  calculateProgressPercentage(currentScore: number, requiredScore: number): number {
    if (requiredScore === 0) return 0;
    return Math.min(Math.round((currentScore / requiredScore) * 100), 100);
  }

  /**
   * Get motivational message based on progress
   */
  getMotivationalMessage(progressPercentage: number, nextLevel: string): string {
    if (progressPercentage >= 90) {
      return `Almost there! Just a few more workouts to reach ${nextLevel}! 🎯`;
    } else if (progressPercentage >= 75) {
      return `You're crushing it! ${progressPercentage}% towards ${nextLevel}! 💪`;
    } else if (progressPercentage >= 50) {
      return `Halfway there! Keep up the great work! 🔥`;
    } else if (progressPercentage >= 25) {
      return `Making progress! Keep going! 💫`;
    } else {
      return `Every workout counts! Start your journey to ${nextLevel}! 🌟`;
    }
  }
}

export const progressionService = new ProgressionService();
export default progressionService;
