import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createQueryClient, queryClient } from './query-client';

describe('createQueryClient defaults', () => {
  const { queries, mutations } = createQueryClient().getDefaultOptions();

  it('caches queries for 5 minutes and garbage-collects after 10', () => {
    expect(queries?.staleTime).toBe(5 * 60 * 1000);
    expect(queries?.gcTime).toBe(10 * 60 * 1000);
  });

  it('retries queries and mutations once', () => {
    expect(queries?.retry).toBe(1);
    expect(mutations?.retry).toBe(1);
  });

  it('backs off exponentially and caps the retry delay at 30 s', () => {
    const retryDelay = queries?.retryDelay as (attemptIndex: number) => number;
    expect(typeof retryDelay).toBe('function');
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(5)).toBe(30000);
  });
});

describe('queryClient singleton', () => {
  it('is a QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });
});
