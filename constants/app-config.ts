export const APP_CONFIG = {
  APP_NAME: 'FitNEase',
  APP_VERSION: '1.0.0',
  APP_BUILD: '1',

  // Navigation
  INITIAL_ROUTE: 'login',
  AUTHENTICATED_ROUTE: '(tabs)',

  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: '@fitnease_auth_token',
    REFRESH_TOKEN: '@fitnease_refresh_token',
    USER_DATA: '@fitnease_user_data',
    ONBOARDING_COMPLETED: '@fitnease_onboarding_completed',
    BIOMETRIC_ENABLED: '@fitnease_biometric_enabled',
    THEME_PREFERENCE: '@fitnease_theme',
    LANGUAGE_PREFERENCE: '@fitnease_language',
    NOTIFICATION_SETTINGS: '@fitnease_notifications',
    OFFLINE_QUEUE: '@fitnease_offline_queue',
    CACHE_DATA: '@fitnease_cache',
  } as const,

  // Validation Rules
  VALIDATION: {
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 30,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    VERIFICATION_CODE_LENGTH: 6,
    GROUP_CODE_LENGTH: 8,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    EXERCISES_PER_PAGE: 15,
    WORKOUTS_PER_PAGE: 10,
    GROUPS_PER_PAGE: 12,
    ACHIEVEMENTS_PER_PAGE: 20,
  },

  // Caching
  CACHE: {
    EXERCISES_TTL: 24 * 60 * 60 * 1000, // 24 hours
    WORKOUTS_TTL: 12 * 60 * 60 * 1000,  // 12 hours
    USER_PROFILE_TTL: 2 * 60 * 60 * 1000, // 2 hours
    GROUPS_TTL: 30 * 60 * 1000,          // 30 minutes
    RECOMMENDATIONS_TTL: 60 * 60 * 1000,  // 1 hour
  },

  // Upload Limits
  UPLOAD_LIMITS: {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,     // 5MB
    MAX_VIDEO_SIZE: 50 * 1024 * 1024,    // 50MB
    SUPPORTED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'webp'],
    SUPPORTED_VIDEO_TYPES: ['mp4', 'mov', 'avi'],
  },

  // Performance
  PERFORMANCE: {
    IMAGE_QUALITY: 0.8,
    THUMBNAIL_SIZE: { width: 150, height: 150 },
    VIDEO_THUMBNAIL_TIME: 3, // seconds
    MAX_CONCURRENT_REQUESTS: 5,
    REQUEST_RETRY_ATTEMPTS: 3,
    REQUEST_RETRY_DELAY: 1000, // milliseconds
  },

  // Features
  FEATURES: {
    BIOMETRIC_AUTH: true,
    OFFLINE_MODE: true,
    PUSH_NOTIFICATIONS: true,
    ANALYTICS: true,
    CRASH_REPORTING: true,
    PERFORMANCE_MONITORING: true,
    DEEP_LINKING: true,
    SOCIAL_SHARING: true,
    IN_APP_PURCHASES: false, // Future feature
  },

  // Social
  SOCIAL: {
    MAX_GROUP_MEMBERS: 50,
    MAX_GROUP_NAME_LENGTH: 30,
    MAX_GROUP_DESCRIPTION_LENGTH: 200,
    MAX_COMMENT_LENGTH: 500,
    GROUP_CODE_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  },

  // Notifications
  NOTIFICATIONS: {
    WORKOUT_REMINDER_DEFAULT: true,
    ACHIEVEMENT_ALERT_DEFAULT: true,
    GROUP_ACTIVITY_DEFAULT: true,
    MARKETING_DEFAULT: false,
    QUIET_HOURS_START: '22:00',
    QUIET_HOURS_END: '07:00',
  },
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Please check your internet connection and try again.',
  AUTHENTICATION_FAILED: 'Invalid email or password. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  VALIDATION_FAILED: 'Please check your input and try again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',
  BIOMETRIC_NOT_AVAILABLE: 'Biometric authentication is not available on this device.',
  OFFLINE_MODE: 'You are currently offline. Some features may not be available.',
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTRATION_SUCCESS: 'Account created successfully!',
  EMAIL_VERIFIED: 'Email verified successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  WORKOUT_COMPLETED: 'Great job! Workout completed!',
  ACHIEVEMENT_UNLOCKED: 'Achievement unlocked!',
  GROUP_JOINED: 'Successfully joined the group!',
  GROUP_CREATED: 'Group created successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
};