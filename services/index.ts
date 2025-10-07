// API Client
export {
  APIClient,
  apiClient,
  DEFAULT_SERVICE_CONFIGS,
  type ApiResponse,
  type ErrorResponse,
  type TokenPair,
  type ServiceConfig,
  type APIClientConfig
} from './api/client';

// Token Manager
export {
  TokenManager,
  tokenManager,
  type TokenMetadata
} from './auth/tokenManager';

// Authentication Service
export {
  AuthService,
  authService,
  type User,
  type UserPreferences,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type VerifyEmailRequest,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
  type UpdateProfileRequest,
  type UpdatePreferencesRequest,
  type DeleteAccountRequest
} from './microservices/authService';

// ML Service
export {
  MLService,
  mlService,
  type WorkoutRecommendation,
  type RecommendedExercise,
  type ExerciseModification,
  type WorkoutAdaptation,
  type PersonalizationFactors,
  type WorkoutAnalysis,
  type ProgressPrediction,
  type NutritionRecommendation,
  type InjuryRiskAssessment,
  type RecoveryRecommendation,
  type GetRecommendationsRequest,
  type AnalyzeWorkoutRequest,
  type PredictProgressRequest,
  type AssessInjuryRiskRequest,
  type GetNutritionRecommendationsRequest,
  type CustomizeWorkoutRequest,
  type OptimizeScheduleRequest,
  type ScheduleOptimization
} from './microservices/mlService';

// Social Service
export {
  SocialService,
  socialService,
  type Group,
  type GroupMember,
  type GroupAchievement,
  type GroupStats,
  type FriendRequest,
  type Friend,
  type SharedWorkout,
  type WorkoutComment,
  type WorkoutCommentReply,
  type Challenge,
  type ChallengeReward,
  type ChallengeParticipant,
  type WorkoutEvaluation,
  type ActivityFeed,
  type CreateGroupRequest,
  type UpdateGroupRequest,
  type JoinGroupRequest,
  type SendFriendRequestRequest,
  type ShareWorkoutRequest,
  type CreateChallengeRequest,
  type EvaluateWorkoutRequest
} from './microservices/socialService';

// Tracking Service
export {
  TrackingService,
  trackingService,
  type Workout,
  type WorkoutExercise,
  type ExerciseSet,
  type WorkoutSession,
  type SessionExercise,
  type HeartRateData,
  type ProgressEntry,
  type BMIEntry,
  type Goal,
  type GoalMilestone,
  type Achievement,
  type WorkoutStreak,
  type PerformanceMetrics,
  type CreateWorkoutRequest,
  type StartWorkoutRequest,
  type UpdateSessionRequest,
  type CompleteWorkoutRequest,
  type LogProgressRequest,
  type CreateGoalRequest,
  type UpdateGoalRequest
} from './microservices/trackingService';

// Import all services
import { authService } from './microservices/authService';
import { mlService } from './microservices/mlService';
import { socialService } from './microservices/socialService';
import { trackingService } from './microservices/trackingService';
import { apiClient, APIClientConfig } from './api/client';
import { tokenManager } from './auth/tokenManager';

// Convenience exports for commonly used services
export const services = {
  auth: authService,
  ml: mlService,
  social: socialService,
  tracking: trackingService,
  api: apiClient,
  token: tokenManager
};

// Service status check utility
export const checkServiceHealth = async () => {
  const results = {
    api: false,
    auth: false,
    ml: false,
    social: false,
    tracking: false
  };

  try {
    // Check if API client is properly configured
    results.api = !!apiClient;

    // Check auth service by validating token
    results.auth = await authService.isAuthenticated();

    // Check other services by making simple calls (would need actual endpoints)
    // For now, just mark as available if the service objects exist
    results.ml = !!mlService;
    results.social = !!socialService;
    results.tracking = !!trackingService;

  } catch (error) {
    console.warn('Service health check failed:', error);
  }

  return results;
};

// Configuration utility
export const configureServices = (configs: Partial<APIClientConfig>) => {
  Object.entries(configs).forEach(([service, config]) => {
    if (config) {
      apiClient.updateServiceConfig(service as keyof APIClientConfig, config);
    }
  });
};

// Authentication helpers
export const authHelpers = {
  login: async (email: string, password: string, rememberMe = false) => {
    return authService.login({ email, password, rememberMe });
  },

  logout: async () => {
    return authService.logout();
  },

  isLoggedIn: async () => {
    return authService.isAuthenticated();
  },

  getCurrentUser: async () => {
    return authService.getCurrentUser();
  },

  refreshIfNeeded: async () => {
    const shouldRefresh = await tokenManager.shouldRefreshToken();
    if (shouldRefresh) {
      return authService.refreshToken();
    }
    return null;
  }
};

// Quick service access patterns
export const quick = {
  // Auth shortcuts
  async login(email: string, password: string) {
    return authHelpers.login(email, password);
  },

  async logout() {
    return authHelpers.logout();
  },

  async getUser() {
    return authHelpers.getCurrentUser();
  },

  // Workout shortcuts
  async getWorkouts(filters?: any) {
    return trackingService.getWorkouts(filters);
  },

  async startWorkout(workoutId: string) {
    return trackingService.startWorkout({ workoutId });
  },

  async getRecommendations(type = 'workout') {
    return mlService.getWorkoutRecommendations({ type: type as any });
  },

  // Social shortcuts
  async getFeed() {
    return socialService.getActivityFeed();
  },

  async getFriends() {
    return socialService.getFriends();
  },

  async getGroups() {
    return socialService.getGroups();
  }
};

// Development utilities
export const dev = {
  async getAuthStatus() {
    return authService.getAuthStatus();
  },

  async getTokenInfo() {
    return tokenManager.debugTokenInfo();
  },

  async checkHealth() {
    return checkServiceHealth();
  },

  async clearAuth() {
    return tokenManager.clearTokens();
  }
};

export default services;