/**
 * Event Deduplication Utility
 *
 * Tracks processed event IDs to prevent duplicate event processing.
 * Uses an in-memory cache with automatic expiry to prevent memory leaks.
 */

interface EventCacheEntry {
  timestamp: number;
  eventType: string;
}

class EventDeduplicationManager {
  private processedEvents: Map<string, EventCacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start automatic cleanup every minute
    this.startCleanup();
  }

  /**
   * Check if an event has already been processed
   * @param eventId Unique event identifier
   * @param eventType Type of event (e.g., 'chat_message', 'member_joined')
   * @returns true if event was already processed, false otherwise
   */
  public hasProcessed(eventId: string, eventType: string): boolean {
    const entry = this.processedEvents.get(eventId);

    if (!entry) {
      return false;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL_MS) {
      this.processedEvents.delete(eventId);
      return false;
    }

    // Entry exists and is not expired
    return true;
  }

  /**
   * Mark an event as processed
   * @param eventId Unique event identifier
   * @param eventType Type of event
   */
  public markProcessed(eventId: string, eventType: string): void {
    // Prevent cache from growing too large
    if (this.processedEvents.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    this.processedEvents.set(eventId, {
      timestamp: Date.now(),
      eventType,
    });

    console.log(`✅ Event marked as processed: ${eventType} (${eventId})`);
  }

  /**
   * Process an event with automatic deduplication
   * @param eventId Unique event identifier
   * @param eventType Type of event
   * @param handler Function to execute if event hasn't been processed
   * @returns true if event was processed, false if it was a duplicate
   */
  public async processEvent<T>(
    eventId: string,
    eventType: string,
    handler: () => T | Promise<T>
  ): Promise<{ processed: boolean; result?: T }> {
    if (this.hasProcessed(eventId, eventType)) {
      console.log(`⏭️ Duplicate event skipped: ${eventType} (${eventId})`);
      return { processed: false };
    }

    try {
      const result = await handler();
      this.markProcessed(eventId, eventType);
      return { processed: true, result };
    } catch (error) {
      console.error(`❌ Error processing event ${eventType} (${eventId}):`, error);
      throw error;
    }
  }

  /**
   * Remove expired events from cache
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [eventId, entry] of this.processedEvents.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.processedEvents.delete(eventId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired events from cache`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Stop automatic cleanup (call on app unmount)
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all processed events (useful for testing or session reset)
   */
  public clear(): void {
    this.processedEvents.clear();
    console.log('🗑️ Event deduplication cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; eventTypes: Record<string, number> } {
    const eventTypes: Record<string, number> = {};

    for (const entry of this.processedEvents.values()) {
      eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
    }

    return {
      size: this.processedEvents.size,
      eventTypes,
    };
  }
}

// Export singleton instance
export const eventDeduplication = new EventDeduplicationManager();

// Export helper function for common pattern
export function withDeduplication<T>(
  eventId: string | undefined | null,
  eventType: string,
  handler: () => T | Promise<T>
): Promise<{ processed: boolean; result?: T }> {
  // Generate fallback ID if none provided (less ideal but prevents crashes)
  const id = eventId || `${eventType}-${Date.now()}-${Math.random()}`;

  return eventDeduplication.processEvent(id, eventType, handler);
}
