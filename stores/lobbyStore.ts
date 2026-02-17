import { create } from 'zustand';

export interface LobbyMember {
  user_id: number;
  user_name: string;
  status: 'waiting' | 'ready';
  joined_at: number;
  fitness_level?: 'beginner' | 'intermediate' | 'advanced';
  user_role?: 'mentor' | 'member'; // User's app role (for mentor badge)
  profile_picture?: string | null;
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
  customizer_id?: number | null; // User who controls exercise swaps (separate from initiator)
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
  unreadMessageCount: number;
  isChatOpen: boolean;
  isLoading: boolean;
  lastUpdated: number; // Timestamp to force re-renders
  leftSessionId: string | null; // Session ID of lobby we just left (prevents re-initialization)
  leftAt: number | null; // Timestamp when we left (for cleanup)

  // Actions
  setLobbyState: (lobbyState: LobbyState) => void;
  updateMemberStatus: (userId: number, status: 'waiting' | 'ready') => void;
  addMember: (member: LobbyMember) => void;
  removeMember: (userId: number) => void;
  addChatMessage: (message: ChatMessage) => void;
  addChatMessages: (messages: ChatMessage[]) => void;
  removeTempMessage: (tempMessageId: string) => void;
  incrementUnreadCount: () => void;
  resetUnreadCount: () => void;
  setChatOpen: (isOpen: boolean) => void;
  clearLobby: (sessionId?: string) => void;
  clearLeftSession: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  currentLobby: null,
  chatMessages: [],
  unreadMessageCount: 0,
  isChatOpen: false,
  isLoading: false,
  lastUpdated: 0,
  leftSessionId: null,
  leftAt: null,

  /**
   * Set complete lobby state (from API or WebSocket)
   * IMPORTANT: Updates lastUpdated timestamp to force re-renders on Android
   * Also clears leftSessionId when entering a new lobby
   * CRITICAL: Rejects invalid lobbies (completed status, 0 members) to prevent ghost indicators
   */
  setLobbyState: (lobbyState: LobbyState) => {
    // CRITICAL: Validate lobby state before setting
    // Reject completed lobbies or lobbies with 0 members (ghost lobbies)
    if (lobbyState.status === 'completed' ||
        !lobbyState.members ||
        lobbyState.members.length === 0) {
      console.log('⚠️ [LOBBY STORE] Rejecting invalid lobby state:', {
        session_id: lobbyState.session_id,
        status: lobbyState.status,
        member_count: lobbyState.member_count,
        members_count_actual: lobbyState.members?.length || 0,
      });
      return; // Don't set invalid lobby state
    }

    set({
      currentLobby: lobbyState,
      lastUpdated: Date.now(), // Force re-render by updating timestamp
      // Clear leftSessionId when entering a lobby (prevents blocking future joins)
      leftSessionId: null,
      leftAt: null,
    });
    console.log('📊 [LOBBY STORE] Lobby state updated:', {
      session_id: lobbyState.session_id,
      status: lobbyState.status,
      member_count: lobbyState.member_count,
      members_count_actual: lobbyState.members?.length || 0,
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
        lastUpdated: Date.now() // Force re-render
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
        lastUpdated: Date.now() // Force re-render
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
        lastUpdated: Date.now() // Force re-render
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

      // Increment unread count if chat is closed (unless it's a temp message)
      const shouldIncrementUnread = !state.isChatOpen && !message.message_id.startsWith('temp-');

      return {
        chatMessages: [...state.chatMessages, message],
        unreadMessageCount: shouldIncrementUnread ? state.unreadMessageCount + 1 : state.unreadMessageCount,
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
   * Remove temporary optimistic message (when real message arrives)
   */
  removeTempMessage: (tempMessageId: string) => {
    set((state) => ({
      chatMessages: state.chatMessages.filter((m) => m.message_id !== tempMessageId),
    }));
    console.log('🗑️ [LOBBY STORE] Temp message removed:', tempMessageId);
  },

  /**
   * Increment unread message count
   */
  incrementUnreadCount: () => {
    set((state) => ({
      unreadMessageCount: state.unreadMessageCount + 1,
    }));
  },

  /**
   * Reset unread message count (when chat is opened)
   */
  resetUnreadCount: () => {
    set({ unreadMessageCount: 0 });
    console.log('📬 [LOBBY STORE] Unread count reset');
  },

  /**
   * Set chat open/closed state
   */
  setChatOpen: (isOpen: boolean) => {
    set({ isChatOpen: isOpen });
    if (isOpen) {
      set({ unreadMessageCount: 0 });
    }
    console.log(`💬 [LOBBY STORE] Chat ${isOpen ? 'opened' : 'closed'}`);
  },

  /**
   * Clear lobby and chat
   * @param sessionId - Optional session ID to mark as "just left" (prevents re-initialization)
   */
  clearLobby: (sessionId?: string) => {
    const currentSessionId = sessionId || get().currentLobby?.session_id;
    set({
      currentLobby: null,
      chatMessages: [],
      unreadMessageCount: 0,
      isChatOpen: false,
      isLoading: false,
      lastUpdated: Date.now(), // Force re-render
      leftSessionId: currentSessionId || null,
      leftAt: Date.now(),
    });
    console.log('🗑️ [LOBBY STORE] Lobby cleared, leftSessionId:', currentSessionId);
  },

  /**
   * Clear the "just left" session marker
   * Call this after sufficient time has passed or when entering a new lobby
   */
  clearLeftSession: () => {
    set({
      leftSessionId: null,
      leftAt: null,
    });
    console.log('🗑️ [LOBBY STORE] Left session marker cleared');
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
}));

/**
 * Stable empty array reference to prevent unnecessary re-renders
 */
const EMPTY_ARRAY: LobbyMember[] = [];

/**
 * Selectors for optimized re-renders
 */
export const selectCurrentLobby = (state: LobbyStore) => state.currentLobby;

export const selectLobbyMembers = (state: LobbyStore) =>
  state.currentLobby?.members ?? EMPTY_ARRAY;

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

export const selectUnreadMessageCount = (state: LobbyStore) => state.unreadMessageCount;

export const selectLeftSessionId = (state: LobbyStore) => state.leftSessionId;

export const selectLeftAt = (state: LobbyStore) => state.leftAt;
