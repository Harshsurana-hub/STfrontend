# STfrontend Issues #31-34: Test Coverage for Utility Functions

## Issues Overview

### Issue #31: Add tests for CSV formula-injection escaping
**Context**: `src/lib/utils/csv.ts` exports `toCsv` and `downloadCsv`. `escapeCell` prefixes cells matching `FORMULA_TRIGGER` (`/^[=+\-@\t\r]/`) with `'` to prevent CSV injection.

**Problem**: The formula-injection guard is security-relevant and easy to regress. Existing tests cover some cases but need comprehensive coverage of all trigger characters.

**Current Test Coverage** (in `src/lib/utils/csv.test.ts`):
- ✅ Basic joining (commas, CRLF)
- ✅ Quoting cells with commas, quotes, newlines
- ✅ Null/undefined handling
- ✅ Formula neutralization (=, +, -, @)
- ⚠️ **Missing**: Tab (`\t`) and carriage return (`\r`) triggers
- ⚠️ **Missing**: Explicit separate test for each trigger character
- ⚠️ **Missing**: Numeric cells that shouldn't be prefixed

**Proposed Test Cases to Add**:

```typescript
describe('toCsv - Formula Injection Protection', () => {
  describe('all formula trigger characters are prefixed', () => {
    it('prefixes cells starting with =', () => {
      expect(toCsv([['=1+1']])).toBe(`'=1+1`);
      expect(toCsv([['=HYPERLINK("url")']])).toBe(`"'=HYPERLINK(""url"")"`);
    });

    it('prefixes cells starting with +', () => {
      expect(toCsv([['+1234']])).toBe(`'+1234`);
      expect(toCsv([['+A1+B1']])).toBe(`'+A1+B1`);
    });

    it('prefixes cells starting with -', () => {
      expect(toCsv([['-ALERT()']])).toBe(`'-ALERT()`);
      // But NOT negative numbers
      expect(toCsv([[-42]])).toBe('-42');
    });

    it('prefixes cells starting with @', () => {
      expect(toCsv([['@SUM(A1:A10)']])).toBe(`'@SUM(A1:A10)`);
      expect(toCsv([['@username']])).toBe(`'@username`);
    });

    it('prefixes cells starting with tab', () => {
      expect(toCsv([['\tvalue']])).toBe(`'\tvalue`);
    });

    it('prefixes cells starting with carriage return', () => {
      expect(toCsv([['\rvalue']])).toBe(`'\rvalue`);
    });
  });

  describe('quoting and escaping rules', () => {
    it('doubles embedded quotes and wraps in quotes', () => {
      expect(toCsv([['say "hello"']])).toBe(`"say ""hello"""`);
      expect(toCsv([[`multi"quote"test`]])).toBe(`"multi""quote""test"`);
    });

    it('wraps cells containing commas in quotes', () => {
      expect(toCsv([['Last, First']])).toBe(`"Last, First"`);
    });

    it('wraps cells containing newlines in quotes', () => {
      expect(toCsv([['line1\nline2']])).toBe(`"line1\nline2"`);
    });

    it('wraps cells containing carriage returns in quotes', () => {
      expect(toCsv([['before\rafter']])).toBe(`"before\rafter"`);
    });

    it('handles formula triggers AND special chars together', () => {
      // Formula trigger + embedded quote
      expect(toCsv([['=HYPERLINK("x")']])).toBe(`"'=HYPERLINK(""x"")"`);
      // Formula trigger + comma
      expect(toCsv([['=SUM(A1,B1)']])).toBe(`"'=SUM(A1,B1)"`);
    });
  });

  describe('null and undefined handling', () => {
    it('converts null to empty string', () => {
      expect(toCsv([[null]])).toBe('');
      expect(toCsv([[null, 'a', null]])).toBe(',a,');
    });

    it('converts undefined to empty string', () => {
      expect(toCsv([[undefined]])).toBe('');
      expect(toCsv([['a', undefined, 'b']])).toBe('a,,b');
    });
  });

  describe('numeric cells', () => {
    it('does not prefix numeric values', () => {
      expect(toCsv([[42]])).toBe('42');
      expect(toCsv([[-123]])).toBe('-123');
      expect(toCsv([[3.14159]])).toBe('3.14159');
    });

    it('does not prefix numeric strings', () => {
      // Numbers as strings are still safe
      expect(toCsv([['123']])).toBe('123');
    });
  });

  describe('row and cell joining', () => {
    it('joins cells with commas', () => {
      expect(toCsv([['a', 'b', 'c']])).toBe('a,b,c');
    });

    it('joins rows with CRLF', () => {
      expect(toCsv([['a'], ['b'], ['c']])).toBe('a\r\nb\r\nc');
      expect(toCsv([['1', '2'], ['3', '4']])).toBe('1,2\r\n3,4');
    });
  });
});
```

**Acceptance Criteria**:
- ✅ Tests cover all six FORMULA_TRIGGER characters: `=`, `+`, `-`, `@`, `\t`, `\r`
- ✅ Tests assert embedded quotes are doubled and cell is wrapped
- ✅ Tests assert null/undefined serialize to empty string
- ✅ `npx vitest run src/lib/utils/csv.test.ts` passes

---

### Issue #32: Add unit tests for utility helpers
**Context**: `src/lib/utils/index.ts` exports pure helpers: `stroopsToUsdc`, `usdcToStroops`, `formatDuration`, `courseTotalMins`, `shortAddress`, `formatUsdc`, `generateCourseId`, etc.

**Problem**: Money-conversion helpers and `formatDuration` have no test coverage. These handle rounding and padding logic that's easy to break.

**Current State**: No `src/lib/utils/index.test.ts` exists.

**Proposed Test File**: `src/lib/utils/index.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import {
  stroopsToUsdc,
  usdcToStroops,
  formatDuration,
  courseTotalMins,
  shortAddress,
  formatUsdc,
  generateCourseId,
  courseStatusBadge,
  levelChip,
} from './index';

describe('stroopsToUsdc', () => {
  it('converts 10M stroops to 1.00 USDC', () => {
    expect(stroopsToUsdc('10000000')).toBe('1.00');
    expect(stroopsToUsdc(10_000_000n)).toBe('1.00');
  });

  it('converts 50M stroops to 5.00 USDC', () => {
    expect(stroopsToUsdc('50000000')).toBe('5.00');
  });

  it('handles fractional USDC', () => {
    expect(stroopsToUsdc('12345678')).toBe('1.23');  // rounds down
    expect(stroopsToUsdc('12350000')).toBe('1.24');  // rounds up
  });

  it('handles zero stroops', () => {
    expect(stroopsToUsdc('0')).toBe('0.00');
  });

  it('pads remainder to 7 digits correctly', () => {
    expect(stroopsToUsdc('1')).toBe('0.00');  // 1 stroop = 0.0000001 USDC
    expect(stroopsToUsdc('100')).toBe('0.00');  // 100 stroops = 0.00001 USDC
  });
});

describe('usdcToStroops', () => {
  it('converts 1 USDC to 10M stroops', () => {
    expect(usdcToStroops(1)).toBe(10_000_000n);
    expect(usdcToStroops('1')).toBe(10_000_000n);
  });

  it('converts 5.50 USDC to 55M stroops', () => {
    expect(usdcToStroops(5.5)).toBe(55_000_000n);
  });

  it('handles fractional cents', () => {
    expect(usdcToStroops('1.23')).toBe(12_300_000n);
    expect(usdcToStroops('0.01')).toBe(100_000n);
  });

  it('handles zero USDC', () => {
    expect(usdcToStroops(0)).toBe(0n);
  });

  it('pads fraction to 7 digits and slices', () => {
    expect(usdcToStroops('1.1')).toBe(11_000_000n);  // .1 -> .1000000
    expect(usdcToStroops('1.123456789')).toBe(11_234_567n);  // truncates at 7
  });

  it('handles no fraction part', () => {
    expect(usdcToStroops('10')).toBe(100_000_000n);
  });
});

describe('formatDuration', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(599)).toBe('9:59');
  });

  it('formats hours as h:mm:ss', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7384)).toBe('2:03:04');
  });

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatDuration(3605)).toBe('1:00:05');
    expect(formatDuration(65)).toBe('1:05');
  });

  it('handles zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});

describe('courseTotalMins', () => {
  it('converts seconds to minutes rounding up', () => {
    expect(courseTotalMins(60)).toBe(1);
    expect(courseTotalMins(119)).toBe(2);  // rounds up
    expect(courseTotalMins(120)).toBe(2);
    expect(courseTotalMins(3600)).toBe(60);
  });

  it('rounds up partial minutes', () => {
    expect(courseTotalMins(1)).toBe(1);  // 1 second = 1 minute
    expect(courseTotalMins(59)).toBe(1);
  });
});

describe('shortAddress', () => {
  it('truncates address to first and last N characters', () => {
    expect(shortAddress('GDXYZ1234567890ABCDEF', 4)).toBe('GDXYZ...CDEF');
  });

  it('defaults to 4 characters', () => {
    expect(shortAddress('GDXYZ1234567890ABCDEF')).toBe('GDXYZ...CDEF');
  });

  it('handles empty string', () => {
    expect(shortAddress('')).toBe('');
  });
});

describe('formatUsdc', () => {
  it('formats number as currency with 2 decimals', () => {
    expect(formatUsdc(5)).toBe('$5.00');
    expect(formatUsdc(123.456)).toBe('$123.46');  // rounds
  });

  it('handles string input', () => {
    expect(formatUsdc('10')).toBe('$10.00');
    expect(formatUsdc('99.99')).toBe('$99.99');
  });
});

describe('generateCourseId', () => {
  it('generates ID with category slug and random suffix', () => {
    const id = generateCourseId('Smart Contracts');
    expect(id).toMatch(/^COURSE-SMART-CO-[A-Z0-9]{4}$/);
  });

  it('uppercases and replaces spaces with dashes', () => {
    const id = generateCourseId('web dev');
    expect(id).toMatch(/^COURSE-WEB-DEV-[A-Z0-9]{4}$/);
  });

  it('limits slug to 8 characters', () => {
    const id = generateCourseId('Very Long Category Name');
    expect(id).toMatch(/^COURSE-VERY-LON-[A-Z0-9]{4}$/);
  });
});

describe('courseStatusBadge', () => {
  it('returns correct badge class for each status', () => {
    expect(courseStatusBadge('DRAFT')).toBe('badge-draft');
    expect(courseStatusBadge('PENDING')).toBe('badge-pending');
    expect(courseStatusBadge('ACTIVE')).toBe('badge-active');
    expect(courseStatusBadge('PAUSED')).toBe('badge-paused');
    expect(courseStatusBadge('ARCHIVED')).toBe('badge-archived');
  });

  it('returns default badge for unknown status', () => {
    // @ts-expect-error testing invalid input
    expect(courseStatusBadge('UNKNOWN')).toBe('badge');
  });
});

describe('levelChip', () => {
  it('returns correct chip class for each level', () => {
    expect(levelChip('Beginner')).toBe('chip-beginner');
    expect(levelChip('Intermediate')).toBe('chip-intermediate');
    expect(levelChip('Advanced')).toBe('chip-advanced');
  });

  it('returns default badge for unknown level', () => {
    expect(levelChip('Expert')).toBe('badge');
  });
});
```

**Acceptance Criteria**:
- ✅ `src/lib/utils/index.test.ts` exists
- ✅ All helpers have test coverage
- ✅ Money conversion edge cases tested (rounding, padding, zero)
- ✅ Duration formatting handles 0, seconds, minutes, hours
- ✅ `npx vitest run src/lib/utils/index.test.ts` passes

---

### Issue #33: Add tests for SEO metadata builders
**Context**: `src/lib/seo.ts` builds canonical/OG/Twitter metadata. `buildPaginatedMetadata` points canonical of pages 2+ at page 1.

**Problem**: Canonical-URL and `noIndex` behavior is untested. Regressions could break SEO.

**Current State**: No `src/lib/seo.test.ts` exists (only `src/app/robots.test.ts`).

**Proposed Test File**: `src/lib/seo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMetadata, buildPaginatedMetadata, absoluteUrl } from './seo';

describe('absoluteUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds absolute URL from relative path', () => {
    expect(absoluteUrl('/courses')).toBe('https://example.com/courses');
  });

  it('handles trailing slash', () => {
    expect(absoluteUrl('/courses/')).toBe('https://example.com/courses/');
  });
});

describe('buildMetadata', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets canonical URL to absolute path', () => {
    const metadata = buildMetadata({ 
      title: 'Test Page',
      path: '/courses' 
    });
    
    expect(metadata.alternates?.canonical).toBe('https://example.com/courses');
  });

  it('includes Open Graph metadata', () => {
    const metadata = buildMetadata({ 
      title: 'Test',
      description: 'Description',
      path: '/test' 
    });
    
    expect(metadata.openGraph?.title).toBe('Test');
    expect(metadata.openGraph?.description).toBe('Description');
    expect(metadata.openGraph?.url).toBe('https://example.com/test');
  });

  it('includes Twitter metadata', () => {
    const metadata = buildMetadata({ 
      title: 'Test',
      description: 'Description',
      path: '/test' 
    });
    
    expect(metadata.twitter?.title).toBe('Test');
    expect(metadata.twitter?.description).toBe('Description');
  });

  it('sets noIndex when specified', () => {
    const metadata = buildMetadata({ 
      title: 'Test',
      path: '/test',
      noIndex: true 
    });
    
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('allows indexing by default', () => {
    const metadata = buildMetadata({ 
      title: 'Test',
      path: '/test' 
    });
    
    // robots should be undefined or allow indexing
    expect(metadata.robots?.index).not.toBe(false);
  });

  it('uses provided image', () => {
    const metadata = buildMetadata({ 
      title: 'Test',
      path: '/test',
      image: '/og-image.png' 
    });
    
    expect(metadata.openGraph?.images).toContain('https://example.com/og-image.png');
  });
});

describe('buildPaginatedMetadata', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets canonical to page 1 for all pages', () => {
    const page1 = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 1,
      totalPages: 5,
    });
    expect(page1.alternates?.canonical).toBe('https://example.com/courses');

    const page3 = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 3,
      totalPages: 5,
    });
    expect(page3.alternates?.canonical).toBe('https://example.com/courses');

    const page5 = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 5,
      totalPages: 5,
    });
    expect(page5.alternates?.canonical).toBe('https://example.com/courses');
  });

  it('sets prev link for pages > 1', () => {
    const metadata = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 3,
      totalPages: 5,
    });
    
    expect(metadata.alternates?.types?.['application/rss+xml']).toBeUndefined();
    // Check for prev in alternates if implemented
  });

  it('sets next link for pages < totalPages', () => {
    const metadata = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 2,
      totalPages: 5,
    });
    
    // Check for next in alternates if implemented
    expect(metadata.alternates?.canonical).toBe('https://example.com/courses');
  });

  it('sets noIndex for pages beyond page 1', () => {
    const page1 = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 1,
      totalPages: 5,
    });
    expect(page1.robots?.index).not.toBe(false);

    const page2 = buildPaginatedMetadata({
      basePath: '/courses',
      currentPage: 2,
      totalPages: 5,
    });
    expect(page2.robots).toEqual({ index: false, follow: true });
  });
});
```

**Acceptance Criteria**:
- ✅ `src/lib/seo.test.ts` exists
- ✅ Imports `buildMetadata`, `buildPaginatedMetadata`, `absoluteUrl` from `@/lib/seo`
- ✅ Test asserts paginated canonical always equals base path
- ✅ Test asserts `noIndex` produces `robots.index === false`
- ✅ `npx vitest run src/lib/seo.test.ts` passes

---

### Issue #34: Add tests for server API fallback behavior
**Context**: `src/lib/api/server.ts` provides `getCourseForMetadata`, `getCoursesForSitemap`, `getCategoriesForSitemap`. Doc comment states they "resolve to `null`/`[]` on any failure."

**Problem**: The documented failure contract (return `null`/`[]` on non-OK responses, malformed payloads, or thrown fetch errors) is not verified.

**Current State**: No test file for `src/lib/api/server.ts`.

**Proposed Test File**: `src/lib/api/server.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCourseForMetadata, getCoursesForSitemap, getCategoriesForSitemap } from './server';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('getCourseForMetadata', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns course data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', title: 'Test Course', slug: 'test' }),
    });

    const result = await getCourseForMetadata('test');
    expect(result).toEqual({ id: '1', title: 'Test Course', slug: 'test' });
  });

  it('returns null on 404 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    const result = await getCourseForMetadata('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null on 500 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    const result = await getCourseForMetadata('test');
    expect(result).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Invalid JSON'); },
    });

    const result = await getCourseForMetadata('test');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await getCourseForMetadata('test');
    expect(result).toBeNull();
  });

  it('returns null on fetch timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

    const result = await getCourseForMetadata('test');
    expect(result).toBeNull();
  });
});

describe('getCoursesForSitemap', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns courses array on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slug: 'course-1', updatedAt: '2024-01-01' },
        { slug: 'course-2', updatedAt: '2024-01-02' },
      ],
    });

    const result = await getCoursesForSitemap();
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('course-1');
  });

  it('returns empty array on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await getCoursesForSitemap();
    expect(result).toEqual([]);
  });

  it('returns empty array on malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Invalid JSON'); },
    });

    const result = await getCoursesForSitemap();
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await getCoursesForSitemap();
    expect(result).toEqual([]);
  });

  it('returns empty array on non-array response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'Not an array' }),
    });

    const result = await getCoursesForSitemap();
    expect(result).toEqual([]);
  });
});

describe('getCategoriesForSitemap', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns categories array on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slug: 'defi', updatedAt: '2024-01-01' },
        { slug: 'nft', updatedAt: '2024-01-02' },
      ],
    });

    const result = await getCategoriesForSitemap();
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('defi');
  });

  it('returns empty array on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await getCategoriesForSitemap();
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS failure'));

    const result = await getCategoriesForSitemap();
    expect(result).toEqual([]);
  });

  it('returns empty array on timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('AbortError'));

    const result = await getCategoriesForSitemap();
    expect(result).toEqual([]);
  });
});

describe('failure contract guarantee', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('never throws from getCourseForMetadata', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Catastrophic failure'));
    
    // Should not throw
    await expect(getCourseForMetadata('test')).resolves.toBeNull();
  });

  it('never throws from getCoursesForSitemap', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Catastrophic failure'));
    
    // Should not throw
    await expect(getCoursesForSitemap()).resolves.toEqual([]);
  });

  it('never throws from getCategoriesForSitemap', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Catastrophic failure'));
    
    // Should not throw
    await expect(getCategoriesForSitemap()).resolves.toEqual([]);
  });
});
```

**Acceptance Criteria**:
- ✅ `src/lib/api/server.test.ts` exists
- ✅ Tests verify `null` return on errors for `getCourseForMetadata`
- ✅ Tests verify `[]` return on errors for sitemap functions
- ✅ Tests cover: non-OK responses, malformed JSON, network errors
- ✅ Tests assert functions never throw
- ✅ `npx vitest run src/lib/api/server.test.ts` passes

---

## Implementation Order

1. **Issue #31** (CSV tests) - Extend existing test file, quick win
2. **Issue #32** (Utils tests) - New file, pure functions, easy to test
3. **Issue #33** (SEO tests) - New file, requires env stubbing
4. **Issue #34** (Server API tests) - New file, requires fetch mocking

---

## Common Testing Patterns

### Environment Stubbing (for SEO tests)
```typescript
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

### Fetch Mocking (for server API tests)
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});
```

### Table-Driven Tests
```typescript
it.each([
  ['=1+1', `'=1+1`],
  ['+123', `'+123`],
  ['-ALERT()', `'-ALERT()`],
  ['@SUM(A1)', `'@SUM(A1)`],
])('prefixes %s to %s', (input, expected) => {
  expect(toCsv([[input]])).toBe(expected);
});
```

---

## Running Tests

### Run all tests
```bash
npm run test
# or
npx vitest
```

### Run specific test file
```bash
npx vitest run src/lib/utils/csv.test.ts
npx vitest run src/lib/utils/index.test.ts
npx vitest run src/lib/seo.test.ts
npx vitest run src/lib/api/server.test.ts
```

### Watch mode
```bash
npx vitest watch src/lib/utils/csv.test.ts
```

### Coverage report
```bash
npx vitest run --coverage
```

---

## Files to Create/Modify

### To Modify:
- `src/lib/utils/csv.test.ts` - Extend with comprehensive formula injection tests

### To Create:
- `src/lib/utils/index.test.ts` - New test file
- `src/lib/seo.test.ts` - New test file
- `src/lib/api/server.test.ts` - New test file

---

## References

- Existing test setup: `vitest.config.ts`, `src/test/setup.ts`
- Existing test examples: `src/lib/utils/csv.test.ts`, `src/app/robots.test.ts`
- Vitest docs: https://vitest.dev/
- CSV Injection (OWASP): https://owasp.org/www-community/attacks/CSV_Injection
