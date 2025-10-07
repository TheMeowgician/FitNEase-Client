export const API_ENDPOINTS = {
  // fitneaseauth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    VERIFY_EMAIL: '/auth/verify-code',
    RESEND_VERIFICATION: '/auth/resend-verification',
    LOGOUT: '/auth/logout',
    LOGOUT_ALL: '/auth/logout-all',
    REFRESH_TOKEN: '/auth/refresh',
    USER_PROFILE: '/auth/user-profile',
    UPDATE_PROFILE: '/auth/user-profile',
    FITNESS_ASSESSMENT: '/fitness-assessment',
    EMAIL_VERIFICATION_STATUS: '/auth/email-verification-status',
    VALIDATE_TOKEN: '/auth/validate',
  },

  // fitneasecontent endpoints
  CONTENT: {
    EXERCISES: '/content/exercises',
    WORKOUTS: '/content/workouts',
    EXERCISE_ATTRIBUTES: '/content/exercise-attributes',
    VIDEOS: '/content/videos',
    MUSCLE_GROUPS: '/content/muscle-groups',
    EXERCISE_INSTRUCTIONS: '/content/exercise-instructions',
    WORKOUT_TEMPLATES: '/content/workout-templates',
    DIFFICULTY_LEVELS: '/content/difficulty-levels',
  },

  // fitneasetracking endpoints
  TRACKING: {
    WORKOUT_SESSION: '/tracking/workout-session',
    GROUP_WORKOUT_SESSION: '/tracking/group-workout-session',
    PROGRESS: '/tracking/progress',
    BMI_RECORD: '/tracking/bmi-record',
    USER_HISTORY: '/tracking/user-history',
    WORKOUT_RATING: '/tracking/workout-rating',
    SESSION_STATS: '/tracking/session-stats',
    OVERTRAINING_RISK: '/tracking/overtraining-risk',
    WEEKLY_SUMMARY: '/tracking/weekly-summary',
  },

  // fitneaseplanning endpoints
  PLANNING: {
    WORKOUT_PLAN: '/planning/workout-plan',
    SCHEDULE: '/planning/schedule',
    RECOMMENDATIONS: '/planning/recommendations',
    CUSTOM_PLAN: '/planning/custom-plan',
    PLAN_HISTORY: '/planning/plan-history',
  },

  // fitneasesocial endpoints
  SOCIAL: {
    GROUPS: '/social/groups',
    GROUP_WORKOUTS: '/social/group-workouts',
    GROUP_MEMBERS: '/social/group-members',
    GROUP_EVALUATION: '/social/group-evaluation',
    GROUP_LEADERBOARD: '/social/group-leaderboard',
    GROUP_CHALLENGES: '/social/group-challenges',
    JOIN_GROUP: '/social/join-group',
    CREATE_GROUP: '/social/create-group',
    DISCOVER_GROUPS: '/social/discover-groups',
    USER_GROUPS: '/social/user-groups',
    POPULAR_WORKOUTS: '/social/popular-workouts',
  },

  // fitneaseml endpoints
  ML: {
    RECOMMENDATIONS: '/api/v1/recommendations',
    HYBRID_SCORES: '/api/v1/hybrid-scores',
    CONTENT_SIMILARITY: '/api/v1/content-similarity',
    COLLABORATIVE_SCORES: '/api/v1/collaborative-scores',
    PREDICT_DIFFICULTY: '/api/v1/predict-difficulty',
    PREDICT_COMPLETION: '/api/v1/predict-completion',
    PREDICT_SUITABILITY: '/api/v1/predict-suitability',
    BEHAVIORAL_DATA: '/api/v1/behavioral-data',
    USER_PATTERNS: '/api/v1/user-patterns',
    MODEL_HEALTH: '/api/v1/model-health',
    TRAIN_MODEL: '/api/v1/train-model',
  },

  // fitneaseengagement endpoints
  ENGAGEMENT: {
    ACHIEVEMENTS: '/engagement/achievements',
    USER_ACHIEVEMENTS: '/engagement/user-achievements',
    UNLOCK_ACHIEVEMENT: '/engagement/unlock-achievement',
    REWARDS: '/engagement/rewards',
    ENGAGEMENT_METRICS: '/engagement/engagement-metrics',
    LEADERBOARD: '/engagement/leaderboard',
    STREAKS: '/engagement/streaks',
    BADGES: '/engagement/badges',
  },

  // fitneasecomms endpoints
  COMMS: {
    AI_CHAT: '/comms/ai-chat',
    CHAT_HISTORY: '/comms/chat-history',
    NOTIFICATIONS: '/comms/notifications',
    NOTIFICATION_SETTINGS: '/comms/notification-settings',
    SEND_NOTIFICATION: '/comms/send-notification',
    MUSIC_INTEGRATION: '/comms/music-integration',
    EMAIL_VERIFICATION: '/comms/email/verification',
    EMAIL_WELCOME: '/comms/email/welcome',
  },

  // fitneasemedia endpoints
  MEDIA: {
    UPLOAD: '/media/upload',
    VIDEO_STREAM: '/media/video',
    IMAGE_UPLOAD: '/media/image',
    FILE_METADATA: '/media/file-metadata',
    DOWNLOAD: '/media/download',
    THUMBNAIL: '/media/thumbnail',
  },

  // fitneaseops endpoints
  OPS: {
    HEALTH_CHECK: '/ops/health-check',
    AUDIT_LOG: '/ops/audit-log',
    REPORTS: '/ops/reports',
    SYSTEM_STATS: '/ops/system-stats',
    API_LOGS: '/ops/api-logs',
  },
};

export const API_TIMEOUTS = {
  DEFAULT: 10000,      // 10 seconds
  UPLOAD: 30000,       // 30 seconds
  STREAMING: 60000,    // 60 seconds
  LONG_RUNNING: 120000, // 2 minutes
};

export const API_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  EXPONENTIAL_BASE: 2,
};

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};