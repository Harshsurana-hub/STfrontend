import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * The leaderboard page exposes a `role="tablist"` with three period tabs and an
 * error block with a Retry button, but neither the tab wiring nor the retry
 * handler had end-to-end coverage: a regression in either would only surface in
 * manual testing.
 *
 * These specs drive the real page against `e2e/mock-api-server.mjs`. The mock
 * serves a different entry set per period, so an assertion on a name proves the
 * page requested *that* period rather than re-rendering an old response, and it
 * can be told to fail the next request once so the error path is deterministic.
 */

const API_LEADERBOARD = '/api/v1/leaderboard';
const MOCK_ORIGIN = 'http://127.0.0.1:3000';

/** Arm or clear the mock's leaderboard failure switch. */
async function setLeaderboardFailure(page: Page, armed: boolean): Promise<void> {
  await page.request.get(`${MOCK_ORIGIN}/__control/leaderboard-fail?on=${armed ? '1' : '0'}`);
}

/** Collect leaderboard requests as the page makes them. */
function recordLeaderboardRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === API_LEADERBOARD) {
      requests.push(request);
    }
  });
  return requests;
}

/** The `period` query each recorded request asked for. */
function requestedPeriods(requests: Request[]): string[] {
  return requests.map((request) => new URL(request.url()).searchParams.get('period') ?? '');
}

test.describe('Leaderboard period tabs', () => {
  test('switches tabs, moves aria-selected, and requests the new period', async ({ page }) => {
    const requests = recordLeaderboardRequests(page);

    await page.goto('/leaderboard');

    const weekTab = page.getByRole('tab', { name: 'This Week' });
    const monthTab = page.getByRole('tab', { name: 'This Month' });
    const table = page.getByRole('table');

    // The page opens on the week view.
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(monthTab).toHaveAttribute('aria-selected', 'false');
    await expect(table.getByText('Ada Week')).toBeVisible();

    await monthTab.click();

    // Selection moves, and only one tab is selected at a time.
    await expect(monthTab).toHaveAttribute('aria-selected', 'true');
    await expect(weekTab).toHaveAttribute('aria-selected', 'false');

    // The month fixture turning up proves a request for the new period was
    // served, not merely a re-render of the week response.
    await expect(table.getByText('Ada Month')).toBeVisible();
    await expect(table.getByText('Ada Week')).toHaveCount(0);

    // The initial request and the switched one both went out, in that order.
    // React issues the mount fetch twice in dev (StrictMode), so compare the
    // period sequence by its ends rather than by exact call count.
    const periods = requestedPeriods(requests);
    expect(periods[0]).toBe('week');
    expect(periods[periods.length - 1]).toBe('month');
    expect(periods).not.toContain('');
  });

  test('requests the all-time period when that tab is chosen', async ({ page }) => {
    const requests = recordLeaderboardRequests(page);

    await page.goto('/leaderboard');
    await expect(page.getByRole('table').getByText('Ada Week')).toBeVisible();

    const allTab = page.getByRole('tab', { name: 'All Time' });
    await allTab.click();

    await expect(allTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('table').getByText('Ada Alltime')).toBeVisible();
    expect(requestedPeriods(requests).at(-1)).toBe('all');
  });
});

test.describe('Leaderboard error and retry', () => {
  test('shows the error block and Retry re-requests the same period', async ({ page }) => {
    // Fail every leaderboard request until the error block is up, so a second
    // in-flight request cannot quietly populate the table behind the error.
    await setLeaderboardFailure(page, true);

    const requests = recordLeaderboardRequests(page);

    await page.goto('/leaderboard');

    const errorText = page.getByText('Failed to load leaderboard. Please try again.');
    await expect(errorText).toBeVisible();

    // The table never rendered, so no entries leaked through on failure.
    await expect(page.getByRole('table')).toHaveCount(0);

    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    // Let the next request succeed, then retry.
    await setLeaderboardFailure(page, false);
    const before = requests.length;
    await retry.click();

    // The retry worked: the error block is gone and the week fixture is up.
    await expect(errorText).toHaveCount(0);
    await expect(page.getByRole('table').getByText('Ada Week')).toBeVisible();

    // Retry re-requested the period the failure happened on, rather than
    // falling back to a default or asking for a different one.
    const retryPeriods = requestedPeriods(requests.slice(before));
    expect(retryPeriods.length).toBeGreaterThan(0);
    expect(retryPeriods.every((period) => period === 'week')).toBe(true);

    await expect(page.getByRole('tab', { name: 'This Week' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('retry from a non-default period keeps that period selected', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.getByRole('table').getByText('Ada Week')).toBeVisible();

    await page.getByRole('tab', { name: 'This Month' }).click();
    await expect(page.getByRole('table').getByText('Ada Month')).toBeVisible();

    // Fail from here on: switching to All Time will fail, and so will anything
    // else until the retry, which is the request under test.
    await setLeaderboardFailure(page, true);

    const requests = recordLeaderboardRequests(page);

    await page.getByRole('tab', { name: 'All Time' }).click();
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    await setLeaderboardFailure(page, false);
    const before = requests.length;
    await retry.click();

    await expect(page.getByRole('table').getByText('Ada Alltime')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'All Time' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // The retry asked for the period that stays selected, not the default.
    const retryPeriods = requestedPeriods(requests.slice(before));
    expect(retryPeriods.length).toBeGreaterThan(0);
    expect(retryPeriods.every((period) => period === 'all')).toBe(true);
  });
});
