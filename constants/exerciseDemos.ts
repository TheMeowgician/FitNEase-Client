// Exercise demonstration GIF mapping
// Smart matching system: Direct match → Keyword match → Category fallback

import { ImageSourcePropType } from 'react-native';

// Import all exercise demo GIFs
const exerciseDemoImages: { [key: string]: ImageSourcePropType } = {
  // Lunges
  'alternating lunges': require('../assets/images/exercise-demos/alternating_lunges.gif'),
  'lunges': require('../assets/images/exercise-demos/alternating_lunges.gif'),
  'lunge': require('../assets/images/exercise-demos/alternating_lunges.gif'),

  // Arm exercises
  'arm raises': require('../assets/images/exercise-demos/arm_raises.gif'),
  'arm circles': require('../assets/images/exercise-demos/arm_raises.gif'),

  // Bicycle Crunches
  'bicycle crunches': require('../assets/images/exercise-demos/bicycle_crunches_slow.gif'),
  'ab bicycle': require('../assets/images/exercise-demos/bicycle_crunches_slow.gif'),
  'bicycle crunch': require('../assets/images/exercise-demos/bicycle_crunches_slow.gif'),

  // Bird Dog
  'bird dog': require('../assets/images/exercise-demos/bird_dog.gif'),
  'bird-dog': require('../assets/images/exercise-demos/bird_dog.gif'),

  // Squats
  'squats': require('../assets/images/exercise-demos/squats.gif'),
  'squat': require('../assets/images/exercise-demos/squats.gif'),
  'bodyweight squat': require('../assets/images/exercise-demos/bodyweight_squat_slow.gif'),
  'bodyweight squats': require('../assets/images/exercise-demos/bodyweight_squat_slow.gif'),
  'squat hold': require('../assets/images/exercise-demos/squat_hold.gif'),
  'squat isometric hold': require('../assets/images/exercise-demos/squat_hold.gif'),

  // Burpees
  'burpee': require('../assets/images/exercise-demos/burpees.gif'),
  'burpees': require('../assets/images/exercise-demos/burpees.gif'),

  // Calf Raises
  'calf raises': require('../assets/images/exercise-demos/calf_raises.gif'),
  'calf raise': require('../assets/images/exercise-demos/calf_raises.gif'),
  'standing calf raise': require('../assets/images/exercise-demos/calf_raises.gif'),

  // Dead Bug
  'dead bug': require('../assets/images/exercise-demos/dead_bug.gif'),
  'dead bug reach': require('../assets/images/exercise-demos/dead_bug.gif'),

  // Glute Bridge
  'glute bridge': require('../assets/images/exercise-demos/glutes_bridge.gif'),
  'glute bridges': require('../assets/images/exercise-demos/glutes_bridge.gif'),
  'hip bridge': require('../assets/images/exercise-demos/glutes_bridge.gif'),

  // Heel Touches
  'heel touch': require('../assets/images/exercise-demos/heel_touch.gif'),
  'heel touches': require('../assets/images/exercise-demos/heel_touch.gif'),
  'lying heel touches': require('../assets/images/exercise-demos/lying_heel_touches.gif'),

  // High Knees
  'high knees': require('../assets/images/exercise-demos/high_knees_running.gif'),
  'high knee': require('../assets/images/exercise-demos/high_knees_running.gif'),

  // Hip Thrusts
  'hip thrust': require('../assets/images/exercise-demos/hip_thrusts.gif'),
  'hip thrusts': require('../assets/images/exercise-demos/hip_thrusts.gif'),

  // Push-ups variations
  'push-up': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'push-ups': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'push up': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'push ups': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'pushup': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'pushups': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'incline push-up': require('../assets/images/exercise-demos/inclined_pushups.gif'),
  'inclined push-up': require('../assets/images/exercise-demos/inclined_pushups.gif'),
  'push-up: incline': require('../assets/images/exercise-demos/inclined_pushups.gif'),
  'knee push-up': require('../assets/images/exercise-demos/knee_pushups.gif'),
  'knee push-ups': require('../assets/images/exercise-demos/knee_pushups.gif'),
  'push-up: on knees': require('../assets/images/exercise-demos/knee_pushups.gif'),
  'wall push-up': require('../assets/images/exercise-demos/wall_pushups.gif'),
  'wall push-ups': require('../assets/images/exercise-demos/wall_pushups.gif'),
  'wall pushups': require('../assets/images/exercise-demos/wall_pushups.gif'),
  'wide push-up': require('../assets/images/exercise-demos/wide_arm_pushups.gif'),
  'wide push-ups': require('../assets/images/exercise-demos/wide_arm_pushups.gif'),
  'wide arm push-up': require('../assets/images/exercise-demos/wide_arm_pushups.gif'),
  'push-up wide': require('../assets/images/exercise-demos/wide_arm_pushups.gif'),

  // Jumping Jacks
  'jumping jack': require('../assets/images/exercise-demos/jumping_jacks.gif'),
  'jumping jacks': require('../assets/images/exercise-demos/jumping_jacks.gif'),

  // Leg Raises
  'leg raises': require('../assets/images/exercise-demos/lying_leg_raises.gif'),
  'leg raise': require('../assets/images/exercise-demos/lying_leg_raises.gif'),
  'lying leg raise': require('../assets/images/exercise-demos/lying_leg_raises.gif'),
  'lying leg raises': require('../assets/images/exercise-demos/lying_leg_raises.gif'),
  'leg raises: lying leg raise': require('../assets/images/exercise-demos/lying_leg_raises.gif'),
  'standing leg raises': require('../assets/images/exercise-demos/standing_leg_raises.gif'),
  'standing leg raise': require('../assets/images/exercise-demos/standing_leg_raises.gif'),

  // March in Place
  'march in place': require('../assets/images/exercise-demos/marching_in_place_fast.gif'),
  'marching in place': require('../assets/images/exercise-demos/marching_in_place_fast.gif'),

  // Crunches
  'crunches': require('../assets/images/exercise-demos/modified_crunches.gif'),
  'crunch': require('../assets/images/exercise-demos/modified_crunches.gif'),
  'modified crunches': require('../assets/images/exercise-demos/modified_crunches.gif'),
  'reverse crunch': require('../assets/images/exercise-demos/reverse_crunches.gif'),
  'reverse crunches': require('../assets/images/exercise-demos/reverse_crunches.gif'),

  // Mountain Climbers
  'mountain climber': require('../assets/images/exercise-demos/mountain_climbers_slow.gif'),
  'mountain climbers': require('../assets/images/exercise-demos/mountain_climbers_slow.gif'),

  // Plank variations
  'plank': require('../assets/images/exercise-demos/plank.gif'),
  'planking': require('../assets/images/exercise-demos/planking.gif'),
  'plank shoulder taps': require('../assets/images/exercise-demos/plank_shoulder_taps.gif'),
  'shoulder tap': require('../assets/images/exercise-demos/plank_shoulder_taps.gif'),
  'shoulder taps': require('../assets/images/exercise-demos/plank_shoulder_taps.gif'),
  '30 shoulder tap': require('../assets/images/exercise-demos/plank_shoulder_taps.gif'),
  'plank to push-up': require('../assets/images/exercise-demos/plank_to_pushups.gif'),
  'plank to pushup': require('../assets/images/exercise-demos/plank_to_pushups.gif'),
  'plank ups': require('../assets/images/exercise-demos/plank_to_pushups.gif'),
  'side plank': require('../assets/images/exercise-demos/side_knee_plank.gif'),
  'side knee plank': require('../assets/images/exercise-demos/side_knee_plank.gif'),

  // Step-ups
  'step-up': require('../assets/images/exercise-demos/step_ups_low.gif'),
  'step-ups': require('../assets/images/exercise-demos/step_ups_low.gif'),
  'step up': require('../assets/images/exercise-demos/step_ups_low.gif'),
  'step ups': require('../assets/images/exercise-demos/step_ups_low.gif'),

  // Tricep Dips
  'tricep dip': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
  'tricep dips': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
  'triceps dip': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
  'triceps dips': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
  'dips': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
};

/**
 * Keyword-based matching rules
 * Maps keywords found in exercise names to their demo GIFs
 * Order matters - more specific keywords should come first
 */
const keywordDemoMap: Array<{ keywords: string[]; demo: ImageSourcePropType }> = [
  // Push-up variations (check specific variations first)
  { keywords: ['incline push', 'inclined push'], demo: require('../assets/images/exercise-demos/inclined_pushups.gif') },
  { keywords: ['knee push', 'kneeling push'], demo: require('../assets/images/exercise-demos/knee_pushups.gif') },
  { keywords: ['wall push'], demo: require('../assets/images/exercise-demos/wall_pushups.gif') },
  { keywords: ['wide push', 'wide arm push'], demo: require('../assets/images/exercise-demos/wide_arm_pushups.gif') },
  { keywords: ['push-up', 'push up', 'pushup', 'press-up', 'press up'], demo: require('../assets/images/exercise-demos/push_ups_fast.gif') },

  // Squat variations
  { keywords: ['squat hold', 'squat isometric', 'isometric squat'], demo: require('../assets/images/exercise-demos/squat_hold.gif') },
  { keywords: ['squat', 'squats'], demo: require('../assets/images/exercise-demos/squats.gif') },

  // Lunge variations
  { keywords: ['lunge', 'lunges', 'split squat'], demo: require('../assets/images/exercise-demos/alternating_lunges.gif') },

  // Plank variations (check specific variations first)
  { keywords: ['shoulder tap', 'plank tap'], demo: require('../assets/images/exercise-demos/plank_shoulder_taps.gif') },
  { keywords: ['side plank', 'lateral plank'], demo: require('../assets/images/exercise-demos/side_knee_plank.gif') },
  { keywords: ['plank to push', 'plank push', 'plank up'], demo: require('../assets/images/exercise-demos/plank_to_pushups.gif') },
  { keywords: ['plank', 'planking'], demo: require('../assets/images/exercise-demos/plank.gif') },

  // Crunch variations
  { keywords: ['bicycle crunch', 'bicycle ab', 'ab bicycle'], demo: require('../assets/images/exercise-demos/bicycle_crunches_slow.gif') },
  { keywords: ['reverse crunch'], demo: require('../assets/images/exercise-demos/reverse_crunches.gif') },
  { keywords: ['crunch', 'crunches', 'sit-up', 'sit up', 'situp'], demo: require('../assets/images/exercise-demos/modified_crunches.gif') },

  // Leg raises
  { keywords: ['standing leg raise'], demo: require('../assets/images/exercise-demos/standing_leg_raises.gif') },
  { keywords: ['leg raise', 'leg lift'], demo: require('../assets/images/exercise-demos/lying_leg_raises.gif') },

  // Core exercises
  { keywords: ['mountain climber'], demo: require('../assets/images/exercise-demos/mountain_climbers_slow.gif') },
  { keywords: ['bird dog', 'bird-dog'], demo: require('../assets/images/exercise-demos/bird_dog.gif') },
  { keywords: ['dead bug'], demo: require('../assets/images/exercise-demos/dead_bug.gif') },
  { keywords: ['heel touch'], demo: require('../assets/images/exercise-demos/heel_touch.gif') },
  { keywords: ['wiper', 'wipers', 'windshield'], demo: require('../assets/images/exercise-demos/plank.gif') },
  { keywords: ['twist', 'rotation', 'russian'], demo: require('../assets/images/exercise-demos/modified_crunches.gif') },
  { keywords: ['v-up', 'v up', 'v-sit', 'v sit'], demo: require('../assets/images/exercise-demos/modified_crunches.gif') },
  { keywords: ['flutter', 'scissor kick'], demo: require('../assets/images/exercise-demos/lying_leg_raises.gif') },
  { keywords: ['hollow', 'boat'], demo: require('../assets/images/exercise-demos/plank.gif') },

  // Glute/hip exercises
  { keywords: ['glute bridge', 'hip bridge', 'bridge'], demo: require('../assets/images/exercise-demos/glutes_bridge.gif') },
  { keywords: ['hip thrust'], demo: require('../assets/images/exercise-demos/hip_thrusts.gif') },

  // Cardio exercises
  { keywords: ['burpee'], demo: require('../assets/images/exercise-demos/burpees.gif') },
  { keywords: ['jumping jack', 'star jump'], demo: require('../assets/images/exercise-demos/jumping_jacks.gif') },
  { keywords: ['high knee', 'high-knee'], demo: require('../assets/images/exercise-demos/high_knees_running.gif') },
  { keywords: ['march', 'marching'], demo: require('../assets/images/exercise-demos/marching_in_place_fast.gif') },
  { keywords: ['sprint', 'run in place', 'running in place'], demo: require('../assets/images/exercise-demos/high_knees_running.gif') },
  { keywords: ['skater hop', 'skater jump', 'skater'], demo: require('../assets/images/exercise-demos/jumping_jacks.gif') },
  { keywords: ['jump rope', 'skipping rope', 'double under'], demo: require('../assets/images/exercise-demos/jumping_jacks.gif') },
  { keywords: ['skip', 'skipping'], demo: require('../assets/images/exercise-demos/high_knees_running.gif') },

  // Lower body
  { keywords: ['calf raise', 'calf raises', 'heel raise'], demo: require('../assets/images/exercise-demos/calf_raises.gif') },
  { keywords: ['box jump', 'box step'], demo: require('../assets/images/exercise-demos/step_ups_low.gif') },
  { keywords: ['step-up', 'step up'], demo: require('../assets/images/exercise-demos/step_ups_low.gif') },
  { keywords: ['wall sit', 'wall squat'], demo: require('../assets/images/exercise-demos/squat_hold.gif') },
  { keywords: ['thruster'], demo: require('../assets/images/exercise-demos/squats.gif') },

  // Upper body
  { keywords: ['tricep dip', 'triceps dip', 'dip', 'bench dip'], demo: require('../assets/images/exercise-demos/tricep_dips_floor.gif') },
  { keywords: ['arm raise', 'arm circle', 'lateral raise', 'shoulder press'], demo: require('../assets/images/exercise-demos/arm_raises.gif') },
  { keywords: ['renegade row', 'renegade'], demo: require('../assets/images/exercise-demos/plank.gif') },
];

/**
 * Category-based fallback demos
 * Used when no keyword match is found
 * Maps target muscle groups to generic demo GIFs
 */
const categoryFallbackMap: { [key: string]: ImageSourcePropType } = {
  // Core exercises
  'core': require('../assets/images/exercise-demos/plank.gif'),
  'abdominals': require('../assets/images/exercise-demos/modified_crunches.gif'),
  'abs': require('../assets/images/exercise-demos/modified_crunches.gif'),

  // Lower body
  'lower_body': require('../assets/images/exercise-demos/squats.gif'),
  'quadriceps': require('../assets/images/exercise-demos/squats.gif'),
  'quads': require('../assets/images/exercise-demos/squats.gif'),
  'hamstrings': require('../assets/images/exercise-demos/glutes_bridge.gif'),
  'glutes': require('../assets/images/exercise-demos/glutes_bridge.gif'),
  'calves': require('../assets/images/exercise-demos/calf_raises.gif'),
  'hips': require('../assets/images/exercise-demos/squats.gif'),
  'thighs': require('../assets/images/exercise-demos/squats.gif'),
  'legs': require('../assets/images/exercise-demos/squats.gif'),

  // Upper body
  'upper_body': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'chest': require('../assets/images/exercise-demos/push_ups_fast.gif'),
  'shoulders': require('../assets/images/exercise-demos/arm_raises.gif'),
  'shoulder': require('../assets/images/exercise-demos/arm_raises.gif'),
  'triceps': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),
  'biceps': require('../assets/images/exercise-demos/plank.gif'),
  'arms': require('../assets/images/exercise-demos/arm_raises.gif'),
  'back': require('../assets/images/exercise-demos/bird_dog.gif'),
  'lats': require('../assets/images/exercise-demos/bird_dog.gif'),
  'upper_arms': require('../assets/images/exercise-demos/tricep_dips_floor.gif'),

  // Full body / cardio
  'full_body': require('../assets/images/exercise-demos/burpees.gif'),
  'cardio': require('../assets/images/exercise-demos/jumping_jacks.gif'),
  'plyometrics': require('../assets/images/exercise-demos/jumping_jacks.gif'),
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
 * @returns ImageSourcePropType or null if no demo exists
 */
export const getExerciseDemo = (
  exerciseName: string,
  targetMuscleGroup?: string
): ImageSourcePropType | null => {
  if (!exerciseName) return null;

  const normalizedName = exerciseName.toLowerCase().trim();

  // STEP 1: Direct match (exact name in our mapping)
  if (exerciseDemoImages[normalizedName]) {
    console.log('🎬 [DEMO] Direct match:', normalizedName);
    return exerciseDemoImages[normalizedName];
  }

  // STEP 2: Keyword-based matching (smart matching)
  for (const rule of keywordDemoMap) {
    for (const keyword of rule.keywords) {
      if (normalizedName.includes(keyword)) {
        console.log('🎬 [DEMO] Keyword match:', { exercise: normalizedName, keyword });
        return rule.demo;
      }
    }
  }

  // STEP 3: Legacy partial match (for edge cases)
  for (const key of Object.keys(exerciseDemoImages)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      console.log('🎬 [DEMO] Partial match:', { exercise: normalizedName, matchedKey: key });
      return exerciseDemoImages[key];
    }
  }

  // STEP 4: Category fallback (use muscle group)
  if (targetMuscleGroup) {
    const normalizedCategory = targetMuscleGroup.toLowerCase().trim();
    // Handle compound muscle groups (e.g., "core,upper_body")
    const groups = normalizedCategory.split(',').map(g => g.trim());
    for (const group of groups) {
      if (categoryFallbackMap[group]) {
        console.log('🎬 [DEMO] Category fallback:', { exercise: normalizedName, category: group });
        return categoryFallbackMap[group];
      }
    }
  }

  console.log('🎬 [DEMO] No demo found for:', normalizedName);
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

export default exerciseDemoImages;
