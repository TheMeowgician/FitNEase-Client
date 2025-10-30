import { create } from 'zustand';

interface RecommendationState {
  recommendations: any[];
  isLoading: boolean;
  lastFetchTime: number | null;
  fetchRecommendations: (userId: string, getRecommendations: (userId: string, limit: number) => Promise<any[]>) => Promise<void>;
  clearRecommendations: () => void;
}

/**
 * Shared recommendation store to ensure all pages show the SAME exercises
 * Fetches once and caches for 5 minutes to maintain consistency
 */
export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  recommendations: [],
  isLoading: false,
  lastFetchTime: null,

  fetchRecommendations: async (userId: string, getRecommendations: (userId: string, limit: number) => Promise<any[]>) => {
    const state = get();
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Return cached recommendations if still fresh
    if (state.recommendations.length > 0 && state.lastFetchTime && (now - state.lastFetchTime) < CACHE_DURATION) {
      console.log('🎯 [RECOMMENDATION STORE] Using cached recommendations');
      return;
    }

    try {
      set({ isLoading: true });
      console.log('🎯 [RECOMMENDATION STORE] Fetching fresh recommendations from ML service...');

      const recs = await getRecommendations(userId, 8);

      console.log(`🎯 [RECOMMENDATION STORE] Fetched ${recs.length} recommendations, caching for all pages`);
      console.log('🎯 [RECOMMENDATION STORE] Exercises:', recs.map((r: any) => `${r.exercise_name} (${r.exercise_id})`));

      set({
        recommendations: recs,
        lastFetchTime: now,
        isLoading: false
      });
    } catch (error) {
      console.error('❌ [RECOMMENDATION STORE] Failed to fetch recommendations:', error);
      set({ isLoading: false });
    }
  },

  clearRecommendations: () => {
    console.log('🎯 [RECOMMENDATION STORE] Clearing cached recommendations');
    set({ recommendations: [], lastFetchTime: null });
  },
}));
