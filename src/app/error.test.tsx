import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Error from './error';

describe('Error boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the status text and logs the error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();

    render(<Error error={new Error('boom')} reset={reset} />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('calls reset exactly once when Try again is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<Error error={new Error('boom')} reset={reset} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('links to the homepage and contact page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Error error={new Error('boom')} reset={vi.fn()} />);

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
  });

  it('renders the digest in the status badge', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });

    render(<Error error={error} reset={vi.fn()} />);

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});
