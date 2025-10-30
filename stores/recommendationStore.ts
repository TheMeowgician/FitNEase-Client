import { create } from 'zustand';
import type { RecommendationResponse } from '../services/microservices/mlService';

interface RecommendationState {
  recommendations: any[];
  algorithm: string | null;  // e.g., "hybrid", "hybrid_fallback_to_content"
  algorithmDisplay: string | null;  // e.g., "Hybrid", "Content"
  weights: { content_weight: number; collaborative_weight: number } | null;
  isLoading: boolean;
  lastFetchTime: number | null;
  fetchRecommendations: (userId: string, getRecommendations: (userId: string, limit: number) => Promise<RecommendationResponse>) => Promise<void>;
  clearRecommendations: () => void;
}

/**
 * Shared recommendation store to ensure all pages show the SAME exercises
 * Fetches once and caches for 5 minutes to maintain consistency
 */
export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  recommendations: [],
  algorithm: null,
  algorithmDisplay: null,
  weights: null,
  isLoading: false,
  lastFetchTime: null,

  fetchRecommendations: async (userId: string, getRecommendations: (userId: string, limit: number) => Promise<RecommendationResponse>) => {
    const state = get();
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Return cached recommendations if still fresh
    if (state.recommendations.length > 0 && state.lastFetchTime && (now - state.lastFetchTime) < CACHE_DURATION) {
      console.log('🎯 [RECOMMENDATION STORE] Using cached recommendations');
      console.log(`🎯 [RECOMMENDATION STORE] Algorithm: ${state.algorithm} (${state.algorithmDisplay})`);
      return;
    }

    try {
      set({ isLoading: true });
      console.log('🎯 [RECOMMENDATION STORE] Fetching fresh recommendations from ML service...');

      const response = await getRecommendations(userId, 8);

      console.log(`🎯 [RECOMMENDATION STORE] Fetched ${response.recommendations.length} recommendations, caching for all pages`);
      console.log(`🎯 [RECOMMENDATION STORE] Algorithm: ${response.algorithm} (${response.algorithmDisplay})`);
      console.log('🎯 [RECOMMENDATION STORE] Exercises:', response.recommendations.map((r: any) => `${r.exercise_name} (${r.exercise_id})`));

      // Log if using fallback
      if (response.algorithm === 'hybrid_fallback_to_content') {
        console.warn('⚠️  [RECOMMENDATION STORE] Hybrid model fell back to content-only (insufficient collaborative data)');
      } else if (response.algorithm === 'hybrid') {
        console.log('✅ [RECOMMENDATION STORE] Hybrid model using BOTH content and collaborative filtering!');
      }

      set({
        recommendations: response.recommendations,
        algorithm: response.algorithm,
        algorithmDisplay: response.algorithmDisplay || 'Hybrid',
        weights: response.weights || null,
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
    set({
      recommendations: [],
      algorithm: null,
      algorithmDisplay: null,
      weights: null,
      lastFetchTime: null
    });
  },
}));
