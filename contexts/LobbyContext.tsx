import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socialService } from '../services/microservices/socialService';
import { useAuth } from './AuthContext';
import { useLobbyStore } from '../stores/lobbyStore';

interface LobbySession {
  sessionId: string;
  groupId: string;
  groupName: string;
  userId: number;
  joinedAt: number;
  expiresAt: number;
}

interface ActiveSessionData {
  sessionData: string;
  initiatorId: string;
  groupId: string;
  sessionId: string;
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
  activeSessionData: ActiveSessionData | null;
  clearActiveSession: () => void;
  autoCleanupOnReload: boolean;
  setAutoCleanupOnReload: (value: boolean) => void;
}

const LobbyContext = createContext<LobbyContextType | undefined>(undefined);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeLobby, setActiveLobby] = useState<LobbySession | null>(null);
  const [activeSessionData, setActiveSessionData] = useState<ActiveSessionData | null>(null);
  const [autoCleanupOnReload, setAutoCleanupOnReload] = useState(false); // Default to false - only enable for development hot-reload scenarios

  const clearActiveSession = () => {
    setActiveSessionData(null);
  };

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

    } catch (error) {
      console.error('❌ [LOBBY CONTEXT] NUCLEAR CLEANUP had critical error:', error);

      // LAST RESORT: Clear state anyway
      // Better to have clean state than be stuck forever
      setActiveLobby(null);

      console.log('🆘 [LOBBY CONTEXT] EMERGENCY CLEANUP - Cleared in-memory state as last resort');
    }
  };

  /**
   * Helper: Clean up all stale lobby keys and related session data from AsyncStorage
   */
  const cleanupStaleLobbyKeys = async (keys: string[], userId: string) => {
    for (const key of keys) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.error('[LOBBY CONTEXT] Failed to remove key:', key, e);
      }
    }
    // Also clear active session data
    try {
      const activeSessionKey = `activeSession_user_${userId}`;
      await AsyncStorage.removeItem(activeSessionKey);
    } catch (e) {
      console.error('[LOBBY CONTEXT] Failed to clear session key:', e);
    }
    console.log(`[LOBBY CONTEXT] Cleaned up ${keys.length} stale lobby key(s)`);
  };

  /**
   * Check for active lobby in AsyncStorage and validate with backend
   *
   * Validates BOTH that the lobby exists AND that the current user is still a member.
   * This prevents stale indicators from appearing after the user has left a lobby
   * but AsyncStorage wasn't properly cleaned up (e.g., app crash, hot reload, etc.)
   */
  const checkForActiveLobby = async () => {
    if (!user) return;

    try {
      // Get all lobby keys for this user
      const allKeys = await AsyncStorage.getAllKeys();
      const lobbyKeys = allKeys.filter(key =>
        key.startsWith('activeLobby_group_') && key.endsWith(`_user_${user.id}`)
      );

      console.log('[LOBBY CONTEXT] Found lobby keys:', lobbyKeys);

      if (lobbyKeys.length === 0) {
        setActiveLobby(null);
        return;
      }

      // If user somehow has multiple lobby keys, we'll validate the most recent one
      // and clean up all others
      const keysToClean: string[] = [];

      // Parse all stored sessions and sort by joinedAt (most recent first)
      const storedSessions: { key: string; session: LobbySession }[] = [];
      for (const key of lobbyKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            storedSessions.push({ key, session: JSON.parse(data) });
          } else {
            keysToClean.push(key);
          }
        } catch (e) {
          keysToClean.push(key);
        }
      }
      storedSessions.sort((a, b) => (b.session.joinedAt || 0) - (a.session.joinedAt || 0));

      // Take the most recent session for validation
      const candidate = storedSessions[0];
      // Mark all others for cleanup
      for (let i = 1; i < storedSessions.length; i++) {
        keysToClean.push(storedSessions[i].key);
      }

      if (!candidate) {
        await cleanupStaleLobbyKeys(keysToClean, user.id);
        setActiveLobby(null);
        return;
      }

      const lobbyKey = candidate.key;
      const lobbySession = candidate.session;

      console.log('[LOBBY CONTEXT] Validating stored lobby session:', {
        sessionId: lobbySession.sessionId,
        groupId: lobbySession.groupId,
        groupName: lobbySession.groupName,
        expiresAt: new Date(lobbySession.expiresAt).toLocaleTimeString(),
        autoCleanupOnReload
      });

      // Check if session has expired (client-side)
      if (Date.now() > lobbySession.expiresAt) {
        console.log('[LOBBY CONTEXT] Lobby session expired (client-side), clearing...');
        keysToClean.push(lobbyKey);
        await cleanupStaleLobbyKeys(keysToClean, user.id);
        setActiveLobby(null);
        return;
      }

      // AUTO-CLEANUP ON RELOAD (for development)
      if (autoCleanupOnReload) {
        console.log('[LOBBY CONTEXT] Auto-cleanup enabled, leaving lobby on reload...');
        try {
          await socialService.leaveLobbyV2(lobbySession.sessionId);
          console.log('[LOBBY CONTEXT] Left lobby on backend');
        } finally {
          keysToClean.push(lobbyKey);
          await cleanupStaleLobbyKeys(keysToClean, user.id);
          setActiveLobby(null);
          console.log('[LOBBY CONTEXT] Auto-cleanup complete');
          return;
        }
      }

      // Clean up any extra keys before validation
      if (keysToClean.length > 0) {
        await cleanupStaleLobbyKeys(keysToClean, user.id);
      }

      // Validate with backend: lobby exists AND user is still a member
      try {
        const response = await socialService.getLobbyStateV2(lobbySession.sessionId);

        if (response.status === 'success' && response.data) {
          const lobbyState = response.data.lobby_state;
          console.log('[LOBBY CONTEXT] Lobby found on server:', {
            status: lobbyState?.status,
            memberCount: lobbyState?.members?.length || 0,
          });

          // CHECK 1: Is lobby completed or expired on server?
          if (lobbyState?.status === 'completed' || lobbyState?.is_expired) {
            console.log('[LOBBY CONTEXT] Lobby is completed/expired on server, clearing stale session...');
            await AsyncStorage.removeItem(lobbyKey);
            setActiveLobby(null);
            setActiveSessionData(null);
            return;
          }

          // CHECK 2: Is the current user still a member of this lobby?
          const currentUserId = parseInt(user.id);
          const members: any[] = lobbyState?.members || [];
          const isUserMember = members.some((m: any) => m.user_id === currentUserId);

          if (!isUserMember) {
            console.log('[LOBBY CONTEXT] User is NOT a member of this lobby, clearing stale session...', {
              userId: currentUserId,
              memberIds: members.map((m: any) => m.user_id),
            });
            await AsyncStorage.removeItem(lobbyKey);
            setActiveLobby(null);
            setActiveSessionData(null);
            return;
          }

          // CHECK 3: Lobby has 0 members (zombie lobby)
          if (members.length === 0) {
            console.log('[LOBBY CONTEXT] Lobby has 0 members (zombie), clearing...');
            await AsyncStorage.removeItem(lobbyKey);
            setActiveLobby(null);
            setActiveSessionData(null);
            return;
          }

          // All checks passed — user is confirmed as an active member
          console.log('[LOBBY CONTEXT] User confirmed as active member, restoring lobby');
          setActiveLobby(lobbySession);

          // Populate Zustand store with backend data so GlobalLobbyIndicator has accurate info
          try {
            useLobbyStore.getState().setLobbyState(lobbyState);
            console.log('[LOBBY CONTEXT] Zustand store populated with backend lobby data');
          } catch (e) {
            console.error('[LOBBY CONTEXT] Failed to populate Zustand store:', e);
          }

          // Check if a workout session is in progress (user may need to reconnect)
          if (lobbyState?.status === 'in_progress') {
            console.log('[LOBBY CONTEXT] Workout is in progress! Checking for reconnect data...');

            // First try: check AsyncStorage for saved session data (most reliable)
            const activeSessionKey = `activeSession_user_${user.id}`;
            const storedSession = await AsyncStorage.getItem(activeSessionKey);

            if (storedSession) {
              const sessionInfo = JSON.parse(storedSession);
              console.log('[LOBBY CONTEXT] Found stored session data for reconnect:', {
                sessionId: sessionInfo.sessionId,
                groupId: sessionInfo.groupId,
              });
              setActiveSessionData({
                sessionData: sessionInfo.sessionData,
                initiatorId: sessionInfo.initiatorId,
                groupId: sessionInfo.groupId,
                sessionId: sessionInfo.sessionId,
              });
            } else if (lobbyState.workout_data) {
              // Fallback: reconstruct session data from backend lobby state
              console.log('[LOBBY CONTEXT] No stored session, reconstructing from backend workout_data');
              setActiveSessionData({
                sessionData: JSON.stringify(lobbyState.workout_data),
                initiatorId: String(lobbyState.initiator_id),
                groupId: String(lobbyState.group_id),
                sessionId: lobbyState.session_id,
              });
            } else {
              console.log('[LOBBY CONTEXT] Workout in progress but no session data available');
            }
          } else {
            // Lobby is waiting/not in progress — clear any stale session data
            setActiveSessionData(null);
            const activeSessionKey = `activeSession_user_${user.id}`;
            await AsyncStorage.removeItem(activeSessionKey);
          }
        } else {
          console.log('[LOBBY CONTEXT] Lobby not found on server, clearing stale session...');
          await AsyncStorage.removeItem(lobbyKey);
          setActiveLobby(null);
          setActiveSessionData(null);
        }
      } catch (error) {
        console.error('[LOBBY CONTEXT] Failed to validate lobby with backend, clearing...', error);
        await AsyncStorage.removeItem(lobbyKey);
        setActiveLobby(null);
        setActiveSessionData(null);
      }
    } catch (error) {
      console.error('[LOBBY CONTEXT] Error checking for active lobby:', error);
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
        activeSessionData,
        clearActiveSession,
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
