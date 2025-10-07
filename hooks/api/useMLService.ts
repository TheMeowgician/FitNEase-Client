import { useState, useCallback } from 'react';
import { mlService } from '../../services';

export const useMLService = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = useCallback(async (userId: string, limit: number = 5) => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the hybrid model (primary endpoint) for better recommendations
      console.log('🤖 [ML SERVICE] Attempting HYBRID MODEL first...');
      const recommendations = await mlService.getRecommendations(userId, {
        num_recommendations: limit,
        content_weight: 0.7,
        collaborative_weight: 0.3,
      });

      // If hybrid returns no recommendations, fallback to content-based
      if (recommendations.length === 0) {
        console.warn('🔄 [ML SERVICE] Hybrid model returned no recommendations, falling back to CONTENT-BASED MODEL');
        const contentBasedRecs = await mlService.getContentBasedRecommendations(userId, { num_recommendations: limit });
        console.log(`✅ [ML SERVICE] Using CONTENT-BASED MODEL - Got ${contentBasedRecs.length} recommendations`);
        return contentBasedRecs;
      }

      console.log(`✅ [ML SERVICE] Using HYBRID MODEL - Got ${recommendations.length} recommendations`);
      return recommendations;
    } catch (err) {
      console.warn('⚠️ [ML SERVICE] Hybrid ML service unavailable, using CONTENT-BASED FALLBACK:', err);
      setError(null); // Don't set error state for non-critical failures
      try {
        // Fallback to content-based recommendations
        const fallbackRecs = await mlService.getContentBasedRecommendations(userId, { num_recommendations: limit });
        console.log(`✅ [ML SERVICE] Using CONTENT-BASED FALLBACK - Got ${fallbackRecs.length} recommendations`);
        return fallbackRecs;
      } catch (fallbackErr) {
        console.warn('❌ [ML SERVICE] Content-based fallback also failed:', fallbackErr);
        console.log('🚨 [ML SERVICE] All ML models failed - returning empty array');
        return [];
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getNutritionRecommendations = useCallback(async (options: any = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      return await mlService.getNutritionRecommendations(options);
    } catch (err) {
      setError((err as any).message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeWorkout = useCallback(async (workoutId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await mlService.analyzeWorkout({
        workoutId,
        includeComparison: true,
        includePredictions: true,
      });
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPersonalizedInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      return await mlService.getPersonalizedInsights();
    } catch (err) {
      setError((err as any).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getRecommendations,
    getNutritionRecommendations,
    analyzeWorkout,
    getPersonalizedInsights,
    isLoading,
    error,
  };
};