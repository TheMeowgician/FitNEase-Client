import { useState, useCallback } from 'react';
import { planningService } from '../../services/microservices/planningService';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const usePlanningService = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Get today's day of week in lowercase
   */
  const getTodayDay = (): DayOfWeek => {
    const today = new Date().getDay();
    const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayMap[today];
  };

  /**
   * Fetch today's exercises from the weekly plan
   * @param userId - The user ID
   * @returns Array of exercises for today, or empty array if today is a rest day
   */
  const getTodayExercises = useCallback(async (userId: string | number): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[PLANNING] Fetching weekly plan for user:', userId);

      // Fetch current week's plan from Planning Service
      const response = await planningService.getCurrentWeeklyPlan(userId);

      if (!response || !response.plan_data) {
        console.warn('[PLANNING] No plan data found');
        return [];
      }

      // Get today's day of week
      const today = getTodayDay();
      console.log('[PLANNING] Today is:', today);

      // Get today's exercises from the plan
      const todayPlan = response.plan_data[today];

      if (!todayPlan || todayPlan.rest_day) {
        console.log('[PLANNING] Today is a rest day');
        return [];
      }

      const exercises = todayPlan.exercises || [];
      console.log(`[PLANNING] Found ${exercises.length} exercises for today (${today})`);
      console.log('[PLANNING] First exercise:', exercises[0]?.exercise_name, `(ID: ${exercises[0]?.exercise_id})`);

      return exercises;
    } catch (err) {
      console.error('[PLANNING] Error fetching today\'s exercises:', err);
      setError(err as Error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch the complete weekly plan
   * @param userId - The user ID
   * @returns The weekly plan object
   */
  const getWeeklyPlan = useCallback(async (userId: string | number) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await planningService.getCurrentWeeklyPlan(userId);
      return response;
    } catch (err) {
      console.error('[PLANNING] Error fetching weekly plan:', err);
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getTodayExercises,
    getWeeklyPlan,
    isLoading,
    error,
  };
};
