import { createServer } from 'node:http';

const port = Number(process.env.MOCK_API_PORT ?? 3000);

const course = {
  id: 'course-react-fundamentals',
  title: 'React Fundamentals for Beginners',
  slug: 'react-fundamentals',
  description: 'Learn the fundamentals of building interfaces with React.',
  category: 'Web Development',
  level: 'BEGINNER',
  language: 'English',
  thumbnailUrl: null,
  previewVideoUrl: null,
  price: 49.99,
  originalPrice: 99.99,
  platformFeePercent: 10,
  status: 'ACTIVE',
  totalLessons: 12,
  totalDuration: 3600,
  totalEnrollments: 100,
  totalRevenue: 0,
  txHash: null,
  approvedAt: null,
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  instructor: {
    name: 'Sarah Chen',
    stellarAddress: 'GTESTINSTRUCTOR',
    avatarUrl: null,
  },
  modules: [],
  _count: { enrollments: 100 },
};

const courses = [course];
const categories = [{ name: 'Web Development', count: courses.length }];

// ── Leaderboard fixture ────────────────────────────────────────────────────
// One entry set per period, so a spec can tell a re-request for the new period
// apart from a re-render of the old one. `currentUser` stays null: the page
// falls back to the auth store, which an unauthenticated E2E run leaves empty.
const leaderboardByPeriod = {
  week: [
    { rank: 1, userId: 'u-week-1', name: 'Ada Week', avatarUrl: null, coursesCompleted: 7, hoursLearned: 21, streakDays: 9 },
    { rank: 2, userId: 'u-week-2', name: 'Bo Week', avatarUrl: null, coursesCompleted: 5, hoursLearned: 14, streakDays: 4 },
    { rank: 3, userId: 'u-week-3', name: 'Cy Week', avatarUrl: null, coursesCompleted: 3, hoursLearned: 8, streakDays: 2 },
  ],
  month: [
    { rank: 1, userId: 'u-month-1', name: 'Ada Month', avatarUrl: null, coursesCompleted: 19, hoursLearned: 54, streakDays: 21 },
    { rank: 2, userId: 'u-month-2', name: 'Bo Month', avatarUrl: null, coursesCompleted: 17, hoursLearned: 48, streakDays: 12 },
    { rank: 3, userId: 'u-month-3', name: 'Cy Month', avatarUrl: null, coursesCompleted: 11, hoursLearned: 31, streakDays: 6 },
  ],
  all: [
    { rank: 1, userId: 'u-all-1', name: 'Ada Alltime', avatarUrl: null, coursesCompleted: 88, hoursLearned: 240, streakDays: 60 },
    { rank: 2, userId: 'u-all-2', name: 'Bo Alltime', avatarUrl: null, coursesCompleted: 71, hoursLearned: 199, streakDays: 41 },
    { rank: 3, userId: 'u-all-3', name: 'Cy Alltime', avatarUrl: null, coursesCompleted: 52, hoursLearned: 151, streakDays: 18 },
  ],
};

/**
 * While true, every leaderboard request fails. The spec arms it before loading
 * the page and clears it once the error block is on screen, so the retry is the
 * first request that can succeed.
 *
 * A single-shot flag is not enough here: React StrictMode double-invokes effects
 * in dev, so the page issues two requests on mount. Failing only the first would
 * let the second populate data, leaving the page in a state that is neither the
 * error path nor the happy path.
 */
let leaderboardFailureArmed = false;

function respond(response, data, status = 200) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Retry-Count',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(data));
}

const server = createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Retry-Count',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    });
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  const { pathname } = url;

  if (pathname === '/health') {
    respond(response, { status: 'ok' });
    return;
  }

  if (pathname === '/api/v1/courses/categories') {
    respond(response, { success: true, data: categories });
    return;
  }

  // Test control: arm or clear failure for the leaderboard endpoint. The spec
  // arms before loading the page and clears once the error block is visible, so
  // the retry is the first request that can succeed.
  if (pathname === '/__control/leaderboard-fail') {
    leaderboardFailureArmed = url.searchParams.get('on') !== '0';
    respond(response, { armed: leaderboardFailureArmed });
    return;
  }

  if (pathname === '/api/v1/leaderboard') {
    if (leaderboardFailureArmed) {
      respond(response, { success: false, message: 'Leaderboard is unavailable' }, 500);
      return;
    }

    const period = url.searchParams.get('period') ?? 'week';
    const entries = leaderboardByPeriod[period] ?? leaderboardByPeriod.week;

    respond(response, {
      success: true,
      // Echo the served period so a spec can assert which period it received.
      data: { entries, currentUser: null, period },
    });
    return;
  }

  if (pathname === '/api/v1/courses') {
    const search = url.searchParams.get('search')?.toLowerCase();
    const category = url.searchParams.get('category');
    const matchingCourses = courses.filter(
      (item) =>
        (!search || item.title.toLowerCase().includes(search)) &&
        (!category || item.category === category),
    );
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 8);

    respond(response, {
      success: true,
      data: {
        data: matchingCourses.slice((page - 1) * limit, page * limit),
        meta: {
          total: matchingCourses.length,
          page,
          limit,
          totalPages: Math.ceil(matchingCourses.length / limit),
        },
      },
    });
    return;
  }

  const courseId = pathname.match(/^\/api\/v1\/courses\/([^/]+)$/)?.[1];
  if (courseId) {
    const matchingCourse = courses.find(
      (item) => item.id === courseId || item.slug === courseId,
    );
    respond(
      response,
      matchingCourse
        ? { success: true, data: matchingCourse }
        : { success: false, message: 'Course not found' },
      matchingCourse ? 200 : 404,
    );
    return;
  }

  respond(response, { success: true, data: [] });
});

server.listen(port, '127.0.0.1');
