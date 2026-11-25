import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockApiServer } from './mock-api-server.mjs';

let server;
let baseUrl;

beforeAll(async () => {
  server = createMockApiServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() };
}

describe('mock API server', () => {
  it('responds to the health check', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });

  it('returns course categories', async () => {
    const { status, body } = await get('/api/v1/courses/categories');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ name: 'Web Development', count: 1 }]);
  });

  it('filters courses by search term', async () => {
    const { status, body } = await get('/api/v1/courses?search=react');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].id).toBe('course-react-fundamentals');
    expect(body.data.meta.total).toBe(1);
  });

  it('returns an empty data array for a non-matching search', async () => {
    const { status, body } = await get('/api/v1/courses?search=zzz');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toEqual([]);
    expect(body.data.meta.total).toBe(0);
  });

  it('filters courses by category', async () => {
    const matching = await get('/api/v1/courses?category=Web%20Development');
    expect(matching.body.data.data).toHaveLength(1);

    const nonMatching = await get('/api/v1/courses?category=Design');
    expect(nonMatching.body.data.data).toEqual([]);
  });

  it('paginates courses and reports meta', async () => {
    const first = await get('/api/v1/courses?page=1&limit=1');
    expect(first.body.data.data).toHaveLength(1);
    expect(first.body.data.meta).toEqual({
      total: 1,
      page: 1,
      limit: 1,
      totalPages: 1,
    });

    const second = await get('/api/v1/courses?page=2&limit=1');
    expect(second.body.data.data).toEqual([]);
    expect(second.body.data.meta.totalPages).toBe(1);
  });

  it('returns a known course by id', async () => {
    const { status, body } = await get('/api/v1/courses/course-react-fundamentals');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('course-react-fundamentals');
  });

  it('returns 404 for an unknown course id', async () => {
    const { status, body } = await get('/api/v1/courses/unknown-id');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});
