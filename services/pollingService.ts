/**
 * HTTP Polling Fallback Service
 *
 * Provides HTTP polling as a fallback mechanism when WebSocket connections fail.
 * Polls the backend for lobby state updates at configurable intervals.
 */

import { socialService } from './microservices/socialService';

export interface PollingConfig {
  interval: number; // Polling interval in milliseconds
  maxRetries: number; // Maximum number of failed polls before giving up
  backoffMultiplier: number; // Multiplier for exponential backoff
}

export interface PollingSubscription {
  sessionId: string;
  onUpdate: (state: any) => void;
  onError: (error: Error) => void;
}

class PollingService {
  private subscriptions: Map<string, PollingSubscription> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastVersions: Map<string, number> = new Map();
  private failedAttempts: Map<string, number> = new Map();
  private isPolling: Map<string, boolean> = new Map();

  private readonly DEFAULT_CONFIG: PollingConfig = {
    interval: 3000, // Poll every 3 seconds
    maxRetries: 10,
    backoffMultiplier: 1.5,
  };

  /**
   * Start polling for a lobby session
   */
  public startPolling(
    sessionId: string,
    onUpdate: (state: any) => void,
    onError: (error: Error) => void,
    config: Partial<PollingConfig> = {}
  ): void {
    // Don't start if already polling
    if (this.isPolling.get(sessionId)) {
      console.log(`⏩ Already polling for session ${sessionId}`);
      return;
    }

    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    console.log(`🔄 Starting HTTP polling for session ${sessionId}`, {
      interval: finalConfig.interval,
      maxRetries: finalConfig.maxRetries,
    });

    // Store subscription
    this.subscriptions.set(sessionId, { sessionId, onUpdate, onError });
    this.isPolling.set(sessionId, true);
    this.failedAttempts.set(sessionId, 0);

    // Start polling
    this.poll(sessionId, finalConfig);
  }

  /**
   * Stop polling for a lobby session
   */
  public stopPolling(sessionId: string): void {
    console.log(`🛑 Stopping HTTP polling for session ${sessionId}`);

    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
    }

    this.subscriptions.delete(sessionId);
    this.lastVersions.delete(sessionId);
    this.failedAttempts.delete(sessionId);
    this.isPolling.delete(sessionId);
  }

  /**
   * Stop all active polling
   */
  public stopAll(): void {
    console.log('🛑 Stopping all HTTP polling');
    const sessionIds = Array.from(this.subscriptions.keys());
    sessionIds.forEach(sessionId => this.stopPolling(sessionId));
  }

  /**
   * Check if polling is active for a session
   */
  public isActive(sessionId: string): boolean {
    return this.isPolling.get(sessionId) === true;
  }

  /**
   * Get polling statistics
   */
  public getStats(): {
    activePolls: number;
    sessions: { sessionId: string; failedAttempts: number; version: number }[];
  } {
    const sessions = Array.from(this.subscriptions.keys()).map(sessionId => ({
      sessionId,
      failedAttempts: this.failedAttempts.get(sessionId) || 0,
      version: this.lastVersions.get(sessionId) || 0,
    }));

    return {
      activePolls: this.subscriptions.size,
      sessions,
    };
  }

  /**
   * Perform a single poll
   */
  private poll(sessionId: string, config: PollingConfig): void {
    const pollOnce = async () => {
      const subscription = this.subscriptions.get(sessionId);
      if (!subscription) {
        // Subscription was removed, stop polling
        this.stopPolling(sessionId);
        return;
      }

      try {
        // Fetch lobby state from backend
        const response = await socialService.getLobbyStateV2(sessionId);

        if (response.status === 'success' && response.data?.lobby_state) {
          const newState = response.data.lobby_state;
          const newVersion = newState.version;
          const lastVersion = this.lastVersions.get(sessionId) || 0;

          // Only trigger update if version changed (avoid unnecessary updates)
          if (newVersion > lastVersion) {
            console.log(`📊 Lobby state updated via polling`, {
              sessionId,
              oldVersion: lastVersion,
              newVersion,
            });

            this.lastVersions.set(sessionId, newVersion);
            subscription.onUpdate(newState);
          }

          // Reset failed attempts on success
          this.failedAttempts.set(sessionId, 0);
        }
      } catch (error) {
        const failedCount = (this.failedAttempts.get(sessionId) || 0) + 1;
        this.failedAttempts.set(sessionId, failedCount);

        console.error(`❌ Polling failed for session ${sessionId}`, {
          attempt: failedCount,
          maxRetries: config.maxRetries,
          error: error instanceof Error ? error.message : error,
        });

        // Check if max retries reached
        if (failedCount >= config.maxRetries) {
          console.error(`❌ Max polling retries reached for session ${sessionId}`);
          subscription.onError(
            new Error(`Polling failed after ${config.maxRetries} attempts`)
          );
          this.stopPolling(sessionId);
          return;
        }

        // Apply exponential backoff
        const backoffInterval = Math.min(
          config.interval * Math.pow(config.backoffMultiplier, failedCount - 1),
          30000 // Max 30 seconds
        );

        console.log(`⏳ Applying backoff: ${backoffInterval}ms`);

        // Clear existing interval and create new one with backoff
        const existingInterval = this.intervals.get(sessionId);
        if (existingInterval) {
          clearInterval(existingInterval);
        }

        const newInterval = setInterval(() => pollOnce(), backoffInterval);
        this.intervals.set(sessionId, newInterval);
        return; // Exit to prevent setting regular interval below
      }
    };

    // Start immediate poll
    pollOnce();

    // Set up regular interval
    const interval = setInterval(() => pollOnce(), config.interval);
    this.intervals.set(sessionId, interval);
  }
}

// Export singleton instance
export const pollingService = new PollingService();

/**
 * React hook for using polling service
 *
 * Usage:
 * ```tsx
 * const { startPolling, stopPolling, isPolling } = usePolling();
 *
 * useEffect(() => {
 *   if (!isWebSocketConnected) {
 *     startPolling(sessionId, (state) => {
 *       console.log('State updated:', state);
 *     });
 *   }
 *   return () => stopPolling(sessionId);
 * }, [sessionId, isWebSocketConnected]);
 * ```
 */
export function usePolling() {
  return {
    startPolling: (
      sessionId: string,
      onUpdate: (state: any) => void,
      onError: (error: Error) => void = () => {},
      config?: Partial<PollingConfig>
    ) => {
      pollingService.startPolling(sessionId, onUpdate, onError, config);
    },
    stopPolling: (sessionId: string) => {
      pollingService.stopPolling(sessionId);
    },
    stopAll: () => {
      pollingService.stopAll();
    },
    isPolling: (sessionId: string) => {
      return pollingService.isActive(sessionId);
    },
    getStats: () => {
      return pollingService.getStats();
    },
  };
}
