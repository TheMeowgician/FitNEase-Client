import { router, useSegments } from 'expo-router';

/**
 * Custom hook for smart back navigation that preserves tab context
 * Fixes issue where router.back() always goes to dashboard instead of previous screen
 */
export function useSmartBack() {
  const segments = useSegments();

  const goBack = () => {
    // Check if we're in a nested screen (outside tabs)
    const isInSettings = segments.includes('settings');
    const isInProfile = segments.includes('profile') && !segments.includes('(tabs)');
    const isInAchievements = segments.includes('achievements');
    const isInGroups = segments.includes('groups') && !segments.includes('(tabs)');

    // For profile-related screens, always go back to profile tab
    // This fixes the issue where navigation from tabs doesn't preserve history
    if (isInProfile || isInAchievements) {
      console.log('📱 [SmartBack] Profile/Achievements screen detected, navigating to Profile tab');
      router.push('/(tabs)/profile');
      return;
    }

    // For settings screens, always go back to profile tab
    if (isInSettings) {
      console.log('📱 [SmartBack] Settings screen detected, navigating to Profile tab');
      router.push('/(tabs)/profile');
      return;
    }

    // For group detail screens, always go back to groups tab
    if (isInGroups) {
      console.log('📱 [SmartBack] Group details screen detected, navigating to Groups tab');
      router.push('/(tabs)/groups');
      return;
    }

    // Try to go back if possible
    if (router.canGoBack()) {
      console.log('📱 [SmartBack] Can go back, using router.back()');
      router.back();
      return;
    }

    // Default fallback to home
    console.log('📱 [SmartBack] No back history, navigating to Home tab');
    router.replace('/(tabs)');
  };

  return { goBack };
}
