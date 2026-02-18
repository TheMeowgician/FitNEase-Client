import { apiClient, ApiResponse } from '../api/client';

export interface WorkoutPlan {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  duration_weeks: number;
  sessions_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface WorkoutPlanSchedule {
  id: string;
  workout_plan_id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  workout_type: 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed';
  estimated_duration: number; // minutes
  is_rest_day: boolean;
  notes?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutScheduleRequest {
  workout_plan_id?: string;
  selected_days: string[]; // array of day names
  sessions_per_week: number;
  preferred_workout_types: string[];
  session_duration: number; // minutes
  rest_days: string[];
  goals: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface CreatePlanRequest {
  name: string;
  description?: string;
  duration_weeks: number;
  sessions_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  schedule: WorkoutScheduleRequest;
}

export interface CustomizePlanRequest {
  duration_weeks?: number;
  sessions_per_week?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  schedule_updates?: Partial<WorkoutScheduleRequest>;
}

// Weekly Workout Plans (Feature #4)
export interface WeeklyWorkoutPlan {
  plan_id: number;
  user_id: number;
  week_start_date: string;
  week_end_date: string;
  monday_workouts: Exercise[];
  tuesday_workouts: Exercise[];
  wednesday_workouts: Exercise[];
  thursday_workouts: Exercise[];
  friday_workouts: Exercise[];
  saturday_workouts: Exercise[];
  sunday_workouts: Exercise[];
  monday_completed: boolean;
  tuesday_completed: boolean;
  wednesday_completed: boolean;
  thursday_completed: boolean;
  friday_completed: boolean;
  saturday_completed: boolean;
  sunday_completed: boolean;
  total_workouts: number;
  completed_workouts: number;
  completion_percentage: number;
  generated_by: string;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  target_muscle_group: string;
  difficulty_level: number;
  equipment_needed: string;
  estimated_calories_burned: number;
  default_duration_seconds: number;
  exercise_category: string;
}

export interface GenerateWeeklyPlanRequest {
  user_id: number;
  regenerate?: boolean;
  week_start_date?: string; // Format: YYYY-MM-DD
}

export class PlanningService {
  // Get user's current workout plan
  public async getWorkoutPlan(userId: string): Promise<WorkoutPlan | null> {
    try {
      const response = await apiClient.get<WorkoutPlan>('planning', `/api/planning/workout-plan/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for workout plan:', error);
      return null;
    }
  }

  // Get all user's workout plans
  public async getUserPlans(userId?: string): Promise<WorkoutPlan[]> {
    try {
      const endpoint = userId
        ? `/api/planning/plans/${userId}`
        : '/api/planning/plans';
      const response = await apiClient.get<WorkoutPlan[]>('planning', endpoint);
      return response.data || [];
    } catch (error: any) {
      const errorMessage = error?.message || '';

      // Handle specific "No active plan found" or similar cases for new users
      if (errorMessage.includes('No active plan found') || errorMessage.includes('No plans found')) {
        console.log(`ℹ️ No workout plans found for user ${userId || 'current'} - this is normal for new users`);
        return [];
      }

      console.warn('Planning service unavailable for user plans:', error);
      return [];
    }
  }

  // Get workout plan schedule
  public async getWorkoutSchedule(planId: string): Promise<WorkoutPlanSchedule[]> {
    try {
      const response = await apiClient.get<WorkoutPlanSchedule[]>('planning', `/api/planning/workout-plan/${planId}/schedule`);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for schedule:', error);
      return [];
    }
  }

  // Create new workout schedule
  public async createWorkoutSchedule(request: WorkoutScheduleRequest, userId?: string): Promise<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }> {
    try {
      const requestWithUserId = {
        ...request,
        user_id: parseInt(userId || '0')
      };

      const response = await apiClient.post<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }>('planning', '/api/planning/workout-plan-with-schedule', requestWithUserId);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for creating schedule:', error);
      throw new Error('Unable to create workout schedule. Planning service unavailable.');
    }
  }

  // Create full workout plan with schedule
  public async createWorkoutPlan(request: CreatePlanRequest): Promise<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }> {
    try {
      const response = await apiClient.post<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }>('planning', '/api/planning/workout-plan', request);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for creating plan:', error);
      throw new Error('Unable to create workout plan. Planning service unavailable.');
    }
  }

  // Update/customize existing workout plan
  public async customizePlan(planId: string, request: CustomizePlanRequest): Promise<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }> {
    try {
      const response = await apiClient.put<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }>('planning', `/api/planning/plan/${planId}/customize`, request);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for plan customization:', error);
      throw new Error('Unable to customize workout plan. Planning service unavailable.');
    }
  }

  // Get available workout types
  public async getWorkoutTypes(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>('planning', '/api/planning/workout-types');
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for workout types:', error);
      // Return default workout types
      return ['strength', 'cardio', 'flexibility', 'mixed', 'tabata'];
    }
  }

  // Get recommended schedule based on user preferences
  public async getRecommendedSchedule(userId: string): Promise<WorkoutPlanSchedule[]> {
    try {
      const response = await apiClient.get<WorkoutPlanSchedule[]>('planning', `/api/planning/recommended-schedule/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for recommended schedule:', error);
      return [];
    }
  }

  // Delete workout plan
  public async deleteWorkoutPlan(planId: string): Promise<boolean> {
    try {
      await apiClient.delete('planning', `/api/planning/workout-plan/${planId}`);
      return true;
    } catch (error) {
      console.warn('Planning service unavailable for plan deletion:', error);
      return false;
    }
  }

  // Save workout schedule (alias for createWorkoutSchedule for backward compatibility)
  public async saveWorkoutSchedule(scheduleData: any, userId?: string): Promise<{ plan: WorkoutPlan; schedule: WorkoutPlanSchedule[] }> {
    const scheduleRequest: WorkoutScheduleRequest = {
      selected_days: scheduleData.workoutDays,
      sessions_per_week: scheduleData.workoutDays.length,
      preferred_workout_types: [scheduleData.workoutType || 'tabata'],
      session_duration: scheduleData.sessionDuration,
      rest_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        .filter(day => !scheduleData.workoutDays.includes(day)),
      goals: ['fitness', 'strength'],
      difficulty: scheduleData.difficultyLevel || 'beginner'
    };

    return this.createWorkoutSchedule(scheduleRequest, userId);
  }

  // Get user's workout plan statistics
  public async getPlanStats(planId: string): Promise<{
    completion_rate: number;
    total_sessions_planned: number;
    total_sessions_completed: number;
    current_week: number;
    weeks_remaining: number;
  } | null> {
    try {
      const response = await apiClient.get<{
        completion_rate: number;
        total_sessions_planned: number;
        total_sessions_completed: number;
        current_week: number;
        weeks_remaining: number;
      }>('planning', `/api/planning/plan/${planId}/stats`);
      return response.data;
    } catch (error) {
      console.warn('Planning service unavailable for plan stats:', error);
      return null;
    }
  }

  // ============================================================================
  // WEEKLY WORKOUT PLANS (Feature #4)
  // ============================================================================

  /**
   * Generate a new weekly workout plan for the user
   * If a plan exists for the current week, it will be returned unless regenerate=true
   */
  public async generateWeeklyPlan(request: GenerateWeeklyPlanRequest): Promise<{
    success: boolean;
    message: string;
    data: WeeklyWorkoutPlan;
    regenerated: boolean;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: WeeklyWorkoutPlan;
        regenerated: boolean;
      }>('planning', '/api/planning/weekly-plans/generate', request);

      // Transform the data before returning
      if (response.data && response.data.data) {
        response.data.data = this.transformWeeklyPlanData(response.data.data) as WeeklyWorkoutPlan;
      }

      return response.data;
    } catch (error: any) {
      console.error('[Planning Service] Failed to generate weekly plan:', error);
      throw new Error(error.message || 'Failed to generate weekly workout plan');
    }
  }

  /**
   * Get the current week's workout plan for the user
   */
  public async getCurrentWeekPlan(userId: number, sessionCount?: number, completedDates?: string[]): Promise<{
    success: boolean;
    message: string;
    data: WeeklyWorkoutPlan | null;
  }> {
    try {
      const sessionParam = sessionCount !== undefined ? `&session_count=${sessionCount}` : '';
      const datesParam = completedDates?.length ? `&completed_dates=${completedDates.join(',')}` : '';
      const response = await apiClient.get<{
        success: boolean;
        message: string;
        data: WeeklyWorkoutPlan | null;
      }>('planning', `/api/planning/weekly-plans/current?user_id=${userId}${sessionParam}${datesParam}`);

      // Transform the data before returning
      if (response.data && response.data.data) {
        response.data.data = this.transformWeeklyPlanData(response.data.data) as WeeklyWorkoutPlan;
      }

      return response.data;
    } catch (error: any) {
      console.error('[Planning Service] Failed to get current week plan:', error);
      throw new Error(error.message || 'Failed to get current week plan');
    }
  }

  /**
   * Get workout plan for a specific week
   * @param date - Date string in format YYYY-MM-DD (any date within the desired week)
   */
  public async getWeekPlan(date: string, userId: number): Promise<{
    success: boolean;
    message: string;
    data: WeeklyWorkoutPlan | null;
  }> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        message: string;
        data: WeeklyWorkoutPlan | null;
      }>('planning', `/api/planning/weekly-plans/week/${date}?user_id=${userId}`);

      // Transform the data before returning
      if (response.data && response.data.data) {
        response.data.data = this.transformWeeklyPlanData(response.data.data) as WeeklyWorkoutPlan;
      }

      return response.data;
    } catch (error: any) {
      console.error('[Planning Service] Failed to get week plan:', error);
      throw new Error(error.message || 'Failed to get week plan');
    }
  }

  /**
   * Mark a day's workouts as completed
   * @param planId - The weekly plan ID
   * @param day - Day of the week (monday, tuesday, etc.)
   */
  public async completeDayWorkout(planId: number, day: string): Promise<{
    success: boolean;
    message: string;
    data: WeeklyWorkoutPlan;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: WeeklyWorkoutPlan;
      }>('planning', `/api/planning/weekly-plans/${planId}/complete-day`, {
        day
      });

      // Transform the data before returning
      if (response.data && response.data.data) {
        response.data.data = this.transformWeeklyPlanData(response.data.data) as WeeklyWorkoutPlan;
      }

      return response.data;
    } catch (error: any) {
      console.error('[Planning Service] Failed to complete day workout:', error);
      throw new Error(error.message || 'Failed to mark day as completed');
    }
  }

  /**
   * Transform exercise data from backend format to client format
   * Backend sends: { name, muscle_group, exercise_id, difficulty, ... }
   * Client expects: { exercise_name, target_muscle_group, exercise_id, difficulty_level, ... }
   */
  private transformExerciseData(exercise: any): any {
    if (!exercise) return exercise;

    return {
      ...exercise,
      // Map backend field names to client field names
      exercise_name: exercise.exercise_name || exercise.name,
      target_muscle_group: exercise.target_muscle_group || exercise.muscle_group,
      difficulty_level: exercise.difficulty_level || (
        exercise.difficulty === 'beginner' ? 1 :
        exercise.difficulty === 'intermediate' ? 2 :
        exercise.difficulty === 'advanced' ? 3 : 1
      ),
      estimated_calories_burned: exercise.estimated_calories_burned ||
                                 exercise.estimated_calories_per_minute * 4 || 0,
      // Keep original fields for compatibility
      name: exercise.name || exercise.exercise_name,
      muscle_group: exercise.muscle_group || exercise.target_muscle_group
    };
  }

  /**
   * Transform weekly plan data to ensure exercises have correct field names
   */
  private transformWeeklyPlanData(planData: any): any {
    if (!planData || !planData.plan_data) return planData;

    const transformedPlanData = { ...planData.plan_data };

    // Transform exercises in each day
    Object.keys(transformedPlanData).forEach(day => {
      const dayData = transformedPlanData[day];
      if (dayData && dayData.exercises && Array.isArray(dayData.exercises)) {
        dayData.exercises = dayData.exercises.map((ex: any) => this.transformExerciseData(ex));
      }
    });

    return {
      ...planData,
      plan_data: transformedPlanData
    };
  }

  /**
   * Get current weekly plan with the new format (plan_data with exercises per day)
   * This matches the actual API response format
   */
  public async getCurrentWeeklyPlan(userId: number | string, sessionCount?: number): Promise<any> {
    try {
      const sessionParam = sessionCount !== undefined ? `&session_count=${sessionCount}` : '';
      const response = await apiClient.get<any>('planning', `/api/planning/weekly-plans/current?user_id=${userId}${sessionParam}`);
      const rawData = response.data || response;

      // Transform the plan data to ensure field name consistency
      if (rawData && rawData.data && rawData.data.plan) {
        rawData.data.plan = this.transformWeeklyPlanData(rawData.data.plan);
      }

      // Transform today's exercises - this is what's displayed on dashboard and workouts pages
      if (rawData && rawData.data && rawData.data.today && rawData.data.today.exercises) {
        rawData.data.today.exercises = rawData.data.today.exercises.map(
          (ex: any) => this.transformExerciseData(ex)
        );
      }

      return rawData;
    } catch (error: any) {
      console.error('[Planning Service] Failed to get current weekly plan:', error);
      throw new Error(error.message || 'Failed to get current weekly plan');
    }
  }

  /**
   * Adapt existing weekly plan when workout days change
   * Intelligently reallocates exercises from removed days to new days
   * @param planId - The weekly plan ID
   * @param adaptationRequest - Details about the day changes
   */
  public async adaptWeeklyPlan(
    planId: number,
    adaptationRequest: {
      old_days: string[];
      new_days: string[];
      preserve_completed?: boolean;
      adaptation_strategy?: 'reallocate' | 'regenerate' | 'hybrid';
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: WeeklyWorkoutPlan;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: WeeklyWorkoutPlan;
      }>('planning', `/api/planning/weekly-plans/${planId}/adapt`, {
        old_days: adaptationRequest.old_days,
        new_days: adaptationRequest.new_days,
        preserve_completed: adaptationRequest.preserve_completed ?? true,
        adaptation_strategy: adaptationRequest.adaptation_strategy ?? 'reallocate',
      });
      return response.data;
    } catch (error: any) {
      console.error('[Planning Service] Failed to adapt weekly plan:', error);
      throw new Error(error.message || 'Failed to adapt weekly plan');
    }
  }
}

export const planningService = new PlanningService();