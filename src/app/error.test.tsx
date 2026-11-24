import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Error from './error';

describe('Error boundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs the error exactly once for a given error object across a re-render', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    const reset = vi.fn();

    const { rerender } = render(<Error error={error} reset={reset} />);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    rerender(<Error error={error} reset={reset} />);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the digest badge when a digest is present', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    render(<Error error={error} reset={vi.fn()} />);
    expect(screen.getByText(/ID: abc123/)).toBeInTheDocument();
  });

  it('renders the no-digest badge when no digest is present', () => {
    const error = new Error('boom');
    render(<Error error={error} reset={vi.fn()} />);
    expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
  });
});
