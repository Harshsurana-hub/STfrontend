import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, isPublicPath } from './middleware';

function makeRequest(pathname: string, token?: string): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  const request = new NextRequest(url);
  if (token) request.cookies.set('sorobanlard_token', token);
  return request;
}

const PUBLIC_ROUTES = ['/', '/courses', '/courses/abc', '/certificates/abc'];

const PROTECTED_ROUTES = ['/dashboard', '/notifications'];

describe('middleware public-path matcher', () => {
  it.each(PUBLIC_ROUTES)('does not redirect unauthenticated %s', (pathname) => {
    const response = middleware(makeRequest(pathname));
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(PROTECTED_ROUTES)('redirects unauthenticated %s to login', (pathname) => {
    const response = middleware(makeRequest(pathname));
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    expect(location).toContain('/login');
  });

  it('redirects /dashboard with a callbackUrl', () => {
    const response = middleware(makeRequest('/dashboard'));
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('callbackUrl=%2Fdashboard');
  });

  it('allows authenticated users through to /dashboard', () => {
    const response = middleware(makeRequest('/dashboard', 'valid-token'));
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('isPublicPath', () => {
  it.each(PUBLIC_ROUTES.filter((p) => p !== '/'))('treats %s as public', (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it('does not treat /courses-admin as public', () => {
    expect(isPublicPath('/courses-admin')).toBe(false);
  });
});
