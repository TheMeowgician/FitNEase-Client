import { apiClient } from '../api/client';

export interface Exercise {
  exercise_id: number; // Changed from string id to number exercise_id to match backend
  exercise_name: string; // Changed from name to exercise_name
  description: string;
  instructions: string[];
  difficulty_level: number; // Changed from string to number (1-3) to match backend
  target_muscle_group: string; // Changed from muscleGroups array to single string
  equipment_needed?: string; // Changed from equipment array to single optional string
  default_duration_seconds: number; // Changed from duration to match backend
  calories_burned_per_minute: number; // Changed from caloriesBurned to match backend
  exercise_category: string; // Added to match backend
  video_url?: string; // Changed from videoUrl to snake_case
  image_url?: string; // Changed from imageUrl to snake_case
  tips: string[];
  common_mistakes: string[]; // Changed from commonMistakes to snake_case
  variations: string[];
  target_reps?: number; // Changed to snake_case
  target_sets?: number; // Changed to snake_case
  rest_time_seconds?: number; // Changed to snake_case and clarified units
  created_at: string; // Changed to snake_case
  updated_at: string; // Changed to snake_case
}

export interface Workout {
  workout_id: number; // Changed from string id to number workout_id
  workout_name: string; // Changed from name to workout_name
  description: string;
  workout_type: 'tabata' | 'hiit' | 'circuit'; // Changed from type to workout_type
  difficulty_level: number; // Changed from string to number (1-3)
  total_duration_minutes: number; // Changed from duration to match backend
  exercises: WorkoutExercise[];
  target_muscle_groups: string; // Changed from array to string
  equipment_needed?: string; // Changed from array to optional string
  estimated_calories_burned: number; // Changed from caloriesBurned
  average_rating: number; // Changed from rating
  total_ratings: number; // Kept same
  is_public: boolean; // Changed to snake_case
  created_by_user_id: number; // Changed from string to number
  tags: string[];
  thumbnail_url?: string; // Changed to snake_case
  video_url?: string; // Changed to snake_case
  created_at: string; // Changed to snake_case
  updated_at: string; // Changed to snake_case
}

export interface WorkoutExercise {
  workout_exercise_id: number; // Changed from string id to number
  exercise: Exercise;
  exercise_order: number; // Changed from order to exercise_order
  work_duration_seconds: number; // Changed from duration to work_duration_seconds
  rest_duration_seconds: number; // Changed from restDuration to rest_duration_seconds
  sets_count: number; // Changed from sets to sets_count
  target_reps?: number; // Changed from reps to target_reps
  notes?: string;
}

export interface TabataRound {
  exercise_id: number; // Changed from string to number
  exercise_name: string; // Changed from exerciseName to exercise_name
  work_time_seconds: number; // Changed from workTime to work_time_seconds - 20 seconds
  rest_time_seconds: number; // Changed from restTime to rest_time_seconds - 10 seconds
  sets_count: number; // Changed from sets to sets_count - 8 sets (4 minutes total)
}

export interface TabataWorkout {
  tabata_workout_id: number; // Changed from string id to number tabata_workout_id
  workout_name: string; // Changed from name to workout_name
  description: string;
  rounds: TabataRound[];
  total_duration_minutes: number; // Changed from totalDuration to total_duration_minutes
  difficulty_level: number; // Changed from string to number (1-3)
  target_muscle_groups: string; // Changed from array to string
  equipment_needed?: string; // Changed from array to optional string
  estimated_calories_burned: number; // Changed from caloriesBurned
  rest_between_rounds_seconds: number; // Changed from restBetweenRounds
  created_by_user_id?: number; // Changed from string to optional number
  is_public: boolean; // Changed to snake_case
  average_rating: number; // Changed from rating
  total_ratings: number;
  created_at: string; // Changed to snake_case
  updated_at: string; // Changed to snake_case
}

export interface WorkoutFilter {
  difficulty_level?: number; // Changed from string to number (1-3)
  target_muscle_groups?: string; // Changed from array to string
  equipment_needed?: string; // Changed from array to string
  duration?: {
    min?: number;
    max?: number;
  };
  workout_type?: 'tabata' | 'hiit' | 'circuit'; // Changed from type to workout_type
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateWorkoutRequest {
  workout_name: string; // Changed from name
  description: string;
  workout_type: 'tabata' | 'hiit' | 'circuit'; // Changed from type
  difficulty_level: number; // Changed from string to number (1-3)
  exercises: {
    exercise_id: number; // Changed from string to number
    exercise_order: number; // Changed from order
    work_duration_seconds: number; // Changed from duration
    rest_duration_seconds: number; // Changed from restDuration
    sets_count: number; // Changed from sets
    target_reps?: number; // Changed from reps
    notes?: string;
  }[];
  is_public: boolean; // Changed to snake_case
  tags?: string[];
}

export interface CreateTabataWorkoutRequest {
  workout_name: string; // Changed from name
  description: string;
  difficulty_level: number; // Changed from string to number (1-3)
  rounds: {
    exercise_id: number; // Changed from string to number
    work_time_seconds?: number; // Changed from workTime - defaults to 20
    rest_time_seconds?: number; // Changed from restTime - defaults to 10
    sets_count?: number; // Changed from sets - defaults to 8
  }[];
  rest_between_rounds_seconds?: number; // Changed from restBetweenRounds - defaults to 60
  is_public: boolean; // Changed to snake_case
  tags?: string[];
}

export interface WorkoutStats {
  total_workouts: number; // Changed to snake_case
  total_exercises: number; // Changed to snake_case
  popular_muscle_groups: { muscle_group_name: string; exercise_count: number }[]; // Changed to snake_case
  average_duration_minutes: number; // Changed to snake_case and clarified units
  difficulty_distribution: {
    level_1: number; // Changed from beginner (1-3 numbering)
    level_2: number; // Changed from intermediate
    level_3: number; // Changed from advanced
  };
}

export class ContentService {
  private serviceName = 'content' as const;

  // Exercise Management
  public async getAllExercises(): Promise<Exercise[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: Exercise[];
      }>(this.serviceName, '/api/content/all-exercises');

      console.log('📚 [CONTENT SERVICE] Fetched all exercises:', response.data.data.length);
      return response.data.data;
    } catch (error) {
      console.warn('Content service unavailable - all exercises feature disabled:', error);
      return [];
    }
  }

  public async getExercises(filters?: {
    difficulty?: string;
    muscleGroups?: string[];
    equipment?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    exercises: Exercise[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => params.append(key, v));
            } else {
              params.append(key, value.toString());
            }
          }
        });
      }

      const response = await apiClient.get<{
        exercises: Exercise[];
        total: number;
        page: number;
        limit: number;
      }>(this.serviceName, `/content/exercises?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - exercises feature disabled:', error);
      return {
        exercises: [],
        total: 0,
        page: 1,
        limit: 20
      };
    }
  }

  public async getExercise(exerciseId: string): Promise<Exercise | null> {
    try {
      // Route is /api/content/exercises/{id} on backend
      const response = await apiClient.get<{ data: Exercise; success: boolean }>(
        this.serviceName,
        `/api/content/exercises/${exerciseId}`
      );
      return response.data.data; // Backend wraps in { data: { data: {...} } }
    } catch (error) {
      console.warn('Content service unavailable - exercise details disabled:', error);
      return null;
    }
  }

  public async getExercisesByMuscleGroup(muscleGroup: string): Promise<Exercise[]> {
    try {
      // Route is /api/content/exercises/by-muscle-group/{group} on backend
      const response = await apiClient.get<Exercise[]>(this.serviceName, `/api/content/exercises/by-muscle-group/${muscleGroup}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - muscle group exercises disabled:', error);
      return [];
    }
  }

  // Workout Management
  public async getWorkouts(filters?: WorkoutFilter): Promise<{
    workouts: Workout[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => params.append(key, v));
            } else if (typeof value === 'object' && key === 'duration') {
              if (value.min) params.append('durationMin', value.min.toString());
              if (value.max) params.append('durationMax', value.max.toString());
            } else {
              params.append(key, value.toString());
            }
          }
        });
      }

      const response = await apiClient.get<{
        workouts: Workout[];
        total: number;
        page: number;
        limit: number;
      }>(this.serviceName, `/content/workouts?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - workouts feature disabled:', error);
      return {
        workouts: [],
        total: 0,
        page: 1,
        limit: 20
      };
    }
  }

  public async getWorkout(workoutId: string): Promise<Workout | null> {
    try {
      // Route is /api/content/workout/{id} (singular) on backend
      const response = await apiClient.get<Workout>(this.serviceName, `/api/content/workout/${workoutId}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - workout details disabled:', error);
      return null;
    }
  }

  // User workout creation, modification and deletion removed - app uses ML recommendations only

  // Tabata Specific Methods
  public async getTabataWorkouts(filters?: {
    difficulty?: string;
    muscleGroups?: string[];
    equipment?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    workouts: TabataWorkout[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => params.append(key, v));
            } else {
              params.append(key, value.toString());
            }
          }
        });
      }

      const response = await apiClient.get<{
        workouts: TabataWorkout[];
        total: number;
        page: number;
        limit: number;
      }>(this.serviceName, `/content/tabata-workouts?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - Tabata workouts feature disabled:', error);
      return {
        workouts: [],
        total: 0,
        page: 1,
        limit: 20
      };
    }
  }

  // Tabata workout creation removed - app uses ML recommendations only

  public async getRandomTabataWorkout(difficulty?: string, muscleGroups?: string[]): Promise<TabataWorkout | null> {
    try {
      const params = new URLSearchParams();
      if (difficulty) params.append('difficulty', difficulty);
      if (muscleGroups) {
        muscleGroups.forEach(mg => params.append('muscleGroups', mg));
      }

      const response = await apiClient.get<TabataWorkout>(this.serviceName, `/content/tabata-workouts/random?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - random Tabata workout disabled:', error);
      return null;
    }
  }

  // Muscle Groups and Equipment
  public async getMuscleGroups(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>(this.serviceName, '/content/muscle-groups');
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - muscle groups disabled:', error);
      return ['Core', 'Upper Body', 'Lower Body']; // Default fallback
    }
  }

  public async getEquipment(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>(this.serviceName, '/content/equipment');
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - equipment list disabled:', error);
      return ['None', 'Dumbbells', 'Resistance Bands']; // Default fallback
    }
  }

  // Statistics
  public async getWorkoutStats(): Promise<WorkoutStats | null> {
    try {
      const response = await apiClient.get<WorkoutStats>(this.serviceName, '/content/stats');
      return response.data;
    } catch (error) {
      console.warn('Content service unavailable - workout stats disabled:', error);
      return null;
    }
  }

  // Rating system removed - app focuses on ML recommendations and behavioral data collection
}

export const contentService = new ContentService();