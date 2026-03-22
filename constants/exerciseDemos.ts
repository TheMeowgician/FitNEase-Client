// Exercise demonstration video mapping
// Smart matching system: Direct match → Keyword match → Category fallback

import { AVPlaybackSource } from 'expo-av';

// Import all exercise demo videos
const exerciseDemoVideos: { [key: string]: AVPlaybackSource } = {
  // Lunges
  'alternating lunges': require('../assets/images/exercise-demos/alternating_lunges.mp4'),
  'lunges': require('../assets/images/exercise-demos/alternating_lunges.mp4'),
  'lunge': require('../assets/images/exercise-demos/alternating_lunges.mp4'),

  // Arm exercises
  'arm raises': require('../assets/images/exercise-demos/arm_raises.mp4'),
  'arm circles': require('../assets/images/exercise-demos/arm_raises.mp4'),

  // Bicycle Crunches
  'bicycle crunches': require('../assets/images/exercise-demos/bicycle_crunches_slow.mp4'),
  'ab bicycle': require('../assets/images/exercise-demos/bicycle_crunches_slow.mp4'),
  'bicycle crunch': require('../assets/images/exercise-demos/bicycle_crunches_slow.mp4'),

  // Bird Dog
  'bird dog': require('../assets/images/exercise-demos/bird_dog.mp4'),
  'bird-dog': require('../assets/images/exercise-demos/bird_dog.mp4'),

  // Squats
  'squats': require('../assets/images/exercise-demos/squats.mp4'),
  'squat': require('../assets/images/exercise-demos/squats.mp4'),
  'bodyweight squat': require('../assets/images/exercise-demos/bodyweight_squat_slow.mp4'),
  'bodyweight squats': require('../assets/images/exercise-demos/bodyweight_squat_slow.mp4'),
  'squat hold': require('../assets/images/exercise-demos/squat_hold.mp4'),
  'squat isometric hold': require('../assets/images/exercise-demos/squat_hold.mp4'),

  // Burpees
  'burpee': require('../assets/images/exercise-demos/burpees.mp4'),
  'burpees': require('../assets/images/exercise-demos/burpees.mp4'),

  // Calf Raises
  'calf raises': require('../assets/images/exercise-demos/calf_raises.mp4'),
  'calf raise': require('../assets/images/exercise-demos/calf_raises.mp4'),
  'standing calf raise': require('../assets/images/exercise-demos/calf_raises.mp4'),

  // Dead Bug
  'dead bug': require('../assets/images/exercise-demos/dead_bug.mp4'),
  'dead bug reach': require('../assets/images/exercise-demos/dead_bug.mp4'),

  // Glute Bridge
  'glute bridge': require('../assets/images/exercise-demos/glutes_bridge.mp4'),
  'glute bridges': require('../assets/images/exercise-demos/glutes_bridge.mp4'),
  'hip bridge': require('../assets/images/exercise-demos/glutes_bridge.mp4'),

  // Heel Touches
  'heel touch': require('../assets/images/exercise-demos/heel_touch.mp4'),
  'heel touches': require('../assets/images/exercise-demos/heel_touch.mp4'),
  'lying heel touches': require('../assets/images/exercise-demos/lying_heel_touches.mp4'),

  // High Knees
  'high knees': require('../assets/images/exercise-demos/high_knees_running.mp4'),
  'high knee': require('../assets/images/exercise-demos/high_knees_running.mp4'),

  // Hip Thrusts
  'hip thrust': require('../assets/images/exercise-demos/hip_thrusts.mp4'),
  'hip thrusts': require('../assets/images/exercise-demos/hip_thrusts.mp4'),

  // Push-ups variations
  'push-up': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'push-ups': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'push up': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'push ups': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'pushup': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'pushups': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'incline push-up': require('../assets/images/exercise-demos/inclined_pushups.mp4'),
  'inclined push-up': require('../assets/images/exercise-demos/inclined_pushups.mp4'),
  'push-up: incline': require('../assets/images/exercise-demos/inclined_pushups.mp4'),
  'knee push-up': require('../assets/images/exercise-demos/knee_pushups.mp4'),
  'knee push-ups': require('../assets/images/exercise-demos/knee_pushups.mp4'),
  'push-up: on knees': require('../assets/images/exercise-demos/knee_pushups.mp4'),
  'wall push-up': require('../assets/images/exercise-demos/wall_pushups.mp4'),
  'wall push-ups': require('../assets/images/exercise-demos/wall_pushups.mp4'),
  'wall pushups': require('../assets/images/exercise-demos/wall_pushups.mp4'),
  'wide push-up': require('../assets/images/exercise-demos/wide_arm_pushups.mp4'),
  'wide push-ups': require('../assets/images/exercise-demos/wide_arm_pushups.mp4'),
  'wide arm push-up': require('../assets/images/exercise-demos/wide_arm_pushups.mp4'),
  'push-up wide': require('../assets/images/exercise-demos/wide_arm_pushups.mp4'),

  // Jumping Jacks
  'jumping jack': require('../assets/images/exercise-demos/jumping_jacks.mp4'),
  'jumping jacks': require('../assets/images/exercise-demos/jumping_jacks.mp4'),

  // Leg Raises
  'leg raises': require('../assets/images/exercise-demos/lying_leg_raises.mp4'),
  'leg raise': require('../assets/images/exercise-demos/lying_leg_raises.mp4'),
  'lying leg raise': require('../assets/images/exercise-demos/lying_leg_raises.mp4'),
  'lying leg raises': require('../assets/images/exercise-demos/lying_leg_raises.mp4'),
  'leg raises: lying leg raise': require('../assets/images/exercise-demos/lying_leg_raises.mp4'),
  'standing leg raises': require('../assets/images/exercise-demos/standing_leg_raises.mp4'),
  'standing leg raise': require('../assets/images/exercise-demos/standing_leg_raises.mp4'),

  // March in Place
  'march in place': require('../assets/images/exercise-demos/marching_in_place_fast.mp4'),
  'marching in place': require('../assets/images/exercise-demos/marching_in_place_fast.mp4'),

  // Crunches
  'crunches': require('../assets/images/exercise-demos/modified_crunches.mp4'),
  'crunch': require('../assets/images/exercise-demos/modified_crunches.mp4'),
  'modified crunches': require('../assets/images/exercise-demos/modified_crunches.mp4'),
  'reverse crunch': require('../assets/images/exercise-demos/reverse_crunches.mp4'),
  'reverse crunches': require('../assets/images/exercise-demos/reverse_crunches.mp4'),

  // Mountain Climbers
  'mountain climber': require('../assets/images/exercise-demos/mountain_climbers_slow.mp4'),
  'mountain climbers': require('../assets/images/exercise-demos/mountain_climbers_slow.mp4'),

  // Plank variations
  'plank': require('../assets/images/exercise-demos/plank.mp4'),
  'planking': require('../assets/images/exercise-demos/planking.mp4'),
  'plank shoulder taps': require('../assets/images/exercise-demos/plank_shoulder_taps.mp4'),
  'shoulder tap': require('../assets/images/exercise-demos/plank_shoulder_taps.mp4'),
  'shoulder taps': require('../assets/images/exercise-demos/plank_shoulder_taps.mp4'),
  '30 shoulder tap': require('../assets/images/exercise-demos/plank_shoulder_taps.mp4'),
  'plank to push-up': require('../assets/images/exercise-demos/plank_to_pushups.mp4'),
  'plank to pushup': require('../assets/images/exercise-demos/plank_to_pushups.mp4'),
  'plank ups': require('../assets/images/exercise-demos/plank_to_pushups.mp4'),
  'side plank': require('../assets/images/exercise-demos/side_knee_plank.mp4'),
  'side knee plank': require('../assets/images/exercise-demos/side_knee_plank.mp4'),

  // Step-ups
  'step-up': require('../assets/images/exercise-demos/step_ups_low.mp4'),
  'step-ups': require('../assets/images/exercise-demos/step_ups_low.mp4'),
  'step up': require('../assets/images/exercise-demos/step_ups_low.mp4'),
  'step ups': require('../assets/images/exercise-demos/step_ups_low.mp4'),

  // Tricep Dips
  'tricep dip': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
  'tricep dips': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
  'triceps dip': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
  'triceps dips': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
  'dips': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
};

/**
 * Keyword-based matching rules
 * Maps keywords found in exercise names to their demo GIFs
 * Order matters - more specific keywords should come first
 */
const keywordDemoMap: Array<{ keywords: string[]; demo: AVPlaybackSource }> = [
  // Push-up variations (check specific variations first)
  { keywords: ['incline push', 'inclined push'], demo: require('../assets/images/exercise-demos/inclined_pushups.mp4') },
  { keywords: ['knee push', 'kneeling push'], demo: require('../assets/images/exercise-demos/knee_pushups.mp4') },
  { keywords: ['wall push'], demo: require('../assets/images/exercise-demos/wall_pushups.mp4') },
  { keywords: ['wide push', 'wide arm push'], demo: require('../assets/images/exercise-demos/wide_arm_pushups.mp4') },
  { keywords: ['push-up', 'push up', 'pushup', 'press-up', 'press up'], demo: require('../assets/images/exercise-demos/push_ups_fast.mp4') },

  // Squat variations
  { keywords: ['squat hold', 'squat isometric', 'isometric squat'], demo: require('../assets/images/exercise-demos/squat_hold.mp4') },
  { keywords: ['squat', 'squats'], demo: require('../assets/images/exercise-demos/squats.mp4') },

  // Lunge variations
  { keywords: ['lunge', 'lunges', 'split squat'], demo: require('../assets/images/exercise-demos/alternating_lunges.mp4') },

  // Plank variations (check specific variations first)
  { keywords: ['shoulder tap', 'plank tap'], demo: require('../assets/images/exercise-demos/plank_shoulder_taps.mp4') },
  { keywords: ['side plank', 'lateral plank'], demo: require('../assets/images/exercise-demos/side_knee_plank.mp4') },
  { keywords: ['plank to push', 'plank push', 'plank up'], demo: require('../assets/images/exercise-demos/plank_to_pushups.mp4') },
  { keywords: ['plank', 'planking'], demo: require('../assets/images/exercise-demos/plank.mp4') },

  // Crunch variations
  { keywords: ['bicycle crunch', 'bicycle ab', 'ab bicycle'], demo: require('../assets/images/exercise-demos/bicycle_crunches_slow.mp4') },
  { keywords: ['reverse crunch'], demo: require('../assets/images/exercise-demos/reverse_crunches.mp4') },
  { keywords: ['crunch', 'crunches', 'sit-up', 'sit up', 'situp'], demo: require('../assets/images/exercise-demos/modified_crunches.mp4') },

  // Leg raises
  { keywords: ['standing leg raise'], demo: require('../assets/images/exercise-demos/standing_leg_raises.mp4') },
  { keywords: ['leg raise', 'leg lift'], demo: require('../assets/images/exercise-demos/lying_leg_raises.mp4') },

  // Core exercises
  { keywords: ['mountain climber'], demo: require('../assets/images/exercise-demos/mountain_climbers_slow.mp4') },
  { keywords: ['bird dog', 'bird-dog'], demo: require('../assets/images/exercise-demos/bird_dog.mp4') },
  { keywords: ['dead bug'], demo: require('../assets/images/exercise-demos/dead_bug.mp4') },
  { keywords: ['heel touch'], demo: require('../assets/images/exercise-demos/heel_touch.mp4') },
  { keywords: ['wiper', 'wipers', 'windshield'], demo: require('../assets/images/exercise-demos/plank.mp4') },
  { keywords: ['twist', 'rotation', 'russian'], demo: require('../assets/images/exercise-demos/modified_crunches.mp4') },
  { keywords: ['v-up', 'v up', 'v-sit', 'v sit'], demo: require('../assets/images/exercise-demos/modified_crunches.mp4') },
  { keywords: ['flutter', 'scissor kick'], demo: require('../assets/images/exercise-demos/lying_leg_raises.mp4') },
  { keywords: ['hollow', 'boat'], demo: require('../assets/images/exercise-demos/plank.mp4') },

  // Glute/hip exercises
  { keywords: ['glute bridge', 'hip bridge', 'bridge'], demo: require('../assets/images/exercise-demos/glutes_bridge.mp4') },
  { keywords: ['hip thrust'], demo: require('../assets/images/exercise-demos/hip_thrusts.mp4') },

  // Cardio exercises
  { keywords: ['burpee'], demo: require('../assets/images/exercise-demos/burpees.mp4') },
  { keywords: ['jumping jack', 'star jump'], demo: require('../assets/images/exercise-demos/jumping_jacks.mp4') },
  { keywords: ['high knee', 'high-knee'], demo: require('../assets/images/exercise-demos/high_knees_running.mp4') },
  { keywords: ['march', 'marching'], demo: require('../assets/images/exercise-demos/marching_in_place_fast.mp4') },
  { keywords: ['sprint', 'run in place', 'running in place'], demo: require('../assets/images/exercise-demos/high_knees_running.mp4') },
  { keywords: ['skater hop', 'skater jump', 'skater'], demo: require('../assets/images/exercise-demos/jumping_jacks.mp4') },
  { keywords: ['jump rope', 'skipping rope', 'double under'], demo: require('../assets/images/exercise-demos/jumping_jacks.mp4') },
  { keywords: ['skip', 'skipping'], demo: require('../assets/images/exercise-demos/high_knees_running.mp4') },

  // Lower body
  { keywords: ['calf raise', 'calf raises', 'heel raise'], demo: require('../assets/images/exercise-demos/calf_raises.mp4') },
  { keywords: ['box jump', 'box step'], demo: require('../assets/images/exercise-demos/step_ups_low.mp4') },
  { keywords: ['step-up', 'step up'], demo: require('../assets/images/exercise-demos/step_ups_low.mp4') },
  { keywords: ['wall sit', 'wall squat'], demo: require('../assets/images/exercise-demos/squat_hold.mp4') },
  { keywords: ['thruster'], demo: require('../assets/images/exercise-demos/squats.mp4') },

  // Upper body
  { keywords: ['tricep dip', 'triceps dip', 'dip', 'bench dip'], demo: require('../assets/images/exercise-demos/tricep_dips_floor.mp4') },
  { keywords: ['arm raise', 'arm circle', 'lateral raise', 'shoulder press'], demo: require('../assets/images/exercise-demos/arm_raises.mp4') },
  { keywords: ['renegade row', 'renegade'], demo: require('../assets/images/exercise-demos/plank.mp4') },
];

/**
 * Category-based fallback demos
 * Used when no keyword match is found
 * Maps target muscle groups to generic demo GIFs
 */
const categoryFallbackMap: { [key: string]: AVPlaybackSource } = {
  // Core exercises
  'core': require('../assets/images/exercise-demos/plank.mp4'),
  'abdominals': require('../assets/images/exercise-demos/modified_crunches.mp4'),
  'abs': require('../assets/images/exercise-demos/modified_crunches.mp4'),

  // Lower body
  'lower_body': require('../assets/images/exercise-demos/squats.mp4'),
  'quadriceps': require('../assets/images/exercise-demos/squats.mp4'),
  'quads': require('../assets/images/exercise-demos/squats.mp4'),
  'hamstrings': require('../assets/images/exercise-demos/glutes_bridge.mp4'),
  'glutes': require('../assets/images/exercise-demos/glutes_bridge.mp4'),
  'calves': require('../assets/images/exercise-demos/calf_raises.mp4'),
  'hips': require('../assets/images/exercise-demos/squats.mp4'),
  'thighs': require('../assets/images/exercise-demos/squats.mp4'),
  'legs': require('../assets/images/exercise-demos/squats.mp4'),

  // Upper body
  'upper_body': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'chest': require('../assets/images/exercise-demos/push_ups_fast.mp4'),
  'shoulders': require('../assets/images/exercise-demos/arm_raises.mp4'),
  'shoulder': require('../assets/images/exercise-demos/arm_raises.mp4'),
  'triceps': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),
  'biceps': require('../assets/images/exercise-demos/plank.mp4'),
  'arms': require('../assets/images/exercise-demos/arm_raises.mp4'),
  'back': require('../assets/images/exercise-demos/bird_dog.mp4'),
  'lats': require('../assets/images/exercise-demos/bird_dog.mp4'),
  'upper_arms': require('../assets/images/exercise-demos/tricep_dips_floor.mp4'),

  // Full body / cardio
  'full_body': require('../assets/images/exercise-demos/burpees.mp4'),
  'cardio': require('../assets/images/exercise-demos/jumping_jacks.mp4'),
  'plyometrics': require('../assets/images/exercise-demos/jumping_jacks.mp4'),
};

/**
 * Get the demo GIF for an exercise using smart matching
 *
 * Matching priority:
 * 1. Direct match - exact exercise name match
 * 2. Keyword match - exercise name contains known keywords
 * 3. Category fallback - use target muscle group to find generic demo
 *
 * @param exerciseName - The exercise name from database
 * @param targetMuscleGroup - Optional muscle group for category fallback
 * @returns AVPlaybackSource or null if no demo exists
 */
export const getExerciseDemo = (
  exerciseName: string,
  targetMuscleGroup?: string
): AVPlaybackSource | null => {
  if (!exerciseName) return null;

  const normalizedName = exerciseName.toLowerCase().trim();

  // STEP 1: Direct match (exact name in our mapping)
  if (exerciseDemoVideos[normalizedName]) {
    return exerciseDemoVideos[normalizedName];
  }

  // STEP 2: Keyword-based matching (smart matching)
  for (const rule of keywordDemoMap) {
    for (const keyword of rule.keywords) {
      if (normalizedName.includes(keyword)) {
            return rule.demo;
      }
    }
  }

  // STEP 3: Legacy partial match (for edge cases)
  for (const key of Object.keys(exerciseDemoVideos)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return exerciseDemoVideos[key];
    }
  }

  // STEP 4: Category fallback (use muscle group)
  if (targetMuscleGroup) {
    const normalizedCategory = targetMuscleGroup.toLowerCase().trim();
    // Handle compound muscle groups (e.g., "core,upper_body")
    const groups = normalizedCategory.split(',').map(g => g.trim());
    for (const group of groups) {
      if (categoryFallbackMap[group]) {
        return categoryFallbackMap[group];
      }
    }
  }

  return null;
};

/**
 * Check if an exercise has a demo GIF
 * @param exerciseName - The exercise name from database
 * @param targetMuscleGroup - Optional muscle group for category fallback
 */
export const hasExerciseDemo = (
  exerciseName: string,
  targetMuscleGroup?: string
): boolean => {
  return getExerciseDemo(exerciseName, targetMuscleGroup) !== null;
};

export default exerciseDemoVideos;
