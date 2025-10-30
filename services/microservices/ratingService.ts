import { apiClient } from '../api/client';

/**
 * Rating Service
 *
 * Handles exercise rating submissions for collaborative filtering.
 * This is CRITICAL for enabling personalized ML recommendations.
 */

interface ExerciseRating {
  exercise_id: number;
  rating_value: number;
  difficulty_perceived?: 'too_easy' | 'appropriate' | 'challenging' | 'too_hard';
  enjoyment_rating?: number;
  would_do_again?: boolean;
  notes?: string;
  completed?: boolean;
  completed_reps?: number;
  completed_duration_seconds?: number;
  came_from_recommendation?: boolean;
  recommendation_session_id?: string;
}

interface BatchRatingRequest {
  user_id: number;
  session_id: number;
  workout_id?: number;
  ratings: ExerciseRating[];
}

interface SingleRatingRequest extends ExerciseRating {
  user_id: number;
  session_id: number;
  workout_id?: number;
}

export const ratingService = {
  /**
   * Submit exercise ratings in batch (recommended)
   * Called after workout completion with all exercise ratings
   */
  async submitExerciseRatingsBatch(data: BatchRatingRequest) {
    try {
      console.log('📊 [RATING SERVICE] Submitting batch ratings:', {
        userId: data.user_id,
        sessionId: data.session_id,
        count: data.ratings.length,
      });

      const response = await apiClient.post('tracking', '/api/exercise-ratings/batch', data);

      console.log('✅ [RATING SERVICE] Batch ratings submitted successfully:', {
        saved: response.data?.data?.saved_count,
        errors: response.data?.data?.error_count,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to submit batch ratings:', {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  },

  /**
   * Submit single exercise rating
   * Use for rating individual exercises outside of workout completion
   */
  async submitExerciseRating(data: SingleRatingRequest) {
    try {
      console.log('📊 [RATING SERVICE] Submitting single rating:', {
        userId: data.user_id,
        exerciseId: data.exercise_id,
        rating: data.rating_value,
      });

      const response = await apiClient.post('tracking', '/api/exercise-rating', data);

      console.log('✅ [RATING SERVICE] Rating submitted successfully');

      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to submit rating:', {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  },

  /**
   * Get user's exercise ratings
   */
  async getUserRatings(userId: number) {
    try {
      const response = await apiClient.get('tracking', `/api/exercise-ratings/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to fetch user ratings:', error);
      throw error;
    }
  },

  /**
   * Get ratings for a specific exercise
   */
  async getExerciseRatings(exerciseId: number) {
    try {
      const response = await apiClient.get('tracking', `/api/exercise-ratings/exercise/${exerciseId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to fetch exercise ratings:', error);
      throw error;
    }
  },

  /**
   * Get rating statistics for a user
   */
  async getRatingStats(userId: number) {
    try {
      const response = await apiClient.get('tracking', `/api/exercise-ratings/stats/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to fetch rating stats:', error);
      throw error;
    }
  },

  /**
   * Get ratings for a specific session
   */
  async getSessionRatings(sessionId: number) {
    try {
      const response = await apiClient.get('tracking', `/api/exercise-ratings/session/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ [RATING SERVICE] Failed to fetch session ratings:', error);
      throw error;
    }
  },
};
