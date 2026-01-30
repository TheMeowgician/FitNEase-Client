import { create } from 'zustand';
import { UnlockedAchievement } from '../components/achievements/AchievementUnlockModal';

// Extended interface to include user_achievement_id for marking as seen
export interface UnseenAchievement extends UnlockedAchievement {
  user_achievement_id: number;
}

interface AchievementState {
  // Queue of newly unlocked achievements to show
  unlockedQueue: UnseenAchievement[];
  // IDs to mark as seen when modal closes
  pendingSeenIds: number[];
  // Whether the modal is currently showing
  isModalVisible: boolean;
  // Flag to prevent duplicate fetches
  hasFetchedUnseen: boolean;

  // Actions
  addUnlockedAchievements: (achievements: UnseenAchievement[]) => void;
  showModal: () => void;
  hideModal: () => void;
  clearQueue: () => void;
  hasUnlockedAchievements: () => boolean;
  getPendingSeenIds: () => number[];
  setHasFetchedUnseen: (value: boolean) => void;
  resetFetchFlag: () => void;
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlockedQueue: [],
  pendingSeenIds: [],
  isModalVisible: false,
  hasFetchedUnseen: false,

  addUnlockedAchievements: (achievements) => {
    if (achievements.length === 0) return;

    // Extract user_achievement_ids for marking as seen later
    const ids = achievements
      .filter(a => a.user_achievement_id)
      .map(a => a.user_achievement_id);

    set((state) => ({
      unlockedQueue: [...state.unlockedQueue, ...achievements],
      pendingSeenIds: [...state.pendingSeenIds, ...ids],
    }));

    console.log('🏆 [ACHIEVEMENT STORE] Added achievements to queue:', achievements.length);
  },

  showModal: () => {
    const { unlockedQueue } = get();
    if (unlockedQueue.length > 0) {
      set({ isModalVisible: true });
      console.log('🏆 [ACHIEVEMENT STORE] Showing achievement modal');
    }
  },

  hideModal: () => {
    set({ isModalVisible: false, unlockedQueue: [] });
    console.log('🏆 [ACHIEVEMENT STORE] Modal closed, queue cleared');
  },

  clearQueue: () => {
    set({ unlockedQueue: [], pendingSeenIds: [] });
  },

  hasUnlockedAchievements: () => {
    return get().unlockedQueue.length > 0;
  },

  getPendingSeenIds: () => {
    const ids = get().pendingSeenIds;
    // Clear the pending IDs after getting them
    set({ pendingSeenIds: [] });
    return ids;
  },

  setHasFetchedUnseen: (value) => {
    set({ hasFetchedUnseen: value });
  },

  resetFetchFlag: () => {
    set({ hasFetchedUnseen: false });
  },
}));
