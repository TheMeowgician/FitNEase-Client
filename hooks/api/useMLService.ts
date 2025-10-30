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

      // 🐛 DEBUG: Log all 8 recommendations from ML service
      if (recommendations.length > 0) {
        console.log(`🐛 [ML SERVICE DEBUG] All 8 recommendations:`, recommendations.map((r: any) => `${r.exercise_name} (${r.exercise_id})`));
      }

      return recommendations;
    } catch (err) {
      console.warn('⚠️ [ML SERVICE] Hybrid ML service unavailable, using CONTENT-BASED FALLBACK:', err);
      setError(null); // Don't set error state for non-critical failures
      try {
        // Fallback to content-based recommendations
        const fallbackRecs = await mlService.getContentBasedRecommendations(userId, { num_recommendations: limit });
        console.log(`✅ [ML SERVICE] Using CONTENT-BASED FALLBACK - Got ${fallbackRecs.length} recommendations`);

        // 🐛 DEBUG: Log fallback recommendations
        if (fallbackRecs.length > 0) {
          console.log(`🐛 [ML SERVICE DEBUG] Fallback recommendations:`, fallbackRecs.map((r: any) => `${r.exercise_name} (${r.exercise_id})`));
        }

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

  // Note: Nutrition, analyzeWorkout, and insights methods not implemented in MLService yet
  // Commenting out to avoid TypeScript errors

  return {
    getRecommendations,
    isLoading,
    error,
  };
};