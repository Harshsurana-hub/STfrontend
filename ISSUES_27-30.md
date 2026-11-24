# STfrontend Issues #27-30: UX and Error Handling Fixes

## Issues Overview

### Issue #27: Make the leaderboard Retry button actually refetch
**Context**: `src/app/leaderboard/page.tsx` loads data in a useEffect keyed on `period`. When the request fails, the Retry button calls `setPeriod((p) => p)`.

**Problem**: The Retry button is a no-op because `setPeriod((p) => p)` returns the identical state value. React bails out of the re-render, and the useEffect never re-runs. Users are stuck on the error message until they switch periods.

**Current Code** (line ~127):
```tsx
<button
  type="button"
  className="btn-secondary mt-4 text-sm"
  onClick={() => setPeriod((p) => p)}
>
  Retry
</button>
```

**Solution Options**:

1. **Add a separate retry counter state** (Recommended):
   ```tsx
   const [retryCount, setRetryCount] = useState(0);
   
   useEffect(() => {
     setLoading(true);
     setError(null);
     leaderboardApi
       .get(period)
       .then(setData)
       .catch(() => setError('Failed to load leaderboard. Please try again.'))
       .finally(() => setLoading(false));
   }, [period, retryCount]); // Add retryCount to deps
   
   // In button:
   onClick={() => setRetryCount((n) => n + 1)}
   ```

2. **Alternative: Extract fetch logic into a callback**:
   ```tsx
   const fetchLeaderboard = useCallback(() => {
     setLoading(true);
     setError(null);
     leaderboardApi
       .get(period)
       .then(setData)
       .catch(() => setError('Failed to load leaderboard. Please try again.'))
       .finally(() => setLoading(false));
   }, [period]);
   
   useEffect(() => {
     fetchLeaderboard();
   }, [fetchLeaderboard]);
   
   // In button:
   onClick={fetchLeaderboard}
   ```

**Expected Behavior**: Clicking Retry re-fetches the leaderboard for the current period.

---

### Issue #28: Surface a visible error when the video player's progress save fails
**Context**: `src/components/learn/VideoPlayer.tsx` autosaves watched seconds every 30s via `saveProgress`, which calls `lessonsApi.updateProgress()`. The catch block is empty with the comment "silently swallow".

**Problem**: Progress saves fail silently. Users whose session expired, network dropped, or enrollment ID is stale see the player working normally while the backend never records progress. No retry, no signal to user or parent page.

**Current Code** (line ~112-121):
```tsx
const saveProgress = useCallback(async () => {
  const vid = videoRef.current;
  if (!vid || !enrollmentId || !lessonId) return;
  const watched = Math.floor(vid.currentTime);
  try {
    const { lessonsApi } = await import('@/lib/api/services');
    await lessonsApi.updateProgress(lessonId, enrollmentId, watched);
    onProgress?.(watched);
  } catch {
    // silently swallow — progress save should never crash the player
  }
}, [enrollmentId, lessonId, onProgress]);
```

**Solution**:

1. **Add state for save error**:
   ```tsx
   const [saveError, setSaveError] = useState<string | null>(null);
   ```

2. **Update saveProgress to surface errors**:
   ```tsx
   const saveProgress = useCallback(async () => {
     const vid = videoRef.current;
     if (!vid || !enrollmentId || !lessonId) return;
     const watched = Math.floor(vid.currentTime);
     try {
       const { lessonsApi } = await import('@/lib/api/services');
       await lessonsApi.updateProgress(lessonId, enrollmentId, watched);
       onProgress?.(watched);
       setSaveError(null); // Clear any previous error
     } catch (err) {
       const message = err instanceof Error ? err.message : 'Failed to save progress';
       setSaveError(message);
       console.error('Progress save failed:', err);
       // Don't throw — let the player keep working
     }
   }, [enrollmentId, lessonId, onProgress]);
   ```

3. **Display error in UI**:
   ```tsx
   {saveError && (
     <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
       <p className="font-medium">Progress not saved</p>
       <p className="text-xs opacity-90">{saveError}</p>
     </div>
   )}
   ```

4. **Optional: Add manual retry**:
   - Add a "Retry" button in the error banner
   - Call `saveProgress()` on click
   - Auto-dismiss after successful save

**Expected Behavior**: 
- When progress save fails, show a visible error message
- User knows their progress isn't being saved
- Don't crash the player
- Optionally provide retry mechanism

---

### Issue #29: Stop the leaderboard from fabricating a rank for the current user
**Context**: `src/app/leaderboard/page.tsx` builds `currentUserEntry` from `data?.currentUser` and, when that is absent, synthesizes an entry with `rank: (data?.entries.length ?? 0) + 1` and zeroed stats.

**Problem**: When the API doesn't return `currentUser`, the page invents a rank (always one past the last listed entry) and reports `coursesCompleted: 0`, `hoursLearned: 0`, `streakDays: 0`. This is misleading data presented as real, and shows a fabricated row for users who aren't ranked at all.

**Current Code** (line ~37-48):
```tsx
const currentUserEntry: LeaderboardEntry | null =
  data?.currentUser ??
  (user
    ? {
        rank: (data?.entries.length ?? 0) + 1,
        userId: user.id,
        name: user.name ?? user.email ?? 'You',
        avatarUrl: user.avatarUrl ?? null,
        coursesCompleted: 0,
        hoursLearned: 0,
        streakDays: 0,
      }
    : null);
```

**Solution**:

**Option 1: Show real data or nothing** (Recommended):
```tsx
const currentUserEntry: LeaderboardEntry | null = data?.currentUser ?? null;
```

**Option 2: Show a "not yet ranked" message** (Alternative):
```tsx
const currentUserEntry: LeaderboardEntry | null = data?.currentUser ?? null;
const showUnrankedNotice = user && !data?.currentUser;

// In the JSX:
{showUnrankedNotice && (
  <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
    You're not ranked yet. Complete courses to appear on the leaderboard!
  </div>
)}
```

**Expected Behavior**:
- If the API supplies `currentUser`, show it
- If not, either omit the current-user row entirely or show a clear "not yet ranked" message
- Never fabricate stats or invented ranks

---

### Issue #30: Return focus to the drawer trigger only when the drawer was actually open
**Context**: `src/lib/hooks/use-focus-trap.ts` has a second effect: `if (!isOpen) { triggerRef.current?.focus(); }` with deps `[isOpen, triggerRef]`.

**Problem**: Because the effect runs on mount with `isOpen === false`, the trigger element is focused on first render even though the drawer was never opened. On pages where the trigger is a hamburger button, this steals focus from the document on load and breaks the expected tab order for keyboard and screen-reader users.

**Current Code** (line ~62-67):
```tsx
// Return focus to the trigger element when the drawer closes.
useEffect(() => {
  if (!isOpen) {
    triggerRef.current?.focus();
  }
}, [isOpen, triggerRef]);
```

**Solution**:

**Add a ref to track if drawer was ever opened**:
```tsx
export function useMobileDrawerFocusTrap({
  isOpen,
  containerRef,
  triggerRef,
  onClose,
}: UseMobileDrawerFocusTrapOptions) {
  // Track whether the drawer has been opened at least once this mount
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
    }
  }, [isOpen]);

  // ... existing focus trap effect ...

  // Return focus to the trigger only if the drawer was actually opened
  useEffect(() => {
    if (!isOpen && wasOpenRef.current) {
      triggerRef.current?.focus();
    }
  }, [isOpen, triggerRef]);
}
```

**Expected Behavior**:
- On mount with `isOpen === false`, trigger is not focused
- When drawer opens and then closes, focus returns to trigger
- Keyboard/screen-reader tab order works correctly on page load

---

## Implementation Order

1. **Issue #30** (Focus trap) - Quick fix, improves accessibility
2. **Issue #27** (Leaderboard retry) - Simple state addition
3. **Issue #29** (Leaderboard fabrication) - Data integrity fix
4. **Issue #28** (Video player errors) - Most complex, requires UI design

---

## Testing Strategy

### Issue #27
- Load leaderboard
- Trigger a network error (disable network or modify API endpoint)
- Click Retry button
- Verify new request is made
- Verify data loads on successful retry

### Issue #28
- Play a video with valid enrollment/lesson IDs
- After 30s, verify progress save success
- Invalidate session or modify API to cause failure
- Verify error message appears in player
- Verify error is logged to console
- Verify player continues to work despite error

### Issue #29
- Load leaderboard as a user not in the top entries
- When API returns no `currentUser`, verify:
  - No fabricated row is shown OR
  - Clear "not yet ranked" message is shown
  - No fake stats displayed

### Issue #30
- Load a page with a drawer (e.g., mobile nav)
- Verify hamburger button is NOT focused on page load
- Click hamburger to open drawer
- Press Escape or click outside to close
- Verify focus returns to hamburger button
- Test with screen reader to confirm proper focus flow

---

## Files to Modify

1. `src/app/leaderboard/page.tsx` - Issues #27, #29
2. `src/components/learn/VideoPlayer.tsx` - Issue #28
3. `src/lib/hooks/use-focus-trap.ts` - Issue #30

---

## References

- React hooks best practices
- WCAG 2.1 focus management guidelines
- Next.js error handling patterns
- Keyboard navigation accessibility standards
