import { create } from 'zustand';

interface ConnectionStore {
  // State
  isConnected: boolean;
  connectionState: string; // 'connected', 'disconnected', 'reconnecting', 'connecting', 'unavailable', 'failed', 'max_retries_reached'
  reconnectAttempts: number;
  maxRetriesReached: boolean;

  // Actions
  setConnected: (isConnected: boolean) => void;
  setConnectionState: (state: string) => void;
  setReconnectAttempts: (attempts: number) => void;
  setMaxRetriesReached: (reached: boolean) => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  isConnected: false,
  connectionState: 'disconnected',
  reconnectAttempts: 0,
  maxRetriesReached: false,

  /**
   * Set connection status
   */
  setConnected: (isConnected: boolean) => {
    set({ isConnected });
    console.log(`🔌 [CONNECTION STORE] Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  },

  /**
   * Set connection state
   * States: connected, disconnected, reconnecting, connecting, unavailable, failed, max_retries_reached
   */
  setConnectionState: (connectionState: string) => {
    set({ connectionState });
    console.log(`🔌 [CONNECTION STORE] Connection state: ${connectionState}`);
  },

  /**
   * Set reconnect attempts
   */
  setReconnectAttempts: (reconnectAttempts: number) => {
    set({ reconnectAttempts });
    console.log(`🔌 [CONNECTION STORE] Reconnect attempts: ${reconnectAttempts}`);
  },

  /**
   * Set max retries reached flag
   */
  setMaxRetriesReached: (maxRetriesReached: boolean) => {
    set({ maxRetriesReached });
    if (maxRetriesReached) {
      console.log('⚠️ [CONNECTION STORE] Max retries reached!');
    }
  },

  /**
   * Reset connection state
   */
  reset: () => {
    set({
      isConnected: false,
      connectionState: 'disconnected',
      reconnectAttempts: 0,
      maxRetriesReached: false,
    });
    console.log('🔌 [CONNECTION STORE] Connection state reset');
  },
}));

/**
 * Selectors for optimized re-renders
 */
export const selectIsConnected = (state: ConnectionStore) => state.isConnected;

export const selectConnectionState = (state: ConnectionStore) => state.connectionState;

export const selectReconnectAttempts = (state: ConnectionStore) => state.reconnectAttempts;

export const selectMaxRetriesReached = (state: ConnectionStore) => state.maxRetriesReached;

export const selectIsReconnecting = (state: ConnectionStore) =>
  state.connectionState === 'reconnecting';

export const selectShouldShowReconnectPrompt = (state: ConnectionStore) =>
  state.maxRetriesReached && !state.isConnected;
