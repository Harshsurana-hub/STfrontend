import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECENTLY_VIEWED_KEY,
  RECENTLY_VIEWED_LIMIT,
  RECENTLY_VIEWED_MAX_AGE_MS,
  clearRecentlyViewed,
  getRecentlyViewed,
  recordRecentlyViewed,
  clearRecentlyViewed,
} from '@/lib/recently-viewed';

describe('recently viewed courses', () => {
  beforeEach(() => localStorage.clear());

  describe('pruning and storage rewrite', () => {
    it('prunes entries older than 30 days and rewrites storage without stale entries', () => {
      const now = Date.now();
      const freshEntry = { courseId: 'fresh-1', viewedAt: new Date(now - 1000).toISOString() };
      const staleEntry = {
        courseId: 'stale-1',
        viewedAt: new Date(now - RECENTLY_VIEWED_MAX_AGE_MS - 5000).toISOString(),
      };

      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([freshEntry, staleEntry]));

      const results = getRecentlyViewed(now);
      expect(results).toHaveLength(1);
      expect(results[0].courseId).toBe('fresh-1');

      // Assert storage was rewritten without the stale entry
      const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].courseId).toBe('fresh-1');
    });

    it('does not rewrite storage if no entries are expired or pruned', () => {
      const now = Date.now();
      const entries = [
        { courseId: 'c1', viewedAt: new Date(now - 1000).toISOString() },
        { courseId: 'c2', viewedAt: new Date(now - 2000).toISOString() },
      ];
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(entries));

      const results = getRecentlyViewed(now);
      expect(results).toHaveLength(2);

      const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) ?? '[]');
      expect(stored).toEqual(entries);
    });
  });

  describe('recording and de-duplication', () => {
    it('moves an existing course to the front without duplicating it', () => {
      const now = 10000;
      recordRecentlyViewed('course-1', now);
      recordRecentlyViewed('course-2', now + 1000);
      recordRecentlyViewed('course-3', now + 2000);

      // Re-record course-1
      recordRecentlyViewed('course-1', now + 3000);

      const entries = getRecentlyViewed(now + 3000);
      expect(entries).toHaveLength(3);
      expect(entries[0].courseId).toBe('course-1');
      expect(entries[1].courseId).toBe('course-3');
      expect(entries[2].courseId).toBe('course-2');

      const course1Occurrences = entries.filter((e) => e.courseId === 'course-1');
      expect(course1Occurrences).toHaveLength(1);
    });

    it('caps the list at RECENTLY_VIEWED_LIMIT (8)', () => {
      const now = 10000;
      for (let i = 0; i < RECENTLY_VIEWED_LIMIT + 5; i++) {
        recordRecentlyViewed(`course-${i}`, now + i * 100);
      }

      const entries = getRecentlyViewed(now + 20000);
      expect(entries).toHaveLength(RECENTLY_VIEWED_LIMIT);
      expect(entries[0].courseId).toBe(`course-${RECENTLY_VIEWED_LIMIT + 4}`);
    });
  });

  describe('defensive parsing of malformed storage', () => {
    it('returns an empty array without throwing when stored JSON is malformed', () => {
      localStorage.setItem(RECENTLY_VIEWED_KEY, '{not valid json');
      expect(() => getRecentlyViewed()).not.toThrow();
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns an empty array when stored JSON is not an array', () => {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify({ invalid: 'object' }));
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('filters out entries that lack required courseId or viewedAt string properties', () => {
      const now = Date.now();
      const mixed = [
        { courseId: 'valid-course', viewedAt: new Date(now).toISOString() },
        { courseId: 12345, viewedAt: new Date(now).toISOString() }, // invalid courseId
        { courseId: 'missing-viewed-at' }, // missing viewedAt
        null,
        'not-an-object',
      ];
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(mixed));

      const entries = getRecentlyViewed(now);
      expect(entries).toHaveLength(1);
      expect(entries[0].courseId).toBe('valid-course');
    });
  });

  describe('clearRecentlyViewed', () => {
    it('empties storage and returns empty array on subsequent read', () => {
      recordRecentlyViewed('course-1', 1000);
      recordRecentlyViewed('course-2', 2000);
      expect(getRecentlyViewed(3000)).toHaveLength(2);

      clearRecentlyViewed();

      expect(getRecentlyViewed(3000)).toEqual([]);
      expect(localStorage.getItem(RECENTLY_VIEWED_KEY)).toBe('[]');
    });
  });
});

describe('recently viewed courses: store rules', () => {
  beforeEach(() => localStorage.clear());

  it('moves a re-added course to the front without duplicating it', () => {
    recordRecentlyViewed('a', 1);
    recordRecentlyViewed('b', 2);
    recordRecentlyViewed('c', 3);
    recordRecentlyViewed('a', 4);

    expect(getRecentlyViewed(4).map(({ courseId }) => courseId)).toEqual(['a', 'c', 'b']);
  });

  it('caps the list at RECENTLY_VIEWED_LIMIT and drops the oldest entries', () => {
    for (let index = 0; index < RECENTLY_VIEWED_LIMIT + 3; index += 1) {
      recordRecentlyViewed(`course-${index}`, index);
    }

    const ids = getRecentlyViewed(RECENTLY_VIEWED_LIMIT + 3).map(({ courseId }) => courseId);
    expect(ids).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(ids).not.toContain('course-0');
    expect(ids).not.toContain('course-2');
    expect(ids).toContain('course-3');
  });

  it('returns the most recently viewed course first', () => {
    recordRecentlyViewed('older', 1);
    recordRecentlyViewed('newest', 2);

    expect(getRecentlyViewed(2)[0].courseId).toBe('newest');
  });

  it('empties the list when cleared', () => {
    recordRecentlyViewed('a', 1);
    recordRecentlyViewed('b', 2);
    clearRecentlyViewed();

    expect(getRecentlyViewed(2)).toEqual([]);
    expect(JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) ?? 'null')).toEqual([]);
  });
});
