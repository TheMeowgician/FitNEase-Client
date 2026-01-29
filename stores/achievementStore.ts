import { create } from 'zustand';
import { UnlockedAchievement } from '../components/achievements/AchievementUnlockModal';

interface AchievementState {
  // Queue of newly unlocked achievements to show
  unlockedQueue: UnlockedAchievement[];
  // Whether the modal is currently showing
  isModalVisible: boolean;

  // Actions
  addUnlockedAchievements: (achievements: UnlockedAchievement[]) => void;
  showModal: () => void;
  hideModal: () => void;
  clearQueue: () => void;
  hasUnlockedAchievements: () => boolean;
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlockedQueue: [],
  isModalVisible: false,

  addUnlockedAchievements: (achievements) => {
    if (achievements.length === 0) return;

    set((state) => ({
      unlockedQueue: [...state.unlockedQueue, ...achievements],
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
    set({ unlockedQueue: [] });
  },

  hasUnlockedAchievements: () => {
    return get().unlockedQueue.length > 0;
  },
}));
