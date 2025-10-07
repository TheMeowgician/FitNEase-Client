import { useState, useEffect } from 'react';
import { engagementService, UserAchievement, Achievement, UserStats, LeaderboardEntry } from '../../services/microservices/engagementService';

export const useEngagementService = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserAchievements = async (userId: string): Promise<UserAchievement[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const achievements = await engagementService.getUserAchievements(userId);
      return achievements; // Already returns empty array on error
    } catch (err) {
      // This should not happen now since service handles errors gracefully
      setError(err instanceof Error ? err.message : 'Failed to get achievements');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableAchievements = async (): Promise<Achievement[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const achievements = await engagementService.getAvailableAchievements();
      return achievements; // Already returns empty array on error
    } catch (err) {
      // This should not happen now since service handles errors gracefully
      setError(err instanceof Error ? err.message : 'Failed to get available achievements');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getUserStats = async (userId: string): Promise<UserStats | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await engagementService.getUserStats(userId);
      return stats; // Already returns null on error
    } catch (err) {
      // This should not happen now since service handles errors gracefully
      setError(err instanceof Error ? err.message : 'Failed to get user stats');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getLeaderboard = async (timeframe: string = 'all_time', limit: number = 10): Promise<LeaderboardEntry[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const leaderboard = await engagementService.getLeaderboard(timeframe, limit);
      return leaderboard; // Already returns empty array on error
    } catch (err) {
      // This should not happen now since service handles errors gracefully
      setError(err instanceof Error ? err.message : 'Failed to get leaderboard');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const unlockAchievement = async (userId: number, achievementId: number): Promise<UserAchievement | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const achievement = await engagementService.unlockAchievement(userId, achievementId);
      return achievement;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock achievement');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    getUserAchievements,
    getAvailableAchievements,
    getUserStats,
    getLeaderboard,
    unlockAchievement
  };
};