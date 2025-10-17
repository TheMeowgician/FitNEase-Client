import { create } from 'zustand';

export interface LobbyMember {
  user_id: number;
  user_name: string;
  status: 'waiting' | 'ready';
  joined_at: number;
}

export interface ChatMessage {
  message_id: string;
  user_id: number | null;
  user_name: string;
  message: string;
  timestamp: number;
  is_system_message: boolean;
}

export interface LobbyState {
  session_id: string;
  group_id: number;
  initiator_id: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'completed';
  workout_data: any;
  members: LobbyMember[];
  member_count: number;
  created_at: number;
  expires_at: number;
  is_expired: boolean;
}

interface LobbyStore {
  // State
  currentLobby: LobbyState | null;
  chatMessages: ChatMessage[];
  isLoading: boolean;

  // Actions
  setLobbyState: (lobbyState: LobbyState) => void;
  updateMemberStatus: (userId: number, status: 'waiting' | 'ready') => void;
  addMember: (member: LobbyMember) => void;
  removeMember: (userId: number) => void;
  addChatMessage: (message: ChatMessage) => void;
  addChatMessages: (messages: ChatMessage[]) => void;
  clearLobby: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  currentLobby: null,
  chatMessages: [],
  isLoading: false,

  /**
   * Set complete lobby state (from API or WebSocket)
   */
  setLobbyState: (lobbyState: LobbyState) => {
    set({ currentLobby: lobbyState });
    console.log('📊 [LOBBY STORE] Lobby state updated:', {
      session_id: lobbyState.session_id,
      status: lobbyState.status,
      member_count: lobbyState.member_count,
    });
  },

  /**
   * Update specific member's status
   */
  updateMemberStatus: (userId: number, status: 'waiting' | 'ready') => {
    set((state) => {
      if (!state.currentLobby) return state;

      const updatedMembers = state.currentLobby.members.map((member) =>
        member.user_id === userId ? { ...member, status } : member
      );

      return {
        currentLobby: {
          ...state.currentLobby,
          members: updatedMembers,
        },
      };
    });

    console.log('📊 [LOBBY STORE] Member status updated:', { userId, status });
  },

  /**
   * Add new member to lobby
   */
  addMember: (member: LobbyMember) => {
    set((state) => {
      if (!state.currentLobby) return state;

      // Check if member already exists (deduplication)
      const existingMember = state.currentLobby.members.find((m) => m.user_id === member.user_id);
      if (existingMember) {
        console.log('⚠️ [LOBBY STORE] Member already exists:', member.user_id);
        return state;
      }

      return {
        currentLobby: {
          ...state.currentLobby,
          members: [...state.currentLobby.members, member],
          member_count: state.currentLobby.member_count + 1,
        },
      };
    });

    console.log('👤 [LOBBY STORE] Member added:', member.user_name);
  },

  /**
   * Remove member from lobby
   */
  removeMember: (userId: number) => {
    set((state) => {
      if (!state.currentLobby) return state;

      const updatedMembers = state.currentLobby.members.filter((m) => m.user_id !== userId);

      return {
        currentLobby: {
          ...state.currentLobby,
          members: updatedMembers,
          member_count: updatedMembers.length,
        },
      };
    });

    console.log('👤 [LOBBY STORE] Member removed:', userId);
  },

  /**
   * Add single chat message (with deduplication)
   */
  addChatMessage: (message: ChatMessage) => {
    set((state) => {
      // DEDUPLICATION: Check if message already exists
      const exists = state.chatMessages.some((m) => m.message_id === message.message_id);
      if (exists) {
        console.log('⚠️ [LOBBY STORE] Duplicate message detected, ignoring:', message.message_id);
        return state;
      }

      return {
        chatMessages: [...state.chatMessages, message],
      };
    });

    console.log('💬 [LOBBY STORE] Chat message added:', {
      from: message.user_name,
      is_system: message.is_system_message,
    });
  },

  /**
   * Add multiple chat messages (from pagination)
   */
  addChatMessages: (messages: ChatMessage[]) => {
    set((state) => {
      const existingIds = new Set(state.chatMessages.map((m) => m.message_id));

      // Filter out duplicates
      const newMessages = messages.filter((m) => !existingIds.has(m.message_id));

      if (newMessages.length === 0) {
        return state;
      }

      // Merge and sort by timestamp
      const merged = [...state.chatMessages, ...newMessages].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      return { chatMessages: merged };
    });

    console.log(`💬 [LOBBY STORE] ${messages.length} messages added to chat`);
  },

  /**
   * Clear lobby and chat
   */
  clearLobby: () => {
    set({
      currentLobby: null,
      chatMessages: [],
      isLoading: false,
    });
    console.log('🗑️ [LOBBY STORE] Lobby cleared');
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
}));

/**
 * Selectors for optimized re-renders
 */
export const selectCurrentLobby = (state: LobbyStore) => state.currentLobby;

export const selectLobbyMembers = (state: LobbyStore) => state.currentLobby?.members || [];

export const selectChatMessages = (state: LobbyStore) => state.chatMessages;

export const selectIsUserReady = (userId: number) => (state: LobbyStore) => {
  const member = state.currentLobby?.members.find((m) => m.user_id === userId);
  return member?.status === 'ready';
};

export const selectAreAllMembersReady = (state: LobbyStore) => {
  if (!state.currentLobby || state.currentLobby.members.length === 0) return false;
  return state.currentLobby.members.every((m) => m.status === 'ready');
};

export const selectIsLobbyInitiator = (userId: number) => (state: LobbyStore) => {
  return state.currentLobby?.initiator_id === userId;
};
