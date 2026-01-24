import { create } from 'zustand';

/**
 * Ready Check Response from a user
 */
export interface ReadyCheckResponse {
  userId: number;
  userName: string;
  response: 'accepted' | 'declined' | 'pending';
  respondedAt: number | null;
}

/**
 * Ready Check State
 */
export interface ReadyCheckState {
  isActive: boolean;
  sessionId: string | null;
  groupId: string | null;
  groupName: string | null;
  initiatorId: number | null;
  initiatorName: string | null;
  startedAt: number | null;
  expiresAt: number | null;
  responses: Record<number, ReadyCheckResponse>;
  result: 'pending' | 'success' | 'failed' | 'timeout' | null;
  timeoutSeconds: number;
}

interface ReadyCheckStore extends ReadyCheckState {
  // Actions
  startReadyCheck: (data: {
    sessionId: string;
    groupId: string;
    groupName: string;
    initiatorId: number;
    initiatorName: string;
    members: Array<{ user_id: number; user_name: string }>;
    timeoutSeconds?: number;
  }) => void;
  updateResponse: (userId: number, response: 'accepted' | 'declined') => void;
  setResult: (result: 'success' | 'failed' | 'timeout') => void;
  clearReadyCheck: () => void;

  // Computed helpers
  getAllAccepted: () => boolean;
  getResponseCount: () => { accepted: number; declined: number; pending: number; total: number };
}

const INITIAL_STATE: ReadyCheckState = {
  isActive: false,
  sessionId: null,
  groupId: null,
  groupName: null,
  initiatorId: null,
  initiatorName: null,
  startedAt: null,
  expiresAt: null,
  responses: {},
  result: null,
  timeoutSeconds: 25, // Default 25 seconds
};

export const useReadyCheckStore = create<ReadyCheckStore>((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Start a new ready check
   * Called when receiving ReadyCheckStarted WebSocket event
   */
  startReadyCheck: (data) => {
    const timeoutSeconds = data.timeoutSeconds || 25;
    const startedAt = Date.now();
    const expiresAt = startedAt + (timeoutSeconds * 1000);

    // Initialize responses for all members as pending
    const responses: Record<number, ReadyCheckResponse> = {};
    data.members.forEach((member) => {
      responses[member.user_id] = {
        userId: member.user_id,
        userName: member.user_name,
        response: 'pending',
        respondedAt: null,
      };
    });

    set({
      isActive: true,
      sessionId: data.sessionId,
      groupId: data.groupId,
      groupName: data.groupName,
      initiatorId: data.initiatorId,
      initiatorName: data.initiatorName,
      startedAt,
      expiresAt,
      responses,
      result: 'pending',
      timeoutSeconds,
    });

    console.log('🔔 [READY CHECK] Started:', {
      sessionId: data.sessionId,
      initiator: data.initiatorName,
      memberCount: data.members.length,
      timeoutSeconds,
    });
  },

  /**
   * Update a user's response
   * Called when receiving ReadyCheckResponse WebSocket event
   */
  updateResponse: (userId, response) => {
    set((state) => {
      if (!state.isActive || !state.responses[userId]) {
        return state;
      }

      const updatedResponses = {
        ...state.responses,
        [userId]: {
          ...state.responses[userId],
          response,
          respondedAt: Date.now(),
        },
      };

      console.log('📝 [READY CHECK] Response updated:', {
        userId,
        response,
        userName: state.responses[userId]?.userName,
      });

      return { responses: updatedResponses };
    });
  },

  /**
   * Set the final result of the ready check
   */
  setResult: (result) => {
    set({ result, isActive: result === 'pending' });
    console.log('🏁 [READY CHECK] Result:', result);
  },

  /**
   * Clear ready check state
   */
  clearReadyCheck: () => {
    set(INITIAL_STATE);
    console.log('🧹 [READY CHECK] Cleared');
  },

  /**
   * Check if all members have accepted
   */
  getAllAccepted: () => {
    const state = get();
    const responses = Object.values(state.responses);
    return responses.length > 0 && responses.every((r) => r.response === 'accepted');
  },

  /**
   * Get response counts
   */
  getResponseCount: () => {
    const state = get();
    const responses = Object.values(state.responses);
    return {
      accepted: responses.filter((r) => r.response === 'accepted').length,
      declined: responses.filter((r) => r.response === 'declined').length,
      pending: responses.filter((r) => r.response === 'pending').length,
      total: responses.length,
    };
  },
}));

// Selectors for optimized re-renders
export const selectIsReadyCheckActive = (state: ReadyCheckStore) => state.isActive;
export const selectReadyCheckSessionId = (state: ReadyCheckStore) => state.sessionId;
export const selectReadyCheckResponses = (state: ReadyCheckStore) => state.responses;
export const selectReadyCheckResult = (state: ReadyCheckStore) => state.result;
export const selectReadyCheckExpiresAt = (state: ReadyCheckStore) => state.expiresAt;
export const selectReadyCheckGroupName = (state: ReadyCheckStore) => state.groupName;
