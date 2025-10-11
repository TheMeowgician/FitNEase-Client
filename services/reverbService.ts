import Pusher from 'pusher-js';
import { TokenManager } from './auth/tokenManager';
import { API_CONFIG } from '../config/api.config';

class ReverbService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();

  /**
   * Initialize Reverb connection
   */
  public async connect(userId: number) {
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
    });

    this.pusher.connection.bind('error', (err: any) => {
      console.error('❌ Reverb connection error:', err);
    });

    this.pusher.connection.bind('disconnected', () => {
      console.log('🔌 Reverb disconnected');
    });

    this.pusher.connection.bind('state_change', (states: any) => {
      console.log('🔄 Reverb state changed:', states.previous, '→', states.current);
    });
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
}

export const reverbService = new ReverbService();
export default reverbService;
