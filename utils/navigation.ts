import { router } from 'expo-router';

export const navigateToWorkout = (workoutId: number) => {
  router.push(`/workout/${workoutId}`);
};

export const navigateToGroupWorkout = (groupId: string, workoutId: number) => {
  router.push(`/workout/session/group/${groupId}?workoutId=${workoutId}`);
};

export const navigateToLogin = () => {
  router.replace('/(auth)/login');
};

export const navigateToHome = () => {
  router.replace('/(tabs)');
};

export const navigateToVerifyEmail = () => {
  router.replace('/(auth)/verify-email');
};

export const navigateToOnboarding = () => {
  router.replace('/(onboarding)/welcome');
};

export const navigateToTab = (tab: 'index' | 'workouts' | 'groups' | 'progress' | 'profile') => {
  router.push(`/(tabs)/${tab === 'index' ? '' : tab}`);
};

export const navigateToWorkoutSession = (sessionId: string) => {
  router.push(`/workout/session/${sessionId}`);
};

export const navigateToGroup = (groupId: string) => {
  router.push(`/groups/${groupId}`);
};

export const navigateToProfile = (userId?: string) => {
  if (userId) {
    router.push(`/profile/${userId}`);
  } else {
    router.push('/(tabs)/profile');
  }
};

export const navigateToSettings = () => {
  router.push('/settings');
};

export const navigateToChat = (chatId?: string) => {
  if (chatId) {
    router.push(`/chat/${chatId}`);
  } else {
    router.push('/chat');
  }
};

export const navigateBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
};

export const navigateToAchievements = () => {
  router.push('/achievements');
};

export const navigateToInstructorDashboard = () => {
  router.push('/instructor');
};

// Navigation helpers with type safety
export const NavigationHelpers = {
  // Auth navigation
  auth: {
    login: navigateToLogin,
    verifyEmail: navigateToVerifyEmail,
    onboarding: navigateToOnboarding,
  },

  // Main app navigation
  app: {
    home: navigateToHome,
    back: navigateBack,
  },

  // Tab navigation
  tabs: {
    home: () => navigateToTab('index'),
    workouts: () => navigateToTab('workouts'),
    groups: () => navigateToTab('groups'),
    progress: () => navigateToTab('progress'),
    profile: () => navigateToTab('profile'),
  },

  // Feature navigation
  workout: {
    details: navigateToWorkout,
    session: navigateToWorkoutSession,
    groupSession: navigateToGroupWorkout,
  },

  // Social navigation
  social: {
    group: navigateToGroup,
    profile: navigateToProfile,
    chat: navigateToChat,
  },

  // Other features
  features: {
    settings: navigateToSettings,
    achievements: navigateToAchievements,
    instructor: navigateToInstructorDashboard,
  },
};