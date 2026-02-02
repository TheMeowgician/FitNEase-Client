// Achievement icon mapping
// Maps achievement_name from database to custom icon images

import { ImageSourcePropType } from 'react-native';

// Import all achievement icons
const achievementImages: { [key: string]: ImageSourcePropType } = {
  // Workout Count Achievements
  'First Workout': require('../assets/images/achievements/first_workout.png'),
  'Getting Started': require('../assets/images/achievements/getting_started.png'),
  'Dedicated Trainer': require('../assets/images/achievements/dedicated_trainer.png'),
  'Fitness Warrior': require('../assets/images/achievements/fitness_warrior.png'),
  'Century Club': require('../assets/images/achievements/century_club.png'),
  'Workout Master': require('../assets/images/achievements/workout_master.png'),

  // Streak Achievements
  '3-Day Spark': require('../assets/images/achievements/3_day_spark.png'),
  'Week Warrior': require('../assets/images/achievements/week_warrior.png'),
  'Two Week Terror': require('../assets/images/achievements/two_week_terror.png'),
  'Month Master': require('../assets/images/achievements/month_master.png'),
  'Iron Will': require('../assets/images/achievements/iron_will.png'),
  'Unstoppable': require('../assets/images/achievements/unstoppable.png'),

  // Calorie Achievements
  'First Thousand': require('../assets/images/achievements/first_thousand.png'),
  'Calorie Burner': require('../assets/images/achievements/calorie_burner.png'),
  'Heat Generator': require('../assets/images/achievements/heat_generator.png'),
  'Calorie Crusher': require('../assets/images/achievements/calorie_crusher.png'),
  'Furnace Master': require('../assets/images/achievements/furnace_master.png'),

  // Time/Duration Achievements
  'First Hour': require('../assets/images/achievements/first_hour.png'),
  'Dedicated': require('../assets/images/achievements/dedicated.png'),
  'Time Investor': require('../assets/images/achievements/time_investor.png'),
  'Marathon Mind': require('../assets/images/achievements/marathon_mind.png'),
  'Time Lord': require('../assets/images/achievements/time_lord.png'),

  // Social Achievements
  'Team Player': require('../assets/images/achievements/team_player.png'),
  'Group Regular': require('../assets/images/achievements/group_regular.png'),
  'Pack Leader': require('../assets/images/achievements/pack_leader.png'),
  'Motivator': require('../assets/images/achievements/motivator.png'),
  'Community Legend': require('../assets/images/achievements/community_legend.png'),

  // Level Progression Achievements
  'Beginner': require('../assets/images/achievements/beginner.png'),
  'Intermediate': require('../assets/images/achievements/intermediate.png'),
  'Advanced': require('../assets/images/achievements/advanced.png'),
};

/**
 * Get the custom icon image for an achievement
 * @param achievementName - The achievement_name from database
 * @returns ImageSourcePropType or null if no custom icon exists
 */
export const getAchievementIcon = (achievementName: string): ImageSourcePropType | null => {
  return achievementImages[achievementName] || null;
};

/**
 * Check if an achievement has a custom icon
 * @param achievementName - The achievement_name from database
 */
export const hasCustomIcon = (achievementName: string): boolean => {
  return achievementName in achievementImages;
};

export default achievementImages;
