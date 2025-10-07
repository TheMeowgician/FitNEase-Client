// Service Usage Examples
// This file demonstrates how to use the FitNEase API services

import {
  authService,
  mlService,
  socialService,
  trackingService,
  services,
  quick,
  authHelpers
} from '../index';

// Example 1: Authentication Flow
export const authenticationExample = async () => {
  try {
    // Login
    const loginResult = await authService.login({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: true
    });
    console.log('Login successful:', loginResult.user);

    // Get current user
    const currentUser = await authService.getCurrentUser();
    console.log('Current user:', currentUser);

    // Update preferences
    await authService.updatePreferences({
      preferences: {
        units: 'metric',
        notifications: {
          workouts: true,
          social: true,
          achievements: true,
          reminders: false
        }
      }
    });

    // Check if authenticated
    const isAuth = await authService.isAuthenticated();
    console.log('Is authenticated:', isAuth);

  } catch (error) {
    console.error('Auth error:', error);
  }
};

// Example 2: Workout Tracking Flow
export const workoutTrackingExample = async () => {
  try {
    // Get available workouts
    const workouts = await trackingService.getWorkouts({
      type: 'strength',
      difficulty: 'intermediate',
      page: 1,
      limit: 10
    });
    console.log('Available workouts:', workouts.workouts);

    // Start a workout session
    const session = await trackingService.startWorkout({
      workoutId: workouts.workouts[0].id,
      notes: 'Starting my evening workout'
    });
    console.log('Started workout session:', session.id);

    // Update session with exercise completion
    await trackingService.updateSession(session.id, {
      exercises: [{
        exerciseId: session.exercises[0].exerciseId,
        completedSets: [{
          setNumber: 1,
          reps: 12,
          weight: 50,
          completed: true
        }]
      }],
      mood: 'good',
      energy: 'high'
    });

    // Complete the workout
    const completedSession = await trackingService.completeWorkout(session.id, {
      actualCaloriesBurned: 350,
      finalNotes: 'Great workout!',
      overallRating: 5
    });
    console.log('Completed workout:', completedSession);

  } catch (error) {
    console.error('Workout tracking error:', error);
  }
};

// Example 3: ML Recommendations
export const mlRecommendationsExample = async () => {
  try {
    // Get workout recommendations
    const workoutRecs = await mlService.getWorkoutRecommendations({
      type: 'workout',
      factors: {
        fitnessLevel: 'intermediate',
        goals: ['muscle-gain', 'strength'],
        preferences: {
          workoutTypes: ['strength', 'mixed'],
          duration: { min: 30, max: 60 },
          intensity: 'moderate',
          equipment: ['dumbbells', 'barbell']
        }
      },
      limit: 5
    });
    console.log('Workout recommendations:', workoutRecs);

    // Get nutrition recommendations
    const nutritionRecs = await mlService.getNutritionRecommendations({
      timing: 'post-workout',
      calorieTarget: 300,
      limit: 3
    });
    console.log('Nutrition recommendations:', nutritionRecs);

    // Analyze workout performance
    const analysis = await mlService.analyzeWorkout({
      workoutId: 'workout-123',
      includeComparison: true,
      includePredictions: true
    });
    console.log('Workout analysis:', analysis);

    // Get personalized insights
    const insights = await mlService.getPersonalizedInsights();
    console.log('Personal insights:', insights);

  } catch (error) {
    console.error('ML service error:', error);
  }
};

// Example 4: Social Features
export const socialFeaturesExample = async () => {
  try {
    // Get friends
    const friends = await socialService.getFriends();
    console.log('Friends:', friends.friends);

    // Get available groups
    const groups = await socialService.getGroups({
      category: 'fitness',
      type: 'public',
      page: 1,
      limit: 10
    });
    console.log('Available groups:', groups.groups);

    // Join a group
    if (groups.groups.length > 0) {
      await socialService.joinGroup({
        groupId: groups.groups[0].id,
        message: 'Excited to join this group!'
      });
    }

    // Share a workout
    const sharedWorkout = await socialService.shareWorkout({
      workoutId: 'workout-123',
      description: 'Just completed an amazing strength workout!',
      visibility: 'friends',
      tags: ['strength', 'personal-best']
    });
    console.log('Shared workout:', sharedWorkout);

    // Get activity feed
    const feed = await socialService.getActivityFeed({
      page: 1,
      limit: 20
    });
    console.log('Activity feed:', feed.activities);

    // Get challenges
    const challenges = await socialService.getChallenges({
      status: 'active',
      type: 'group',
      page: 1,
      limit: 10
    });
    console.log('Active challenges:', challenges.challenges);

  } catch (error) {
    console.error('Social features error:', error);
  }
};

// Example 5: Progress Tracking
export const progressTrackingExample = async () => {
  try {
    // Log weight progress
    const weightEntry = await trackingService.logProgress({
      type: 'weight',
      value: 75.5,
      unit: 'kg',
      notes: 'Morning weigh-in'
    });
    console.log('Weight logged:', weightEntry);

    // Log BMI
    const bmiEntry = await trackingService.logBMI(175, 75.5);
    console.log('BMI logged:', bmiEntry);

    // Create a goal
    const goal = await trackingService.createGoal({
      type: 'weight-loss',
      title: 'Lose 5kg in 3 months',
      description: 'Target weight loss for summer',
      targetValue: 70.5,
      unit: 'kg',
      targetDate: '2024-06-01',
      priority: 'high',
      milestones: [
        { title: '2kg lost', value: 73.5, targetDate: '2024-04-01' },
        { title: '4kg lost', value: 71.5, targetDate: '2024-05-01' }
      ]
    });
    console.log('Goal created:', goal);

    // Get performance metrics
    const metrics = await trackingService.getPerformanceMetrics('month');
    console.log('Monthly metrics:', metrics);

    // Get dashboard summary
    const dashboard = await trackingService.getDashboardSummary();
    console.log('Dashboard summary:', dashboard);

  } catch (error) {
    console.error('Progress tracking error:', error);
  }
};

// Example 6: Using Quick Access Helpers
export const quickAccessExample = async () => {
  try {
    // Quick login
    await quick.login('user@example.com', 'password123');

    // Quick workout access
    const workouts = await quick.getWorkouts({ type: 'cardio' });
    console.log('Quick workouts:', workouts);

    // Quick recommendations
    const recs = await quick.getRecommendations();
    console.log('Quick recommendations:', recs);

    // Quick social access
    const feed = await quick.getFeed();
    console.log('Quick feed:', feed);

  } catch (error) {
    console.error('Quick access error:', error);
  }
};

// Example 7: Service Configuration
export const serviceConfigurationExample = () => {
  // Configure service endpoints for production
  const productionConfigs = {
    auth: { baseURL: 'https://api.fitnease.com/auth', service: 'auth' },
    ml: { baseURL: 'https://api.fitnease.com/ml', service: 'ml' },
    social: { baseURL: 'https://api.fitnease.com/social', service: 'social' },
    tracking: { baseURL: 'https://api.fitnease.com/tracking', service: 'tracking' }
  };

  // Update configurations
  Object.entries(productionConfigs).forEach(([service, config]) => {
    services.api.updateServiceConfig(service as any, config);
  });

  console.log('Services configured for production');
};

// Example 8: Error Handling Patterns
export const errorHandlingExample = async () => {
  try {
    // Attempt operation
    const user = await authService.getCurrentUser();
    console.log('User:', user);

  } catch (error) {
    if (error.message.includes('401')) {
      // Handle authentication error
      console.log('Authentication required - redirecting to login');
      await authHelpers.logout();
      // Redirect to login screen
    } else if (error.message.includes('Network')) {
      // Handle network error
      console.log('Network error - showing offline message');
      // Show offline indicator
    } else {
      // Handle other errors
      console.error('Unexpected error:', error.message);
      // Show generic error message
    }
  }
};

// Example 9: Data Synchronization
export const dataSyncExample = async () => {
  try {
    // Sync user preferences
    const preferences = await authService.getPreferences();

    // Sync recent workouts
    const recentSessions = await trackingService.getSessions({
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      }
    });

    // Sync social activity
    const recentActivity = await socialService.getActivityFeed({ limit: 50 });

    console.log('Data synchronized:', {
      preferences,
      recentSessions: recentSessions.sessions.length,
      recentActivity: recentActivity.activities.length
    });

  } catch (error) {
    console.error('Sync error:', error);
  }
};

// Example 10: Complete User Journey
export const completeUserJourneyExample = async () => {
  try {
    console.log('Starting complete user journey...');

    // 1. Login
    await authHelpers.login('user@example.com', 'password123');
    console.log('✓ Logged in');

    // 2. Get recommendations
    const recommendations = await mlService.getWorkoutRecommendations({
      limit: 3
    });
    console.log('✓ Got recommendations:', recommendations.length);

    // 3. Start a workout
    if (recommendations.length > 0) {
      const session = await trackingService.startWorkout({
        workoutId: recommendations[0].id
      });
      console.log('✓ Started workout session');

      // 4. Complete some exercises
      await trackingService.updateSession(session.id, {
        mood: 'great',
        energy: 'high'
      });
      console.log('✓ Updated workout progress');

      // 5. Complete workout
      await trackingService.completeWorkout(session.id, {
        actualCaloriesBurned: 300,
        overallRating: 5
      });
      console.log('✓ Completed workout');

      // 6. Share workout
      await socialService.shareWorkout({
        workoutId: recommendations[0].id,
        description: 'Great workout today!',
        visibility: 'friends'
      });
      console.log('✓ Shared workout');
    }

    // 7. Check progress
    const dashboard = await trackingService.getDashboardSummary();
    console.log('✓ Dashboard updated:', dashboard.weeklyStats);

    // 8. Get new recommendations based on completed workout
    const newRecs = await mlService.getAdaptiveRecommendations({
      recentWorkouts: [recommendations[0].id],
      performance: [{ rating: 5, difficulty: 'just-right' }],
      feedback: [],
      preferences: {}
    });
    console.log('✓ Got adaptive recommendations:', newRecs.recommendations.length);

    console.log('✅ Complete user journey finished successfully!');

  } catch (error) {
    console.error('❌ User journey failed:', error);
  }
};

// Export all examples
export const examples = {
  authentication: authenticationExample,
  workoutTracking: workoutTrackingExample,
  mlRecommendations: mlRecommendationsExample,
  socialFeatures: socialFeaturesExample,
  progressTracking: progressTrackingExample,
  quickAccess: quickAccessExample,
  serviceConfiguration: serviceConfigurationExample,
  errorHandling: errorHandlingExample,
  dataSync: dataSyncExample,
  completeUserJourney: completeUserJourneyExample
};

// Development helper to run all examples
export const runAllExamples = async () => {
  console.log('🚀 Running all service examples...\n');

  for (const [name, example] of Object.entries(examples)) {
    try {
      console.log(`📋 Running ${name} example...`);
      await example();
      console.log(`✅ ${name} example completed\n`);
    } catch (error) {
      console.error(`❌ ${name} example failed:`, error.message, '\n');
    }
  }

  console.log('🏁 All examples completed!');
};