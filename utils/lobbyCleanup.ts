import AsyncStorage from '@react-native-async-storage/async-storage';
import { socialService } from '../services/microservices/socialService';
import { useLobbyStore } from '../stores/lobbyStore';
import { reverbService } from '../services/reverbService';

/**
 * Lobby Cleanup Utilities
 *
 * Provides comprehensive cleanup functions for lobby exit paths and crash recovery
 */

/**
 * Check for stale lobbies after app crash/restart
 * Call this on app launch to recover from unexpected exits
 */
export async function recoverFromCrash(userId: number): Promise<void> {
  console.log('🔄 [CRASH RECOVERY] Checking for stale lobbies...');

  try {
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();

    // Filter for active lobby keys for this user
    const lobbyKeys = allKeys.filter(
      (key) => key.startsWith('activeLobby_') && key.endsWith(`_user_${userId}`)
    );

    if (lobbyKeys.length === 0) {
      console.log('✅ [CRASH RECOVERY] No stale lobbies found');
      return;
    }

    console.log(`🔍 [CRASH RECOVERY] Found ${lobbyKeys.length} stale lobby(ies)`);

    // Check each lobby to see if it's still active
    for (const key of lobbyKeys) {
      try {
        const dataStr = await AsyncStorage.getItem(key);
        if (!dataStr) continue;

        const lobbyData = JSON.parse(dataStr);
        const { sessionId, groupId } = lobbyData;

        // Check if lobby still exists on server
        const response = await socialService.getLobbyState(sessionId);

        if (!response.success || response.data?.lobby_state?.status === 'completed') {
          // Lobby no longer active, clean up
          console.log(`🗑️ [CRASH RECOVERY] Cleaning stale lobby: ${sessionId}`);
          await clearLobbyData(sessionId, groupId, userId);
        } else {
          console.log(`✅ [CRASH RECOVERY] Lobby still active: ${sessionId}`);
          // Could optionally rejoin here or just clear it
          // For safety, we'll clear it and let user rejoin manually
          await clearLobbyData(sessionId, groupId, userId);
        }
      } catch (error) {
        console.error('❌ [CRASH RECOVERY] Error checking lobby:', error);
        // Clean up anyway if we can't verify
        await AsyncStorage.removeItem(key);
      }
    }

    console.log('✅ [CRASH RECOVERY] Recovery complete');
  } catch (error) {
    console.error('❌ [CRASH RECOVERY] Recovery failed:', error);
  }
}

/**
 * Comprehensive cleanup function for all lobby exit paths
 * Covers: leave, kick, delete, complete, crash
 */
export async function clearLobbyData(
  sessionId: string,
  groupId: number,
  userId: number
): Promise<void> {
  console.log('🗑️ [CLEANUP] Clearing lobby data...');

  try {
    // 1. Clear AsyncStorage
    const storageKey = `activeLobby_group_${groupId}_user_${userId}`;
    await AsyncStorage.removeItem(storageKey);
    console.log('🗑️ [CLEANUP] Cleared AsyncStorage');

    // 2. Unsubscribe from lobby channel
    try {
      reverbService.unsubscribeFromLobby(sessionId);
      console.log('🗑️ [CLEANUP] Unsubscribed from lobby channel');
    } catch (error) {
      console.error('⚠️ [CLEANUP] Error unsubscribing from lobby:', error);
    }

    // 3. Unsubscribe from presence channel
    try {
      reverbService.unsubscribeFromPresence(`lobby.${sessionId}`);
      console.log('🗑️ [CLEANUP] Unsubscribed from presence channel');
    } catch (error) {
      console.error('⚠️ [CLEANUP] Error unsubscribing from presence:', error);
    }

    // 4. Clear lobby store
    useLobbyStore.getState().clearLobby();
    console.log('🗑️ [CLEANUP] Cleared lobby store');

    console.log('✅ [CLEANUP] Lobby data cleared successfully');
  } catch (error) {
    console.error('❌ [CLEANUP] Failed to clear lobby data:', error);
    throw error;
  }
}

/**
 * Clean up on voluntary leave
 */
export async function cleanupOnLeave(
  sessionId: string,
  groupId: number,
  userId: number
): Promise<void> {
  console.log('🚪 [LEAVE] Cleaning up on voluntary leave...');

  try {
    // Call API to leave lobby
    await socialService.leaveLobby(sessionId);
    console.log('🚪 [LEAVE] Left lobby via API');

    // Clear all data
    await clearLobbyData(sessionId, groupId, userId);

    console.log('✅ [LEAVE] Leave cleanup complete');
  } catch (error) {
    console.error('❌ [LEAVE] Leave cleanup failed:', error);
    // Still try to clear local data even if API fails
    try {
      await clearLobbyData(sessionId, groupId, userId);
    } catch (cleanupError) {
      console.error('❌ [LEAVE] Local cleanup also failed:', cleanupError);
    }
    throw error;
  }
}

/**
 * Clean up after being kicked
 */
export async function cleanupOnKick(
  sessionId: string,
  groupId: number,
  userId: number,
  reason?: string
): Promise<void> {
  console.log('⚠️ [KICK] Cleaning up after being kicked...');

  try {
    // No API call needed (already kicked by server)
    await clearLobbyData(sessionId, groupId, userId);

    console.log('✅ [KICK] Kick cleanup complete');
  } catch (error) {
    console.error('❌ [KICK] Kick cleanup failed:', error);
    throw error;
  }
}

/**
 * Clean up when lobby is deleted
 */
export async function cleanupOnDelete(
  sessionId: string,
  groupId: number,
  userId: number,
  reason?: string
): Promise<void> {
  console.log('🗑️ [DELETE] Cleaning up after lobby deletion...');

  try {
    // No API call needed (lobby already deleted)
    await clearLobbyData(sessionId, groupId, userId);

    console.log('✅ [DELETE] Delete cleanup complete');
  } catch (error) {
    console.error('❌ [DELETE] Delete cleanup failed:', error);
    throw error;
  }
}

/**
 * Clean up after workout completion
 */
export async function cleanupOnComplete(
  sessionId: string,
  groupId: number,
  userId: number
): Promise<void> {
  console.log('🏁 [COMPLETE] Cleaning up after workout completion...');

  try {
    // Lobby should be auto-completed by server
    await clearLobbyData(sessionId, groupId, userId);

    console.log('✅ [COMPLETE] Completion cleanup complete');
  } catch (error) {
    console.error('❌ [COMPLETE] Completion cleanup failed:', error);
    throw error;
  }
}

/**
 * Get all active lobbies for a user (for debugging)
 */
export async function getActiveLobbies(userId: number): Promise<any[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const lobbyKeys = allKeys.filter(
      (key) => key.startsWith('activeLobby_') && key.endsWith(`_user_${userId}`)
    );

    const lobbies = [];
    for (const key of lobbyKeys) {
      const dataStr = await AsyncStorage.getItem(key);
      if (dataStr) {
        lobbies.push(JSON.parse(dataStr));
      }
    }

    return lobbies;
  } catch (error) {
    console.error('❌ Error getting active lobbies:', error);
    return [];
  }
}
