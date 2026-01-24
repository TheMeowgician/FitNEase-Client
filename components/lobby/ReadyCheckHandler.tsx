import { useEffect, useRef } from 'react';
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

  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    // Only subscribe if user is in an active lobby
    if (!isInLobby || !activeLobby || !user) {
      // Cleanup if we were subscribed
      if (isSubscribedRef.current && channelRef.current) {
        console.log('🔕 [READY CHECK HANDLER] Unsubscribing from ready check channel');
        reverbService.unsubscribe(`private-lobby.${channelRef.current}`);
        channelRef.current = null;
        isSubscribedRef.current = false;
        clearReadyCheck();
      }
      return;
    }

    const sessionId = activeLobby.sessionId;

    // Don't re-subscribe if already subscribed to the same session
    if (isSubscribedRef.current && channelRef.current === sessionId) {
      return;
    }

    // Unsubscribe from old channel if different session
    if (isSubscribedRef.current && channelRef.current !== sessionId) {
      console.log('🔕 [READY CHECK HANDLER] Switching lobby session, unsubscribing from old');
      reverbService.unsubscribe(`private-lobby.${channelRef.current}`);
      clearReadyCheck();
    }

    console.log('🔔 [READY CHECK HANDLER] Subscribing to ready check events for session:', sessionId);

    // Subscribe to lobby channel for ready check events only
    // Note: We use the same channel as the lobby but only listen for ready check events
    // The main lobby screen also subscribes to this channel for other events
    channelRef.current = sessionId;
    isSubscribedRef.current = true;

    // Subscribe using a separate listener for ready check events
    const channel = reverbService.subscribeToLobby(sessionId, {
      onReadyCheckStarted: (data: any) => {
        console.log('🔔 [READY CHECK HANDLER] Ready check started:', data);

        // Get members from data or from store
        const members = data.members || lobbyMembers.map((m) => ({
          user_id: m.user_id,
          user_name: m.user_name,
        }));

        startReadyCheck({
          sessionId: data.session_id || sessionId,
          groupId: activeLobby.groupId,
          groupName: activeLobby.groupName || `Group ${activeLobby.groupId}`,
          initiatorId: data.initiator_id,
          initiatorName: data.initiator_name || 'Host',
          members,
          timeoutSeconds: data.timeout_seconds || 25,
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

    return () => {
      // Don't unsubscribe on component unmount - let the effect cleanup handle it
      // This prevents issues with React's strict mode double-mounting
    };
  }, [isInLobby, activeLobby?.sessionId, user?.id]);

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
