import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socialService } from '../services/microservices/socialService';
import { useAuth } from './AuthContext';

interface LobbySession {
  sessionId: string;
  groupId: string;
  groupName: string;
  userId: number;
  joinedAt: number;
  expiresAt: number;
}

interface LobbyContextType {
  activeLobby: LobbySession | null;
  setActiveLobby: (lobby: LobbySession | null) => void;
  clearActiveLobby: () => Promise<void>;
  clearActiveLobbyLocal: () => Promise<void>;
  forceCleanupAllLobbies: () => Promise<void>;
  saveLobbySession: (sessionId: string, groupId: string, groupName: string) => Promise<void>;
  checkForActiveLobby: () => Promise<void>;
  isInLobby: boolean;
  autoCleanupOnReload: boolean;
  setAutoCleanupOnReload: (value: boolean) => void;
}

const LobbyContext = createContext<LobbyContextType | undefined>(undefined);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeLobby, setActiveLobby] = useState<LobbySession | null>(null);
  const [autoCleanupOnReload, setAutoCleanupOnReload] = useState(true); // Default to true for easy development

  // Check for active lobby on mount
  useEffect(() => {
    if (user) {
      checkForActiveLobby();
    }
  }, [user]);

  /**
   * Save lobby session to both state and AsyncStorage
   */
  const saveLobbySession = async (sessionId: string, groupId: string, groupName: string) => {
    if (!user) return;

    try {
      const lobbySession: LobbySession = {
        sessionId,
        groupId,
        groupName,
        userId: parseInt(user.id),
        joinedAt: Date.now(),
        expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
      };

      // Save to state
      setActiveLobby(lobbySession);

      // Save to AsyncStorage
      const storageKey = `activeLobby_group_${groupId}_user_${user.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(lobbySession));

      console.log('💾 [LOBBY CONTEXT] Saved lobby session:', {
        sessionId,
        groupId,
        groupName,
        expiresAt: new Date(lobbySession.expiresAt).toLocaleTimeString()
      });
    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] Error saving lobby session:', error);
    }
  };

  /**
   * Clear active lobby from both state and AsyncStorage (calls backend API)
   */
  const clearActiveLobby = async () => {
    try {
      if (activeLobby && user) {
        // Try to leave on backend first
        // Note: leaveLobbyV2 now handles "already left" gracefully
        await socialService.leaveLobbyV2(activeLobby.sessionId);
        console.log('✅ [LOBBY CONTEXT] Left lobby on backend');

        const storageKey = `activeLobby_group_${activeLobby.groupId}_user_${user.id}`;
        await AsyncStorage.removeItem(storageKey);
        console.log('🧹 [LOBBY CONTEXT] Cleared lobby session from storage');
      }
      setActiveLobby(null);
    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] Error clearing lobby session:', error);
    }
  };

  /**
   * Clear active lobby locally only (does NOT call backend API)
   * Use this when you've already left the lobby via API
   *
   * CRITICAL: Set React state FIRST (synchronous, immediate UI update)
   * then do AsyncStorage cleanup (async, can be slow)
   */
  const clearActiveLobbyLocal = async () => {
    try {
      // Capture values before clearing state
      const lobbyToClean = activeLobby;
      const currentUser = user;

      // CRITICAL: Set state to null IMMEDIATELY (synchronous)
      // This ensures UI components like GlobalLobbyIndicator update right away
      setActiveLobby(null);
      console.log('🧹 [LOBBY CONTEXT] State set to null immediately');

      // THEN remove from AsyncStorage (async, slower I/O operation)
      if (lobbyToClean && currentUser) {
        const storageKey = `activeLobby_group_${lobbyToClean.groupId}_user_${currentUser.id}`;
        await AsyncStorage.removeItem(storageKey);
        console.log('🧹 [LOBBY CONTEXT] Cleared lobby session from AsyncStorage (local only)');
      }
    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] Error clearing lobby session locally:', error);
      // Even if AsyncStorage fails, state is already null which is the important part
    }
  };

  /**
   * Force cleanup all lobby sessions for current user
   * NUCLEAR OPTION: Works even if backend has bugs
   *
   * Strategy:
   * 1. Try force-leave-all endpoint (may fail due to backend bugs)
   * 2. If that fails, try leaving individual lobbies from AsyncStorage
   * 3. If that fails, clear local state anyway (better than being stuck)
   * 4. Always clear AsyncStorage regardless of backend success
   */
  const forceCleanupAllLobbies = async () => {
    if (!user) return;

    console.log('🔥 [LOBBY CONTEXT] NUCLEAR CLEANUP - Force cleanup all lobbies...');

    try {
      // STEP 1: Get all lobby sessions from AsyncStorage FIRST
      // This way we know what lobbies to clean up, even if backend fails
      const allKeys = await AsyncStorage.getAllKeys();
      const specificLobbyKeys = allKeys.filter(key =>
        key.startsWith('activeLobby_group_') && key.endsWith(`_user_${user.id}`)
      );

      console.log(`🔍 [LOBBY CONTEXT] Found ${specificLobbyKeys.length} lobby sessions in storage`);

      // Parse session IDs from storage for individual cleanup
      const sessionIds: string[] = [];
      for (const key of specificLobbyKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.sessionId) {
              sessionIds.push(parsed.sessionId);
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse lobby data:', key);
        }
      }

      console.log(`📋 [LOBBY CONTEXT] Found ${sessionIds.length} session IDs to clean up`);

      // STEP 2: Try force-leave-all endpoint (BEST OPTION)
      // This may fail due to backend bugs, but we try anyway
      let forceLeaveSuccess = false;
      try {
        console.log('🚀 [LOBBY CONTEXT] Attempting force-leave-all endpoint...');
        const response = await socialService.forceLeaveAllLobbies();
        console.log(`✅ [LOBBY CONTEXT] Force-leave-all succeeded:`, {
          lobbies_left: response.data.lobbies_left,
          has_errors: response.data.errors.length > 0
        });
        forceLeaveSuccess = true;

        if (response.data.errors.length > 0) {
          console.warn('⚠️ [LOBBY CONTEXT] Some lobbies had errors:', response.data.errors);
        }
      } catch (backendError: any) {
        console.error('❌ [LOBBY CONTEXT] Force-leave-all FAILED:', backendError.message);
        console.log('🔄 [LOBBY CONTEXT] Will try individual lobby cleanup as fallback...');
      }

      // STEP 3: FALLBACK - If force-leave-all failed, try leaving individual lobbies
      if (!forceLeaveSuccess && sessionIds.length > 0) {
        console.log('🔄 [LOBBY CONTEXT] Force-leave-all failed, trying individual leaves...');

        let individualSuccessCount = 0;
        for (const sessionId of sessionIds) {
          try {
            console.log(`🚪 [LOBBY CONTEXT] Leaving individual lobby: ${sessionId}`);
            await socialService.leaveLobbyV2(sessionId);
            individualSuccessCount++;
            console.log(`✅ [LOBBY CONTEXT] Left lobby ${sessionId}`);
          } catch (leaveError: any) {
            console.error(`❌ [LOBBY CONTEXT] Failed to leave lobby ${sessionId}:`, leaveError.message);
            // Continue trying other lobbies even if one fails
          }
        }

        console.log(`📊 [LOBBY CONTEXT] Individual cleanup result: ${individualSuccessCount}/${sessionIds.length} succeeded`);
      }

      // STEP 4: NUCLEAR CLEANUP - Clear AsyncStorage REGARDLESS of backend success
      // Even if backend still thinks user is in lobby, clear local state
      // This prevents frontend from being stuck forever
      console.log('💣 [LOBBY CONTEXT] NUCLEAR OPTION - Clearing ALL local lobby storage...');

      // Clear specific lobby keys
      for (const key of specificLobbyKeys) {
        try {
          await AsyncStorage.removeItem(key);
          console.log(`🗑️ [LOBBY CONTEXT] Removed: ${key}`);
        } catch (error) {
          console.error(`❌ [LOBBY CONTEXT] Failed to remove ${key}:`, error);
        }
      }

      // Clear ALL lobby-related keys (nuclear option for corrupted data)
      const allLobbyKeys = allKeys.filter(key =>
        key.includes('activeLobby') || key.includes('lobby') || key.includes('Lobby')
      );

      console.log(`🔥 [LOBBY CONTEXT] Removing ${allLobbyKeys.length} total lobby-related keys...`);

      for (const key of allLobbyKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.error(`❌ [LOBBY CONTEXT] Failed to remove key ${key}:`, error);
        }
      }

      // STEP 5: Clear in-memory state
      setActiveLobby(null);

      console.log('✅ [LOBBY CONTEXT] NUCLEAR CLEANUP COMPLETE');
      console.log('📊 [LOBBY CONTEXT] Summary:');
      console.log(`   - Force-leave-all: ${forceLeaveSuccess ? 'SUCCESS' : 'FAILED (using fallback)'}`);
      console.log(`   - Session IDs found: ${sessionIds.length}`);
      console.log(`   - Local storage cleared: ${allLobbyKeys.length} keys`);
      console.log(`   - In-memory state: CLEARED`);

      // Return success indicator for caller
      return {
        success: true,
        forceLeaveWorked: forceLeaveSuccess,
        sessionsCleaned: sessionIds.length,
        storageKeysCleared: allLobbyKeys.length,
      };

    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] NUCLEAR CLEANUP had critical error:', error);

      // LAST RESORT: Clear state anyway
      // Better to have clean state than be stuck forever
      setActiveLobby(null);

      console.log('🆘 [LOBBY CONTEXT] EMERGENCY CLEANUP - Cleared in-memory state as last resort');

      return {
        success: false,
        error: error,
        message: 'Emergency cleanup performed - in-memory state cleared'
      };
    }
  };

  /**
   * Check for active lobby in AsyncStorage and validate with backend
   */
  const checkForActiveLobby = async () => {
    if (!user) return;

    try {
      // Get all lobby keys for this user
      const allKeys = await AsyncStorage.getAllKeys();
      const lobbyKeys = allKeys.filter(key =>
        key.startsWith('activeLobby_group_') && key.endsWith(`_user_${user.id}`)
      );

      console.log('🔍 [LOBBY CONTEXT] Found lobby keys:', lobbyKeys);

      if (lobbyKeys.length === 0) {
        setActiveLobby(null);
        return;
      }

      // Get the first lobby session (users should only have one active lobby)
      const lobbyKey = lobbyKeys[0];
      const storedData = await AsyncStorage.getItem(lobbyKey);

      if (!storedData) {
        setActiveLobby(null);
        return;
      }

      const lobbySession: LobbySession = JSON.parse(storedData);

      console.log('✅ [LOBBY CONTEXT] Found stored lobby session:', {
        sessionId: lobbySession.sessionId,
        groupId: lobbySession.groupId,
        groupName: lobbySession.groupName,
        expiresAt: new Date(lobbySession.expiresAt).toLocaleTimeString(),
        autoCleanupOnReload
      });

      // Check if session has expired
      if (Date.now() > lobbySession.expiresAt) {
        console.log('⏰ [LOBBY CONTEXT] Lobby session expired, clearing...');
        await AsyncStorage.removeItem(lobbyKey);
        setActiveLobby(null);
        return;
      }

      // AUTO-CLEANUP ON RELOAD (for development)
      if (autoCleanupOnReload) {
        console.log('🔄 [LOBBY CONTEXT] Auto-cleanup enabled, leaving lobby on reload...');
        try {
          // leaveLobbyV2 now handles "already left" gracefully
          await socialService.leaveLobbyV2(lobbySession.sessionId);
          console.log('✅ [LOBBY CONTEXT] Left lobby on backend');
        } finally {
          // Always clear local storage
          await AsyncStorage.removeItem(lobbyKey);
          setActiveLobby(null);
          console.log('✅ [LOBBY CONTEXT] Auto-cleanup complete (local storage cleared)');
          return;
        }
      }

      // Validate with backend that lobby still exists
      try {
        const response = await socialService.getLobbyStateV2(lobbySession.sessionId);

        if (response.status === 'success' && response.data) {
          console.log('✅ [LOBBY CONTEXT] Lobby still active on server');
          setActiveLobby(lobbySession);
        } else {
          console.log('⚠️ [LOBBY CONTEXT] Lobby not found on server, clearing...');
          await AsyncStorage.removeItem(lobbyKey);
          setActiveLobby(null);
        }
      } catch (error) {
        console.error('❌ [LOBBY CONTEXT] Failed to validate lobby, clearing...', error);
        await AsyncStorage.removeItem(lobbyKey);
        setActiveLobby(null);
      }
    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] Error checking for active lobby:', error);
      setActiveLobby(null);
    }
  };

  return (
    <LobbyContext.Provider
      value={{
        activeLobby,
        setActiveLobby,
        clearActiveLobby,
        clearActiveLobbyLocal,
        forceCleanupAllLobbies,
        saveLobbySession,
        checkForActiveLobby,
        isInLobby: !!activeLobby,
        autoCleanupOnReload,
        setAutoCleanupOnReload,
      }}
    >
      {children}
    </LobbyContext.Provider>
  );
}

export function useLobby() {
  const context = useContext(LobbyContext);
  if (context === undefined) {
    throw new Error('useLobby must be used within a LobbyProvider');
  }
  return context;
}
