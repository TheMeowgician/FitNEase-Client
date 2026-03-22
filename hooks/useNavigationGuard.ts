import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export const useAuthGuard = () => {
  const { isAuthenticated, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!onboardingCompleted) {
      router.replace('/(onboarding)/welcome');
    }
  }, [isAuthenticated, onboardingCompleted]);
};

export const useGuestGuard = () => {
  const { isAuthenticated, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (isAuthenticated && onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, onboardingCompleted]);
};

export const useOnboardingGuard = () => {
  const { isAuthenticated, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, onboardingCompleted]);
};

export const useEmailVerificationGuard = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (isEmailVerified && !onboardingCompleted) {
      router.replace('/(onboarding)/welcome');
    } else if (isEmailVerified && onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted]);
};

export const useWorkoutGuard = () => {
  const { isAuthenticated, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !onboardingCompleted) {
      router.replace('/');
    }
  }, [isAuthenticated, onboardingCompleted]);
};

export const useInstructorGuard = () => {
  const { isAuthenticated, onboardingCompleted, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !onboardingCompleted) {
      router.replace('/');
    } else if (user?.role !== 'mentor') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, onboardingCompleted, user]);
};

// Hook to check if navigation is allowed to specific routes
export const useRoutePermission = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted, user } = useAuth();

  const canAccessAuth = !isAuthenticated;
  const canAccessOnboarding = isAuthenticated && !onboardingCompleted;
  const canAccessMainApp = isAuthenticated && onboardingCompleted;
  const canAccessInstructor = canAccessMainApp && user?.role === 'mentor';

  return {
    canAccessAuth,
    canAccessOnboarding,
    canAccessMainApp,
    canAccessInstructor,
    isAuthenticated,
    isEmailVerified,
    onboardingCompleted,
  };
};

// Navigation state provider hook
export const useNavigationState = () => {
  const { isAuthenticated, isLoading, onboardingCompleted } = useAuth();

  const getInitialRoute = () => {
    if (isLoading) return null;

    if (!isAuthenticated) return '/(auth)/login';
    if (!onboardingCompleted) return '/(onboarding)/welcome';
    return '/(tabs)';
  };

  const isNavigationReady = !isLoading;

  return {
    initialRoute: getInitialRoute(),
    isNavigationReady,
    isLoading,
  };
};
