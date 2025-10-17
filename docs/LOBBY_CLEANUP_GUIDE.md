# Lobby Cleanup System - Complete Guide

## Overview

The lobby cleanup system ensures that all lobby-related data is properly cleaned up on **every** exit path. This prevents memory leaks, stale WebSocket connections, and data inconsistencies.

## Exit Paths

The system handles **5 primary exit paths**:

### 1. Voluntary Leave
**When:** User clicks "Leave" button in lobby
**Flow:**
1. User confirms leave action
2. `cleanupOnLeave()` is called
3. API call to `/lobby/{sessionId}/leave`
4. Clear AsyncStorage
5. Unsubscribe from WebSocket channels
6. Clear lobby store
7. Navigate back

**Code location:** `app/workout/group-lobby.tsx:289-306`

### 2. Kicked by Initiator
**When:** Lobby initiator kicks a member
**Flow:**
1. Server sends `MemberKicked` event
2. Event handler checks if current user was kicked
3. If yes, `cleanupOnKick()` is called
4. Clear AsyncStorage
5. Unsubscribe from WebSocket channels
6. Clear lobby store
7. Show alert and navigate back

**Code location:** `app/workout/group-lobby.tsx:204-220`

### 3. Lobby Deleted
**When:** Lobby is deleted (initiator leaves, expiry, etc.)
**Flow:**
1. Server sends `LobbyDeleted` event
2. Event handler receives deletion reason
3. `cleanupOnDelete()` is called
4. Clear AsyncStorage
5. Unsubscribe from WebSocket channels
6. Clear lobby store
7. Show alert and navigate back

**Code location:** `app/workout/group-lobby.tsx:198-202`

### 4. Workout Started
**When:** Initiator starts workout
**Flow:**
1. Server sends `WorkoutStarted` event
2. Event handler navigates to workout session
3. Component unmounts, triggering cleanup in useEffect
4. `cleanup()` is called automatically
5. Clear AsyncStorage
6. Unsubscribe from WebSocket channels
7. Clear lobby store

**Code location:** `app/workout/group-lobby.tsx:186-196`

### 5. App Crash/Restart
**When:** App crashes or is force-closed
**Flow:**
1. On next app launch, `recoverFromCrash()` is called
2. Scans AsyncStorage for stale lobby keys
3. For each lobby, check if still active via API
4. If inactive or error, clear all data
5. User can rejoin manually if needed

**Code location:** `utils/lobbyCleanup.ts:18-56`

## Cleanup Steps (All Paths)

Every cleanup path performs these **5 critical steps**:

### Step 1: Clear AsyncStorage
```typescript
const storageKey = `activeLobby_group_${groupId}_user_${userId}`;
await AsyncStorage.removeItem(storageKey);
```
**Purpose:** Removes persisted lobby data

### Step 2: Unsubscribe from Lobby Channel
```typescript
reverbService.unsubscribeFromLobby(sessionId);
```
**Purpose:** Stops receiving lobby events (MemberJoined, StatusChanged, etc.)

### Step 3: Unsubscribe from Presence Channel
```typescript
reverbService.unsubscribeFromPresence(`lobby.${sessionId}`);
```
**Purpose:** Stops tracking online/offline member status

### Step 4: Clear Lobby Store
```typescript
useLobbyStore.getState().clearLobby();
```
**Purpose:** Clears all lobby state (members, messages, status)

### Step 5: Reset Refs
```typescript
hasJoinedRef.current = false;
channelRef.current = null;
presenceChannelRef.current = null;
```
**Purpose:** Resets component-level tracking

## Usage Examples

### In group-lobby.tsx Component

```typescript
import { cleanupOnLeave, cleanupOnKick, cleanupOnDelete } from '../../utils/lobbyCleanup';

// On voluntary leave
const handleLeaveLobby = async () => {
  try {
    await cleanupOnLeave(sessionId, parseInt(groupId), currentUser.user_id);
    router.back();
  } catch (error) {
    console.error('Leave failed:', error);
  }
};

// On kicked event
onMemberKicked: (data: any) => {
  if (data.kicked_user_id === currentUser?.user_id) {
    cleanupOnKick(sessionId, parseInt(groupId), currentUser.user_id, data.reason);
    Alert.alert('Kicked', data.reason);
    router.back();
  }
};

// On lobby deleted event
onLobbyDeleted: (data: any) => {
  cleanupOnDelete(sessionId, parseInt(groupId), currentUser.user_id, data.reason);
  Alert.alert('Lobby Closed', data.reason);
  router.back();
};
```

### In App Root (_layout.tsx)

```typescript
import { recoverFromCrash } from '../utils/lobbyCleanup';
import { useAuthStore } from '../stores/authStore';

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      // Run crash recovery on app launch
      recoverFromCrash(user.user_id);
    }
  }, [user]);

  return <Stack />;
}
```

### In Workout Session Screen

```typescript
import { cleanupOnComplete } from '../utils/lobbyCleanup';

const handleWorkoutComplete = async () => {
  // Save workout results...

  // Clean up lobby data
  if (sessionId && groupId && userId) {
    await cleanupOnComplete(sessionId, groupId, userId);
  }

  router.replace('/dashboard');
};
```

## Testing Checklist

### Test All Exit Paths:
- [ ] User leaves voluntarily → Cleanup runs
- [ ] User is kicked → Cleanup runs
- [ ] Lobby is deleted → Cleanup runs
- [ ] Workout starts → Cleanup runs on unmount
- [ ] App crashes → Recovery runs on relaunch

### Verify Cleanup Steps:
- [ ] AsyncStorage is cleared
- [ ] WebSocket channels unsubscribed
- [ ] Lobby store is empty
- [ ] No memory leaks
- [ ] No duplicate subscriptions

### Edge Cases:
- [ ] Leave with poor network (API fails)
- [ ] Kick while disconnected
- [ ] Delete while app backgrounded
- [ ] Crash during lobby join
- [ ] Multiple rapid leaves

## Debugging

### Check Active Lobbies
```typescript
import { getActiveLobbies } from '../utils/lobbyCleanup';

const lobbies = await getActiveLobbies(userId);
console.log('Active lobbies:', lobbies);
```

### Monitor Cleanup Logs
All cleanup functions log their progress:
- `🗑️ [CLEANUP]` - General cleanup
- `🚪 [LEAVE]` - Voluntary leave
- `⚠️ [KICK]` - Kicked
- `🗑️ [DELETE]` - Lobby deleted
- `🏁 [COMPLETE]` - Workout completed
- `🔄 [CRASH RECOVERY]` - Crash recovery

### Common Issues

**Issue:** Stale lobby data after app crash
**Solution:** Ensure `recoverFromCrash()` is called in app root

**Issue:** WebSocket events still received after leave
**Solution:** Verify unsubscribe calls are not throwing errors

**Issue:** Multiple lobby entries in AsyncStorage
**Solution:** Check that storage key format is consistent

## Architecture Decisions

### Why AsyncStorage?
- **Persistence:** Survives app restarts
- **Recovery:** Enables crash recovery
- **Debugging:** Can inspect stale lobbies

### Why Separate Cleanup Functions?
- **Clarity:** Each exit path is explicit
- **Logging:** Detailed logs per path
- **Error Handling:** Path-specific error recovery

### Why Not Just useEffect Cleanup?
- **Async Operations:** AsyncStorage requires async
- **API Calls:** Some paths need API calls
- **Error Recovery:** Need try/catch per step

## Performance Considerations

- Cleanup is **async** but non-blocking
- Failed cleanup doesn't crash app
- Crash recovery runs **once** on launch
- Storage keys use **consistent format** for fast queries

## Security Considerations

- No sensitive data in AsyncStorage keys
- Lobby data cleared on **all** exit paths
- WebSocket channels unsubscribed (prevents unauthorized access)
- Store cleared (prevents data leakage)

## Future Enhancements

- [ ] Add telemetry for cleanup success/failure rates
- [ ] Implement retry logic for failed API cleanups
- [ ] Add cleanup queue for offline scenarios
- [ ] Create dashboard to view all user lobbies
