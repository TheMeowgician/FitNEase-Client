import Pusher from 'pusher-js';
import { TokenManager } from './auth/tokenManager';
import { API_CONFIG } from '../config/api.config';

class ReverbService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting: boolean = false;
  private onReconnectCallback: (() => void) | null = null;
  private lastUserId: number | null = null;
  private maxRetriesReached: boolean = false;
  private connectionStateCallbacks: ((state: string) => void)[] = [];

  /**
   * Initialize Reverb connection
   */
  public async connect(userId: number) {
    this.lastUserId = userId; // Store for manual reconnect

    if (this.pusher) {
      console.log('⚠️ Reverb already connected, disconnecting first');
      this.disconnect();
    }

    // Get auth token for authentication
    const tokenManager = new TokenManager();
    const token = await tokenManager.getAccessToken();
    if (!token) {
      console.error('❌ No auth token available for Reverb connection');
      return;
    }

    // Get WebSocket configuration from API_CONFIG
    const socialUrl = API_CONFIG.SOCIAL_SERVICE_URL;
    const wsHost = API_CONFIG.REVERB_WS_HOST;
    const wsPort = API_CONFIG.REVERB_WS_PORT;
    const forceTLS = wsPort === 443; // Use TLS for ngrok (port 443)

    console.log('🔌 Connecting to Reverb:', {
      userId,
      tokenPrefix: token.substring(0, 20) + '...',
      wsHost,
      wsPort,
      forceTLS,
      authEndpoint: `${socialUrl}/api/broadcasting/auth`
    });

    // Initialize Pusher client pointing to Laravel Reverb
    // For testing mode (ngrok), WebSocket goes through gateway /reverb/ path
    const wsPath = wsPort === 443 ? '/reverb' : '';

    this.pusher = new Pusher('auqcet6tsq2wdjpmjp7v', {
      wsHost,
      wsPort,
      wsPath,
      forceTLS,
      enabledTransports: ['ws', 'wss'],
      cluster: 'mt1', // Required by Pusher but ignored by Reverb
      authEndpoint: `${socialUrl}/api/broadcasting/auth`,
      auth: {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      },
    });

    this.pusher.connection.bind('connected', () => {
      console.log('✅ Reverb connected successfully');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.maxRetriesReached = false;

      // Clear any pending reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Notify state change listeners
      this.notifyStateChange('connected');

      // Trigger reconnect callback (used by WebSocketContext to refetch invitations)
      if (this.onReconnectCallback) {
        console.log('🔄 Triggering reconnect callback');
        this.onReconnectCallback();
      }
    });

    this.pusher.connection.bind('error', (err: any) => {
      console.error('❌ Reverb connection error:', err);
    });

    this.pusher.connection.bind('disconnected', () => {
      console.log('🔌 Reverb disconnected');
      this.scheduleReconnect(userId);
    });

    this.pusher.connection.bind('unavailable', () => {
      console.log('⚠️ Reverb unavailable');
      this.scheduleReconnect(userId);
    });

    this.pusher.connection.bind('failed', () => {
      console.error('❌ Reverb connection failed permanently');
      this.scheduleReconnect(userId);
    });

    this.pusher.connection.bind('state_change', (states: any) => {
      console.log('🔄 Reverb state changed:', states.previous, '→', states.current);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(userId: number) {
    if (this.isReconnecting || !this.pusher) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      this.maxRetriesReached = true;
      this.notifyStateChange('max_retries_reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    this.notifyStateChange('reconnecting');

    // Exponential backoff: 2^attempt seconds, max 60 seconds
    const delaySeconds = Math.min(Math.pow(2, this.reconnectAttempts), 60);
    const delayMs = delaySeconds * 1000;

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delaySeconds}s`);

    this.reconnectTimeout = setTimeout(async () => {
      console.log('🔄 Attempting reconnect...');
      this.isReconnecting = false;

      try {
        // Save current channels for resubscription
        const channelsToResubscribe = Array.from(this.channels.keys());

        // Disconnect and reconnect
        this.disconnect();
        await this.connect(userId);

        // Note: Channels will need to be resubscribed by WebSocketContext
        // The onReconnectCallback will handle this
        console.log('✅ Reconnect successful, channels to resubscribe:', channelsToResubscribe);
      } catch (error) {
        console.error('❌ Reconnect failed:', error);
        this.scheduleReconnect(userId);
      }
    }, delayMs);
  }

  /**
   * Set callback to be called after successful reconnection
   * Used by WebSocketContext to resubscribe to channels and refetch pending invitations
   */
  public onReconnect(callback: () => void) {
    this.onReconnectCallback = callback;
  }

  /**
   * Check if Reverb is connected
   */
  public isConnected(): boolean {
    return this.pusher !== null && this.pusher.connection.state === 'connected';
  }

  /**
   * Disconnect from Reverb
   */
  public disconnect() {
    if (this.pusher) {
      this.channels.forEach((channel) => {
        this.pusher?.unsubscribe(channel.name);
      });
      this.channels.clear();
      this.pusher.disconnect();
      this.pusher = null;
      console.log('Reverb disconnected');
    }
  }

  /**
   * Subscribe to a public channel
   */
  public subscribeToChannel(channelName: string, callbacks: {
    onEvent: (eventName: string, data: any) => void;
  }) {
    if (!this.pusher) {
      console.error('Pusher not initialized. Call connect() first.');
      return null;
    }

    const channel = this.pusher.subscribe(channelName);
    this.channels.set(channelName, channel);

    // Bind to all events on this channel
    channel.bind_global((eventName: string, data: any) => {
      console.log(`📨 Event received on ${channelName}:`, eventName, data);
      callbacks.onEvent(eventName, data);
    });

    console.log(`✅ Subscribed to channel: ${channelName}`);
    return channel;
  }

  /**
   * Subscribe to a private channel
   */
  public subscribeToPrivateChannel(channelName: string, callbacks: {
    onEvent: (eventName: string, data: any) => void;
  }) {
    if (!this.pusher) {
      console.error('Pusher not initialized. Call connect() first.');
      return null;
    }

    const channel = this.pusher.subscribe(`private-${channelName}`);
    this.channels.set(`private-${channelName}`, channel);

    // Bind to all events on this channel
    channel.bind_global((eventName: string, data: any) => {
      console.log(`📨 Private event received on ${channelName}:`, eventName, data);
      callbacks.onEvent(eventName, data);
    });

    console.log(`✅ Subscribed to private channel: private-${channelName}`);
    return channel;
  }

  /**
   * Subscribe to a presence channel (tracks online users)
   */
  public subscribeToPresenceChannel(
    channelName: string,
    callbacks: {
      onEvent: (eventName: string, data: any) => void;
      onMemberAdded?: (member: any) => void;
      onMemberRemoved?: (member: any) => void;
    }
  ) {
    if (!this.pusher) {
      console.error('Pusher not initialized. Call connect() first.');
      return null;
    }

    const channel = this.pusher.subscribe(`presence-${channelName}`);
    this.channels.set(`presence-${channelName}`, channel);

    // Bind to all events on this channel
    channel.bind_global((eventName: string, data: any) => {
      console.log(`📨 Presence event received on ${channelName}:`, eventName, data);
      callbacks.onEvent(eventName, data);
    });

    // Track members joining/leaving
    if (callbacks.onMemberAdded) {
      channel.bind('pusher:member_added', (member: any) => {
        console.log(`👤 Member joined ${channelName}:`, member);
        callbacks.onMemberAdded?.(member);
      });
    }

    if (callbacks.onMemberRemoved) {
      channel.bind('pusher:member_removed', (member: any) => {
        console.log(`👋 Member left ${channelName}:`, member);
        callbacks.onMemberRemoved?.(member);
      });
    }

    console.log(`✅ Subscribed to presence channel: presence-${channelName}`);
    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe(channelName: string) {
    if (this.pusher && this.channels.has(channelName)) {
      this.pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
      console.log(`🔕 Unsubscribed from channel: ${channelName}`);
    }
  }

  /**
   * Subscribe to group workout invitations
   */
  public subscribeToGroupWorkoutInvitations(
    groupId: number,
    onInvitation: (data: {
      group_id: number;
      initiator_id: number;
      initiator_name: string;
      workout_data: any;
      session_id: string;
    }) => void
  ) {
    return this.subscribeToPrivateChannel(`group.${groupId}`, {
      onEvent: (eventName, data) => {
        if (eventName === 'GroupWorkoutInvitation') {
          onInvitation(data);
        }
      },
    });
  }

  /**
   * Subscribe to group presence (track online members)
   */
  public subscribeToGroupPresence(
    groupId: number,
    callbacks: {
      onMemberOnline: (member: any) => void;
      onMemberOffline: (member: any) => void;
      onInitialMembers?: (members: any[]) => void;
    }
  ) {
    const channel = this.subscribeToPresenceChannel(`group.${groupId}`, {
      onEvent: () => {},
      onMemberAdded: callbacks.onMemberOnline,
      onMemberRemoved: callbacks.onMemberOffline,
    });

    // Get initial list of online members
    if (channel && callbacks.onInitialMembers) {
      channel.bind('pusher:subscription_succeeded', (members: any) => {
        // Presence channel members object has user IDs as keys
        // Example: { "2023": true, "2024": true }
        const memberIds = Object.keys(members.members || {});
        console.log(`👥 Initial members in group ${groupId}:`, memberIds);

        // Convert to array of member objects with id property
        const membersList = memberIds.map(id => ({ id }));
        callbacks.onInitialMembers?.(membersList);
      });
    }

    return channel;
  }

  /**
   * Manual reconnect - can be called after max retries reached
   */
  public async manualReconnect(): Promise<boolean> {
    console.log('🔄 Manual reconnect triggered');

    if (!this.lastUserId) {
      console.error('❌ No user ID available for manual reconnect');
      return false;
    }

    // Reset retry counters
    this.reconnectAttempts = 0;
    this.maxRetriesReached = false;
    this.isReconnecting = false;

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      await this.connect(this.lastUserId);
      return true;
    } catch (error) {
      console.error('❌ Manual reconnect failed:', error);
      return false;
    }
  }

  /**
   * Check if max retries have been reached
   */
  public hasMaxRetriesReached(): boolean {
    return this.maxRetriesReached;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): string {
    if (!this.pusher) return 'disconnected';
    return this.pusher.connection.state;
  }

  /**
   * Subscribe to connection state changes
   */
  public onConnectionStateChange(callback: (state: string) => void): () => void {
    this.connectionStateCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.connectionStateCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionStateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(state: string) {
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('❌ Error in connection state callback:', error);
      }
    });
  }

  /**
   * Get reconnect attempts count
   */
  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get max reconnect attempts
   */
  public getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  /**
   * Subscribe to lobby channel for real-time lobby events
   */
  public subscribeToLobby(
    sessionId: string,
    callbacks: {
      onLobbyStateChanged?: (data: any) => void;
      onMemberJoined?: (data: any) => void;
      onMemberLeft?: (data: any) => void;
      onMemberStatusUpdated?: (data: any) => void;
      onLobbyMessageSent?: (data: any) => void;
      onWorkoutStarted?: (data: any) => void;
      onLobbyDeleted?: (data: any) => void;
      onMemberKicked?: (data: any) => void;
      onInitiatorRoleTransferred?: (data: any) => void;
    }
  ) {
    const channelName = `private-lobby.${sessionId}`;

    return this.subscribeToPrivateChannel(`lobby.${sessionId}`, {
      onEvent: (eventName, data) => {
        switch (eventName) {
          case 'LobbyStateChanged':
            callbacks.onLobbyStateChanged?.(data);
            break;
          case 'MemberJoined':
            callbacks.onMemberJoined?.(data);
            break;
          case 'MemberLeft':
            callbacks.onMemberLeft?.(data);
            break;
          case 'MemberStatusUpdated':
            callbacks.onMemberStatusUpdated?.(data);
            break;
          case 'LobbyMessageSent':
            callbacks.onLobbyMessageSent?.(data);
            break;
          case 'WorkoutStarted':
            callbacks.onWorkoutStarted?.(data);
            break;
          case 'LobbyDeleted':
            callbacks.onLobbyDeleted?.(data);
            break;
          case 'MemberKicked':
            callbacks.onMemberKicked?.(data);
            break;
          case 'initiator.transferred':
            callbacks.onInitiatorRoleTransferred?.(data);
            break;
        }
      },
    });
  }

  /**
   * Subscribe to presence channel (for online/offline status)
   */
  public subscribeToPresence(
    channelName: string,
    callbacks: {
      onHere?: (members: any[]) => void;
      onJoining?: (member: any) => void;
      onLeaving?: (member: any) => void;
    }
  ) {
    const channel = this.subscribeToPresenceChannel(channelName, {
      onEvent: () => {},
      onMemberAdded: callbacks.onJoining,
      onMemberRemoved: callbacks.onLeaving,
    });

    // Get initial members
    if (channel && callbacks.onHere) {
      channel.bind('pusher:subscription_succeeded', (members: any) => {
        const membersList = Object.keys(members.members || {}).map(id => ({
          user_id: parseInt(id)
        }));
        callbacks.onHere?.(membersList);
      });
    }

    return channel;
  }
}

export const reverbService = new ReverbService();
export default reverbService;
