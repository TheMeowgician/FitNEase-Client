// Exercise demonstration GIF mapping
// Maps exercise names (case-insensitive) to their demo GIF files

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
 * Get the demo GIF for an exercise
 * @param exerciseName - The exercise name from database
 * @returns ImageSourcePropType or null if no demo exists
 */
export const getExerciseDemo = (exerciseName: string): ImageSourcePropType | null => {
  if (!exerciseName) return null;

  const normalizedName = exerciseName.toLowerCase().trim();

  // Direct match
  if (exerciseDemoImages[normalizedName]) {
    return exerciseDemoImages[normalizedName];
  }

  // Partial match - check if exercise name contains any key
  for (const key of Object.keys(exerciseDemoImages)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return exerciseDemoImages[key];
    }
  }

  return null;
};

/**
 * Check if an exercise has a demo GIF
 * @param exerciseName - The exercise name from database
 */
export const hasExerciseDemo = (exerciseName: string): boolean => {
  return getExerciseDemo(exerciseName) !== null;
};

export default exerciseDemoImages;
