import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

export default function IndexPage() {
  const { isAuthenticated, isLoading, isEmailVerified, onboardingCompleted } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      console.log('🚦 Routing decision:', {
        isAuthenticated,
        isEmailVerified,
        onboardingCompleted,
        isLoading,
        timestamp: new Date().toISOString()
      });

      if (!isAuthenticated) {
        console.log('➡️ Redirecting to splash (not authenticated)');
        // Use push instead of replace to ensure navigation happens
        router.push('/(auth)/splash');
      } else if (!isEmailVerified) {
        console.log('➡️ Redirecting to verify-email (email not verified)');
        router.push('/(auth)/verify-email');
      } else if (!onboardingCompleted) {
        console.log('➡️ Redirecting to fitness-assessment (onboarding not completed)');
        router.push('/(onboarding)/fitness-assessment');
      } else {
        console.log('➡️ Redirecting to main app (all checks passed)');
        router.push('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, isEmailVerified, onboardingCompleted]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner message="Loading FitNEase..." />
      </View>
    );
  }

  return null;
}
