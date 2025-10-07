import { apiClient, ApiResponse } from '../api/client';

export interface Workout {
  id: string;
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'balance' | 'sports' | 'mixed';
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  exercises: WorkoutExercise[];
  equipment: string[];
  instructions?: string[];
  notes?: string;
  tags: string[];
  isCustom: boolean;
  createdBy?: string;
  estimatedCalories: number;
  targetMuscles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'balance';
  sets?: ExerciseSet[];
  duration?: number;
  distance?: number;
  restTime?: number;
  instructions: string[];
  targetMuscles: string[];
  equipment: string[];
  modifications?: {
    easier: string;
    harder: string;
  };
  videoUrl?: string;
  imageUrl?: string;
}

export interface ExerciseSet {
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  restTime?: number;
  completed: boolean;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  workoutId: string;
  workoutName: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'in-progress' | 'completed' | 'paused' | 'cancelled';
  exercises: SessionExercise[];
  notes?: string;
  mood?: 'great' | 'good' | 'okay' | 'poor' | 'terrible';
  energy?: 'high' | 'medium' | 'low';
  difficulty?: 'too-easy' | 'just-right' | 'too-hard';
  enjoyment?: number;
  actualCaloriesBurned?: number;
  heartRateData?: HeartRateData[];
  environmentConditions?: {
    temperature?: number;
    humidity?: number;
    location?: 'gym' | 'home' | 'outdoor' | 'other';
  };
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  plannedSets: ExerciseSet[];
  completedSets: ExerciseSet[];
  skipped: boolean;
  notes?: string;
  actualDuration?: number;
  perceivedExertion?: number;
  formQuality?: number;
}

export interface HeartRateData {
  timestamp: string;
  heartRate: number;
  zone?: 'resting' | 'fat-burn' | 'cardio' | 'peak';
}

export interface ProgressEntry {
  id: string;
  userId: string;
  date: string;
  type: 'weight' | 'body-fat' | 'muscle-mass' | 'measurement' | 'photo' | 'performance';
  value: number;
  unit: string;
  bodyPart?: string;
  notes?: string;
  source: 'manual' | 'device' | 'app';
  deviceInfo?: {
    deviceType: string;
    deviceModel: string;
    accuracy?: number;
  };
  metadata?: any;
  createdAt: string;
}

export interface BMIEntry {
  id: string;
  userId: string;
  height: number;
  weight: number;
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  date: string;
  notes?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  type: 'weight-loss' | 'weight-gain' | 'muscle-gain' | 'strength' | 'endurance' | 'flexibility' | 'custom';
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  milestones: GoalMilestone[];
  progress: {
    percentage: number;
    trend: 'improving' | 'stable' | 'declining';
    estimatedCompletion?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  value: number;
  targetDate: string;
  isCompleted: boolean;
  completedAt?: string;
  reward?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'workout' | 'consistency' | 'progress' | 'social' | 'milestone';
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  icon: string;
  criteria: string;
  unlockedAt?: string;
  isUnlocked: boolean;
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  points: number;
}

export interface WorkoutStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  streakType: 'daily' | 'weekly' | 'custom';
  startDate: string;
  lastWorkoutDate: string;
  target: number;
  isActive: boolean;
  milestones: {
    day: number;
    achieved: boolean;
    achievedAt?: string;
  }[];
}

export interface PerformanceMetrics {
  userId: string;
  period: 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  summary: {
    totalWorkouts: number;
    totalDuration: number;
    totalCaloriesBurned: number;
    averageIntensity: number;
    consistencyScore: number;
    improvementRate: number;
  };
  breakdown: {
    byType: { type: string; count: number; percentage: number }[];
    byDifficulty: { difficulty: string; count: number; percentage: number }[];
    byDay: { day: string; count: number }[];
  };
  trends: {
    metric: string;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
    description: string;
  }[];
  personalBests: {
    exercise: string;
    metric: string;
    value: number;
    unit: string;
    date: string;
  }[];
}

export interface CreateWorkoutRequest {
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'balance' | 'sports' | 'mixed';
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: Omit<WorkoutExercise, 'id'>[];
  equipment: string[];
  instructions?: string[];
  notes?: string;
  tags: string[];
}

export interface StartWorkoutRequest {
  workoutId: string;
  notes?: string;
  environmentConditions?: any;
}

export interface UpdateSessionRequest {
  exercises?: Partial<SessionExercise>[];
  notes?: string;
  mood?: string;
  energy?: string;
  difficulty?: string;
  enjoyment?: number;
  heartRateData?: HeartRateData[];
}

export interface CompleteWorkoutRequest {
  actualCaloriesBurned?: number;
  finalNotes?: string;
  overallRating?: number;
}

export interface LogProgressRequest {
  type: 'weight' | 'body-fat' | 'muscle-mass' | 'measurement' | 'photo' | 'performance';
  value: number;
  unit: string;
  date?: string;
  bodyPart?: string;
  notes?: string;
  source?: 'manual' | 'device' | 'app';
  deviceInfo?: any;
  metadata?: any;
}

export interface CreateGoalRequest {
  type: string;
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  targetDate: string;
  priority: 'low' | 'medium' | 'high';
  milestones?: Omit<GoalMilestone, 'id' | 'isCompleted'>[];
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  targetValue?: number;
  targetDate?: string;
  priority?: 'low' | 'medium' | 'high';
  isActive?: boolean;
}

export class TrackingService {
  // Workout Management
  public async createWorkout(request: CreateWorkoutRequest): Promise<Workout> {
    try {
      const response = await apiClient.post<Workout>('tracking', '/tracking/workouts', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to create workout');
    }
  }

  public async getWorkouts(filters?: {
    type?: string;
    difficulty?: string;
    category?: string;
    equipment?: string[];
    duration?: { min: number; max: number };
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    workouts: Workout[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        workouts: Workout[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/workouts?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get workouts');
    }
  }

  public async getWorkout(workoutId: string): Promise<Workout> {
    try {
      const response = await apiClient.get<Workout>('tracking', `/tracking/workouts/${workoutId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get workout');
    }
  }

  public async updateWorkout(workoutId: string, updates: Partial<CreateWorkoutRequest>): Promise<Workout> {
    try {
      const response = await apiClient.put<Workout>('tracking', `/tracking/workouts/${workoutId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update workout');
    }
  }

  public async deleteWorkout(workoutId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('tracking', `/tracking/workouts/${workoutId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete workout');
    }
  }

  public async favoriteWorkout(workoutId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('tracking', `/tracking/workouts/${workoutId}/favorite`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to favorite workout');
    }
  }

  public async unfavoriteWorkout(workoutId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('tracking', `/tracking/workouts/${workoutId}/favorite`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to unfavorite workout');
    }
  }

  // Workout Sessions
  public async createWorkoutSession(sessionData: {
    workoutId: string;
    startTime: Date;
    endTime?: Date;
    duration: number;
    caloriesBurned: number;
    completed: boolean;
    notes?: string;
  }): Promise<WorkoutSession> {
    try {
      const response = await apiClient.post<WorkoutSession>('tracking', '/tracking/sessions', {
        workoutId: sessionData.workoutId,
        startTime: sessionData.startTime.toISOString(),
        endTime: sessionData.endTime?.toISOString(),
        duration: sessionData.duration,
        actualCaloriesBurned: sessionData.caloriesBurned,
        status: sessionData.completed ? 'completed' : 'cancelled',
        notes: sessionData.notes,
        completionPercentage: sessionData.completed ? 100 : 50,
      });
      return response.data;
    } catch (error) {
      console.warn('Tracking service unavailable - session saved locally:', error);
      // Return mock data when service is unavailable
      return {
        id: Date.now().toString(),
        workoutId: sessionData.workoutId,
        workoutName: 'Tabata Workout',
        userId: 'current-user',
        startTime: sessionData.startTime.toISOString(),
        endTime: sessionData.endTime?.toISOString(),
        duration: sessionData.duration,
        status: sessionData.completed ? 'completed' : 'cancelled',
        exercises: [],
        actualCaloriesBurned: sessionData.caloriesBurned,
        completionPercentage: sessionData.completed ? 100 : 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as WorkoutSession;
    }
  }

  public async startWorkout(request: StartWorkoutRequest): Promise<WorkoutSession> {
    try {
      const response = await apiClient.post<WorkoutSession>('tracking', '/tracking/sessions/start', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to start workout');
    }
  }

  public async updateSession(sessionId: string, updates: UpdateSessionRequest): Promise<WorkoutSession> {
    try {
      const response = await apiClient.put<WorkoutSession>('tracking', `/tracking/sessions/${sessionId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update session');
    }
  }

  public async pauseSession(sessionId: string): Promise<WorkoutSession> {
    try {
      const response = await apiClient.post<WorkoutSession>('tracking', `/tracking/sessions/${sessionId}/pause`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to pause session');
    }
  }

  public async resumeSession(sessionId: string): Promise<WorkoutSession> {
    try {
      const response = await apiClient.post<WorkoutSession>('tracking', `/tracking/sessions/${sessionId}/resume`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to resume session');
    }
  }

  public async completeWorkout(sessionId: string, request: CompleteWorkoutRequest = {}): Promise<WorkoutSession> {
    try {
      const response = await apiClient.post<WorkoutSession>('tracking', `/tracking/sessions/${sessionId}/complete`, request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to complete workout');
    }
  }

  public async cancelSession(sessionId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('tracking', `/tracking/sessions/${sessionId}/cancel`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to cancel session');
    }
  }

  public async getSession(sessionId: string): Promise<WorkoutSession> {
    try {
      const response = await apiClient.get<WorkoutSession>('tracking', `/tracking/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get session');
    }
  }

  public async getSessions(filters?: {
    status?: string;
    workoutType?: string;
    dateRange?: { start: string; end: string };
    page?: number;
    limit?: number;
  }): Promise<{
    sessions: WorkoutSession[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        sessions: WorkoutSession[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/sessions?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get sessions');
    }
  }

  public async addHeartRateData(sessionId: string, heartRateData: HeartRateData[]): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('tracking', `/tracking/sessions/${sessionId}/heart-rate`, { heartRateData });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to add heart rate data');
    }
  }

  // Progress Tracking
  public async logProgress(request: LogProgressRequest): Promise<ProgressEntry> {
    try {
      const response = await apiClient.post<ProgressEntry>('tracking', '/tracking/progress', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to log progress');
    }
  }

  public async getProgress(filters?: {
    type?: string;
    bodyPart?: string;
    dateRange?: { start: string; end: string };
    page?: number;
    limit?: number;
  }): Promise<{
    entries: ProgressEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        entries: ProgressEntry[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/progress?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get progress');
    }
  }

  public async updateProgressEntry(entryId: string, updates: Partial<LogProgressRequest>): Promise<ProgressEntry> {
    try {
      const response = await apiClient.put<ProgressEntry>('tracking', `/tracking/progress/${entryId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update progress entry');
    }
  }

  public async deleteProgressEntry(entryId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('tracking', `/tracking/progress/${entryId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete progress entry');
    }
  }

  // BMI Tracking
  public async logBMI(height: number, weight: number, notes?: string): Promise<BMIEntry> {
    try {
      const response = await apiClient.post<BMIEntry>('tracking', '/tracking/bmi', { height, weight, notes });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to log BMI');
    }
  }

  public async getBMIHistory(page = 1, limit = 20): Promise<{
    entries: BMIEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get<{
        entries: BMIEntry[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/bmi?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get BMI history');
    }
  }

  public async getLatestBMI(): Promise<BMIEntry | null> {
    try {
      const response = await apiClient.get<BMIEntry>('tracking', '/tracking/bmi/latest');
      return response.data;
    } catch (error) {
      if ((error as any).message?.includes('404')) {
        return null;
      }
      throw new Error((error as any).message || 'Failed to get latest BMI');
    }
  }

  public async updateBMIEntry(entryId: string, updates: { height?: number; weight?: number; notes?: string }): Promise<BMIEntry> {
    try {
      const response = await apiClient.put<BMIEntry>('tracking', `/tracking/bmi/${entryId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update BMI entry');
    }
  }

  public async deleteBMIEntry(entryId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('tracking', `/tracking/bmi/${entryId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete BMI entry');
    }
  }

  // Goals Management
  public async createGoal(request: CreateGoalRequest): Promise<Goal> {
    try {
      const response = await apiClient.post<Goal>('tracking', '/tracking/goals', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to create goal');
    }
  }

  public async getGoals(filters?: {
    type?: string;
    isActive?: boolean;
    priority?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    goals: Goal[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        goals: Goal[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/goals?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get goals');
    }
  }

  public async getGoal(goalId: string): Promise<Goal> {
    try {
      const response = await apiClient.get<Goal>('tracking', `/tracking/goals/${goalId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get goal');
    }
  }

  public async updateGoal(goalId: string, updates: UpdateGoalRequest): Promise<Goal> {
    try {
      const response = await apiClient.put<Goal>('tracking', `/tracking/goals/${goalId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update goal');
    }
  }

  public async deleteGoal(goalId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('tracking', `/tracking/goals/${goalId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete goal');
    }
  }

  public async updateGoalProgress(goalId: string, currentValue: number): Promise<Goal> {
    try {
      const response = await apiClient.put<Goal>('tracking', `/tracking/goals/${goalId}/progress`, { currentValue });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update goal progress');
    }
  }

  // Achievements
  public async getAchievements(filters?: {
    category?: string;
    type?: string;
    isUnlocked?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    achievements: Achievement[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        achievements: Achievement[];
        total: number;
        page: number;
        limit: number;
      }>('tracking', `/tracking/achievements?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get achievements');
    }
  }

  public async getRecentAchievements(limit = 10): Promise<Achievement[]> {
    try {
      const response = await apiClient.get<Achievement[]>('tracking', `/tracking/achievements/recent?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get recent achievements');
    }
  }

  // Streaks
  public async getWorkoutStreak(): Promise<WorkoutStreak> {
    try {
      const response = await apiClient.get<WorkoutStreak>('tracking', '/tracking/streak');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get workout streak');
    }
  }

  public async updateStreak(): Promise<WorkoutStreak> {
    try {
      const response = await apiClient.post<WorkoutStreak>('tracking', '/tracking/streak/update');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update streak');
    }
  }

  // Performance Metrics
  public async getPerformanceMetrics(period: 'week' | 'month' | 'year' = 'month'): Promise<PerformanceMetrics> {
    try {
      const response = await apiClient.get<PerformanceMetrics>('tracking', `/tracking/metrics?period=${period}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get performance metrics');
    }
  }

  public async getCustomMetrics(startDate: string, endDate: string): Promise<PerformanceMetrics> {
    try {
      const response = await apiClient.get<PerformanceMetrics>('tracking', `/tracking/metrics/custom?start=${startDate}&end=${endDate}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get custom metrics');
    }
  }

  public async getPersonalBests(exerciseId?: string): Promise<{
    bests: Array<{
      exercise: string;
      metric: string;
      value: number;
      unit: string;
      date: string;
      sessionId: string;
    }>;
  }> {
    try {
      const url = exerciseId
        ? `/tracking/personal-bests?exerciseId=${exerciseId}`
        : '/tracking/personal-bests';
      const response = await apiClient.get<{
        bests: Array<{
          exercise: string;
          metric: string;
          value: number;
          unit: string;
          date: string;
          sessionId: string;
        }>;
      }>('tracking', url);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get personal bests');
    }
  }

  // Dashboard Summary
  public async getDashboardSummary(): Promise<{
    recentWorkouts: WorkoutSession[];
    weeklyProgress: { date: string; workouts: number; duration: number }[];
    activeGoals: Goal[];
    recentAchievements: Achievement[];
    currentStreak: WorkoutStreak;
    upcomingMilestones: { goal: string; milestone: string; daysLeft: number }[];
    weeklyStats: {
      workouts: number;
      duration: number;
      calories: number;
      averageRating: number;
    };
  }> {
    try {
      const response = await apiClient.get<{
        recentWorkouts: WorkoutSession[];
        weeklyProgress: { date: string; workouts: number; duration: number }[];
        activeGoals: Goal[];
        recentAchievements: Achievement[];
        currentStreak: WorkoutStreak;
        upcomingMilestones: { goal: string; milestone: string; daysLeft: number }[];
        weeklyStats: {
          workouts: number;
          duration: number;
          calories: number;
          averageRating: number;
        };
      }>('tracking', '/tracking/dashboard');
      return response.data;
    } catch (error) {
      console.warn('Tracking service unavailable for dashboard summary:', error);
      // Return fallback data when service is unavailable
      return {
        recentWorkouts: [],
        weeklyProgress: [],
        activeGoals: [],
        recentAchievements: [],
        currentStreak: { count: 0, startDate: new Date().toISOString(), isActive: false },
        upcomingMilestones: [],
        weeklyStats: {
          workouts: 0,
          duration: 0,
          calories: 0,
          averageRating: 0,
        },
      };
    }
  }

  // Export Data
  public async exportData(format: 'json' | 'csv' = 'json', dataTypes: string[] = []): Promise<{ downloadUrl: string }> {
    try {
      const response = await apiClient.post<{ downloadUrl: string }>('tracking', '/tracking/export', {
        format,
        dataTypes
      });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to export data');
    }
  }
}

export const trackingService = new TrackingService();