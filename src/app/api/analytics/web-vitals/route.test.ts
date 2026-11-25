import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST /api/analytics/web-vitals', () => {
  it('returns a 2xx response for a valid payload', async () => {
    const body = {
      name: 'LCP',
      value: 1234.5,
      rating: 'good',
      id: 'v1-1234567890',
      navigationType: 'navigate',
    };

    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
  });

  it('returns a 400 response for a malformed JSON body', async () => {
    const request = new Request('http://localhost/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not valid json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
