import React, { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  const MIN_FETCH_INTERVAL = 30000; // 30 seconds between fetches

  /**
   * Fetch unseen achievements from the backend
   */
  const fetchUnseenAchievements = useCallback(async () => {
    if (!isAuthenticated || !user?.user_id) {
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

      const unseen = await engagementService.getUnseenAchievements(user.user_id);

      if (unseen && unseen.length > 0) {
        console.log('🏆 [ACHIEVEMENT HANDLER] Found unseen achievements:', unseen.length);
        addUnlockedAchievements(unseen);
        // Small delay before showing modal for better UX
        setTimeout(() => {
          showModal();
        }, 500);
      } else {
        console.log('🏆 [ACHIEVEMENT HANDLER] No unseen achievements');
      }

      setHasFetchedUnseen(true);
    } catch (error) {
      console.warn('🏆 [ACHIEVEMENT HANDLER] Error fetching unseen achievements:', error);
    }
  }, [isAuthenticated, user?.user_id, addUnlockedAchievements, showModal, setHasFetchedUnseen]);

  /**
   * Handle modal close - mark achievements as seen
   */
  const handleModalClose = useCallback(async () => {
    // Get IDs before hiding modal (this clears them from store)
    const idsToMark = getPendingSeenIds();

    // Hide the modal
    hideModal();

    // Mark achievements as seen in the backend
    if (idsToMark.length > 0 && user?.user_id) {
      console.log('🏆 [ACHIEVEMENT HANDLER] Marking as seen:', idsToMark);
      await engagementService.markAchievementsSeen(user.user_id, idsToMark);
    }
  }, [getPendingSeenIds, hideModal, user?.user_id]);

  /**
   * Effect: Fetch unseen achievements when user authenticates
   */
  useEffect(() => {
    if (isAuthenticated && user?.user_id && !hasFetchedUnseen) {
      // Delay initial fetch to let the app settle after login
      const timer = setTimeout(() => {
        fetchUnseenAchievements();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.user_id, hasFetchedUnseen, fetchUnseenAchievements]);

  /**
   * Effect: Reset fetch flag when user logs out
   */
  useEffect(() => {
    if (!isAuthenticated) {
      resetFetchFlag();
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
        user?.user_id
      ) {
        console.log('🏆 [ACHIEVEMENT HANDLER] App became active, checking for unseen achievements');
        fetchUnseenAchievements();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user?.user_id, fetchUnseenAchievements]);

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
