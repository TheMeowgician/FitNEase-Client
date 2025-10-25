import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socialService } from '../services/microservices/socialService';

/**
 * Workout Invitation Types
 */
export interface WorkoutInvitation {
  invitation_id: string;
  session_id: string;
  group_id: number;
  initiator_id: number;
  initiator_name: string;
  workout_data: any;
  expires_at: number; // Unix timestamp (seconds)
  received_at: number; // Local timestamp for ordering
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Store State Interface
 */
interface InvitationStoreState {
  // Pending invitations indexed by invitation_id
  invitations: Record<string, WorkoutInvitation>;

  // Currently visible invitation (for modal display)
  currentInvitationId: string | null;

  // Loading and error state
  isLoading: boolean;
  error: string | null;

  // Persistence flag
  isHydrated: boolean;

  // Actions
  addInvitation: (invitation: WorkoutInvitation) => void;
  removeInvitation: (invitationId: string) => void;
  acceptInvitation: (invitationId: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  declineInvitation: (invitationId: string) => Promise<{ success: boolean; error?: string }>;

  // Queue management
  showNextInvitation: () => void;
  clearCurrentInvitation: () => void;

  // Utility
  cleanupExpiredInvitations: () => void;
  fetchPendingInvitations: () => Promise<void>;
  clearAllInvitations: () => void;

  // Persistence
  hydrateFromStorage: () => Promise<void>;
  persistToStorage: () => Promise<void>;
}

const INVITATION_STORAGE_KEY = 'workout_invitations_v1';

/**
 * Global Invitation Store
 *
 * Professional features:
 * - Persistent across app restarts (AsyncStorage)
 * - Auto-deduplication (same invitation_id won't duplicate)
 * - Auto-expiration (removes invitations past expires_at)
 * - Queue management (shows invitations one at a time)
 * - Integration with backend endpoints
 */
export const useInvitationStore = create<InvitationStoreState>((set, get) => ({
  invitations: {},
  currentInvitationId: null,
  isLoading: false,
  error: null,
  isHydrated: false,

  addInvitation: (invitation) => {
    const now = Date.now();
    const expiresAtMs = invitation.expires_at * 1000; // Convert to milliseconds

    // Ignore expired invitations
    if (expiresAtMs <= now) {
      console.log('🚫 [INVITATION STORE] Ignoring expired invitation', {
        invitationId: invitation.invitation_id,
        expiresAt: new Date(expiresAtMs).toISOString(),
        now: new Date(now).toISOString()
      });
      return;
    }

    set((state) => {
      // Check if invitation already exists (deduplication)
      if (state.invitations[invitation.invitation_id]) {
        console.log('⚠️ [INVITATION STORE] Duplicate invitation ignored', {
          invitationId: invitation.invitation_id
        });
        return state;
      }

      console.log('✅ [INVITATION STORE] Adding invitation', {
        invitationId: invitation.invitation_id,
        sessionId: invitation.session_id,
        initiatorName: invitation.initiator_name,
        expiresAt: new Date(expiresAtMs).toISOString()
      });

      const newInvitations = {
        ...state.invitations,
        [invitation.invitation_id]: {
          ...invitation,
          received_at: now
        }
      };

      // Auto-show this invitation if no current invitation is shown
      const newCurrentId = state.currentInvitationId || invitation.invitation_id;

      const newState = {
        invitations: newInvitations,
        currentInvitationId: newCurrentId,
        error: null
      };

      // Persist to storage asynchronously
      setTimeout(() => get().persistToStorage(), 0);

      return newState;
    });
  },

  removeInvitation: (invitationId) => {
    set((state) => {
      const { [invitationId]: removed, ...remainingInvitations } = state.invitations;

      if (!removed) {
        return state; // Invitation doesn't exist
      }

      console.log('🗑️ [INVITATION STORE] Removing invitation', { invitationId });

      // If we're removing the current invitation, clear it
      const newCurrentId = state.currentInvitationId === invitationId
        ? null
        : state.currentInvitationId;

      const newState = {
        invitations: remainingInvitations,
        currentInvitationId: newCurrentId
      };

      // Persist to storage asynchronously
      setTimeout(() => get().persistToStorage(), 0);

      return newState;
    });
  },

  acceptInvitation: async (invitationId) => {
    const invitation = get().invitations[invitationId];

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Check if expired
    const now = Date.now();
    const expiresAtMs = invitation.expires_at * 1000;
    if (expiresAtMs <= now) {
      get().removeInvitation(invitationId);
      return { success: false, error: 'Invitation has expired' };
    }

    set({ isLoading: true, error: null });

    try {
      console.log('✅ [INVITATION STORE] Accepting invitation', { invitationId });

      const response = await socialService.acceptInvitation(invitationId);

      if (response.status === 'success') {
        // Remove from store
        get().removeInvitation(invitationId);

        // Show next invitation if any
        setTimeout(() => get().showNextInvitation(), 100);

        set({ isLoading: false });

        return {
          success: true,
          sessionId: response.data.session_id
        };
      } else {
        set({ isLoading: false, error: response.message });
        return { success: false, error: response.message };
      }
    } catch (error: any) {
      console.error('❌ [INVITATION STORE] Accept invitation failed', error);
      const errorMessage = error.message || 'Failed to accept invitation';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  declineInvitation: async (invitationId) => {
    const invitation = get().invitations[invitationId];

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Check if already expired - silently remove without API call
    const now = Date.now();
    const expiresAtMs = invitation.expires_at * 1000;
    if (expiresAtMs <= now) {
      console.log('🗑️ [INVITATION STORE] Removing expired invitation silently', { invitationId });
      get().removeInvitation(invitationId);
      setTimeout(() => get().showNextInvitation(), 100);
      return { success: true }; // Treat as success - already expired
    }

    set({ isLoading: true, error: null });

    try {
      console.log('❌ [INVITATION STORE] Declining invitation', { invitationId });

      const response = await socialService.declineInvitation(invitationId);

      if (response.status === 'success') {
        // Remove from store
        get().removeInvitation(invitationId);

        // Show next invitation if any
        setTimeout(() => get().showNextInvitation(), 100);

        set({ isLoading: false });

        return { success: true };
      } else {
        set({ isLoading: false, error: response.message });
        return { success: false, error: response.message };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to decline invitation';

      // CRITICAL: If invitation is no longer valid, treat as success and remove it
      // This prevents error loops from stale invitations
      if (errorMessage.includes('no longer valid') || errorMessage.includes('not found')) {
        console.log('🧹 [INVITATION STORE] Invitation no longer valid, removing silently', { invitationId });
        get().removeInvitation(invitationId);
        setTimeout(() => get().showNextInvitation(), 100);
        set({ isLoading: false });
        return { success: true }; // Treat as success - already handled on backend
      }

      console.error('❌ [INVITATION STORE] Decline invitation failed', error);
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  showNextInvitation: () => {
    set((state) => {
      // Get all invitation IDs sorted by received_at (oldest first)
      const invitationIds = Object.keys(state.invitations).sort((a, b) => {
        return state.invitations[a].received_at - state.invitations[b].received_at;
      });

      if (invitationIds.length === 0) {
        console.log('📭 [INVITATION STORE] No more invitations to show');
        return { currentInvitationId: null };
      }

      const nextId = invitationIds[0];
      console.log('📬 [INVITATION STORE] Showing next invitation', {
        invitationId: nextId,
        totalPending: invitationIds.length
      });

      return { currentInvitationId: nextId };
    });
  },

  clearCurrentInvitation: () => {
    set({ currentInvitationId: null });
  },

  cleanupExpiredInvitations: () => {
    const now = Date.now();

    set((state) => {
      const validInvitations: Record<string, WorkoutInvitation> = {};
      let expiredCount = 0;

      Object.entries(state.invitations).forEach(([id, invitation]) => {
        const expiresAtMs = invitation.expires_at * 1000;

        if (expiresAtMs > now) {
          validInvitations[id] = invitation;
        } else {
          expiredCount++;
        }
      });

      if (expiredCount > 0) {
        console.log('🧹 [INVITATION STORE] Cleaned up expired invitations', {
          expiredCount,
          remainingCount: Object.keys(validInvitations).length
        });

        // If current invitation was expired, clear it
        const newCurrentId = validInvitations[state.currentInvitationId || '']
          ? state.currentInvitationId
          : null;

        // Persist to storage asynchronously
        setTimeout(() => get().persistToStorage(), 0);

        return {
          invitations: validInvitations,
          currentInvitationId: newCurrentId
        };
      }

      return state;
    });
  },

  fetchPendingInvitations: async () => {
    set({ isLoading: true, error: null });

    try {
      console.log('🔄 [INVITATION STORE] Fetching pending invitations');

      const response = await socialService.getPendingInvitations();

      if (response.status === 'success' && response.data) {
        const invitations = response.data.invitations || [];

        console.log('✅ [INVITATION STORE] Fetched invitations', {
          count: invitations.length
        });

        // Add each invitation (deduplication happens in addInvitation)
        invitations.forEach((inv: any) => {
          get().addInvitation({
            invitation_id: inv.invitation_id,
            session_id: inv.session_id,
            group_id: inv.group_id,
            initiator_id: inv.initiator_id,
            initiator_name: inv.initiator_name,
            workout_data: inv.workout_data,
            expires_at: inv.expires_at,
            received_at: Date.now()
          });
        });

        // Cleanup expired ones
        get().cleanupExpiredInvitations();

        set({ isLoading: false });
      } else {
        set({ isLoading: false, error: response.message });
      }
    } catch (error: any) {
      console.error('❌ [INVITATION STORE] Fetch failed', error);
      set({ isLoading: false, error: error.message || 'Failed to fetch invitations' });
    }
  },

  clearAllInvitations: () => {
    console.log('🗑️ [INVITATION STORE] Clearing all invitations');

    set({
      invitations: {},
      currentInvitationId: null,
      error: null
    });

    // Persist to storage asynchronously
    setTimeout(() => get().persistToStorage(), 0);
  },

  hydrateFromStorage: async () => {
    try {
      console.log('💧 [INVITATION STORE] Hydrating from AsyncStorage');

      const storedData = await AsyncStorage.getItem(INVITATION_STORAGE_KEY);

      if (storedData) {
        const parsed = JSON.parse(storedData);
        const now = Date.now();

        // CRITICAL: Filter out ALL expired/stale invitations BEFORE hydration
        // This prevents auto-decline loops on app reload
        const validInvitations: Record<string, WorkoutInvitation> = {};
        let expiredCount = 0;
        let totalCount = 0;

        Object.entries(parsed.invitations || {}).forEach(([id, invitation]: [string, any]) => {
          totalCount++;
          const expiresAtMs = invitation.expires_at * 1000;

          // Only hydrate invitations that are still valid
          if (expiresAtMs > now) {
            validInvitations[id] = invitation;
          } else {
            expiredCount++;
            console.log('🗑️ [HYDRATE] Discarding expired invitation', {
              invitationId: id,
              expired: new Date(expiresAtMs).toISOString(),
              now: new Date(now).toISOString()
            });
          }
        });

        // Only set state with VALID invitations
        const validCurrentId = validInvitations[parsed.currentInvitationId || '']
          ? parsed.currentInvitationId
          : null;

        set({
          invitations: validInvitations,
          currentInvitationId: validCurrentId,
          isHydrated: true
        });

        console.log('✅ [INVITATION STORE] Hydrated with cleanup', {
          total: totalCount,
          valid: Object.keys(validInvitations).length,
          expired: expiredCount
        });

        // If we filtered out expired invitations, persist the clean state
        if (expiredCount > 0) {
          console.log('💾 [HYDRATE] Persisting cleaned invitation data');
          setTimeout(() => get().persistToStorage(), 0);
        }
      } else {
        console.log('📭 [INVITATION STORE] No stored invitations found');
        set({ isHydrated: true });
      }
    } catch (error) {
      console.error('❌ [INVITATION STORE] Hydration failed', error);
      // On error, clear AsyncStorage to prevent corrupt data loops
      try {
        await AsyncStorage.removeItem(INVITATION_STORAGE_KEY);
        console.log('🧹 [HYDRATE] Cleared corrupt AsyncStorage data');
      } catch (e) {
        console.error('❌ [HYDRATE] Failed to clear AsyncStorage', e);
      }
      set({ isHydrated: true }); // Mark as hydrated even on error
    }
  },

  persistToStorage: async () => {
    try {
      const state = get();

      const dataToStore = {
        invitations: state.invitations,
        currentInvitationId: state.currentInvitationId
      };

      await AsyncStorage.setItem(INVITATION_STORAGE_KEY, JSON.stringify(dataToStore));

      console.log('💾 [INVITATION STORE] Persisted to AsyncStorage', {
        count: Object.keys(state.invitations).length
      });
    } catch (error) {
      console.error('❌ [INVITATION STORE] Persistence failed', error);
    }
  }
}));

/**
 * Selectors for optimized re-renders
 */
export const selectCurrentInvitation = (state: InvitationStoreState) => {
  if (!state.currentInvitationId) return null;
  return state.invitations[state.currentInvitationId] || null;
};

export const selectInvitationCount = (state: InvitationStoreState) => {
  return Object.keys(state.invitations).length;
};

export const selectHasInvitations = (state: InvitationStoreState) => {
  return Object.keys(state.invitations).length > 0;
};

export const selectInvitationForSession = (sessionId: string) => (state: InvitationStoreState) => {
  return Object.values(state.invitations).find(inv => inv.session_id === sessionId);
};

/**
 * Auto-cleanup interval (run every 30 seconds)
 * Call this in your app initialization
 */
export const startInvitationCleanupInterval = () => {
  const cleanup = () => {
    useInvitationStore.getState().cleanupExpiredInvitations();
  };

  // Run immediately
  cleanup();

  // Then run every 30 seconds
  const intervalId = setInterval(cleanup, 30000);

  return () => clearInterval(intervalId);
};
