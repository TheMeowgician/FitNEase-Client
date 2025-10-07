export const TABATA_CONFIG = {
  // Core Timing (in seconds)
  WORK_DURATION: 20,
  REST_DURATION: 10,
  ROUNDS: 8,
  TOTAL_DURATION: 240, // 8 rounds × 30 seconds
  PREPARATION_TIME: 10,
  COOLDOWN_TIME: 30,

  // Muscle Groups
  MUSCLE_GROUPS: {
    CORE: 'core',
    UPPER_BODY: 'upper_body',
    LOWER_BODY: 'lower_body',
    FULL_BODY: 'full_body',
  } as const,

  // Difficulty Levels
  DIFFICULTY_LEVELS: {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
  } as const,

  // Timer States
  TIMER_STATES: {
    IDLE: 'idle',
    PREPARATION: 'preparation',
    WORK: 'work',
    REST: 'rest',
    COMPLETE: 'complete',
    PAUSED: 'paused',
  } as const,

  // Session Types
  SESSION_TYPES: {
    INDIVIDUAL: 'individual',
    GROUP: 'group',
  } as const,

  // Sound Cues
  SOUND_CUES: {
    PREPARATION: 'preparation_beep',
    WORK_START: 'work_start_beep',
    WORK_END: 'work_end_beep',
    REST_START: 'rest_start_beep',
    REST_END: 'rest_end_beep',
    ROUND_COMPLETE: 'round_complete_beep',
    WORKOUT_COMPLETE: 'workout_complete_beep',
    HALFWAY_WORK: 'halfway_work_beep',
    COUNTDOWN_3: 'countdown_3_beep',
    COUNTDOWN_2: 'countdown_2_beep',
    COUNTDOWN_1: 'countdown_1_beep',
  } as const,

  // Haptic Feedback
  HAPTIC_PATTERNS: {
    WORK_START: 'heavy',
    REST_START: 'medium',
    ROUND_COMPLETE: 'success',
    WORKOUT_COMPLETE: 'success',
    WARNING: 'warning',
  } as const,
};

export const TABATA_EXERCISES = {
  CORE: [
    {
      id: 'mountain_climbers',
      name: 'Mountain Climbers',
      difficulty: 2,
      caloriesPerMinute: 8.5,
    },
    {
      id: 'plank_variations',
      name: 'Plank Variations',
      difficulty: 1,
      caloriesPerMinute: 6.0,
    },
    {
      id: 'bicycle_crunches',
      name: 'Bicycle Crunches',
      difficulty: 2,
      caloriesPerMinute: 7.2,
    },
    {
      id: 'russian_twists',
      name: 'Russian Twists',
      difficulty: 2,
      caloriesPerMinute: 6.8,
    },
    {
      id: 'leg_raises',
      name: 'Leg Raises',
      difficulty: 2,
      caloriesPerMinute: 6.5,
    },
    {
      id: 'flutter_kicks',
      name: 'Flutter Kicks',
      difficulty: 2,
      caloriesPerMinute: 7.0,
    },
  ],
  UPPER_BODY: [
    {
      id: 'push_ups',
      name: 'Push-ups',
      difficulty: 2,
      caloriesPerMinute: 8.0,
    },
    {
      id: 'burpees',
      name: 'Burpees',
      difficulty: 3,
      caloriesPerMinute: 12.0,
    },
    {
      id: 'arm_circles',
      name: 'Arm Circles',
      difficulty: 1,
      caloriesPerMinute: 4.5,
    },
    {
      id: 'pike_push_ups',
      name: 'Pike Push-ups',
      difficulty: 3,
      caloriesPerMinute: 9.0,
    },
    {
      id: 'tricep_dips',
      name: 'Tricep Dips',
      difficulty: 2,
      caloriesPerMinute: 7.5,
    },
    {
      id: 'jumping_jacks',
      name: 'Jumping Jacks',
      difficulty: 1,
      caloriesPerMinute: 8.0,
    },
  ],
  LOWER_BODY: [
    {
      id: 'squats',
      name: 'Squats',
      difficulty: 1,
      caloriesPerMinute: 6.5,
    },
    {
      id: 'lunges',
      name: 'Lunges',
      difficulty: 2,
      caloriesPerMinute: 7.0,
    },
    {
      id: 'jump_squats',
      name: 'Jump Squats',
      difficulty: 3,
      caloriesPerMinute: 10.0,
    },
    {
      id: 'calf_raises',
      name: 'Calf Raises',
      difficulty: 1,
      caloriesPerMinute: 5.0,
    },
    {
      id: 'lateral_lunges',
      name: 'Lateral Lunges',
      difficulty: 2,
      caloriesPerMinute: 6.8,
    },
    {
      id: 'wall_sits',
      name: 'Wall Sits',
      difficulty: 2,
      caloriesPerMinute: 5.5,
    },
  ],
};

export const TABATA_PRESETS = {
  BEGINNER_CORE: {
    name: 'Beginner Core Tabata',
    exercises: ['plank_variations', 'leg_raises', 'bicycle_crunches'],
    difficulty: 1,
    duration: 12, // 3 exercises × 4 minutes
  },
  INTERMEDIATE_FULL_BODY: {
    name: 'Intermediate Full Body',
    exercises: ['burpees', 'mountain_climbers', 'jump_squats'],
    difficulty: 2,
    duration: 12,
  },
  ADVANCED_HIIT: {
    name: 'Advanced HIIT Blast',
    exercises: ['burpees', 'pike_push_ups', 'jump_squats', 'mountain_climbers'],
    difficulty: 3,
    duration: 16, // 4 exercises × 4 minutes
  },
};

export const TABATA_VALIDATION = {
  MIN_WORK_DURATION: 15,
  MAX_WORK_DURATION: 30,
  MIN_REST_DURATION: 5,
  MAX_REST_DURATION: 20,
  MIN_ROUNDS: 4,
  MAX_ROUNDS: 12,
  MIN_PREPARATION_TIME: 5,
  MAX_PREPARATION_TIME: 30,
};