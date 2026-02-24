/**
 * Workout Session Generator
 *
 * Generates proper Tabata workout sessions with multiple exercises
 * using progressive overload based on fitness level and completed session count:
 *
 * - Beginner:     4→5→6 exercises  (0-5 / 6-15 / 16+ sessions)
 * - Intermediate: 6→7→8 exercises  (0-5 / 6-15 / 16+ sessions)
 * - Advanced:     8→10→12 exercises (0-5 / 6-15 / 16+ sessions)
 *
 * Each exercise follows standard Tabata protocol:
 * 20 seconds work, 10 seconds rest, 8 sets = 4 minutes per exercise
 */

import { MLRecommendation } from './microservices/mlService';

export interface TabataExercise {
  exercise_id: number;
  exercise_name: string;
  target_muscle_group: string;
  difficulty_level: number;
  default_duration_seconds: number;
  estimated_calories_burned: number;
  equipment_needed?: string;
  exercise_category: string;
  instructions?: string;
  recommendation_score?: number;
  algorithm_used?: string;
}

export interface TabataWorkoutSession {
  session_id: string;
  session_name: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  total_exercises: number;
  total_duration_minutes: number;
  estimated_calories: number;
  exercises: TabataExercise[];
  created_at: string;
}

export interface TabataSessionConfig {
  work_duration: number; // seconds
  rest_duration: number; // seconds
  sets_per_exercise: number;
  rest_between_exercises: number; // seconds
}

// Standard Tabata configuration
export const TABATA_CONFIG: TabataSessionConfig = {
  work_duration: 20,
  rest_duration: 10,
  sets_per_exercise: 8,
  rest_between_exercises: 60, // 1 minute rest between exercises
};

/**
 * Get the number of exercises based on fitness level and completed session count (progressive overload).
 *
 * Progressive overload ranges (per professor requirements):
 *   Beginner:     0-5 sessions→4, 6-15→5, 16+→6
 *   Intermediate: 0-5 sessions→6, 6-15→7, 16+→8
 *   Advanced:     0-5 sessions→8, 6-15→10, 16+→12
 */
export function getExerciseCountForLevel(fitnessLevel: string, sessionCount: number = 0): number {
  const level = fitnessLevel.toLowerCase();

  if (level === 'beginner') {
    if (sessionCount < 6) return 4;
    if (sessionCount < 16) return 5;
    return 6;
  } else if (level === 'intermediate' || level === 'medium') {
    if (sessionCount < 6) return 6;
    if (sessionCount < 16) return 7;
    return 8;
  } else if (level === 'advanced' || level === 'expert') {
    if (sessionCount < 6) return 8;
    if (sessionCount < 16) return 10;
    return 12;
  }

  // Default to beginner
  return 4;
}

/**
 * Calculate session duration in minutes
 */
export function calculateSessionDuration(exerciseCount: number): number {
  const { work_duration, rest_duration, sets_per_exercise, rest_between_exercises } = TABATA_CONFIG;

  // Duration per exercise = (20s work + 10s rest) × 8 sets = 240 seconds = 4 minutes
  const durationPerExercise = (work_duration + rest_duration) * sets_per_exercise;

  // Total exercise time
  const totalExerciseTime = durationPerExercise * exerciseCount;

  // Rest between exercises (n-1 rests)
  const totalRestTime = rest_between_exercises * (exerciseCount - 1);

  // Total in seconds, convert to minutes
  return Math.ceil((totalExerciseTime + totalRestTime) / 60);
}

/**
 * Generate a Tabata workout session from ML recommendations
 */
export function generateTabataSession(
  recommendations: MLRecommendation[],
  fitnessLevel: string,
  userId: string,
  sessionCount: number = 0
): TabataWorkoutSession {
  // Use all exercises passed in — backend already determined the correct count
  // (progressive overload + time floor + fitness level cap)
  const selectedExercises = recommendations;

  // Map to TabataExercise format
  const exercises: TabataExercise[] = selectedExercises.map(rec => ({
    exercise_id: rec.exercise_id,
    exercise_name: rec.exercise_name,
    target_muscle_group: rec.target_muscle_group,
    difficulty_level: rec.difficulty_level,
    default_duration_seconds: rec.default_duration_seconds,
    estimated_calories_burned: rec.estimated_calories_burned,
    equipment_needed: rec.equipment_needed,
    exercise_category: rec.exercise_category,
    recommendation_score: rec.recommendation_score,
    algorithm_used: rec.algorithm_used,
  }));

  // Calculate total metrics
  const totalDuration = calculateSessionDuration(exercises.length);
  const estimatedCalories = exercises.reduce((sum, ex) => sum + (ex.estimated_calories_burned || 0), 0);

  // Generate session
  const session: TabataWorkoutSession = {
    session_id: `tabata_${userId}_${Date.now()}`,
    session_name: `${fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)} Tabata Workout`,
    difficulty_level: fitnessLevel.toLowerCase() as any,
    total_exercises: exercises.length,
    total_duration_minutes: totalDuration,
    estimated_calories: estimatedCalories,
    exercises: exercises,
    created_at: new Date().toISOString(),
  };

  return session;
}

/**
 * Validate if recommendations are sufficient for a workout session
 */
export function hasEnoughExercises(
  recommendations: MLRecommendation[],
  fitnessLevel: string,
  sessionCount: number = 0
): boolean {
  const required = getExerciseCountForLevel(fitnessLevel, sessionCount);
  return recommendations.length >= required;
}

/**
 * Get session summary text
 */
export function getSessionSummary(session: TabataWorkoutSession): string {
  return `${session.total_exercises} exercises • ${session.total_duration_minutes} min • ~${session.estimated_calories} cal`;
}