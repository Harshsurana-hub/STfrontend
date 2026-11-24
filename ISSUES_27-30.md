# STfrontend Issues #27-30: UX Fixes and Error Handling

## Overview
This document tracks four user experience issues in STfrontend that affect leaderboards, video progress tracking, and accessibility. These issues range from broken retry buttons to silent failures that mislead users about their progress.

**Branch:** `fixes-27-30`  
**Repository:** https://github.com/jeffy005/STfrontend  
**Total Issues:** 4  
**Category:** UX Bugs & Error Handling

---

## Implementation Order

1. **Issue #27** - Leaderboard Retry button (High: User is stuck on error)
2. **Issue #28** - Video progress save failures (High: Silent data loss)
3. **Issue #29** - Fabricated leaderboard rank (Medium: Misleading UI)
4. **Issue #30** - Focus trap on mount (Medium: Accessibility bug)

---

## Issue #27: Leaderboard Retry Button is a No-Op

**Type:** Bug - Broken User Interaction  
**Priority:** High  
**Component:** `src/app/leaderboard/page.tsx`

### Problem
The leaderboard loads data in a `useEffect` keyed on `period`. When the request fails, the error UI shows a "Retry" button that calls `setPeriod((p) => p)`. This sets the **same value**, so React bails out of re-rendering and the `useEffect` never re-runs. Users who hit a transient network error are **stuck** until they manually switch periods.

### Root Cause

**Current Code** (`src/app/leaderboard/page.tsx`):

```tsx
export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    leaderboardApi
      .get(period)
      .then((response) => {
        setData(response);
      })
      .catch(() => {
        setError('Failed to load leaderboard. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [period]);  // ← Only re-runs when period CHANGES
  
  // Error UI
  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button onClick={() => setPeriod((p) => p)}>
          {/*                    ^^^^^^^^^^^^^^^^^^^
              BUG: Sets same value, useEffect doesn't re-run */}
          Retry
        </button>
      </div>
    );
  }
  
  // ... rest of component
}
```

**Why It Fails:**
1. User lands on page → `period = 'weekly'`
2. API request fails → `error` is set
3. User clicks "Retry" → `setPeriod('weekly')` (same value)
4. React sees `period` didn't change → no re-render, no `useEffect` re-run
5. User still sees error message

### Proposed Solution

#### Option 1: Add Retry Counter (Recommended)

```tsx
// File: src/app/leaderboard/page.tsx

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [retryCount, setRetryCount] = useState(0);  // ← New state
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    leaderboardApi
      .get(period)
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        console.error('Leaderboard fetch failed:', err);
        setError('Failed to load leaderboard. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [period, retryCount]);  // ← Add retryCount to dependencies
  
  // Error UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-600 dark:text-red-400 text-center">
          <svg className="w-12 h-12 mx-auto mb-4" /* error icon */ />
          <p className="text-lg font-medium">{error}</p>
        </div>
        <button
          onClick={() => setRetryCount((n) => n + 1)}  // ← Increment counter
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // ... rest of component
}
```

**Why This Works:**
- Incrementing `retryCount` always produces a new value
- New value triggers `useEffect` to re-run
- API request is re-issued with current `period`

#### Option 2: Extract Fetch Function

```tsx
// File: src/app/leaderboard/page.tsx

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    setError(null);
    
    leaderboardApi
      .get(period)
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        console.error('Leaderboard fetch failed:', err);
        setError('Failed to load leaderboard. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [period]);
  
  // Initial load and when period changes
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);
  
  // Error UI
  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button onClick={fetchLeaderboard}>  {/* ← Call function directly */}
          Retry
        </button>
      </div>
    );
  }
  
  // ... rest of component
}
```

### Implementation Steps

1. **Choose implementation** (recommend Option 1 for simplicity)
2. **Add retry state** or extract fetch function
3. **Update error UI** button onClick handler
4. **Test retry behavior** with network throttling
5. **Add loading indicator** during retry

### Test Strategy

```typescript
// File: src/app/leaderboard/page.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import LeaderboardPage from './page';
import * as leaderboardApi from '@/lib/api/leaderboard';

vi.mock('@/lib/api/leaderboard');

describe('LeaderboardPage Retry', () => {
  it('should refetch when Retry button is clicked', async () => {
    const getSpy = vi.spyOn(leaderboardApi, 'get')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        entries: [{ rank: 1, username: 'alice', coursesCompleted: 10 }],
        currentUser: null
      });
    
    render(<LeaderboardPage />);
    
    // Wait for initial error
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
    
    expect(getSpy).toHaveBeenCalledTimes(1);
    
    // Click Retry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    
    // Should refetch
    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
    
    // Should show data after successful retry
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
  });
  
  it('should retry with the same period', async () => {
    const getSpy = vi.spyOn(leaderboardApi, 'get')
      .mockRejectedValue(new Error('Network error'));
    
    render(<LeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
    
    // Initial call with 'weekly'
    expect(getSpy).toHaveBeenCalledWith('weekly');
    
    getSpy.mockClear();
    
    // Click Retry
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    
    // Should retry with same period
    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('weekly');
    });
  });
  
  it('should show loading state during retry', async () => {
    vi.spyOn(leaderboardApi, 'get')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<LeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
```

### Acceptance Criteria

- [ ] Clicking Retry re-issues the API request for the current period
- [ ] Loading indicator appears during retry
- [ ] Error message clears before retry attempt
- [ ] Successful retry displays leaderboard data
- [ ] Failed retry shows error again with working Retry button
- [ ] Period changes still work correctly
- [ ] Tests verify retry behavior

---

## Issue #28: Video Progress Save Failures Are Silent

**Type:** Bug - Silent Failure  
**Priority:** High  
**Component:** `src/components/learn/VideoPlayer.tsx`

### Problem
The VideoPlayer autosaves watched seconds every 30s via `saveProgress`, which calls `lessonsApi.updateProgress(lessonId, enrollmentId, watched)`. The catch block is **empty** with the comment "silently swallow — progress save should never crash the player".

**Impact:**
- Learners with expired sessions see the player working normally
- Network drops don't show any error
- Stale enrollment IDs fail silently
- Users watch entire lessons without progress being recorded
- No retry mechanism
- No signal to user or parent page

### Root Cause

**Current Code** (`src/components/learn/VideoPlayer.tsx`):

```tsx
export function VideoPlayer({ lessonId, enrollmentId, initialProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(initialProgress || 0);
  
  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const watched = Math.floor(videoRef.current.currentTime);
        
        saveProgress(watched).catch(() => {
          // ← BUG: Empty catch block!
          // Comment: "silently swallow — progress save should never crash the player"
        });
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [lessonId, enrollmentId]);
  
  async function saveProgress(watched: number) {
    await lessonsApi.updateProgress(lessonId, enrollmentId, watched);
  }
  
  return (
    <video
      ref={videoRef}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      // ... other props
    />
  );
}
```

**Common Failure Scenarios:**
1. **Session expired:** 401 response, no token refresh
2. **Network offline:** Request timeout, no retry
3. **Invalid enrollment ID:** 404 response, stale data
4. **Rate limiting:** 429 response, temporary block
5. **Server error:** 500 response, transient issue

### Proposed Solution

#### Fix #1: Show Non-Blocking Notification

```tsx
// File: src/components/learn/VideoPlayer.tsx

import { toast } from '@/lib/toast'; // Or your toast library

export function VideoPlayer({ lessonId, enrollmentId, initialProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(initialProgress || 0);
  const [progressSaveError, setProgressSaveError] = useState(false);
  const retryQueueRef = useRef<number[]>([]);
  
  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const watched = Math.floor(videoRef.current.currentTime);
        
        saveProgress(watched).catch((error) => {
          console.error('Progress save failed:', error);
          
          // Queue for retry
          retryQueueRef.current.push(watched);
          
          // Show non-blocking notification (only once)
          if (!progressSaveError) {
            setProgressSaveError(true);
            
            toast.warning(
              'Your progress is not being saved. Check your connection.',
              {
                duration: 5000,
                action: {
                  label: 'Retry',
                  onClick: () => retryPendingProgress()
                }
              }
            );
          }
        });
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [lessonId, enrollmentId, progressSaveError]);
  
  async function saveProgress(watched: number) {
    await lessonsApi.updateProgress(lessonId, enrollmentId, watched);
    
    // Clear error state on success
    if (progressSaveError) {
      setProgressSaveError(false);
      toast.success('Progress saving resumed');
    }
  }
  
  async function retryPendingProgress() {
    if (retryQueueRef.current.length === 0) return;
    
    // Try to save the latest progress
    const latestProgress = Math.max(...retryQueueRef.current);
    
    try {
      await saveProgress(latestProgress);
      retryQueueRef.current = []; // Clear queue on success
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }
  
  // Try to save progress when leaving page
  useEffect(() => {
    return () => {
      if (videoRef.current && retryQueueRef.current.length === 0) {
        const watched = Math.floor(videoRef.current.currentTime);
        // Best-effort save (won't wait for response)
        saveProgress(watched).catch(() => {});
      }
    };
  }, []);
  
  return (
    <div className="relative">
      {progressSaveError && (
        <div className="absolute top-2 right-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded text-sm flex items-center gap-2">
          <svg className="w-4 h-4" /* warning icon */ />
          Progress not saving
        </div>
      )}
      
      <video
        ref={videoRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        // ... other props
      />
    </div>
  );
}
```

#### Fix #2: Emit Event to Parent Page

```tsx
// File: src/components/learn/VideoPlayer.tsx

interface VideoPlayerProps {
  lessonId: string;
  enrollmentId: string;
  initialProgress?: number;
  onProgressSaveError?: (error: Error) => void;  // ← New callback
}

export function VideoPlayer({
  lessonId,
  enrollmentId,
  initialProgress,
  onProgressSaveError
}: VideoPlayerProps) {
  // ... existing state
  
  async function saveProgress(watched: number) {
    try {
      await lessonsApi.updateProgress(lessonId, enrollmentId, watched);
    } catch (error) {
      console.error('Progress save failed:', error);
      
      // Notify parent page
      onProgressSaveError?.(error as Error);
      
      throw error; // Re-throw for local handling
    }
  }
  
  // ... rest of component
}
```

**Parent Page:**

```tsx
// File: src/app/learn/[lessonId]/page.tsx

export default function LessonPage({ params }: Props) {
  const [progressSaveError, setProgressSaveError] = useState<string | null>(null);
  
  const handleProgressSaveError = (error: Error) => {
    // Map error to user-friendly message
    if (error.message.includes('401') || error.message.includes('authentication')) {
      setProgressSaveError('Your session has expired. Please refresh the page.');
    } else if (error.message.includes('network')) {
      setProgressSaveError('Connection lost. Your progress may not be saved.');
    } else {
      setProgressSaveError('Unable to save progress. Please check your connection.');
    }
  };
  
  return (
    <div>
      {progressSaveError && (
        <Alert variant="warning" onDismiss={() => setProgressSaveError(null)}>
          {progressSaveError}
        </Alert>
      )}
      
      <VideoPlayer
        lessonId={params.lessonId}
        enrollmentId={enrollmentId}
        initialProgress={lesson.progress}
        onProgressSaveError={handleProgressSaveError}
      />
    </div>
  );
}
```

#### Fix #3: Add Retry with Exponential Backoff

```tsx
// File: src/lib/utils/retry.ts

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// File: src/components/learn/VideoPlayer.tsx

import { retryWithBackoff } from '@/lib/utils/retry';

async function saveProgress(watched: number) {
  await retryWithBackoff(
    () => lessonsApi.updateProgress(lessonId, enrollmentId, watched),
    3,  // 3 retries
    1000  // 1s base delay (1s, 2s, 4s)
  );
}
```

### Implementation Steps

1. **Choose implementation approach** (recommend combining all three)
2. **Add toast/notification system** if not already present
3. **Implement retry queue** for failed saves
4. **Add visual indicator** when progress save fails
5. **Emit error events** to parent page
6. **Add retry with backoff**
7. **Write tests** for all failure scenarios

### Test Strategy

```typescript
// File: src/components/learn/VideoPlayer.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { VideoPlayer } from './VideoPlayer';
import * as lessonsApi from '@/lib/api/lessons';

vi.mock('@/lib/api/lessons');

describe('VideoPlayer progress save', () => {
  it('should show error when progress save fails', async () => {
    vi.spyOn(lessonsApi, 'updateProgress').mockRejectedValue(
      new Error('Network error')
    );
    
    const { container } = render(
      <VideoPlayer lessonId="lesson-1" enrollmentId="enroll-1" />
    );
    
    const video = container.querySelector('video')!;
    
    // Simulate 30+ seconds of playback
    vi.useFakeTimers();
    Object.defineProperty(video, 'currentTime', {
      get: () => 35,
      configurable: true
    });
    
    // Fast-forward past autosave interval
    vi.advanceTimersByTime(30000);
    
    // Should show error indicator
    await waitFor(() => {
      expect(screen.getByText(/progress not saving/i)).toBeInTheDocument();
    });
    
    vi.useRealTimers();
  });
  
  it('should call onProgressSaveError callback', async () => {
    const error = new Error('401: Unauthorized');
    vi.spyOn(lessonsApi, 'updateProgress').mockRejectedValue(error);
    
    const onError = vi.fn();
    
    render(
      <VideoPlayer
        lessonId="lesson-1"
        enrollmentId="enroll-1"
        onProgressSaveError={onError}
      />
    );
    
    vi.useFakeTimers();
    vi.advanceTimersByTime(30000);
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
    
    vi.useRealTimers();
  });
  
  it('should retry failed progress saves', async () => {
    const updateProgressSpy = vi.spyOn(lessonsApi, 'updateProgress')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);
    
    render(<VideoPlayer lessonId="lesson-1" enrollmentId="enroll-1" />);
    
    vi.useFakeTimers();
    vi.advanceTimersByTime(30000);
    
    // First attempt fails
    await waitFor(() => {
      expect(updateProgressSpy).toHaveBeenCalledTimes(1);
    });
    
    // Should show error
    expect(screen.getByText(/progress not saving/i)).toBeInTheDocument();
    
    // Retry after 1 second (backoff)
    vi.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(updateProgressSpy).toHaveBeenCalledTimes(2);
    });
    
    // Error should clear after success
    await waitFor(() => {
      expect(screen.queryByText(/progress not saving/i)).not.toBeInTheDocument();
    });
    
    vi.useRealTimers();
  });
});
```

### Acceptance Criteria

- [ ] Failed progress saves show non-blocking notification
- [ ] Visual indicator appears when progress is not saving
- [ ] Retry mechanism with exponential backoff (3 attempts)
- [ ] Parent page can be notified via callback
- [ ] User-friendly error messages for common failures
- [ ] Progress queued for retry when network returns
- [ ] Best-effort save on page unload
- [ ] Tests cover network errors, auth errors, and retries

---

## Issue #29: Leaderboard Fabricates Rank for Current User

**Type:** Bug - Misleading UI  
**Priority:** Medium  
**Component:** `src/app/leaderboard/page.tsx`

### Problem
When the API does not return `currentUser`, the page **synthesizes** an entry with:
- `rank: (data?.entries.length ?? 0) + 1` (always one past the last entry)
- `coursesCompleted: 0`
- `hoursLearned: 0`
- `streakDays: 0`

This is **fabricated data presented as real**. It misleads users into thinking they have a rank and zeroed stats, when they may not be ranked at all (no activity, ineligible, etc.).

### Root Cause

**Current Code** (`src/app/leaderboard/page.tsx`):

```tsx
export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  
  // ... fetch logic ...
  
  // Fabricate current user entry when API doesn't provide one
  const currentUserEntry = data?.currentUser ?? {
    rank: (data?.entries.length ?? 0) + 1,  // ← Fabricated rank!
    username: 'You',
    coursesCompleted: 0,  // ← Fabricated stats!
    hoursLearned: 0,
    streakDays: 0
  };
  
  return (
    <div>
      {/* Top entries */}
      {data?.entries.map((entry) => (
        <LeaderboardEntry key={entry.rank} entry={entry} />
      ))}
      
      {/* Current user (may be fabricated!) */}
      <LeaderboardEntry
        entry={currentUserEntry}
        highlight={true}
        className="current-user"
      />
    </div>
  );
}
```

**Why This Is Misleading:**
- User with no activity sees "Rank: 101" (or whatever N+1 is)
- Zero stats look like real data, not "unranked"
- No visual distinction between real and fabricated entries
- User doesn't know if they're actually ranked or not

### Proposed Solution

#### Option 1: Omit Current User Row When Not Ranked

```tsx
// File: src/app/leaderboard/page.tsx

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  
  // ... fetch logic ...
  
  return (
    <div className="leaderboard-container">
      <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>
      
      {/* Period selector */}
      <PeriodSelector value={period} onChange={setPeriod} />
      
      {/* Top entries */}
      <div className="space-y-2 mt-6">
        {data?.entries.map((entry) => (
          <LeaderboardEntry key={entry.rank} entry={entry} />
        ))}
      </div>
      
      {/* Current user - only show if API provides it */}
      {data?.currentUser && (
        <div className="mt-6 pt-4 border-t">
          <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Your Rank
          </h2>
          <LeaderboardEntry
            entry={data.currentUser}
            highlight={true}
            className="current-user"
          />
        </div>
      )}
      
      {/* Message when user is not ranked */}
      {!data?.currentUser && (
        <div className="mt-6 pt-4 border-t text-center text-gray-600 dark:text-gray-400">
          <p>You are not ranked yet.</p>
          <p className="text-sm mt-1">
            Complete courses to appear on the leaderboard!
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Option 2: Show Explicitly Unranked State

```tsx
// File: src/app/leaderboard/page.tsx

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  
  // ... fetch logic ...
  
  const currentUserEntry = data?.currentUser;
  const isRanked = currentUserEntry !== null && currentUserEntry !== undefined;
  
  return (
    <div className="leaderboard-container">
      {/* Top entries */}
      <div className="space-y-2">
        {data?.entries.map((entry) => (
          <LeaderboardEntry key={entry.rank} entry={entry} />
        ))}
      </div>
      
      {/* Current user section */}
      <div className="mt-6 pt-4 border-t">
        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          Your Progress
        </h2>
        
        {isRanked ? (
          <LeaderboardEntry
            entry={currentUserEntry}
            highlight={true}
            className="current-user"
          />
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2" /* trophy icon */ />
              <p className="font-medium">Not Ranked</p>
              <p className="text-sm mt-1">
                Start completing courses to earn your place on the leaderboard!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Option 3: Show Unranked with Actual Stats (If Available)

```tsx
// File: src/app/leaderboard/page.tsx

interface UnrankedUser {
  username: string;
  coursesCompleted: number;
  hoursLearned: number;
  streakDays: number;
  // No rank field
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [userStats, setUserStats] = useState<UnrankedUser | null>(null);
  
  useEffect(() => {
    // If API didn't return currentUser, fetch user's actual stats separately
    if (data && !data.currentUser) {
      userApi.getStats().then(setUserStats).catch(() => {});
    }
  }, [data]);
  
  const currentUserEntry = data?.currentUser;
  
  return (
    <div>
      {/* Top entries */}
      {data?.entries.map((entry) => (
        <LeaderboardEntry key={entry.rank} entry={entry} />
      ))}
      
      {/* Current user - ranked */}
      {currentUserEntry && (
        <div className="mt-6 pt-4 border-t">
          <h2>Your Rank</h2>
          <LeaderboardEntry entry={currentUserEntry} highlight={true} />
        </div>
      )}
      
      {/* Current user - unranked but with stats */}
      {!currentUserEntry && userStats && (
        <div className="mt-6 pt-4 border-t">
          <h2>Your Progress</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Not ranked yet</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{userStats.coursesCompleted}</p>
                <p className="text-xs text-gray-600">Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{userStats.hoursLearned}</p>
                <p className="text-xs text-gray-600">Hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{userStats.streakDays}</p>
                <p className="text-xs text-gray-600">Day Streak</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Current user - no data at all */}
      {!currentUserEntry && !userStats && (
        <div className="mt-6 pt-4 border-t text-center text-gray-600">
          <p>You are not ranked yet.</p>
          <p className="text-sm">Complete courses to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  );
}
```

### Implementation Steps

1. **Choose implementation** (recommend Option 1 for simplicity)
2. **Remove fabricated entry logic**
3. **Add conditional rendering** for ranked vs. unranked
4. **Design unranked state UI**
5. **Update types** (make `currentUser` properly optional)
6. **Write tests** for both states

### Test Strategy

```typescript
// File: src/app/leaderboard/page.test.tsx

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LeaderboardPage from './page';
import * as leaderboardApi from '@/lib/api/leaderboard';

vi.mock('@/lib/api/leaderboard');

describe('LeaderboardPage currentUser display', () => {
  it('should show current user when API provides one', async () => {
    vi.spyOn(leaderboardApi, 'get').mockResolvedValue({
      entries: [
        { rank: 1, username: 'alice', coursesCompleted: 10, hoursLearned: 50, streakDays: 7 },
        { rank: 2, username: 'bob', coursesCompleted: 8, hoursLearned: 40, streakDays: 5 }
      ],
      currentUser: {
        rank: 15,
        username: 'currentuser',
        coursesCompleted: 3,
        hoursLearned: 15,
        streakDays: 2
      }
    });
    
    render(<LeaderboardPage />);
    
    // Should show current user's actual rank
    await screen.findByText('Your Rank');
    expect(screen.getByText('15')).toBeInTheDocument(); // Actual rank
    expect(screen.getByText('3')).toBeInTheDocument(); // Actual courses
  });
  
  it('should NOT fabricate entry when API does not provide currentUser', async () => {
    vi.spyOn(leaderboardApi, 'get').mockResolvedValue({
      entries: [
        { rank: 1, username: 'alice', coursesCompleted: 10, hoursLearned: 50, streakDays: 7 },
        { rank: 2, username: 'bob', coursesCompleted: 8, hoursLearned: 40, streakDays: 5 }
      ],
      currentUser: null  // ← No current user from API
    });
    
    render(<LeaderboardPage />);
    
    await screen.findByText('alice');
    
    // Should NOT show fabricated "Rank: 3" entry
    expect(screen.queryByText('3')).not.toBeInTheDocument(); // Would be N+1 rank
    
    // Should show unranked message instead
    expect(screen.getByText(/not ranked yet/i)).toBeInTheDocument();
  });
  
  it('should not show zeroed stats as real data', async () => {
    vi.spyOn(leaderboardApi, 'get').mockResolvedValue({
      entries: [
        { rank: 1, username: 'alice', coursesCompleted: 10, hoursLearned: 50, streakDays: 7 }
      ],
      currentUser: null
    });
    
    render(<LeaderboardPage />);
    
    await screen.findByText('alice');
    
    // Should NOT show "0 courses, 0 hours, 0 streak" as if it were real
    // (This would be misleading - looks like user has participated but scored zero)
    const zeros = screen.queryAllByText('0');
    expect(zeros.length).toBe(0); // No fabricated zeros
  });
});
```

### Acceptance Criteria

- [ ] No fabricated rank is shown when API doesn't provide `currentUser`
- [ ] No zeroed stats are presented as real data
- [ ] Clear distinction between "ranked" and "not ranked yet"
- [ ] Unranked state has helpful messaging
- [ ] Tests verify both ranked and unranked scenarios
- [ ] API types properly reflect optional `currentUser`

---

## Issue #30: Focus Trap Returns Focus on Mount

**Type:** Accessibility Bug  
**Priority:** Medium  
**Component:** `src/lib/hooks/use-focus-trap.ts`

### Problem
The `useFocusTrap` hook has a second effect:

```tsx
if (!isOpen) {
  triggerRef.current?.focus();
}
```

This runs **on mount** when `isOpen === false`, focusing the trigger element even though **the drawer was never opened**. On pages where the trigger is a hamburger menu button, this **steals focus** on page load and breaks the expected tab order for keyboard and screen-reader users.

### Root Cause

**Current Code** (`src/lib/hooks/use-focus-trap.ts`):

```tsx
export function useFocusTrap(isOpen: boolean, triggerRef: React.RefObject<HTMLElement>) {
  // Effect 1: Trap focus inside drawer when open
  useEffect(() => {
    if (!isOpen) return;
    
    const container = /* drawer element */;
    // ... focus trap logic ...
    
    return () => {
      // Cleanup
    };
  }, [isOpen]);
  
  // Effect 2: Return focus to trigger when closed
  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus();  // ← BUG: Runs on mount!
    }
  }, [isOpen, triggerRef]);
  //  ^^^^^^
  //  When component mounts, isOpen = false, so trigger is focused
}
```

**Why This Is Wrong:**
1. Component mounts with `isOpen = false`
2. Second effect runs immediately
3. `triggerRef.current?.focus()` executes
4. Hamburger button (or whatever the trigger is) gets focused
5. Tab order is disrupted, screen readers announce the button

**Expected Behavior:**
- Focus should **only** return to trigger after drawer **transitions from open to closed**
- Focus should **never** be moved on mount

### Proposed Solution

#### Fix #1: Track Previous Open State

```tsx
// File: src/lib/hooks/use-focus-trap.ts

export function useFocusTrap(isOpen: boolean, triggerRef: React.RefObject<HTMLElement>) {
  const wasOpen = useRef(false);  // ← Track previous state
  
  // Effect 1: Trap focus inside drawer when open
  useEffect(() => {
    if (!isOpen) return;
    
    wasOpen.current = true;  // ← Remember it was open
    
    const container = document.querySelector('[role="dialog"]');
    if (!container) return;
    
    // ... focus trap logic ...
    
    return () => {
      // Cleanup
    };
  }, [isOpen]);
  
  // Effect 2: Return focus ONLY after closing (not on mount)
  useEffect(() => {
    // Only focus trigger if drawer WAS open and is NOW closed
    if (!isOpen && wasOpen.current) {
      triggerRef.current?.focus();
      wasOpen.current = false;  // Reset
    }
  }, [isOpen, triggerRef]);
}
```

#### Fix #2: Use Transition Tracking

```tsx
// File: src/lib/hooks/use-focus-trap.ts

export function useFocusTrap(isOpen: boolean, triggerRef: React.RefObject<HTMLElement>) {
  const [justClosed, setJustClosed] = useState(false);
  
  // Effect 1: Track open→closed transition
  useEffect(() => {
    if (!isOpen) {
      // Check if it was previously open (not initial mount)
      if (document.querySelector('[role="dialog"][aria-hidden="false"]')) {
        setJustClosed(true);
      }
    }
  }, [isOpen]);
  
  // Effect 2: Return focus after transition
  useEffect(() => {
    if (justClosed) {
      triggerRef.current?.focus();
      setJustClosed(false);
    }
  }, [justClosed, triggerRef]);
  
  // Effect 3: Trap focus inside drawer when open
  useEffect(() => {
    if (!isOpen) return;
    
    const container = document.querySelector('[role="dialog"]');
    if (!container) return;
    
    // ... focus trap logic ...
    
    return () => {
      // Cleanup
    };
  }, [isOpen]);
}
```

#### Fix #3: Simplest - Only Focus on Explicit Close

```tsx
// File: src/lib/hooks/use-focus-trap.ts

export function useFocusTrap(isOpen: boolean, triggerRef: React.RefObject<HTMLElement>) {
  const prevOpenRef = useRef<boolean | null>(null);
  
  useEffect(() => {
    // On mount, prevOpenRef is null, so we skip focusing
    // On subsequent renders, we check for open→closed transition
    if (prevOpenRef.current === true && isOpen === false) {
      triggerRef.current?.focus();
    }
    
    // Update ref AFTER checking
    prevOpenRef.current = isOpen;
  }, [isOpen, triggerRef]);
  
  // Effect for focus trap when open
  useEffect(() => {
    if (!isOpen) return;
    
    const container = document.querySelector('[role="dialog"]');
    if (!container) return;
    
    // ... focus trap logic ...
    
    return () => {
      // Cleanup
    };
  }, [isOpen]);
}
```

### Implementation Steps

1. **Choose implementation** (recommend Fix #3 for simplicity)
2. **Add previous state tracking** with `useRef`
3. **Conditionally focus** only on open→closed transition
4. **Test with screen readers**
5. **Test keyboard navigation**

### Test Strategy

```typescript
// File: src/lib/hooks/use-focus-trap.test.tsx

import { render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useFocusTrap } from './use-focus-trap';

function TestComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  
  useFocusTrap(isOpen, triggerRef);
  
  return (
    <div>
      <button ref={triggerRef} onClick={() => setIsOpen(true)}>
        Open Drawer
      </button>
      
      {isOpen && (
        <div role="dialog">
          <button onClick={() => setIsOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('should NOT focus trigger on mount', () => {
    render(<TestComponent />);
    
    const trigger = screen.getByText('Open Drawer');
    
    // Trigger should NOT be focused on mount
    expect(document.activeElement).not.toBe(trigger);
  });
  
  it('should return focus to trigger after closing drawer', async () => {
    const { user } = renderWithUser(<TestComponent />);
    
    const trigger = screen.getByText('Open Drawer');
    
    // Open drawer
    await user.click(trigger);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Close drawer
    await user.click(screen.getByText('Close'));
    
    // Focus should return to trigger
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
  
  it('should not interfere with normal tab order', () => {
    render(
      <>
        <input data-testid="before" />
        <TestComponent />
        <input data-testid="after" />
      </>
    );
    
    const before = screen.getByTestId('before');
    const after = screen.getByTestId('after');
    const trigger = screen.getByText('Open Drawer');
    
    // Focus first input
    before.focus();
    expect(document.activeElement).toBe(before);
    
    // Tab should go to trigger, not steal focus
    userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    
    // Tab should continue to next element
    userEvent.tab();
    expect(document.activeElement).toBe(after);
  });
});
```

### Acceptance Criteria

- [ ] Trigger is NOT focused on component mount
- [ ] Trigger IS focused after drawer closes (open→closed transition)
- [ ] Tab order is not disrupted on page load
- [ ] Screen readers announce correct element on page load
- [ ] Focus trap works correctly when drawer is open
- [ ] Tests verify mount behavior and transition behavior

---

## Overall Testing Strategy

### Manual Testing Checklist

**Issue #27: Leaderboard Retry**
- [ ] Load leaderboard with network offline → see error
- [ ] Click Retry → see loading indicator
- [ ] Network comes back → see leaderboard data
- [ ] Error occurs again → Retry still works

**Issue #28: Video Progress**
- [ ] Watch video with network offline → see warning
- [ ] Network returns → warning clears
- [ ] Session expires during video → see session error
- [ ] Progress saves successfully after retry

**Issue #29: Fabricated Rank**
- [ ] User with rank → see actual rank and stats
- [ ] User without rank → see "not ranked yet" message
- [ ] No zeroed stats displayed as real data

**Issue #30: Focus Trap**
- [ ] Load page → focus is NOT on hamburger button
- [ ] Open drawer → focus is trapped inside
- [ ] Close drawer → focus returns to hamburger button
- [ ] Tab through page → order is correct

### Automated Test Coverage

```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Target files should have 90%+ coverage:
# - src/app/leaderboard/page.tsx
# - src/components/learn/VideoPlayer.tsx
# - src/lib/hooks/use-focus-trap.ts
```

### Accessibility Testing

```bash
# Install axe-core
npm install -D @axe-core/react

# Run accessibility tests
npm run test:a11y

# Manual testing with screen readers:
# - NVDA (Windows)
# - JAWS (Windows)
# - VoiceOver (Mac)
```

---

## Implementation Timeline

### Week 1: Issues #27 & #28 (High Priority)
- Days 1-2: Fix leaderboard Retry button + tests
- Days 3-4: Add video progress error handling + tests
- Day 5: Integration testing and QA

### Week 2: Issues #29 & #30 (Medium Priority)
- Days 1-2: Remove fabricated leaderboard rank + tests
- Days 3-4: Fix focus trap on mount + tests
- Day 5: Accessibility testing and final review

**Total Timeline:** 2 weeks

---

## Success Metrics

### Issue #27 (Leaderboard Retry)
- ✅ 100% of Retry clicks trigger refetch
- ✅ 0 users stuck on error state
- ✅ Average time to recovery < 5 seconds

### Issue #28 (Video Progress)
- ✅ 100% of progress save failures visible to user
- ✅ 90% of failed saves recovered via retry
- ✅ 0 "watched full lesson but no progress" reports

### Issue #29 (Fabricated Rank)
- ✅ 0 fabricated ranks displayed
- ✅ 100% of unranked users see clear message
- ✅ No misleading zero stats

### Issue #30 (Focus Trap)
- ✅ 100% of page loads have correct focus
- ✅ 0 screen reader complaints
- ✅ WCAG 2.1 Level AA compliance

---

## Documentation Updates

### User-Facing

**Help Center:**
- Document progress save errors and what they mean
- Explain leaderboard ranking criteria
- Keyboard navigation guide

### Developer

**README:**
- Document focus trap usage and pitfalls
- Error handling patterns for API calls
- Retry strategy guidelines

---

## Conclusion

These four issues represent **user-facing bugs** that degrade the experience:

**High Priority:**
- #27: Broken retry leaves users stuck
- #28: Silent failures hide data loss

**Medium Priority:**
- #29: Misleading UI confuses users
- #30: Accessibility violation affects keyboard/SR users

All have clear fixes, comprehensive test coverage, and measurable success criteria. Ready for implementation! 🚀
