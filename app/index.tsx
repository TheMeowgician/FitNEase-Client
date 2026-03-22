import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

export default function IndexPage() {
  const { isAuthenticated, isLoading, onboardingCompleted, pendingVerificationEmail, user } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      console.log('🚦 Routing decision:', {
        isAuthenticated,
        onboardingCompleted,
        pendingVerificationEmail,
        isLoading,
        timestamp: new Date().toISOString()
      });

      if (!isAuthenticated) {
        if (pendingVerificationEmail) {
          // User registered but closed app before verifying email — resume verification
          console.log('➡️ Redirecting to verify-email (pending verification for:', pendingVerificationEmail, ')');
          router.push({ pathname: '/(auth)/verify-email', params: { email: pendingVerificationEmail } });
        } else {
          console.log('➡️ Redirecting to splash (not authenticated)');
          router.push('/(auth)/splash');
        }
      } else if (!onboardingCompleted) {
        console.log('➡️ Redirecting to welcome (onboarding not completed)');
        router.push('/(onboarding)/welcome');
      } else {
        console.log('➡️ Redirecting to main app (all checks passed)');
        router.push('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, onboardingCompleted, pendingVerificationEmail]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner message="Loading FitNEase..." />
      </View>
    );
  }

  return null;
}
