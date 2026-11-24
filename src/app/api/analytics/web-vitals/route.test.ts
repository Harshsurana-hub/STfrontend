import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';

describe('POST /api/analytics/web-vitals', () => {
  it('returns 400 when body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: 'invalid-json{',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON payload');
  });

  it('returns 400 when metric name is not one of CORE_WEB_VITALS', async () => {
    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TTFB',
        value: 120,
        rating: 'good',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when rating is unknown', async () => {
    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: 'LCP',
        value: 2000,
        rating: 'excellent',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when value is non-finite or not a number', async () => {
    const requestNonFinite = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: 'LCP',
        value: null,
        rating: 'good',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res1 = await POST(requestNonFinite);
    expect(res1.status).toBe(400);

    const requestString = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: 'LCP',
        value: 'fast',
        rating: 'good',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res2 = await POST(requestString);
    expect(res2.status).toBe(400);
  });

  it('returns 2xx when payload is valid', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const validPayload = {
      name: 'LCP',
      value: 1800,
      rating: 'good',
      path: '/courses/learn',
      timestamp: 1711000000000,
    };

    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.received).toEqual(validPayload);

    consoleSpy.mockRestore();
  });
});
