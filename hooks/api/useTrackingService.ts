import { useState, useCallback } from 'react';
import { trackingService } from '../../services';

export const useTrackingService = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSessionStats = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const dashboard = await trackingService.getDashboardSummary();
      return {
        this_week_sessions: dashboard.weeklyStats.workouts,
        total_calories_burned: dashboard.weeklyStats.calories,
        total_exercise_time: dashboard.weeklyStats.duration,
      };
    } catch (err) {
      console.warn('Tracking service unavailable, using fallback stats:', err);
      setError(null); // Don't set error state for non-critical failures
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startWorkoutSession = useCallback(async (workoutId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await trackingService.startWorkout({ workoutId });
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeWorkoutSession = useCallback(async (sessionId: string, data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      return await trackingService.completeWorkout(sessionId, data);
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getWorkoutSessions = useCallback(async (filters: any = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      return await trackingService.getSessions(filters);
    } catch (err) {
      setError((err as any).message);
      return { sessions: [], total: 0, page: 1, limit: 20 };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPerformanceMetrics = useCallback(async (period: 'week' | 'month' | 'year' = 'month') => {
    setIsLoading(true);
    setError(null);
    try {
      return await trackingService.getPerformanceMetrics(period);
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logProgress = useCallback(async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      return await trackingService.logProgress(data);
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getSessionStats,
    startWorkoutSession,
    completeWorkoutSession,
    getWorkoutSessions,
    getPerformanceMetrics,
    logProgress,
    isLoading,
    error,
  };
};