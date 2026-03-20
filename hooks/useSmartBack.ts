import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { router, useSegments, useFocusEffect } from 'expo-router';

/**
 * Custom hook for smart back navigation that preserves tab context.
 * Handles both in-app back buttons AND Android hardware/gesture back.
 * Fixes issue where router.back() goes to dashboard instead of the correct parent screen.
 */
export function useSmartBack() {
  const segments = useSegments();

  const goBack = useCallback(() => {
    const isInSettings = segments.includes('settings');
    const isInProfile = segments.includes('profile') && !segments.includes('(tabs)');
    const isInAchievements = segments.includes('achievements');
    const isInAssessment = segments.includes('assessment');
    const isInGroups = segments.includes('groups') && !segments.includes('(tabs)');
    const isInMentor = segments.includes('mentor');

    // Routes accessed from Profile tab — hardcode because router.back()
    // pops to the tab navigator which resets to Home (wrong)
    if (isInSettings || isInProfile || isInAchievements || isInAssessment) {
      router.push('/(tabs)/profile');
      return;
    }

    // Routes accessed from Groups tab — same reason
    if (isInGroups || isInMentor) {
      router.push('/(tabs)/groups');
      return;
    }

    // All other screens (notifications, workout, exercises, etc.)
    // router.back() works here because these are either:
    // - Accessed from Home tab (back → Home = correct, it's the default tab)
    // - Deep in the stack (back → previous non-tab screen = correct)
    if (router.canGoBack()) {
      router.back();
      return;
    }

    // No history fallback → home tab
    router.replace('/(tabs)');
  }, [segments]);

  // Override Android hardware back button / gesture navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [goBack])
  );

  return { goBack };
}
