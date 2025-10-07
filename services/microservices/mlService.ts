import { apiClient, type APIClientConfig } from '../api/client';

// ML Service types based on actual backend
export interface MLRecommendation {
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  workout_name?: string;
  recommendation_score: number;
  content_based_score: number;
  collaborative_score: number;
  algorithm_used: 'content_based' | 'collaborative' | 'hybrid' | 'random_forest';
  recommendation_reason: string;
  difficulty_level: number; // 1-3 (beginner-advanced)
  target_muscle_group: string;
  default_duration_seconds: number;
  estimated_calories_burned: number;
  equipment_needed?: string;
  exercise_category: string;
}

export interface UserBehaviorData {
  user_id: number;
  workout_ratings: Array<{
    workout_id: number;
    exercise_id: number;
    rating: number;
    completed: boolean;
    duration_minutes: number;
  }>;
  completion_rates: {
    overall: number;
    by_difficulty: Record<string, number>;
    by_muscle_group: Record<string, number>;
  };
  preferences: {
    preferred_muscle_groups: string[];
    preferred_difficulty: number;
    average_session_duration: number;
    most_active_times: string[];
  };
}

export interface MLPrediction {
  difficulty_prediction: number;
  completion_probability: number;
  suitability_score: number;
  confidence_level: number;
  predicted_duration: number;
  predicted_calories: number;
}

export interface ContentSimilarity {
  exercise_id_1: number;
  exercise_id_2: number;
  similarity_threshold?: number;
}

export interface SimilarExercises {
  target_exercise_id: number;
  similarity_threshold?: number;
  limit?: number;
}

export class MLService {
  private serviceName: keyof APIClientConfig = 'ml';
  private baseUrl = '/api/v1'; // Flask API base path

  // Main hybrid recommendations (PRIMARY ENDPOINT)
  public async getRecommendations(
    userId: string | number,
    options?: {
      num_recommendations?: number;
      content_weight?: number;
      collaborative_weight?: number;
    }
  ): Promise<MLRecommendation[]> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const params = new URLSearchParams();
        if (options?.num_recommendations) {
          params.append('num_recommendations', options.num_recommendations.toString());
        }
        if (options?.content_weight) {
          params.append('content_weight', options.content_weight.toString());
        }
        if (options?.collaborative_weight) {
          params.append('collaborative_weight', options.collaborative_weight.toString());
        }

        const url = `${this.baseUrl}/recommendations/${userId}?${params.toString()}`;

        if (attempt > 1) {
          console.log(`🔄 [ML SERVICE] Retry attempt ${attempt}/${maxRetries}...`);
        }

        const response = await apiClient.get<{
          recommendations: MLRecommendation[];
          algorithm: string;
          count: number;
          status: string;
          user_id: number;
          weights?: { collaborative_weight: number; content_weight: number };
        }>(
          this.serviceName,
          url,
          { timeout: 45000 } // Increase timeout to 45 seconds for ML service
        );

        console.log(`✅ [ML SERVICE] Success on attempt ${attempt}`);
        return response.data.recommendations;
      } catch (error) {
        lastError = error;
        console.warn(`❌ [ML SERVICE] Attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.warn('ML hybrid service unavailable after retries - returning empty recommendations:', lastError);
    return []; // Don't use misleading fallback for hybrid recommendations
  }

  // Content-based recommendations only
  public async getContentBasedRecommendations(
    userId: string | number,
    options?: { num_recommendations?: number }
  ): Promise<MLRecommendation[]> {
    try {
      const params = new URLSearchParams();
      if (options?.num_recommendations) {
        params.append('num_recommendations', options.num_recommendations.toString());
      }

      const response = await apiClient.get<{
        recommendations: MLRecommendation[];
        algorithm: string;
        count: number;
        status: string;
        user_id: number;
      }>(
        this.serviceName,
        `${this.baseUrl}/content-recommendations/${userId}?${params.toString()}`
      );
      return response.data.recommendations;
    } catch (error) {
      console.warn('ML content-based service unavailable:', error);
      return []; // Content-based fallbacks could be added here for new users if needed
    }
  }

  // Collaborative filtering recommendations only
  public async getCollaborativeRecommendations(
    userId: string | number,
    options?: { num_recommendations?: number }
  ): Promise<MLRecommendation[]> {
    try {
      const params = new URLSearchParams();
      if (options?.num_recommendations) {
        params.append('num_recommendations', options.num_recommendations.toString());
      }

      const response = await apiClient.get<{
        recommendations: MLRecommendation[];
        algorithm: string;
        count: number;
        status: string;
        user_id: number;
      }>(
        this.serviceName,
        `${this.baseUrl}/collaborative-recommendations/${userId}?${params.toString()}`
      );
      return response.data.recommendations;
    } catch (error) {
      console.warn('ML collaborative service unavailable:', error);
      return []; // No fallbacks for collaborative - requires user rating data
    }
  }

  // Calculate exercise similarity
  public async calculateExerciseSimilarity(
    data: ContentSimilarity
  ): Promise<{ similarity_score: number } | null> {
    try {
      const response = await apiClient.post<{ similarity_score: number }>(
        this.serviceName,
        `${this.baseUrl}/exercise-similarity`,
        data
      );
      return response.data;
    } catch (error) {
      console.warn('ML exercise similarity unavailable:', error);
      return null;
    }
  }

  // Get similar exercises
  public async getSimilarExercises(
    data: SimilarExercises
  ): Promise<MLRecommendation[]> {
    try {
      const response = await apiClient.post<MLRecommendation[]>(
        this.serviceName,
        `${this.baseUrl}/similar-exercises`,
        data
      );
      return response.data;
    } catch (error) {
      console.warn('ML similar exercises unavailable:', error);
      return [];
    }
  }

  // Random Forest predictions
  public async predictDifficulty(
    userId: number,
    workoutId: number
  ): Promise<any> {
    try {
      const response = await apiClient.post<any>(
        this.serviceName,
        `${this.baseUrl}/predict-difficulty`,
        { user_id: userId, workout_id: workoutId }
      );
      return response.data;
    } catch (error) {
      console.warn('ML difficulty prediction unavailable:', error);
      return null;
    }
  }

  public async predictCompletion(
    userId: number,
    workoutId: number
  ): Promise<any> {
    try {
      const response = await apiClient.post<any>(
        this.serviceName,
        `${this.baseUrl}/predict-completion`,
        { user_id: userId, workout_id: workoutId }
      );
      return response.data;
    } catch (error) {
      console.warn('ML completion prediction unavailable:', error);
      return null;
    }
  }

  public async predictSuitability(
    userId: number,
    workoutId: number
  ): Promise<any> {
    try {
      const response = await apiClient.post<any>(
        this.serviceName,
        `${this.baseUrl}/predict-suitability`,
        { user_id: userId, workout_id: workoutId }
      );
      return response.data;
    } catch (error) {
      console.warn('ML suitability prediction unavailable:', error);
      return null;
    }
  }

  // Update user behavioral data
  public async updateBehaviorData(
    data: UserBehaviorData
  ): Promise<boolean> {
    try {
      await apiClient.post(
        this.serviceName,
        `${this.baseUrl}/behavioral-data`,
        data
      );
      return true;
    } catch (error) {
      console.warn('ML behavioral data update unavailable:', error);
      return false;
    }
  }

  // Get user behavioral patterns
  public async getUserPatterns(
    userId: string | number
  ): Promise<any> {
    try {
      const response = await apiClient.get(
        this.serviceName,
        `${this.baseUrl}/user-patterns/${userId}`
      );
      return response.data;
    } catch (error) {
      console.warn('ML user patterns unavailable:', error);
      return null;
    }
  }

  // Model management
  public async getModelHealth(): Promise<any> {
    try {
      const response = await apiClient.get(
        this.serviceName,
        `${this.baseUrl}/model-health`
      );
      return response.data;
    } catch (error) {
      console.warn('ML model health check unavailable:', error);
      return null;
    }
  }

  // Legacy method for backward compatibility
  public async getWorkoutRecommendations(
    options?: { type?: string; num_recommendations?: number; userId?: string | number }
  ): Promise<MLRecommendation[]> {
    // Default to content-based recommendations if no specific type requested
    const userId = options?.userId || '35'; // Default user for now
    const numRecs = options?.num_recommendations || 15;

    try {
      return await this.getContentBasedRecommendations(userId, { num_recommendations: numRecs });
    } catch (error) {
      console.warn('ML service unavailable, using fallback recommendations:', error);
      return [];
    }
  }

  public async trainModels(
    data?: { retrain_all?: boolean; model_types?: string[] }
  ): Promise<boolean> {
    try {
      await apiClient.post(
        this.serviceName,
        `${this.baseUrl}/train-model`,
        data || {}
      );
      return true;
    } catch (error) {
      console.warn('ML model training unavailable:', error);
      return false;
    }
  }

  // Fallback recommendations when ML service is unavailable
  // DEPRECATED: This was used for misleading hybrid fallbacks.
  // If needed, should only be used for content-based fallbacks for new users.
  private getFallbackRecommendations(limit: number): MLRecommendation[] {
    const fallbackExercises = [
      {
        workout_id: 1,
        exercise_id: 1,
        exercise_name: 'Burpees',
        workout_name: 'High-Intensity Tabata',
        recommendation_score: 0.85,
        content_based_score: 0.80,
        collaborative_score: 0.90,
        algorithm_used: 'content_based' as const, // Fixed: was misleadingly labeled as 'hybrid'
        recommendation_reason: 'Content-based: Perfect for full-body conditioning based on your fitness level',
        difficulty_level: 2,
        target_muscle_group: 'core,upper_body,lower_body',
        default_duration_seconds: 240, // 4 minutes
        estimated_calories_burned: 120,
        equipment_needed: 'none',
        exercise_category: 'tabata',
      },
      {
        workout_id: 2,
        exercise_id: 2,
        exercise_name: 'Mountain Climbers',
        workout_name: 'Core Power Tabata',
        recommendation_score: 0.82,
        content_based_score: 0.85,
        collaborative_score: 0.79,
        algorithm_used: 'content_based' as const, // Fixed: was misleadingly labeled as 'hybrid'
        recommendation_reason: 'Content-based: Excellent for core strength and cardiovascular fitness',
        difficulty_level: 1,
        target_muscle_group: 'core,upper_body',
        default_duration_seconds: 240,
        estimated_calories_burned: 100,
        equipment_needed: 'none',
        exercise_category: 'tabata',
      },
      {
        workout_id: 3,
        exercise_id: 3,
        exercise_name: 'Jump Squats',
        workout_name: 'Lower Body Blast',
        recommendation_score: 0.78,
        content_based_score: 0.75,
        collaborative_score: 0.81,
        algorithm_used: 'content_based' as const, // Fixed: was misleadingly labeled as 'hybrid'
        recommendation_reason: 'Great for building lower body power and strength',
        difficulty_level: 2,
        target_muscle_group: 'lower_body,core',
        default_duration_seconds: 240,
        estimated_calories_burned: 110,
        equipment_needed: 'none',
        exercise_category: 'tabata',
      },
      {
        workout_id: 4,
        exercise_id: 4,
        exercise_name: 'High Knees',
        workout_name: 'Cardio Kickstart',
        recommendation_score: 0.75,
        content_based_score: 0.78,
        collaborative_score: 0.72,
        algorithm_used: 'content_based' as const,
        recommendation_reason: 'Content-based: Perfect warm-up exercise that builds endurance',
        difficulty_level: 1,
        target_muscle_group: 'lower_body,core',
        default_duration_seconds: 240,
        estimated_calories_burned: 90,
        equipment_needed: 'none',
        exercise_category: 'tabata',
      },
      {
        workout_id: 5,
        exercise_id: 5,
        exercise_name: 'Push-up to T',
        workout_name: 'Upper Body Challenge',
        recommendation_score: 0.72,
        content_based_score: 0.70,
        collaborative_score: 0.74,
        algorithm_used: 'collaborative' as const,
        recommendation_reason: 'Advanced movement combining strength and mobility',
        difficulty_level: 3,
        target_muscle_group: 'upper_body,core',
        default_duration_seconds: 240,
        estimated_calories_burned: 105,
        equipment_needed: 'none',
        exercise_category: 'tabata',
      },
    ];

    return fallbackExercises.slice(0, limit);
  }
}

export const mlService = new MLService();

export const useMLService = () => {
  const getRecommendations = async (
    userId: string | number,
    options?: {
      num_recommendations?: number;
      content_weight?: number;
      collaborative_weight?: number;
    }
  ) => {
    return mlService.getRecommendations(userId, options);
  };

  const getContentBasedRecommendations = async (
    userId: string | number,
    numRecommendations?: number
  ) => {
    return mlService.getContentBasedRecommendations(userId, { num_recommendations: numRecommendations });
  };

  const getCollaborativeRecommendations = async (
    userId: string | number,
    numRecommendations?: number
  ) => {
    return mlService.getCollaborativeRecommendations(userId, { num_recommendations: numRecommendations });
  };

  const updateBehaviorData = async (
    data: UserBehaviorData
  ) => {
    return mlService.updateBehaviorData(data);
  };

  const predictDifficulty = async (
    userId: number,
    workoutId: number
  ) => {
    return mlService.predictDifficulty(userId, workoutId);
  };

  const predictCompletion = async (
    userId: number,
    workoutId: number
  ) => {
    return mlService.predictCompletion(userId, workoutId);
  };

  const predictSuitability = async (
    userId: number,
    workoutId: number
  ) => {
    return mlService.predictSuitability(userId, workoutId);
  };

  const getSimilarExercises = async (
    exerciseId: number,
    limit: number = 5,
    similarityThreshold?: number
  ) => {
    return mlService.getSimilarExercises({
      target_exercise_id: exerciseId,
      limit,
      similarity_threshold: similarityThreshold
    });
  };

  const getUserPatterns = async (userId: string | number) => {
    return mlService.getUserPatterns(userId);
  };

  const getModelHealth = async () => {
    return mlService.getModelHealth();
  };

  const getWorkoutRecommendations = async (
    options?: { type?: string; num_recommendations?: number; userId?: string | number }
  ) => {
    return mlService.getWorkoutRecommendations(options);
  };

  return {
    getRecommendations,
    getContentBasedRecommendations,
    getCollaborativeRecommendations,
    getWorkoutRecommendations,
    updateBehaviorData,
    predictDifficulty,
    predictCompletion,
    predictSuitability,
    getSimilarExercises,
    getUserPatterns,
    getModelHealth,
  };
};