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
  const getTodayExercises = useCallback(async (userId: string | number, sessionCount?: number): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[PLANNING] Fetching weekly plan for user:', userId);

      // Fetch current week's plan from Planning Service
      const response = await planningService.getCurrentWeeklyPlan(userId, sessionCount);

      // Backend returns: { data: { plan: {...}, today: {...}, today_day_name: "..." } }
      // The response from planningService.getCurrentWeeklyPlan is response.data
      const planData = response?.data || response;

      if (!planData) {
        console.warn('[PLANNING] No response data found');
        return [];
      }

      // Get today's day name from the response
      const todayDayName = planData.today_day_name;
      console.log('[PLANNING] Today is:', todayDayName);

      // Get today's exercises directly from the "today" field in the response
      const todayPlan = planData.today;

      if (!todayPlan) {
        console.warn('[PLANNING] No today plan found in response');
        return [];
      }

      if (todayPlan.rest_day) {
        console.log('[PLANNING] Today is a rest day');
        return [];
      }

      const exercises = todayPlan.exercises || [];
      console.log(`[PLANNING] Found ${exercises.length} exercises for today (${todayDayName})`);
      if (exercises.length > 0) {
        console.log('[PLANNING] First exercise:', exercises[0]?.exercise_name, `(ID: ${exercises[0]?.exercise_id})`);
      }

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
  const getWeeklyPlan = useCallback(async (userId: string | number, sessionCount?: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await planningService.getCurrentWeeklyPlan(userId, sessionCount);
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
