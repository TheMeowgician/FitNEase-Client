import { create } from 'zustand';

/**
 * Exercise data for voting
 */
export interface VotingExercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level: number;
  target_muscle_group: string;
  default_duration_seconds?: number;
  estimated_calories_burned?: number;
  equipment_needed?: string;
  exercise_category?: string;
}

/**
 * Member vote response
 */
export interface MemberVote {
  userId: number;
  userName: string;
  vote: 'accept' | 'customize' | 'pending';
  votedAt: number | null;
}

/**
 * Voting State
 */
export interface VotingState {
  isActive: boolean;
  sessionId: string | null;
  votingId: string | null;
  initiatorId: number | null;
  initiatorName: string | null;
  startedAt: number | null;
  expiresAt: number | null;
  timeoutSeconds: number;
  exercises: VotingExercise[];
  alternativePool: VotingExercise[];
  memberVotes: Record<number, MemberVote>;
  result: 'pending' | 'accept_recommended' | 'customize' | null;
  reason: 'all_voted' | 'majority' | 'timeout' | null;
  finalExercises: VotingExercise[];
  customizerId: number | null; // User who controls exercise swaps after customize vote
}

interface VotingStore extends VotingState {
  // Actions
  startVoting: (data: {
    sessionId: string;
    votingId: string;
    initiatorId: number;
    initiatorName: string;
    members: Array<{ user_id: number; user_name: string }>;
    exercises: VotingExercise[];
    alternativePool: VotingExercise[];
    timeoutSeconds?: number;
    expiresAt?: number;
  }) => void;
  submitVote: (userId: number, userName: string, vote: 'accept' | 'customize') => void;
  updateVoteCounts: (currentVotes: Record<number, { vote: string; user_name: string }>) => void;
  completeVoting: (data: {
    result: 'accept_recommended' | 'customize';
    reason: 'all_voted' | 'majority' | 'timeout';
    finalVotes: Record<number, { vote: string; user_name: string }>;
    acceptCount: number;
    customizeCount: number;
    finalExercises: VotingExercise[];
    customizerId?: number | null;
  }) => void;
  clearVoting: () => void;

  // Computed helpers
  getVoteCounts: () => { accept: number; customize: number; pending: number; total: number };
  hasUserVoted: (userId: number) => boolean;
  getUserVote: (userId: number) => 'accept' | 'customize' | 'pending' | null;
  allVotesSubmitted: () => boolean;
}

const INITIAL_STATE: VotingState = {
  isActive: false,
  sessionId: null,
  votingId: null,
  initiatorId: null,
  initiatorName: null,
  startedAt: null,
  expiresAt: null,
  timeoutSeconds: 60, // Default 60 seconds
  exercises: [],
  alternativePool: [],
  memberVotes: {},
  result: null,
  reason: null,
  finalExercises: [],
  customizerId: null,
};

export const useVotingStore = create<VotingStore>((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Start a new voting session
   * Called when receiving VotingStarted WebSocket event
   */
  startVoting: (data) => {
    const timeoutSeconds = data.timeoutSeconds || 60;
    const startedAt = Date.now();
    // Use expiresAt from server if provided, otherwise calculate
    const expiresAt = data.expiresAt
      ? data.expiresAt * 1000 // Convert seconds to milliseconds
      : startedAt + (timeoutSeconds * 1000);

    // Initialize votes for all members as pending
    const memberVotes: Record<number, MemberVote> = {};
    data.members.forEach((member) => {
      memberVotes[member.user_id] = {
        userId: member.user_id,
        userName: member.user_name,
        vote: 'pending',
        votedAt: null,
      };
    });

    set({
      isActive: true,
      sessionId: data.sessionId,
      votingId: data.votingId,
      initiatorId: data.initiatorId,
      initiatorName: data.initiatorName,
      startedAt,
      expiresAt,
      timeoutSeconds,
      exercises: data.exercises,
      alternativePool: data.alternativePool,
      memberVotes,
      result: 'pending',
      reason: null,
      finalExercises: [],
    });

    console.log('[VOTING] Started:', {
      sessionId: data.sessionId,
      votingId: data.votingId,
      initiator: data.initiatorName,
      memberCount: data.members.length,
      exerciseCount: data.exercises.length,
      alternativeCount: data.alternativePool.length,
      timeoutSeconds,
    });
  },

  /**
   * Submit a vote for a member
   * Called when receiving VoteSubmitted WebSocket event
   */
  submitVote: (userId, userName, vote) => {
    set((state) => {
      if (!state.isActive) {
        return state;
      }

      const updatedVotes = {
        ...state.memberVotes,
        [userId]: {
          userId,
          userName,
          vote,
          votedAt: Date.now(),
        },
      };

      console.log('[VOTING] Vote submitted:', {
        userId,
        userName,
        vote,
      });

      return { memberVotes: updatedVotes };
    });
  },

  /**
   * Update vote counts from server broadcast
   * Used to sync state when receiving VoteSubmitted with currentVotes
   */
  updateVoteCounts: (currentVotes) => {
    set((state) => {
      if (!state.isActive) {
        return state;
      }

      const updatedVotes = { ...state.memberVotes };

      Object.entries(currentVotes).forEach(([userIdStr, voteData]) => {
        const userId = parseInt(userIdStr, 10);
        if (updatedVotes[userId]) {
          updatedVotes[userId] = {
            ...updatedVotes[userId],
            vote: voteData.vote as 'accept' | 'customize',
            votedAt: Date.now(),
          };
        }
      });

      return { memberVotes: updatedVotes };
    });
  },

  /**
   * Complete the voting session
   * Called when receiving VotingComplete WebSocket event
   */
  completeVoting: (data) => {
    set((state) => {
      // Update member votes with final votes (including defaults for non-voters)
      const updatedVotes = { ...state.memberVotes };

      Object.entries(data.finalVotes).forEach(([userIdStr, voteData]) => {
        const userId = parseInt(userIdStr, 10);
        if (updatedVotes[userId]) {
          updatedVotes[userId] = {
            ...updatedVotes[userId],
            vote: voteData.vote as 'accept' | 'customize',
            votedAt: updatedVotes[userId].votedAt || Date.now(),
          };
        }
      });

      console.log('[VOTING] Completed:', {
        result: data.result,
        reason: data.reason,
        acceptCount: data.acceptCount,
        customizeCount: data.customizeCount,
      });

      return {
        isActive: false,
        result: data.result,
        reason: data.reason,
        memberVotes: updatedVotes,
        finalExercises: data.finalExercises,
        customizerId: data.customizerId ?? null,
      };
    });
  },

  /**
   * Clear voting state
   */
  clearVoting: () => {
    set(INITIAL_STATE);
    console.log('[VOTING] Cleared');
  },

  /**
   * Get vote counts
   */
  getVoteCounts: () => {
    const state = get();
    const votes = Object.values(state.memberVotes);
    return {
      accept: votes.filter((v) => v.vote === 'accept').length,
      customize: votes.filter((v) => v.vote === 'customize').length,
      pending: votes.filter((v) => v.vote === 'pending').length,
      total: votes.length,
    };
  },

  /**
   * Check if a specific user has voted
   */
  hasUserVoted: (userId) => {
    const state = get();
    const vote = state.memberVotes[userId];
    return vote ? vote.vote !== 'pending' : false;
  },

  /**
   * Get a user's vote
   */
  getUserVote: (userId) => {
    const state = get();
    const vote = state.memberVotes[userId];
    return vote ? vote.vote : null;
  },

  /**
   * Check if all members have voted
   */
  allVotesSubmitted: () => {
    const state = get();
    const votes = Object.values(state.memberVotes);
    return votes.length > 0 && votes.every((v) => v.vote !== 'pending');
  },
}));

// Selectors for optimized re-renders
export const selectIsVotingActive = (state: VotingStore) => state.isActive;
export const selectVotingSessionId = (state: VotingStore) => state.sessionId;
export const selectVotingId = (state: VotingStore) => state.votingId;
export const selectVotingExercises = (state: VotingStore) => state.exercises;
export const selectVotingAlternatives = (state: VotingStore) => state.alternativePool;
export const selectMemberVotes = (state: VotingStore) => state.memberVotes;
export const selectVotingResult = (state: VotingStore) => state.result;
export const selectVotingReason = (state: VotingStore) => state.reason;
export const selectVotingExpiresAt = (state: VotingStore) => state.expiresAt;
export const selectFinalExercises = (state: VotingStore) => state.finalExercises;
export const selectVotingTimeoutSeconds = (state: VotingStore) => state.timeoutSeconds;
