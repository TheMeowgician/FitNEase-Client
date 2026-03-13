import React, { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAchievementStore } from '../../stores/achievementStore';
import { engagementService } from '../../services/microservices/engagementService';
import AchievementUnlockModal from './AchievementUnlockModal';

/**
 * AchievementHandler - Global component for managing achievement notifications
 *
 * This component:
 * 1. Fetches unseen achievements when user logs in or app becomes active
 * 2. Shows the achievement modal when achievements are queued
 * 3. Marks achievements as seen when user dismisses the modal
 *
 * Place this component in the root layout so it's always mounted.
 */
export function AchievementHandler() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const {
    unlockedQueue,
    isModalVisible,
    addUnlockedAchievements,
    showModal,
    hideModal,
    getPendingSeenIds,
    hasFetchedUnseen,
    setHasFetchedUnseen,
    resetFetchFlag,
  } = useAchievementStore();

  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRetriedRef = useRef(false);
  const MIN_FETCH_INTERVAL = 30000; // 30 seconds between fetches

  /**
   * Fetch unseen achievements from the backend
   */
  const fetchUnseenAchievements = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    // Only show achievements on main tab routes (dashboard, groups, progress, etc.).
    // usePathname() strips route group names like (onboarding)/(auth), so we use an
    // allowlist of tab paths instead. This prevents the modal from appearing on:
    // - Onboarding pages (permissions, welcome, goals, etc.)
    // - Auth pages (login, register, verify-email, etc.)
    // - Any non-tab screen (group detail, settings, workout session, etc.)
    const TAB_ROUTES = ['/', '/groups', '/progress', '/profile', '/workouts', '/weekly-plan'];
    const isOnTabRoute = TAB_ROUTES.includes(pathname);
    if (!isOnTabRoute) {
      console.log('🏆 [ACHIEVEMENT HANDLER] Skipping - not on a tab route:', pathname);
      return;
    }

    // Throttle fetches to prevent spam
    const now = Date.now();
    if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log('🏆 [ACHIEVEMENT HANDLER] Skipping fetch - throttled');
      return;
    }

    try {
      console.log('🏆 [ACHIEVEMENT HANDLER] Fetching unseen achievements...');
      lastFetchTime.current = now;

      const unseen = await engagementService.getUnseenAchievements(user.id);

      if (unseen && unseen.length > 0) {
        console.log('🏆 [ACHIEVEMENT HANDLER] Found unseen achievements:', unseen.length);
        addUnlockedAchievements(unseen);
        // Small delay before showing modal for better UX
        setTimeout(() => {
          showModal();
        }, 500);
      } else {
        console.log('🏆 [ACHIEVEMENT HANDLER] No unseen achievements');
        // If first fetch found nothing, schedule one retry after 5s.
        // This handles the race condition where achievements are still
        // being written to DB (e.g. after onboarding completes).
        if (!hasRetriedRef.current) {
          hasRetriedRef.current = true;
          console.log('🏆 [ACHIEVEMENT HANDLER] Scheduling one retry in 5s...');
          retryTimerRef.current = setTimeout(() => {
            lastFetchTime.current = 0; // Reset throttle for retry
            fetchUnseenAchievements();
          }, 5000);
        }
      }

      setHasFetchedUnseen(true);
    } catch (error) {
      console.warn('🏆 [ACHIEVEMENT HANDLER] Error fetching unseen achievements:', error);
    }
  }, [isAuthenticated, user?.id, pathname, addUnlockedAchievements, showModal, setHasFetchedUnseen]);

  /**
   * Handle modal close - mark achievements as seen
   */
  const handleModalClose = useCallback(async () => {
    // Get IDs before hiding modal (this clears them from store)
    const idsToMark = getPendingSeenIds();

    // Hide the modal
    hideModal();

    // Mark achievements as seen in the backend
    if (idsToMark.length > 0 && user?.id) {
      console.log('🏆 [ACHIEVEMENT HANDLER] Marking as seen:', idsToMark);
      await engagementService.markAchievementsSeen(user.id, idsToMark);
    }
  }, [getPendingSeenIds, hideModal, user?.id]);

  /**
   * Effect: Fetch unseen achievements when user authenticates
   */
  useEffect(() => {
    if (isAuthenticated && user?.id && !hasFetchedUnseen) {
      // Reset throttle and retry state so a fresh fetch can run
      // (covers both initial login and post-onboarding re-check)
      lastFetchTime.current = 0;
      hasRetriedRef.current = false;

      // Delay fetch to let the app settle
      const timer = setTimeout(() => {
        fetchUnseenAchievements();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.id, hasFetchedUnseen, fetchUnseenAchievements]);

  /**
   * Effect: Reset fetch flag and retry state when user logs out
   */
  useEffect(() => {
    if (!isAuthenticated) {
      resetFetchFlag();
      hasRetriedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }
  }, [isAuthenticated, resetFetchFlag]);

  /**
   * Effect: Fetch unseen achievements when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated &&
        user?.id
      ) {
        console.log('🏆 [ACHIEVEMENT HANDLER] App became active, checking for unseen achievements');
        fetchUnseenAchievements();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user?.id, fetchUnseenAchievements]);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // Don't render modal if not authenticated or no achievements
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AchievementUnlockModal
      visible={isModalVisible}
      achievements={unlockedQueue}
      onClose={handleModalClose}
    />
  );
}

export default AchievementHandler;
