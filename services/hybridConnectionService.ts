/**
 * Hybrid Connection Service
 *
 * Automatically switches between WebSocket and HTTP polling based on connection state.
 * Provides seamless fallback when WebSocket fails.
 */

import reverbService from './reverbService';
import { pollingService } from './pollingService';

export type ConnectionMode = 'websocket' | 'polling' | 'disconnected';

export interface HybridConnectionConfig {
  enableAutoFallback: boolean; // Automatically switch to polling when WebSocket fails
  pollingInterval: number; // Polling interval in milliseconds
  maxReconnectAttempts: number; // Max WebSocket reconnect attempts before falling back
}

interface ConnectionSubscription {
  sessionId: string;
  onStateChange: (state: any) => void;
  onModeChange?: (mode: ConnectionMode) => void;
  onError?: (error: Error) => void;
}

class HybridConnectionService {
  private subscriptions: Map<string, ConnectionSubscription> = new Map();
  private currentModes: Map<string, ConnectionMode> = new Map();
  private wsConnectionState: string = 'disconnected';
  private wsStateUnsubscribe: (() => void) | null = null;

  private readonly DEFAULT_CONFIG: HybridConnectionConfig = {
    enableAutoFallback: true,
    pollingInterval: 3000,
    maxReconnectAttempts: 10,
  };

  private config: HybridConnectionConfig = this.DEFAULT_CONFIG;

  constructor() {
    // Listen to WebSocket connection state changes
    this.wsStateUnsubscribe = reverbService.onConnectionStateChange((state) => {
      this.wsConnectionState = state;
      console.log(`🔌 WebSocket state changed: ${state}`);
      this.handleConnectionStateChange(state);
    });
  }

  /**
   * Configure the hybrid connection service
   */
  public configure(config: Partial<HybridConnectionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚙️ Hybrid connection service configured', this.config);
  }

  /**
   * Subscribe to lobby updates with automatic fallback
   */
  public subscribe(
    sessionId: string,
    onStateChange: (state: any) => void,
    onModeChange?: (mode: ConnectionMode) => void,
    onError?: (error: Error) => void
  ): () => void {
    console.log(`🔗 Subscribing to lobby ${sessionId} with hybrid connection`);

    // Store subscription
    this.subscriptions.set(sessionId, {
      sessionId,
      onStateChange,
      onModeChange,
      onError,
    });

    // Determine initial connection mode
    const initialMode = this.determineConnectionMode();
    this.currentModes.set(sessionId, initialMode);

    // Start appropriate connection
    if (initialMode === 'websocket') {
      this.startWebSocket(sessionId);
    } else if (initialMode === 'polling') {
      this.startPolling(sessionId);
    }

    // Notify mode change
    if (onModeChange) {
      onModeChange(initialMode);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(sessionId);
  }

  /**
   * Unsubscribe from lobby updates
   */
  public unsubscribe(sessionId: string): void {
    console.log(`🔌 Unsubscribing from lobby ${sessionId}`);

    // Stop polling if active
    if (pollingService.isActive(sessionId)) {
      pollingService.stopPolling(sessionId);
    }

    // Remove subscription
    this.subscriptions.delete(sessionId);
    this.currentModes.delete(sessionId);
  }

  /**
   * Get current connection mode for a session
   */
  public getMode(sessionId: string): ConnectionMode {
    return this.currentModes.get(sessionId) || 'disconnected';
  }

  /**
   * Force switch to polling mode
   */
  public forcePolling(sessionId: string): void {
    console.log(`🔄 Forcing polling mode for session ${sessionId}`);
    this.switchToPolling(sessionId);
  }

  /**
   * Attempt to reconnect via WebSocket
   */
  public async reconnectWebSocket(sessionId: string): Promise<boolean> {
    console.log(`🔄 Attempting to reconnect WebSocket for session ${sessionId}`);

    try {
      const success = await reverbService.manualReconnect();
      if (success) {
        // Switch back to WebSocket
        this.switchToWebSocket(sessionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to reconnect WebSocket:', error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    wsState: string;
    activeSubscriptions: number;
    modes: Record<ConnectionMode, number>;
    pollingStats: any;
  } {
    const modes: Record<ConnectionMode, number> = {
      websocket: 0,
      polling: 0,
      disconnected: 0,
    };

    this.currentModes.forEach(mode => {
      modes[mode]++;
    });

    return {
      wsState: this.wsConnectionState,
      activeSubscriptions: this.subscriptions.size,
      modes,
      pollingStats: pollingService.getStats(),
    };
  }

  /**
   * Cleanup service (call on app unmount)
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up hybrid connection service');

    // Stop all polling
    pollingService.stopAll();

    // Clear subscriptions
    this.subscriptions.clear();
    this.currentModes.clear();

    // Unsubscribe from WebSocket state changes
    if (this.wsStateUnsubscribe) {
      this.wsStateUnsubscribe();
      this.wsStateUnsubscribe = null;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private determineConnectionMode(): ConnectionMode {
    const wsState = reverbService.getConnectionState();
    const maxRetriesReached = reverbService.hasMaxRetriesReached();

    if (wsState === 'connected') {
      return 'websocket';
    } else if (maxRetriesReached && this.config.enableAutoFallback) {
      return 'polling';
    } else {
      return 'disconnected';
    }
  }

  private handleConnectionStateChange(state: string): void {
    if (!this.config.enableAutoFallback) {
      return;
    }

    const maxRetriesReached = reverbService.hasMaxRetriesReached();

    // If WebSocket connected, switch all to WebSocket
    if (state === 'connected') {
      console.log('✅ WebSocket connected, switching all sessions to WebSocket');
      this.subscriptions.forEach((_, sessionId) => {
        this.switchToWebSocket(sessionId);
      });
    }

    // If max retries reached, switch all to polling
    else if (maxRetriesReached || state === 'max_retries_reached') {
      console.log('🔄 Max retries reached, switching all sessions to polling');
      this.subscriptions.forEach((_, sessionId) => {
        this.switchToPolling(sessionId);
      });
    }
  }

  private startWebSocket(sessionId: string): void {
    console.log(`🔌 Starting WebSocket for session ${sessionId}`);

    // Subscribe to lobby channel
    reverbService.subscribeToPrivateChannel(`lobby.${sessionId}`, {
      onEvent: (eventName, data) => {
        const subscription = this.subscriptions.get(sessionId);
        if (subscription) {
          // Pass event to subscriber
          subscription.onStateChange({ eventName, data });
        }
      },
    });
  }

  private startPolling(sessionId: string): void {
    console.log(`📊 Starting HTTP polling for session ${sessionId}`);

    const subscription = this.subscriptions.get(sessionId);
    if (!subscription) {
      return;
    }

    pollingService.startPolling(
      sessionId,
      (state) => {
        subscription.onStateChange(state);
      },
      (error) => {
        if (subscription.onError) {
          subscription.onError(error);
        }
      },
      {
        interval: this.config.pollingInterval,
        maxRetries: this.config.maxReconnectAttempts,
      }
    );
  }

  private switchToWebSocket(sessionId: string): void {
    const currentMode = this.currentModes.get(sessionId);
    if (currentMode === 'websocket') {
      return; // Already in WebSocket mode
    }

    console.log(`🔄 Switching session ${sessionId} to WebSocket`);

    // Stop polling
    if (pollingService.isActive(sessionId)) {
      pollingService.stopPolling(sessionId);
    }

    // Start WebSocket
    this.startWebSocket(sessionId);

    // Update mode
    this.currentModes.set(sessionId, 'websocket');

    // Notify mode change
    const subscription = this.subscriptions.get(sessionId);
    if (subscription?.onModeChange) {
      subscription.onModeChange('websocket');
    }
  }

  private switchToPolling(sessionId: string): void {
    const currentMode = this.currentModes.get(sessionId);
    if (currentMode === 'polling') {
      return; // Already in polling mode
    }

    console.log(`🔄 Switching session ${sessionId} to polling`);

    // Unsubscribe from WebSocket (if subscribed)
    reverbService.unsubscribe(`lobby.${sessionId}`);

    // Start polling
    this.startPolling(sessionId);

    // Update mode
    this.currentModes.set(sessionId, 'polling');

    // Notify mode change
    const subscription = this.subscriptions.get(sessionId);
    if (subscription?.onModeChange) {
      subscription.onModeChange('polling');
    }
  }
}

// Export singleton instance
export const hybridConnectionService = new HybridConnectionService();
