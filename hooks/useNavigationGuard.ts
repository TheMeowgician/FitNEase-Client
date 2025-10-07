import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export const useAuthGuard = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!isEmailVerified) {
      router.replace('/(auth)/verify-email');
    } else if (!onboardingCompleted) {
      router.replace('/(onboarding)/welcome');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted]);
};

export const useGuestGuard = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (isAuthenticated && isEmailVerified && onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted]);
};

export const useOnboardingGuard = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!isEmailVerified) {
      router.replace('/(auth)/verify-email');
    } else if (onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted]);
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
  const { isAuthenticated, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !isEmailVerified || !onboardingCompleted) {
      router.replace('/');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted]);
};

export const useInstructorGuard = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !isEmailVerified || !onboardingCompleted) {
      router.replace('/');
    } else if (user?.role !== 'instructor' && user?.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isEmailVerified, onboardingCompleted, user]);
};

// Hook to check if navigation is allowed to specific routes
export const useRoutePermission = () => {
  const { isAuthenticated, isEmailVerified, onboardingCompleted, user } = useAuth();

  const canAccessAuth = !isAuthenticated;
  const canAccessOnboarding = isAuthenticated && isEmailVerified && !onboardingCompleted;
  const canAccessMainApp = isAuthenticated && isEmailVerified && onboardingCompleted;
  const canAccessInstructor = canAccessMainApp && (user?.role === 'instructor' || user?.role === 'admin');

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
  const { isAuthenticated, isLoading, isEmailVerified, onboardingCompleted } = useAuth();

  const getInitialRoute = () => {
    if (isLoading) return null;

    if (!isAuthenticated) return '/(auth)/login';
    if (!isEmailVerified) return '/(auth)/verify-email';
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