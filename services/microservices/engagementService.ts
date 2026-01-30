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
  private serviceName = 'engagement' as const;

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
        '/api/engagement/available-achievements'
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
        `/api/engagement/leaderboard?timeframe=${timeframe}&limit=${limit}`
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
        '/api/engagement/unlock-achievement',
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
        `/api/engagement/achievement-progress/${userId}`,
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
        `/api/engagement/achievement-progress/${userId}`
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

  /**
   * Get achievements that user hasn't seen yet (seen_at IS NULL)
   * Used to show achievement modal when app opens
   */
  public async getUnseenAchievements(userId: string | number): Promise<any[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        this.serviceName,
        `/api/engagement/unseen-achievements/${userId}`
      );
      return response.data.data || [];
    } catch (error) {
      console.warn('Could not fetch unseen achievements:', error);
      return [];
    }
  }

  /**
   * Mark achievements as seen after user dismisses the modal
   */
  public async markAchievementsSeen(userId: string | number, userAchievementIds: number[]): Promise<boolean> {
    try {
      await apiClient.post(
        this.serviceName,
        '/api/engagement/mark-achievements-seen',
        {
          user_id: Number(userId),
          user_achievement_ids: userAchievementIds
        }
      );
      console.log('🏆 [ENGAGEMENT] Marked achievements as seen:', userAchievementIds.length);
      return true;
    } catch (error) {
      console.warn('Could not mark achievements as seen:', error);
      return false;
    }
  }

  /**
   * Unlock level-based achievement (beginner, intermediate, advanced)
   * Called when user's fitness level changes
   */
  public async unlockLevelAchievement(userId: string | number, level: 'beginner' | 'intermediate' | 'advanced'): Promise<any | null> {
    try {
      const response = await apiClient.post<{ success: boolean; data: any }>(
        this.serviceName,
        '/api/engagement/unlock-level-achievement',
        {
          user_id: Number(userId),
          level
        }
      );

      if (response.data.data) {
        console.log('🏆 [ENGAGEMENT] Level achievement unlocked:', level);
      }

      return response.data.data || null;
    } catch (error) {
      console.warn('Could not unlock level achievement:', error);
      return null;
    }
  }
}

export const engagementService = new EngagementService();