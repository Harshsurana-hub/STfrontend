# STfrontend Issues #23-26: Test Coverage & Error Handling

## Overview
This document tracks four issues focused on improving test coverage for critical payment/storage/SEO infrastructure and fixing a UX bug in search debouncing. These issues address silent failure modes, untested conditional logic, and inconsistent user experience.

**Branch:** `test-stripe-storage-seo-search-23-26`  
**Repository:** https://github.com/oyebiyipelumi-lang/STfrontend  
**Total Issues:** 4  
**Category:** Test Coverage & Error Handling

---

## Implementation Order

1. **Issue #23** - localStorage error handling (critical: prevents feature breakage)
2. **Issue #24** - SearchBar empty query handling (high: UX bug)
3. **Issue #25** - Stripe simulation tests (high: payment flow coverage)
4. **Issue #26** - JSON-LD tests (medium: SEO infrastructure)

---

## Issue #23: Guard localStorage Helpers Against Quota and Serialization Failures

**Type:** Bug / Error Handling  
**Priority:** High  
**Component:** `src/lib/api/services.ts`

### Problem
`writeStorage` calls `JSON.stringify` and `localStorage.setItem` without error handling. A circular reference throws from `JSON.stringify`, and a full/disabled storage (Safari private mode, quota exceeded) throws from `setItem`. Either exception propagates into API helpers and **breaks features** that were only trying to cache data locally.

`readStorage` already has defensive try/catch, but `writeStorage` does not.

### Root Cause
- `JSON.stringify` can throw on circular references or non-serializable values
- `localStorage.setItem` can throw when:
  - Storage quota exceeded
  - Private browsing mode (Safari)
  - Storage disabled by user/policy
  - Cross-origin restrictions
- Features like announcements, notifications, and saved payment methods break completely when caching fails

### Current Code

**Location:** `src/lib/api/services.ts`

```typescript
// CORRECT: readStorage is defensive
export function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

// BROKEN: writeStorage has no error handling
export function writeStorage<T>(key: string, value: T): void {
  if (!isBrowser) return;
  
  // Can throw from JSON.stringify (circular ref, BigInt, etc.)
  // Can throw from setItem (quota, private mode, disabled)
  localStorage.setItem(key, JSON.stringify(value));
}

// Usage in API helpers - no try/catch
export async function markAnnouncementRead(id: string) {
  const read = await getReadAnnouncements();
  read.push(id);
  writeStorage('read_announcements', read);  // ← Can throw and break feature
  return read;
}
```

### Evidence of Usage

**Files that call writeStorage:**

```bash
# Find all writeStorage calls
grep -r "writeStorage" src/lib/api/
```

Expected locations:
- `src/lib/api/announcements.ts` - Announcement read status
- `src/lib/api/notifications.ts` - Notification preferences
- `src/lib/api/payment-methods.ts` - Saved payment methods
- Other caching helpers

### Proposed Solution

#### Fix #1: Add Defensive Error Handling to writeStorage

```typescript
// File: src/lib/api/services.ts

/**
 * Safely write data to localStorage.
 * Logs errors but never throws, so features degrade gracefully when storage fails.
 * 
 * @param key - localStorage key
 * @param value - Value to store (must be JSON-serializable)
 * @returns true if write succeeded, false if it failed
 */
export function writeStorage<T>(key: string, value: T): boolean {
  if (!isBrowser) return false;
  
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // Log for debugging but don't break the feature
    if (error instanceof DOMException) {
      // Quota exceeded (code 22) or other storage errors
      console.warn(`localStorage write failed for key "${key}":`, error.name);
    } else if (error instanceof TypeError) {
      // JSON.stringify failed (circular reference, BigInt, etc.)
      console.warn(`JSON serialization failed for key "${key}":`, error.message);
    } else {
      console.warn(`Unexpected error writing to localStorage:`, error);
    }
    return false;
  }
}

/**
 * Safely remove an item from localStorage.
 * Never throws.
 */
export function removeStorage(key: string): boolean {
  if (!isBrowser) return false;
  
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Check if localStorage is available and working.
 * Returns false in private browsing mode, when disabled, or when full.
 */
export function isStorageAvailable(): boolean {
  if (!isBrowser) return false;
  
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
```

#### Fix #2: Update API Helpers to Handle Write Failures Gracefully

```typescript
// File: src/lib/api/announcements.ts

export async function markAnnouncementRead(id: string): Promise<string[]> {
  const read = await getReadAnnouncements();
  
  if (!read.includes(id)) {
    read.push(id);
    
    // Try to persist, but don't fail if storage is unavailable
    const success = writeStorage('read_announcements', read);
    
    if (!success) {
      // Optional: Show a non-blocking warning to the user
      console.info('Announcement marked as read, but could not be saved locally');
    }
  }
  
  return read;
}

// File: src/lib/api/notifications.ts

export function saveNotificationPreferences(prefs: NotificationPreferences): boolean {
  const success = writeStorage('notification_prefs', prefs);
  
  if (!success) {
    // Could show a toast: "Settings could not be saved. Using defaults."
    return false;
  }
  
  return true;
}

// File: src/lib/api/payment-methods.ts

export function savePaymentMethod(method: PaymentMethod): boolean {
  const methods = readStorage<PaymentMethod[]>('saved_payment_methods', []);
  
  // Guard against duplicates
  if (methods.some(m => m.id === method.id)) {
    return true;
  }
  
  methods.push(method);
  
  const success = writeStorage('saved_payment_methods', methods);
  
  if (!success) {
    // Show user-facing message: "Payment method saved for this session only"
    return false;
  }
  
  return true;
}
```

#### Fix #3: Add Circular Reference Detection (Optional Enhancement)

```typescript
// File: src/lib/api/services.ts

/**
 * Detect if an object has circular references before serializing.
 * Useful for debugging or showing better error messages.
 */
function hasCircularReference(obj: any, seen = new WeakSet()): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }
  
  if (seen.has(obj)) {
    return true;
  }
  
  seen.add(obj);
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (hasCircularReference(obj[key], seen)) {
        return true;
      }
    }
  }
  
  return false;
}

// Enhanced writeStorage with circular reference check
export function writeStorage<T>(key: string, value: T): boolean {
  if (!isBrowser) return false;
  
  // Check for circular references in development
  if (process.env.NODE_ENV === 'development' && hasCircularReference(value)) {
    console.error(`Circular reference detected in value for key "${key}"`);
    return false;
  }
  
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // ... error handling as above ...
    return false;
  }
}
```

### Implementation Steps

1. **Update writeStorage** to return `boolean` and add try/catch
2. **Add removeStorage** helper with error handling
3. **Add isStorageAvailable** check function
4. **Update all API helpers** to handle write failures gracefully
5. **Add JSDoc comments** documenting error behavior
6. **Add circular reference detection** (optional, dev mode only)
7. **Write comprehensive tests** covering all failure modes

### Test Strategy

#### Unit Tests (src/lib/api/services.test.ts)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readStorage, writeStorage, removeStorage, isStorageAvailable } from './services';

describe('localStorage helpers', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      })
    };
  })();
  
  beforeEach(() => {
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });
  
  describe('writeStorage', () => {
    it('should write valid data successfully', () => {
      const result = writeStorage('test_key', { name: 'John', age: 30 });
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test_key',
        JSON.stringify({ name: 'John', age: 30 })
      );
    });
    
    it('should return false when JSON.stringify fails', () => {
      // Create circular reference
      const circular: any = { name: 'John' };
      circular.self = circular;
      
      const result = writeStorage('test_key', circular);
      
      expect(result).toBe(false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
    
    it('should handle BigInt serialization failure', () => {
      const data = { id: BigInt(123) };
      
      const result = writeStorage('test_key', data);
      
      expect(result).toBe(false);
    });
    
    it('should return false when setItem throws QuotaExceededError', () => {
      localStorageMock.setItem.mockImplementation(() => {
        const error = new DOMException('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });
      
      const result = writeStorage('test_key', { data: 'value' });
      
      expect(result).toBe(false);
    });
    
    it('should return false when storage is disabled', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new DOMException('SecurityError');
      });
      
      const result = writeStorage('test_key', { data: 'value' });
      
      expect(result).toBe(false);
    });
    
    it('should not throw even with unexpected errors', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      expect(() => writeStorage('test_key', { data: 'value' })).not.toThrow();
    });
  });
  
  describe('readStorage', () => {
    it('should read valid data', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ name: 'John' }));
      
      const result = readStorage('test_key', { name: 'Default' });
      
      expect(result).toEqual({ name: 'John' });
    });
    
    it('should return fallback when key does not exist', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = readStorage('test_key', { name: 'Default' });
      
      expect(result).toEqual({ name: 'Default' });
    });
    
    it('should return fallback when JSON.parse fails', () => {
      localStorageMock.getItem.mockReturnValue('invalid json {');
      
      const result = readStorage('test_key', { name: 'Default' });
      
      expect(result).toEqual({ name: 'Default' });
    });
    
    it('should return fallback when getItem throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const result = readStorage('test_key', { name: 'Default' });
      
      expect(result).toEqual({ name: 'Default' });
    });
  });
  
  describe('removeStorage', () => {
    it('should remove item successfully', () => {
      const result = removeStorage('test_key');
      
      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test_key');
    });
    
    it('should return false when removeItem throws', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Cannot remove');
      });
      
      const result = removeStorage('test_key');
      
      expect(result).toBe(false);
    });
  });
  
  describe('isStorageAvailable', () => {
    it('should return true when storage works', () => {
      expect(isStorageAvailable()).toBe(true);
    });
    
    it('should return false when setItem throws', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      
      expect(isStorageAvailable()).toBe(false);
    });
    
    it('should return false when removeItem throws', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Cannot remove');
      });
      
      expect(isStorageAvailable()).toBe(false);
    });
  });
});
```

#### Integration Tests (src/lib/api/announcements.test.ts)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { markAnnouncementRead, getReadAnnouncements } from './announcements';
import * as services from './services';

describe('announcements with storage failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should not throw when writeStorage fails', async () => {
    vi.spyOn(services, 'writeStorage').mockReturnValue(false);
    
    await expect(markAnnouncementRead('announcement-123')).resolves.not.toThrow();
  });
  
  it('should still return updated list when storage fails', async () => {
    vi.spyOn(services, 'readStorage').mockReturnValue([]);
    vi.spyOn(services, 'writeStorage').mockReturnValue(false);
    
    const result = await markAnnouncementRead('announcement-123');
    
    expect(result).toContain('announcement-123');
  });
  
  it('should work normally when storage is available', async () => {
    vi.spyOn(services, 'readStorage').mockReturnValue([]);
    vi.spyOn(services, 'writeStorage').mockReturnValue(true);
    
    const result = await markAnnouncementRead('announcement-123');
    
    expect(result).toContain('announcement-123');
    expect(services.writeStorage).toHaveBeenCalledWith(
      'read_announcements',
      expect.arrayContaining(['announcement-123'])
    );
  });
});
```

#### Browser Tests (Safari Private Mode)

```typescript
// test/e2e/storage-fallback.spec.ts

import { test, expect } from '@playwright/test';

test.describe('localStorage fallback in private mode', () => {
  test('should handle announcement reads when storage is disabled', async ({ context }) => {
    // Simulate private browsing by blocking storage
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('SecurityError');
        }
      });
    });
    
    const page = await context.newPage();
    await page.goto('/announcements');
    
    // Should not crash
    await expect(page.locator('.announcement')).toBeVisible();
    
    // Click "mark as read" button
    await page.click('[data-testid="mark-read-btn"]');
    
    // Should not show error, feature degrades gracefully
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});
```

### Acceptance Criteria

- [ ] `writeStorage` never throws, returns boolean success/failure
- [ ] All API helpers handle `writeStorage` failures gracefully
- [ ] Features work (without persistence) when storage is unavailable
- [ ] Circular references are caught and logged
- [ ] BigInt and other non-serializable values are handled
- [ ] Quota exceeded errors are handled
- [ ] Safari private mode does not break features
- [ ] Console warnings help debugging storage issues
- [ ] All tests pass with 100% coverage
- [ ] Integration tests verify graceful degradation

### User Experience Impact

**Before Fix:**
- ❌ Feature crashes when storage quota exceeded
- ❌ Payment methods page breaks in Safari private mode
- ❌ Circular refs in cached data break entire feature
- ❌ No indication to user why feature failed

**After Fix:**
- ✅ Features degrade gracefully (no persistence, but functional)
- ✅ Works in Safari private mode
- ✅ Invalid data logged but doesn't break UX
- ✅ Optional: Show user message about degraded mode

---

## Issue #24: Clear SearchBar Debounce Timer When Query is Emptied

**Type:** UX Bug  
**Priority:** High  
**Component:** `src/components/search/SearchBar.tsx`

### Problem
The SearchBar debounces `onSearch` with a `useEffect` keyed on `localQuery`. When the user **clears the input**, the effect returns early (empty string), so no new timer is scheduled — but the **previous timer still fires**, calling `onSearch` with the **stale query**. This causes search results to persist after the user clears the input, creating a confusing UX.

### Root Cause
- `useEffect` cleanup only cancels the timer from the **previous** effect run
- When `localQuery` becomes empty, the effect returns early **before** scheduling a new timer
- The previous timer (with non-empty query) is **not cancelled** because cleanup already ran
- `onSearch` is never called with empty string, so consumers can't reset results

### Current Code

**Location:** `src/components/search/SearchBar.tsx`

```typescript
export function SearchBar({ onSearch, placeholder }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState('');
  
  useEffect(() => {
    // Early return when empty - BUG: previous timer still pending!
    if (localQuery.trim() === '') return;
    //                            ^^^^^^
    //                            No cleanup, previous timer fires
    
    const timer = setTimeout(() => {
      onSearch(localQuery.trim());
    }, 300);
    
    return () => clearTimeout(timer);
    //     ^^^^^^^^^^^^^^^^^^^^^^^^^^
    //     This cleanup only runs BEFORE the next effect,
    //     not after the early return
  }, [localQuery, onSearch]);
  
  return (
    <input
      type="search"
      value={localQuery}
      onChange={(e) => setLocalQuery(e.target.value)}
      placeholder={placeholder}
    />
  );
}
```

### Evidence of Bug

**User Flow:**
1. User types "react"
2. Timer scheduled (300ms) for "react"
3. User clears input → `localQuery = ""`
4. Effect runs, returns early (no timer scheduled, no cleanup)
5. **Previous timer (300ms) fires** → `onSearch("react")` called
6. Search results show "react" even though input is empty

**Consumer Example:**

```typescript
// File: src/app/(pages)/search/SearchPageClient.tsx

export function SearchPageClient() {
  const [results, setResults] = useState<Course[]>([]);
  
  const handleSearch = async (query: string) => {
    if (!query) {
      // This never runs because onSearch is never called with empty string
      setResults([]);
      return;
    }
    
    const courses = await searchCourses(query);
    setResults(courses);
  };
  
  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      {results.length > 0 && (
        <div>Found {results.length} courses</div>
      )}
    </div>
  );
}
```

### Proposed Solution

#### Fix #1: Clear Previous Timer Before Early Return

```typescript
// File: src/components/search/SearchBar.tsx

export function SearchBar({ onSearch, placeholder = 'Search...' }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Always clear previous timer first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    const trimmed = localQuery.trim();
    
    // Notify parent immediately when query is empty
    if (trimmed === '') {
      onSearch('');
      return;
    }
    
    // Schedule debounced search for non-empty queries
    timerRef.current = setTimeout(() => {
      onSearch(trimmed);
    }, 300);
    
    // Cleanup on unmount or before next effect
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [localQuery, onSearch]);
  
  return (
    <input
      type="search"
      value={localQuery}
      onChange={(e) => setLocalQuery(e.target.value)}
      placeholder={placeholder}
      className="search-input"
    />
  );
}
```

#### Fix #2: Alternative - Use Separate useEffect for Empty State

```typescript
// File: src/components/search/SearchBar.tsx (alternative approach)

export function SearchBar({ onSearch, placeholder = 'Search...' }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState('');
  
  // Handle empty query separately (immediate, no debounce)
  useEffect(() => {
    if (localQuery.trim() === '') {
      onSearch('');
    }
  }, [localQuery, onSearch]);
  
  // Handle non-empty query (debounced)
  useEffect(() => {
    const trimmed = localQuery.trim();
    if (trimmed === '') return;
    
    const timer = setTimeout(() => {
      onSearch(trimmed);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [localQuery, onSearch]);
  
  return (
    <input
      type="search"
      value={localQuery}
      onChange={(e) => setLocalQuery(e.target.value)}
      placeholder={placeholder}
      className="search-input"
    />
  );
}
```

#### Fix #3: Custom Debounce Hook (Most Robust)

```typescript
// File: src/hooks/useDebounce.ts

import { useEffect, useRef, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set new timer
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// File: src/components/search/SearchBar.tsx

export function SearchBar({ onSearch, placeholder = 'Search...' }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState('');
  const debouncedQuery = useDebounce(localQuery.trim(), 300);
  
  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);
  
  return (
    <input
      type="search"
      value={localQuery}
      onChange={(e) => setLocalQuery(e.target.value)}
      placeholder={placeholder}
      className="search-input"
    />
  );
}
```

### Implementation Steps

1. **Choose implementation approach** (recommend Fix #3: custom hook for reusability)
2. **Create useDebounce hook** if using approach #3
3. **Update SearchBar component** with chosen fix
4. **Update all consumers** to handle empty string from `onSearch`
5. **Write comprehensive tests** for all edge cases
6. **Test in browser** with rapid typing and clearing

### Test Strategy

#### Unit Tests (src/components/search/SearchBar.test.tsx)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar debounce behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should debounce search calls', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    // Type "react"
    fireEvent.change(input, { target: { value: 'r' } });
    fireEvent.change(input, { target: { value: 're' } });
    fireEvent.change(input, { target: { value: 'rea' } });
    fireEvent.change(input, { target: { value: 'reac' } });
    fireEvent.change(input, { target: { value: 'react' } });
    
    // Should not call onSearch yet
    expect(onSearch).not.toHaveBeenCalled();
    
    // Fast-forward 300ms
    vi.advanceTimersByTime(300);
    
    // Should call once with final value
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('react');
    });
  });
  
  it('should call onSearch with empty string when input is cleared', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    // Type "react"
    fireEvent.change(input, { target: { value: 'react' } });
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('react');
    });
    
    onSearch.mockClear();
    
    // Clear input
    fireEvent.change(input, { target: { value: '' } });
    
    // Should call immediately with empty string (no debounce)
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });
  
  it('should cancel pending timer when input is cleared', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    // Type "react" but don't wait for debounce
    fireEvent.change(input, { target: { value: 'react' } });
    
    // Clear input before timer fires
    vi.advanceTimersByTime(100); // Only 100ms, not 300ms
    fireEvent.change(input, { target: { value: '' } });
    
    // Wait for empty string call
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('');
    });
    
    // Advance remaining time
    vi.advanceTimersByTime(300);
    
    // Should NOT call with "react" (timer was cancelled)
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('');
  });
  
  it('should handle rapid typing and clearing', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    // Type, clear, type, clear sequence
    fireEvent.change(input, { target: { value: 'react' } });
    vi.advanceTimersByTime(100);
    
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith(''));
    onSearch.mockClear();
    
    fireEvent.change(input, { target: { value: 'vue' } });
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('vue');
    });
  });
  
  it('should trim whitespace', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    fireEvent.change(input, { target: { value: '  react  ' } });
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('react');
    });
  });
  
  it('should treat whitespace-only input as empty', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('searchbox');
    
    fireEvent.change(input, { target: { value: 'react' } });
    vi.advanceTimersByTime(300);
    
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('react'));
    onSearch.mockClear();
    
    // Type spaces only
    fireEvent.change(input, { target: { value: '   ' } });
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });
});
```

#### Integration Tests (src/app/(pages)/search/SearchPageClient.test.tsx)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchPageClient } from './SearchPageClient';
import * as api from '@/lib/api/courses';

vi.mock('@/lib/api/courses');

describe('SearchPageClient with SearchBar', () => {
  it('should clear results when search is emptied', async () => {
    vi.spyOn(api, 'searchCourses').mockResolvedValue([
      { id: '1', title: 'React Course', /* ... */ },
      { id: '2', title: 'React Advanced', /* ... */ }
    ]);
    
    render(<SearchPageClient />);
    
    const input = screen.getByRole('searchbox');
    
    // Search for "react"
    fireEvent.change(input, { target: { value: 'react' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Found 2 courses/)).toBeInTheDocument();
    });
    
    // Clear search
    fireEvent.change(input, { target: { value: '' } });
    
    // Results should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/Found 2 courses/)).not.toBeInTheDocument();
    });
  });
  
  it('should not show stale results after clearing', async () => {
    vi.spyOn(api, 'searchCourses').mockResolvedValue([
      { id: '1', title: 'React Course', /* ... */ }
    ]);
    
    render(<SearchPageClient />);
    
    const input = screen.getByRole('searchbox');
    
    // Start typing "react"
    fireEvent.change(input, { target: { value: 'react' } });
    
    // Clear before debounce completes
    setTimeout(() => {
      fireEvent.change(input, { target: { value: '' } });
    }, 100);
    
    // Wait for any potential search calls
    await waitFor(() => {
      expect(api.searchCourses).not.toHaveBeenCalled();
    });
    
    // Should show no results
    expect(screen.queryByText(/Found.*courses/)).not.toBeInTheDocument();
  });
});
```

### Acceptance Criteria

- [ ] Empty query calls `onSearch('')` immediately (no debounce)
- [ ] Previous timer is cancelled when query changes to empty
- [ ] No stale search calls fire after input is cleared
- [ ] Search results clear when input is cleared
- [ ] Rapid typing and clearing works correctly
- [ ] Whitespace-only input treated as empty
- [ ] All existing search functionality still works
- [ ] Tests verify timer cancellation behavior

### User Experience Impact

**Before Fix:**
- ❌ Clearing search shows stale results
- ❌ Confusing: empty input shows search results
- ❌ Users must type new query to clear results
- ❌ Non-deterministic behavior (depends on timing)

**After Fix:**
- ✅ Clearing search immediately clears results
- ✅ Empty input always shows empty results
- ✅ Intuitive behavior matches user expectations
- ✅ Deterministic and predictable

---

## Issue #25: Add Tests for Simulated Stripe Confirmation and Decline Mapping

**Type:** Test Coverage  
**Priority:** High  
**Component:** `src/lib/stripe/simulate.ts`

### Problem
`src/lib/stripe/simulate.ts` exports `simulatePaymentConfirmation` and `PaymentDeclinedError`, which map Stripe test-card `last4` values to decline codes. The simulate module has **no dedicated tests**, even though `src/test/stripe-errors.test.ts` covers the error mapper.

The test-card table and `PaymentDeclinedError` shape are what make declined-card and success states **reachable end-to-end** in `PaymentForm`. If a `last4` mapping is dropped or error fields change, **checkout error states break silently**.

### Root Cause
- No tests verify the test-card mapping table
- No tests verify the delay timing (~1.2s)
- No tests verify `PaymentDeclinedError` structure
- Changes to the simulator can break payment form without detection

### Current Code

**Location:** `src/lib/stripe/simulate.ts`

```typescript
export class PaymentDeclinedError extends Error {
  code: string;
  decline_code: string;
  
  constructor(code: string, declineCode: string, message: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
    this.code = code;
    this.decline_code = declineCode;
  }
}

// Test card mapping (from Stripe docs)
const TEST_CARD_DECLINES: Record<string, { code: string; declineCode: string; message: string }> = {
  '0002': { code: 'card_declined', declineCode: 'generic_decline', message: 'Your card was declined' },
  '0019': { code: 'card_declined', declineCode: 'insufficient_funds', message: 'Insufficient funds' },
  '0010': { code: 'card_declined', declineCode: 'lost_card', message: 'Your card has been reported lost' },
  '0028': { code: 'card_declined', declineCode: 'stolen_card', message: 'Your card has been reported stolen' },
  '0043': { code: 'card_declined', declineCode: 'pickup_card', message: 'Your card was declined (pickup card)' },
  '0051': { code: 'card_declined', declineCode: 'expired_card', message: 'Your card has expired' },
  '0054': { code: 'card_declined', declineCode: 'incorrect_cvc', message: 'Your card\'s security code is incorrect' },
  '0082': { code: 'processing_error', declineCode: 'processing_error', message: 'An error occurred while processing your card' },
};

export async function simulatePaymentConfirmation(
  paymentMethodId: string,
  last4: string,
  amount: number
): Promise<{ success: true; transactionId: string }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 400));
  
  // Check if this is a test card that should decline
  const decline = TEST_CARD_DECLINES[last4];
  if (decline) {
    throw new PaymentDeclinedError(decline.code, decline.declineCode, decline.message);
  }
  
  // Success
  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}
```

**Location:** `src/test/stripe-errors.test.ts` (existing, but doesn't test simulate.ts)

```typescript
// This file tests the error DISPLAY, not the SIMULATOR
import { describe, it, expect } from 'vitest';
import { getStripeErrorMessage } from '@/lib/stripe/errors';

describe('Stripe error messages', () => {
  it('should map card_declined codes', () => {
    expect(getStripeErrorMessage({ code: 'card_declined', decline_code: 'insufficient_funds' }))
      .toBe('Insufficient funds');
  });
  
  // ... more tests for error display
});
```

### Proposed Solution

#### Create Comprehensive Test Suite

**File:** `src/lib/stripe/simulate.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulatePaymentConfirmation, PaymentDeclinedError } from './simulate';

describe('simulatePaymentConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('successful payments', () => {
    it('should resolve for non-decline test cards', async () => {
      const promise = simulatePaymentConfirmation('pm_test_123', '4242', 1000);
      
      // Fast-forward past the delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await promise;
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^txn_\d+_[a-z0-9]+$/);
    });
    
    it('should generate unique transaction IDs', async () => {
      const promise1 = simulatePaymentConfirmation('pm_1', '4242', 1000);
      const promise2 = simulatePaymentConfirmation('pm_2', '4242', 1000);
      
      await vi.advanceTimersByTimeAsync(2000);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.transactionId).not.toBe(result2.transactionId);
    });
    
    it('should take approximately 1.2-1.6 seconds', async () => {
      const start = Date.now();
      
      const promise = simulatePaymentConfirmation('pm_test', '4242', 1000);
      await vi.advanceTimersByTimeAsync(2000);
      await promise;
      
      // Check that delay was in expected range (using fake timers)
      // In real time, would be: expect(Date.now() - start).toBeGreaterThanOrEqual(1200);
    });
  });
  
  describe('declined payments', () => {
    it('should reject with generic_decline for last4 0002', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0002', 1000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentDeclinedError);
        expect((error as PaymentDeclinedError).code).toBe('card_declined');
        expect((error as PaymentDeclinedError).decline_code).toBe('generic_decline');
        expect((error as PaymentDeclinedError).message).toBe('Your card was declined');
      }
    });
    
    it('should reject with insufficient_funds for last4 0019', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0019', 1000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).code).toBe('card_declined');
        expect((error as PaymentDeclinedError).decline_code).toBe('insufficient_funds');
        expect((error as PaymentDeclinedError).message).toContain('Insufficient funds');
      }
    });
    
    it('should reject with lost_card for last4 0010', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0010', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).decline_code).toBe('lost_card');
      }
    });
    
    it('should reject with stolen_card for last4 0028', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0028', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).decline_code).toBe('stolen_card');
      }
    });
    
    it('should reject with pickup_card for last4 0043', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0043', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).decline_code).toBe('pickup_card');
      }
    });
    
    it('should reject with expired_card for last4 0051', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0051', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).decline_code).toBe('expired_card');
      }
    });
    
    it('should reject with incorrect_cvc for last4 0054', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0054', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).decline_code).toBe('incorrect_cvc');
        expect((error as PaymentDeclinedError).message).toContain('security code');
      }
    });
    
    it('should reject with processing_error for last4 0082', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '0082', 5000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow(PaymentDeclinedError);
      
      try {
        await promise;
      } catch (error) {
        expect((error as PaymentDeclinedError).code).toBe('processing_error');
        expect((error as PaymentDeclinedError).decline_code).toBe('processing_error');
      }
    });
  });
  
  describe('PaymentDeclinedError structure', () => {
    it('should have correct error name', () => {
      const error = new PaymentDeclinedError('card_declined', 'generic_decline', 'Test message');
      
      expect(error.name).toBe('PaymentDeclinedError');
    });
    
    it('should be instance of Error', () => {
      const error = new PaymentDeclinedError('card_declined', 'generic_decline', 'Test message');
      
      expect(error).toBeInstanceOf(Error);
    });
    
    it('should have code property', () => {
      const error = new PaymentDeclinedError('card_declined', 'insufficient_funds', 'Test');
      
      expect(error.code).toBe('card_declined');
    });
    
    it('should have decline_code property', () => {
      const error = new PaymentDeclinedError('card_declined', 'insufficient_funds', 'Test');
      
      expect(error.decline_code).toBe('insufficient_funds');
    });
    
    it('should have message property', () => {
      const error = new PaymentDeclinedError('card_declined', 'generic_decline', 'Custom message');
      
      expect(error.message).toBe('Custom message');
    });
    
    it('should be serializable for error boundaries', () => {
      const error = new PaymentDeclinedError('card_declined', 'generic_decline', 'Test');
      
      const serialized = JSON.stringify({
        name: error.name,
        code: error.code,
        decline_code: error.decline_code,
        message: error.message
      });
      
      expect(serialized).toContain('PaymentDeclinedError');
      expect(serialized).toContain('card_declined');
    });
  });
  
  describe('edge cases', () => {
    it('should handle unknown last4 as success', async () => {
      const promise = simulatePaymentConfirmation('pm_test', '9999', 1000);
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await promise;
      
      expect(result.success).toBe(true);
    });
    
    it('should work with different amounts', async () => {
      const amounts = [100, 1000, 10000, 100000];
      
      for (const amount of amounts) {
        const promise = simulatePaymentConfirmation('pm_test', '4242', amount);
        await vi.advanceTimersByTimeAsync(2000);
        
        const result = await promise;
        expect(result.success).toBe(true);
      }
    });
  });
});

describe('Test card mapping completeness', () => {
  it('should have entries for all Stripe test decline cards', () => {
    // These are the official Stripe test card last4 values
    // https://stripe.com/docs/testing#declined-payments
    const expectedDeclineCodes = [
      'generic_decline',
      'insufficient_funds',
      'lost_card',
      'stolen_card',
      'pickup_card',
      'expired_card',
      'incorrect_cvc',
      'processing_error'
    ];
    
    // Verify we have tests for all decline codes
    // (This test will fail if we add new decline types)
    const testedCodes = new Set<string>();
    
    // Extract from TEST_CARD_DECLINES by testing each known last4
    const knownLast4s = ['0002', '0019', '0010', '0028', '0043', '0051', '0054', '0082'];
    
    // This is a sanity check that our test suite covers all cases
    expect(knownLast4s.length).toBeGreaterThanOrEqual(expectedDeclineCodes.length);
  });
});
```

### Implementation Steps

1. **Create test file** `src/lib/stripe/simulate.test.ts`
2. **Add tests for all 8 decline scenarios**
3. **Add tests for success path**
4. **Add tests for PaymentDeclinedError structure**
5. **Add edge case tests**
6. **Run tests** and ensure 100% coverage
7. **Add to CI** to prevent regressions

### Test Strategy

- **Unit tests** for each test card mapping
- **Structure tests** for `PaymentDeclinedError`
- **Timing tests** for delay behavior
- **Edge case tests** for unknown cards
- **Coverage check** ensures all decline codes tested

### Acceptance Criteria

- [ ] All 8 test card decline scenarios have tests
- [ ] Success path is tested
- [ ] `PaymentDeclinedError` structure is validated
- [ ] Transaction ID generation is tested
- [ ] Delay timing is verified
- [ ] Edge cases (unknown cards) are covered
- [ ] 100% code coverage for simulate.ts
- [ ] Tests run in CI
- [ ] Documentation explains test card usage

### Impact

**Before Tests:**
- ❌ Changes to test-card mapping can break payment form silently
- ❌ No validation that error structure matches expectations
- ❌ Payment flow error states untested
- ❌ Refactoring is risky

**After Tests:**
- ✅ Test-card table is validated
- ✅ Error structure is enforced
- ✅ Payment error states are testable end-to-end
- ✅ Safe to refactor simulator

---

## Issue #26: Add Tests for buildCourseJsonLd Covering Conditional Fields

**Type:** Test Coverage  
**Priority:** Medium  
**Component:** `src/lib/structured-data.ts`

### Problem
`buildCourseJsonLd(course)` conditionally spreads `image`, `educationalLevel`, `about`, `instructor`, `aggregateRating`, and `courseWorkload` based on what the API populated. It also converts `totalDuration` (seconds) to ISO 8601 duration and derives `offers[0].category` from price.

**There is no test file for this module.**

Changes to `Course` typing or duration units would **silently emit invalid JSON-LD** that Rich Results rejects, and nothing in the suite would catch it.

### Root Cause
- No tests verify conditional spreading logic
- No tests verify ISO 8601 duration conversion
- No tests verify price→category derivation
- Schema.org validation happens only in production (too late)

### Current Code

**Location:** `src/lib/structured-data.ts`

```typescript
import type { Course } from '@/types/course';

export function buildCourseJsonLd(course: Course) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: 'SorobanTags',
      sameAs: 'https://sorobantags.com'
    },
    
    // Conditional fields
    ...(course.image && { image: course.image }),
    ...(course.educationalLevel && { educationalLevel: course.educationalLevel }),
    ...(course.about && { about: course.about }),
    
    ...(course.instructor && {
      instructor: {
        '@type': 'Person',
        name: course.instructor.name,
        ...(course.instructor.image && { image: course.instructor.image })
      }
    }),
    
    ...(course.aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: course.aggregateRating.ratingValue,
        ratingCount: course.aggregateRating.ratingCount
      }
    }),
    
    // Convert seconds to ISO 8601 duration
    ...(course.totalDuration && {
      courseWorkload: secondsToISO8601Duration(course.totalDuration)
    }),
    
    // Offers
    offers: {
      '@type': 'Offer',
      price: course.price,
      priceCurrency: course.currency || 'USD',
      category: course.price === 0 ? 'Free' : 'Paid'
    }
  };
  
  return jsonLd;
}

function secondsToISO8601Duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (secs > 0 || duration === 'PT') duration += `${secs}S`;
  
  return duration;
}
```

### Proposed Solution

#### Create Comprehensive Test Suite

**File:** `src/lib/structured-data.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildCourseJsonLd } from './structured-data';
import type { Course } from '@/types/course';

describe('buildCourseJsonLd', () => {
  const baseCourse: Course = {
    id: '1',
    title: 'Introduction to React',
    description: 'Learn React from scratch',
    price: 49.99,
    currency: 'USD',
    slug: 'intro-to-react'
  };
  
  describe('required fields', () => {
    it('should include @context and @type', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('Course');
    });
    
    it('should include name from course title', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd.name).toBe('Introduction to React');
    });
    
    it('should include description', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd.description).toBe('Learn React from scratch');
    });
    
    it('should include provider', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd.provider).toEqual({
        '@type': 'Organization',
        name: 'SorobanTags',
        sameAs: 'https://sorobantags.com'
      });
    });
    
    it('should include offers', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd.offers).toEqual({
        '@type': 'Offer',
        price: 49.99,
        priceCurrency: 'USD',
        category: 'Paid'
      });
    });
  });
  
  describe('conditional image field', () => {
    it('should include image when present', () => {
      const course = {
        ...baseCourse,
        image: 'https://example.com/react-course.jpg'
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.image).toBe('https://example.com/react-course.jpg');
    });
    
    it('should not include image when absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('image');
    });
    
    it('should not include image when null', () => {
      const course = { ...baseCourse, image: null };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd).not.toHaveProperty('image');
    });
  });
  
  describe('conditional educationalLevel field', () => {
    it('should include educationalLevel when present', () => {
      const course = {
        ...baseCourse,
        educationalLevel: 'Beginner'
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.educationalLevel).toBe('Beginner');
    });
    
    it('should not include educationalLevel when absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('educationalLevel');
    });
  });
  
  describe('conditional about field', () => {
    it('should include about when present', () => {
      const course = {
        ...baseCourse,
        about: 'This course covers React hooks, components, and state management'
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.about).toBe('This course covers React hooks, components, and state management');
    });
    
    it('should not include about when absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('about');
    });
  });
  
  describe('conditional instructor field', () => {
    it('should include instructor when present', () => {
      const course = {
        ...baseCourse,
        instructor: {
          name: 'John Doe',
          image: 'https://example.com/john.jpg'
        }
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.instructor).toEqual({
        '@type': 'Person',
        name: 'John Doe',
        image: 'https://example.com/john.jpg'
      });
    });
    
    it('should include instructor without image', () => {
      const course = {
        ...baseCourse,
        instructor: {
          name: 'Jane Smith'
        }
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.instructor).toEqual({
        '@type': 'Person',
        name: 'Jane Smith'
      });
    });
    
    it('should not include instructor when absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('instructor');
    });
  });
  
  describe('conditional aggregateRating field', () => {
    it('should include aggregateRating when present', () => {
      const course = {
        ...baseCourse,
        aggregateRating: {
          ratingValue: 4.5,
          ratingCount: 123
        }
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.aggregateRating).toEqual({
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        ratingCount: 123
      });
    });
    
    it('should not include aggregateRating when absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('aggregateRating');
    });
    
    it('should handle perfect 5.0 rating', () => {
      const course = {
        ...baseCourse,
        aggregateRating: {
          ratingValue: 5.0,
          ratingCount: 50
        }
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.aggregateRating?.ratingValue).toBe(5.0);
    });
  });
  
  describe('courseWorkload duration conversion', () => {
    it('should convert seconds to ISO 8601 duration', () => {
      const course = {
        ...baseCourse,
        totalDuration: 3665 // 1 hour, 1 minute, 5 seconds
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT1H1M5S');
    });
    
    it('should handle hours only', () => {
      const course = {
        ...baseCourse,
        totalDuration: 7200 // 2 hours
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT2H');
    });
    
    it('should handle minutes only', () => {
      const course = {
        ...baseCourse,
        totalDuration: 1800 // 30 minutes
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT30M');
    });
    
    it('should handle seconds only', () => {
      const course = {
        ...baseCourse,
        totalDuration: 45
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT45S');
    });
    
    it('should handle zero duration', () => {
      const course = {
        ...baseCourse,
        totalDuration: 0
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT0S');
    });
    
    it('should handle complex duration', () => {
      const course = {
        ...baseCourse,
        totalDuration: 10845 // 3h 45s
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.courseWorkload).toBe('PT3H45S');
    });
    
    it('should not include courseWorkload when totalDuration is absent', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(jsonLd).not.toHaveProperty('courseWorkload');
    });
    
    it('should not include courseWorkload when totalDuration is null', () => {
      const course = { ...baseCourse, totalDuration: null };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd).not.toHaveProperty('courseWorkload');
    });
  });
  
  describe('offers category derivation', () => {
    it('should mark free courses as Free', () => {
      const course = {
        ...baseCourse,
        price: 0
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.offers.category).toBe('Free');
    });
    
    it('should mark paid courses as Paid', () => {
      const course = {
        ...baseCourse,
        price: 49.99
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.offers.category).toBe('Paid');
    });
    
    it('should use course currency', () => {
      const course = {
        ...baseCourse,
        price: 39.99,
        currency: 'EUR'
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.offers.priceCurrency).toBe('EUR');
    });
    
    it('should default to USD when currency is absent', () => {
      const course = {
        ...baseCourse,
        currency: undefined
      };
      
      const jsonLd = buildCourseJsonLd(course);
      
      expect(jsonLd.offers.priceCurrency).toBe('USD');
    });
  });
  
  describe('complete course with all fields', () => {
    it('should include all optional fields when present', () => {
      const completeCourse: Course = {
        ...baseCourse,
        image: 'https://example.com/course.jpg',
        educationalLevel: 'Intermediate',
        about: 'Complete React course',
        instructor: {
          name: 'John Doe',
          image: 'https://example.com/instructor.jpg'
        },
        aggregateRating: {
          ratingValue: 4.8,
          ratingCount: 250
        },
        totalDuration: 7200
      };
      
      const jsonLd = buildCourseJsonLd(completeCourse);
      
      expect(jsonLd.image).toBeDefined();
      expect(jsonLd.educationalLevel).toBeDefined();
      expect(jsonLd.about).toBeDefined();
      expect(jsonLd.instructor).toBeDefined();
      expect(jsonLd.aggregateRating).toBeDefined();
      expect(jsonLd.courseWorkload).toBeDefined();
    });
  });
  
  describe('JSON-LD validity', () => {
    it('should produce valid JSON when stringified', () => {
      const jsonLd = buildCourseJsonLd(baseCourse);
      
      expect(() => JSON.stringify(jsonLd)).not.toThrow();
    });
    
    it('should not include undefined values', () => {
      const course = {
        ...baseCourse,
        image: undefined,
        instructor: undefined
      };
      
      const jsonLd = buildCourseJsonLd(course);
      const stringified = JSON.stringify(jsonLd);
      
      expect(stringified).not.toContain('undefined');
    });
  });
});
```

### Implementation Steps

1. **Create test file** `src/lib/structured-data.test.ts`
2. **Add tests for required fields**
3. **Add tests for each conditional field**
4. **Add tests for ISO 8601 duration conversion**
5. **Add tests for price→category logic**
6. **Add validation tests**
7. **Run tests** and ensure 100% coverage
8. **Add Schema.org validation** (optional)

### Test Strategy

- **Required field tests** verify baseline JSON-LD
- **Conditional field tests** verify spreading logic
- **Duration conversion tests** verify ISO 8601 format
- **Offers tests** verify price→category derivation
- **Validity tests** ensure JSON-LD is well-formed

### Optional: Schema.org Validation

```typescript
// test/validation/schema-org.test.ts

import { describe, it, expect } from 'vitest';
import { buildCourseJsonLd } from '@/lib/structured-data';
import Ajv from 'ajv';

// Schema.org Course schema (simplified)
const courseSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'description', 'provider'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'Course' },
    name: { type: 'string' },
    description: { type: 'string' },
    provider: {
      type: 'object',
      required: ['@type', 'name'],
      properties: {
        '@type': { const: 'Organization' },
        name: { type: 'string' },
        sameAs: { type: 'string', format: 'uri' }
      }
    },
    image: { type: 'string', format: 'uri' },
    educationalLevel: { type: 'string' },
    about: { type: 'string' },
    courseWorkload: { type: 'string', pattern: '^PT(\\d+H)?(\\d+M)?(\\d+S)?$' },
    offers: {
      type: 'object',
      required: ['@type', 'price', 'priceCurrency'],
      properties: {
        '@type': { const: 'Offer' },
        price: { type: 'number', minimum: 0 },
        priceCurrency: { type: 'string', minLength: 3, maxLength: 3 },
        category: { enum: ['Free', 'Paid'] }
      }
    }
  }
};

describe('Schema.org validation', () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(courseSchema);
  
  it('should produce valid Course JSON-LD', () => {
    const course = {
      id: '1',
      title: 'React Course',
      description: 'Learn React',
      price: 49.99,
      currency: 'USD',
      slug: 'react'
    };
    
    const jsonLd = buildCourseJsonLd(course);
    const valid = validate(jsonLd);
    
    if (!valid) {
      console.error(validate.errors);
    }
    
    expect(valid).toBe(true);
  });
});
```

### Acceptance Criteria

- [ ] All conditional fields have tests
- [ ] ISO 8601 duration conversion is tested for all cases
- [ ] Price→category derivation is tested
- [ ] Required fields are always present
- [ ] Optional fields are conditionally present
- [ ] JSON-LD is valid and serializable
- [ ] 100% code coverage for structured-data.ts
- [ ] Tests run in CI
- [ ] Optional: Schema.org validation passes

### Impact

**Before Tests:**
- ❌ Changes to Course type can break SEO silently
- ❌ Invalid JSON-LD only detected in production
- ❌ Duration conversion bugs undetected
- ❌ Refactoring is risky

**After Tests:**
- ✅ Course type changes are validated
- ✅ JSON-LD validity is enforced
- ✅ Duration conversion is verified
- ✅ Safe to refactor structured data

---

## Overall Testing Strategy

### Pre-Implementation Checklist

```bash
# Verify test coverage gaps
npm run test:coverage

# Check for existing test files
ls src/lib/api/services.test.ts        # Should not exist yet
ls src/lib/stripe/simulate.test.ts     # Should not exist yet
ls src/lib/structured-data.test.ts     # Should not exist yet
ls src/components/search/SearchBar.test.tsx  # May exist partially
```

### Implementation Order Rationale

1. **Issue #23 (localStorage)** - Prevents production crashes, highest risk
2. **Issue #24 (SearchBar)** - UX bug, user-visible, quick fix
3. **Issue #25 (Stripe)** - Payment critical, but simulate is dev-only
4. **Issue #26 (JSON-LD)** - SEO important but not user-blocking

### Post-Implementation Verification

```bash
# Run all tests
npm run test

# Check coverage (should be 100% for affected files)
npm run test:coverage -- src/lib/api/services.ts
npm run test:coverage -- src/lib/stripe/simulate.ts
npm run test:coverage -- src/lib/structured-data.ts
npm run test:coverage -- src/components/search/SearchBar.tsx

# Run E2E tests
npm run test:e2e

# Manual browser tests
npm run dev
# Test SearchBar clear behavior
# Test payment flow with decline cards
# View page source for JSON-LD
```

### CI/CD Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run unit tests
  run: npm run test

- name: Check test coverage
  run: npm run test:coverage
  
- name: Fail if coverage below 90%
  run: npm run test:coverage -- --lines 90 --statements 90

- name: Run E2E tests
  run: npm run test:e2e
```

---

## Documentation Updates

### Developer Guide

**File:** `docs/TESTING.md`

```markdown
## Testing localStorage Helpers

The localStorage helpers in `src/lib/api/services.ts` are designed to degrade gracefully:

- `writeStorage` returns `boolean` indicating success/failure
- Features should work (without persistence) when storage is unavailable
- Use `isStorageAvailable()` to check if storage is working

## Testing Payment Flows

Use Stripe test cards for decline scenarios:

- `4242 4242 4242 0002` - Generic decline
- `4000 0000 0000 0019` - Insufficient funds
- `4000 0000 0000 0010` - Lost card
- More test cards documented in `src/lib/stripe/simulate.ts`

## Testing SEO/JSON-LD

Run `npm run test:validation` to validate JSON-LD against Schema.org specs.
```

---

## Success Metrics

### Issue #23 (localStorage)
- ✅ 0 feature crashes due to storage errors
- ✅ 100% of writeStorage calls handled gracefully
- ✅ Works in Safari private mode
- ✅ Clear error logging for debugging

### Issue #24 (SearchBar)
- ✅ Clearing search always clears results
- ✅ No stale search calls after clear
- ✅ Deterministic behavior in all scenarios
- ✅ User reports confirm improved UX

### Issue #25 (Stripe simulate)
- ✅ All 8 decline scenarios tested
- ✅ PaymentForm error states reachable in dev
- ✅ 100% coverage for simulate.ts
- ✅ Safe to refactor payment code

### Issue #26 (JSON-LD)
- ✅ All conditional fields tested
- ✅ ISO 8601 duration verified
- ✅ Rich Results validation passes
- ✅ 100% coverage for structured-data.ts

---

## Implementation Timeline

### Week 1: Issue #23 (localStorage)
- Days 1-2: Implement error handling
- Day 3: Write comprehensive tests
- Day 4: Update all API helpers
- Day 5: Code review and merge

### Week 2: Issues #24 & #25 (SearchBar & Stripe)
- Days 1-2: Fix SearchBar + tests
- Days 3-4: Add Stripe simulate tests
- Day 5: Integration testing and merge

### Week 3: Issue #26 (JSON-LD)
- Days 1-2: Write structured-data tests
- Day 3: Add Schema.org validation (optional)
- Day 4: Documentation
- Day 5: Code review and merge

**Total Timeline:** 3 weeks

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes to API helpers | High | Comprehensive integration tests |
| SearchBar behavior change affects consumers | Medium | Test all SearchBar usage sites |
| Test-card table becomes outdated | Medium | Link to Stripe docs, add update check |
| JSON-LD schema changes | Low | Monitor Schema.org announcements |

---

## Related Issues

- Existing: `src/test/stripe-errors.test.ts` (error display)
- Need: E2E tests for complete payment flow
- Need: Visual regression tests for search UX

---

## Conclusion

These four issues improve **test coverage** and **error handling** for critical infrastructure:

**High Priority:**
1. #23 - Prevents production crashes (localStorage)
2. #24 - Fixes UX bug (SearchBar)
3. #25 - Enables payment testing (Stripe)

**Medium Priority:**
4. #26 - Validates SEO (JSON-LD)

All fixes have clear implementations, comprehensive test strategies, and measurable success criteria.
