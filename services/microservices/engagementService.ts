import { apiClient } from '../api/client';

export interface Achievement {
  achievement_id: number;
  achievement_name: string;
  description: string;
  achievement_type: string;
  criteria_json: any;
  points_value: number;
  badge_icon: string;
  badge_color: string;
  rarity_level: string;
  is_active: boolean;
}

export interface UserAchievement {
  user_achievement_id: number;
  user_id: number;
  achievement_id: number;
  progress_percentage: number;
  is_completed: boolean;
  earned_at: string | null;
  points_earned: number;
  achievement?: Achievement;
}

export interface UserStats {
  user_id: number;
  total_points: number;
  total_achievements: number;
  average_engagement_score: number;
  current_streak_days: number;
  recent_metrics: any[];
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  total_points: number;
  total_achievements: number;
}

export class EngagementService {
  private serviceName = 'engagement';

  public async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: UserAchievement[] }>(
        this.serviceName,
        `/api/engagement/achievements/${userId}`
      );
      return response.data.data;
    } catch (error) {
      console.warn('Engagement service unavailable - achievements feature disabled:', error);
      return []; // Return empty array instead of throwing
    }
  }

  public async getAvailableAchievements(): Promise<Achievement[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: Achievement[] }>(
        this.serviceName,
        '/engagement/available-achievements'
      );
      return response.data.data;
    } catch (error) {
      console.warn('Engagement service unavailable - available achievements feature disabled:', error);
      return []; // Return empty array instead of throwing
    }
  }

  public async getUserStats(userId: string): Promise<UserStats | null> {
    try {
      const response = await apiClient.get<{ success: boolean; data: UserStats }>(
        this.serviceName,
        `/api/engagement/user-stats/${userId}`
      );
      return response.data.data;
    } catch (error) {
      console.warn('Engagement service unavailable - user stats feature disabled:', error);
      return null; // Return null instead of throwing
    }
  }

  public async getLeaderboard(timeframe: string = 'all_time', limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: LeaderboardEntry[] }>(
        this.serviceName,
        `/engagement/leaderboard?timeframe=${timeframe}&limit=${limit}`
      );
      return response.data.data;
    } catch (error) {
      console.warn('Engagement service unavailable - leaderboard feature disabled:', error);
      return []; // Return empty array instead of throwing
    }
  }

  public async unlockAchievement(userId: number, achievementId: number): Promise<UserAchievement> {
    try {
      const response = await apiClient.post<{ success: boolean; data: UserAchievement }>(
        this.serviceName,
        '/engagement/unlock-achievement',
        {
          user_id: userId,
          achievement_id: achievementId
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to unlock achievement:', error);
      throw new Error('Failed to unlock achievement');
    }
  }

  public async updateAchievementProgress(userId: string, achievementId: number, progress: number): Promise<UserAchievement> {
    try {
      const response = await apiClient.put<{ success: boolean; data: UserAchievement }>(
        this.serviceName,
        `/engagement/achievement-progress/${userId}`,
        {
          achievement_id: achievementId,
          progress_percentage: progress
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to update achievement progress:', error);
      throw new Error('Failed to update achievement progress');
    }
  }

  public async getAchievementProgress(userId: string): Promise<any[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        this.serviceName,
        `/engagement/achievement-progress/${userId}`
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get achievement progress:', error);
      throw new Error('Failed to load achievement progress');
    }
  }

  /**
   * Check for newly unlocked achievements after a workout
   * This should be called after saving a workout session
   */
  public async checkAchievementsAfterWorkout(userId: string | number): Promise<any[]> {
    try {
      const response = await apiClient.post<{ success: boolean; data: { newly_unlocked: any[] } }>(
        this.serviceName,
        '/api/engagement/check-achievements',
        { user_id: Number(userId) }
      );

      const newlyUnlocked = response.data.data?.newly_unlocked || [];

      if (newlyUnlocked.length > 0) {
        console.log('🏆 [ENGAGEMENT] Newly unlocked achievements:', newlyUnlocked.length);
      }

      return newlyUnlocked;
    } catch (error) {
      console.warn('Engagement service unavailable - achievement check skipped:', error);
      return [];
    }
  }

  /**
   * Get achievements that were recently unlocked (within last hour)
   * Used to show achievement modal if user missed it
   */
  public async getRecentlyUnlockedAchievements(userId: string | number): Promise<any[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        this.serviceName,
        `/api/engagement/recently-unlocked/${userId}`
      );
      return response.data.data || [];
    } catch (error) {
      console.warn('Could not fetch recently unlocked achievements:', error);
      return [];
    }
  }
}

export const engagementService = new EngagementService();