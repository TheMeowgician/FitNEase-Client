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
}

export const planningService = new PlanningService();