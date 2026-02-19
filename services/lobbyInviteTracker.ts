/**
 * Single source of truth for tracking outgoing lobby invitations.
 *
 * Problem this solves:
 * Without this module, the invite modal has no memory of who was already
 * invited. Re-opening the modal (or hitting "Invite All" again after someone
 * leaves/rejoins) re-invites users with pending invitations, burning the
 * backend's 20-invitations/hour rate limit quota on 409 responses.
 *
 * Design — pure module (no React/Zustand):
 * Mirrors the progressive_overload.py / ProgressiveOverload.php pattern
 * used elsewhere in this codebase. RN modules are singletons, so the map
 * lives for the app's lifetime and is accessible from any import site.
 * No re-render side effects, no framework dependencies.
 *
 * Hydra-bug prevention:
 * When a user ACCEPTS an invitation they JOIN the lobby. At that point
 * group-lobby.tsx must call clearInviteForUser() so that if the user
 * later LEAVES, they reappear in the invite list and can be re-invited.
 *
 * Do NOT duplicate this logic in other files.
 *
 * Expiry: 5 minutes — matches backend invitation_expiry_minutes config.
 */

/** How long a sent invite is considered "pending". Matches backend TTL. */
export const LOBBY_INVITE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/** sentInvites[sessionId][userId] = expiry timestamp (ms since epoch) */
const sentInvites: Record<string, Record<number, number>> = {};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Record that userId was invited to sessionId.
 * Call after a 2xx response (invite sent) OR after a 409
 * "already has a pending invitation" — both mean an invite already exists.
 */
export function trackInvite(sessionId: string, userId: number): void {
  if (!sentInvites[sessionId]) {
    sentInvites[sessionId] = {};
  }
  sentInvites[sessionId][userId] = Date.now() + LOBBY_INVITE_EXPIRY_MS;
}

/**
 * Clear the pending-invite record for a single user in a session.
 * Call when the user JOINS the lobby (invitation accepted) so that if they
 * later leave, they can be re-invited without waiting for expiry.
 */
export function clearInviteForUser(sessionId: string, userId: number): void {
  if (sentInvites[sessionId]) {
    delete sentInvites[sessionId][userId];
  }
}

/**
 * Wipe all invite records for a session.
 * Call when the lobby is deleted, the initiator leaves the lobby,
 * or the workout session starts.
 */
export function clearInviteSession(sessionId: string): void {
  delete sentInvites[sessionId];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the Set of userIds that still have a valid pending invite for
 * sessionId. Use this in loadGroupMembers() to filter the invite modal list.
 */
export function getPendingInviteIds(sessionId: string): Set<number> {
  const sessionMap = sentInvites[sessionId];
  if (!sessionMap) return new Set<number>();

  const now = Date.now();
  const pending = new Set<number>();
  for (const [userIdStr, expiry] of Object.entries(sessionMap)) {
    if (now < expiry) {
      pending.add(Number(userIdStr));
    }
  }
  return pending;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

/**
 * Discard all entries whose expiry has passed.
 * Called automatically every 60 seconds via startInviteCleanup().
 */
export function cleanupExpiredInvites(): void {
  const now = Date.now();
  for (const sessionId of Object.keys(sentInvites)) {
    const sessionMap = sentInvites[sessionId];
    for (const userIdStr of Object.keys(sessionMap)) {
      if (now >= sessionMap[Number(userIdStr)]) {
        delete sessionMap[Number(userIdStr)];
      }
    }
    if (Object.keys(sessionMap).length === 0) {
      delete sentInvites[sessionId];
    }
  }
}

/**
 * Start a periodic cleanup of expired invite records.
 * Call once from app startup (root layout).
 * Returns a cancel function (useful in tests).
 */
export function startInviteCleanup(): () => void {
  cleanupExpiredInvites();
  const id = setInterval(cleanupExpiredInvites, 60_000);
  return () => clearInterval(id);
}
