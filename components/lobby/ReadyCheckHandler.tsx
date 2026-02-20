import { useEffect, useRef, useCallback } from 'react';
import { useLobby } from '../../contexts/LobbyContext';
import { useAuth } from '../../contexts/AuthContext';
import { reverbService } from '../../services/reverbService';
import { useReadyCheckStore } from '../../stores/readyCheckStore';
import { useLobbyStore, selectLobbyMembers } from '../../stores/lobbyStore';

/**
 * Global Ready Check Handler
 *
 * This component manages WebSocket subscriptions for ready check events
 * at the app level. It ensures ready check modals appear regardless of
 * which screen the user is on.
 *
 * This component doesn't render anything - it just manages subscriptions.
 */
export function ReadyCheckHandler() {
  const { activeLobby, isInLobby } = useLobby();
  const { user } = useAuth();
  const lobbyMembers = useLobbyStore(selectLobbyMembers);

  const startReadyCheck = useReadyCheckStore((state) => state.startReadyCheck);
  const updateResponse = useReadyCheckStore((state) => state.updateResponse);
  const setResult = useReadyCheckStore((state) => state.setResult);
  const clearReadyCheck = useReadyCheckStore((state) => state.clearReadyCheck);

  const channelRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);
  const activeLobbyRef = useRef(activeLobby);
  const lobbyMembersRef = useRef(lobbyMembers);

  // Keep refs updated for use in callbacks
  useEffect(() => {
    activeLobbyRef.current = activeLobby;
  }, [activeLobby]);

  useEffect(() => {
    lobbyMembersRef.current = lobbyMembers;
  }, [lobbyMembers]);

  // Subscription function that can be called to ensure subscription is active
  const ensureSubscription = useCallback((sessionId: string) => {
    const channelName = `private-lobby.${sessionId}`;

    // Check if channel is actually subscribed in reverbService
    const isActuallySubscribed = reverbService.isChannelSubscribed(channelName);

    console.log('🔍 [READY CHECK HANDLER] Checking subscription:', {
      sessionId,
      channelName,
      isSubscribedRef: isSubscribedRef.current,
      channelRef: channelRef.current,
      isActuallySubscribed,
    });

    // If we think we're subscribed but the channel isn't actually subscribed, reset our state
    if (isSubscribedRef.current && !isActuallySubscribed) {
      console.log('⚠️ [READY CHECK HANDLER] Subscription was lost, re-subscribing...');
      isSubscribedRef.current = false;
    }

    // Don't re-subscribe if already subscribed to the same session AND channel is actually subscribed
    if (isSubscribedRef.current && channelRef.current === sessionId && isActuallySubscribed) {
      console.log('✅ [READY CHECK HANDLER] Already subscribed to session:', sessionId);
      return;
    }

    // CRITICAL: If the channel is already subscribed by group-lobby.tsx, do NOT
    // re-subscribe. subscribeToPrivateChannel calls unbind_global() which would
    // KILL group-lobby's event handlers (LobbyStateChanged, MemberJoined, etc.),
    // leaving only ready-check handlers. group-lobby already handles ALL events
    // including ready checks, so we just piggyback on its subscription.
    if (!isSubscribedRef.current && isActuallySubscribed) {
      console.log('✅ [READY CHECK HANDLER] Channel already managed by group-lobby, piggybacking');
      channelRef.current = sessionId;
      isSubscribedRef.current = true;
      return;
    }

    // Unsubscribe from old channel if different session
    if (channelRef.current && channelRef.current !== sessionId) {
      console.log('🔕 [READY CHECK HANDLER] Switching lobby session, unsubscribing from old:', channelRef.current);
      reverbService.unsubscribe(`private-lobby.${channelRef.current}`);
      clearReadyCheck();
    }

    console.log('🔔 [READY CHECK HANDLER] Subscribing to ready check events for session:', sessionId);

    // Update refs
    channelRef.current = sessionId;
    isSubscribedRef.current = true;

    // Subscribe using a separate listener for ready check events
    // Only reaches here when NO other component has subscribed to this channel
    // (e.g., user is on home screen, not on the lobby screen)
    reverbService.subscribeToLobby(sessionId, {
      onReadyCheckStarted: (data: any) => {
        console.log('🔔 [READY CHECK HANDLER] Ready check started:', data);

        // Get members from data or from ref (use ref for current value)
        const currentMembers = lobbyMembersRef.current;
        const members = data.members || currentMembers.map((m) => ({
          user_id: m.user_id,
          user_name: m.user_name,
        }));

        const currentLobby = activeLobbyRef.current;
        startReadyCheck({
          sessionId: data.session_id || sessionId,
          groupId: currentLobby?.groupId || '',
          groupName: currentLobby?.groupName || `Group ${currentLobby?.groupId}`,
          initiatorId: data.initiator_id,
          initiatorName: data.initiator_name || 'Host',
          members,
          timeoutSeconds: data.timeout_seconds || 25,
          serverExpiresAt: data.expires_at,
        });
      },

      onReadyCheckResponse: (data: any) => {
        console.log('🔔 [READY CHECK HANDLER] Ready check response:', data);
        updateResponse(data.user_id, data.response);
      },

      onReadyCheckComplete: (data: any) => {
        console.log('🔔 [READY CHECK HANDLER] Ready check complete:', data);
        setResult(data.success ? 'success' : 'failed');
      },

      onReadyCheckCancelled: (data: any) => {
        console.log('🔔 [READY CHECK HANDLER] Ready check cancelled:', data);
        clearReadyCheck();
      },
    });

    console.log('✅ [READY CHECK HANDLER] Subscription complete for session:', sessionId);
  }, [startReadyCheck, updateResponse, setResult, clearReadyCheck]);

  useEffect(() => {
    // Only subscribe if user is in an active lobby
    if (!isInLobby || !activeLobby || !user) {
      console.log('🔍 [READY CHECK HANDLER] Not subscribing:', {
        isInLobby,
        hasActiveLobby: !!activeLobby,
        hasUser: !!user,
      });

      // Cleanup if we were subscribed
      if (isSubscribedRef.current && channelRef.current) {
        console.log('🔕 [READY CHECK HANDLER] Unsubscribing from ready check channel:', channelRef.current);
        reverbService.unsubscribe(`private-lobby.${channelRef.current}`);
        channelRef.current = null;
        isSubscribedRef.current = false;
        clearReadyCheck();
      }
      return;
    }

    const sessionId = activeLobby.sessionId;
    ensureSubscription(sessionId);

    return () => {
      // Don't unsubscribe on effect cleanup - let the explicit cleanup handle it
      // This prevents issues with React's strict mode double-mounting
    };
  }, [isInLobby, activeLobby?.sessionId, user?.id, ensureSubscription, clearReadyCheck]);

  // Periodic check to ensure subscription is still active (every 10 seconds when in lobby)
  useEffect(() => {
    if (!isInLobby || !activeLobby) {
      return;
    }

    const intervalId = setInterval(() => {
      if (activeLobby?.sessionId && isSubscribedRef.current) {
        const channelName = `private-lobby.${activeLobby.sessionId}`;
        const isActuallySubscribed = reverbService.isChannelSubscribed(channelName);

        if (!isActuallySubscribed) {
          console.log('⚠️ [READY CHECK HANDLER] Subscription lost during interval check, re-subscribing...');
          ensureSubscription(activeLobby.sessionId);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [isInLobby, activeLobby?.sessionId, ensureSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribedRef.current && channelRef.current) {
        console.log('🔕 [READY CHECK HANDLER] Component unmounting, cleaning up');
        // Note: We don't unsubscribe here because the lobby screen manages the channel
        isSubscribedRef.current = false;
        channelRef.current = null;
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}

export default ReadyCheckHandler;
