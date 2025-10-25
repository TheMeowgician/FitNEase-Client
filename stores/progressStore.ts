import { create } from 'zustand';
import { trackingService } from '../services/microservices/trackingService';
import { progressionService, ProgressionProgress } from '../services/microservices/progressionService';

interface WeeklyStats {
  this_week_sessions: number;
  total_calories_burned: number;
  total_exercise_time: number;
}

interface OverallStats {
  totalWorkouts: number;
  totalMinutes: number;
  totalCalories: number;
  activeDays: number;
  currentStreak: number;
  thisWeekWorkouts: number;
  thisMonthWorkouts: number;
}

interface WorkoutHistoryItem {
  id: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  workoutType: string;
  completed: boolean;
}

interface ProgressState {
  // Data
  workoutHistory: WorkoutHistoryItem[];
  weeklyStats: WeeklyStats | null;
  overallStats: OverallStats | null;
  progressionData: ProgressionProgress | null;
  engagementStats: any | null;
  recentWorkouts: any[];

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchTime: number | null;

  // Cache duration (5 minutes)
  CACHE_DURATION: number;

  // Actions
  fetchAllProgressData: (userId: string) => Promise<void>;
  fetchWeeklyStats: (userId: string) => Promise<void>;
  fetchProgressionData: (userId: string) => Promise<void>;
  refreshAfterWorkout: (userId: string) => Promise<void>;
  invalidateCache: () => void;
  reset: () => void;
}

const calculateWeeklyStats = (workoutHistory: any[]): WeeklyStats => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekWorkouts = workoutHistory.filter((w: any) => {
    const workoutDate = new Date(w.date);
    return workoutDate >= startOfWeek;
  });

  return {
    this_week_sessions: thisWeekWorkouts.length,
    total_calories_burned: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
    total_exercise_time: thisWeekWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
  };
};

const calculateOverallStats = (workoutHistory: any[], engagementStats: any): OverallStats => {
  const now = new Date();

  // This week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const thisWeekWorkouts = workoutHistory.filter((w: any) => {
    const workoutDate = new Date(w.date);
    return workoutDate >= startOfWeek;
  }).length;

  // This month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthWorkouts = workoutHistory.filter((w: any) => {
    const workoutDate = new Date(w.date);
    return workoutDate >= startOfMonth;
  }).length;

  // Active days
  const uniqueDates = new Set(
    workoutHistory.map((w: any) => new Date(w.date).toDateString())
  );

  return {
    totalWorkouts: workoutHistory.length,
    totalMinutes: workoutHistory.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
    totalCalories: workoutHistory.reduce((sum: number, w: any) => sum + (w.caloriesBurned || 0), 0),
    activeDays: uniqueDates.size,
    currentStreak: engagementStats?.current_streak_days || 0,
    thisWeekWorkouts,
    thisMonthWorkouts,
  };
};

export const useProgressStore = create<ProgressState>((set, get) => ({
  // Initial state
  workoutHistory: [],
  weeklyStats: null,
  overallStats: null,
  progressionData: null,
  engagementStats: null,
  recentWorkouts: [],
  isLoading: false,
  isRefreshing: false,
  lastFetchTime: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  // Fetch all progress data (used on initial load and manual refresh)
  fetchAllProgressData: async (userId: string) => {
    const state = get();

    // Check cache - skip if data is fresh (unless refreshing)
    const now = Date.now();
    if (
      state.lastFetchTime &&
      now - state.lastFetchTime < state.CACHE_DURATION &&
      !state.isRefreshing
    ) {
      console.log('📊 [PROGRESS STORE] Using cached data');
      return;
    }

    try {
      set({ isLoading: !state.lastFetchTime, isRefreshing: !!state.lastFetchTime });
      console.log('📊 [PROGRESS STORE] Fetching all progress data for user:', userId);

      // Fetch all data in parallel
      const [workoutHistory, progressionData, engagementStats, recentWorkoutSessions] = await Promise.all([
        trackingService.getWorkoutHistory(userId).catch((err: Error) => {
          console.warn('⚠️ [PROGRESS STORE] Workout history unavailable:', err);
          return [];
        }),
        progressionService.getProgress(parseInt(userId)).catch(() => {
          console.warn('⚠️ [PROGRESS STORE] Progression data unavailable');
          return null;
        }),
        // We'll get engagement stats from another service if available
        Promise.resolve(null),
        trackingService.getSessions({ status: 'completed', limit: 5, userId }).catch(() => {
          console.warn('⚠️ [PROGRESS STORE] Recent workouts unavailable');
          return { sessions: [], total: 0, page: 1, limit: 5 };
        }),
      ]);

      // Calculate derived stats
      const weeklyStats = calculateWeeklyStats(workoutHistory);
      const overallStats = calculateOverallStats(workoutHistory, engagementStats);

      console.log('✅ [PROGRESS STORE] Data fetched successfully:', {
        workoutHistory: workoutHistory.length,
        weeklyStats,
        overallStats,
        progressionData: !!progressionData,
      });

      set({
        workoutHistory,
        weeklyStats,
        overallStats,
        progressionData,
        engagementStats,
        recentWorkouts: recentWorkoutSessions?.sessions || [],
        lastFetchTime: Date.now(),
        isLoading: false,
        isRefreshing: false,
      });
    } catch (error) {
      console.error('❌ [PROGRESS STORE] Error fetching progress data:', error);
      set({ isLoading: false, isRefreshing: false });
      throw error;
    }
  },

  // Fetch only weekly stats (lightweight, for dashboard refresh)
  fetchWeeklyStats: async (userId: string) => {
    try {
      console.log('📊 [PROGRESS STORE] Fetching weekly stats only');
      const workoutHistory = await trackingService.getWorkoutHistory(userId);
      const weeklyStats = calculateWeeklyStats(workoutHistory);

      set({ weeklyStats, workoutHistory });
      console.log('✅ [PROGRESS STORE] Weekly stats updated:', weeklyStats);
    } catch (error) {
      console.error('❌ [PROGRESS STORE] Error fetching weekly stats:', error);
    }
  },

  // Fetch only progression data (for ProgressionCard refresh)
  fetchProgressionData: async (userId: string) => {
    try {
      console.log('📊 [PROGRESS STORE] Fetching progression data only');
      const progressionData = await progressionService.getProgress(parseInt(userId));

      set({ progressionData });
      console.log('✅ [PROGRESS STORE] Progression data updated:', progressionData);
    } catch (error) {
      console.error('❌ [PROGRESS STORE] Error fetching progression data:', error);
    }
  },

  // Refresh after workout completion (invalidates cache and refetches)
  refreshAfterWorkout: async (userId: string) => {
    console.log('🔄 [PROGRESS STORE] Refreshing after workout completion');
    get().invalidateCache();
    await get().fetchAllProgressData(userId);
  },

  // Invalidate cache to force refetch on next access
  invalidateCache: () => {
    console.log('🗑️ [PROGRESS STORE] Cache invalidated');
    set({ lastFetchTime: null });
  },

  // Reset store (on logout)
  reset: () => {
    console.log('🔄 [PROGRESS STORE] Resetting store');
    set({
      workoutHistory: [],
      weeklyStats: null,
      overallStats: null,
      progressionData: null,
      engagementStats: null,
      recentWorkouts: [],
      isLoading: false,
      isRefreshing: false,
      lastFetchTime: null,
    });
  },
}));
