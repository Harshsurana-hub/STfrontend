import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Footer } from './Footer';
import { newsletterApi } from '@/lib/api/services';

vi.mock('@/lib/api/services', () => ({
  newsletterApi: {
    subscribe: vi.fn(),
  },
}));

describe('Footer newsletter form', () => {
  beforeEach(() => {
    vi.mocked(newsletterApi.subscribe).mockReset();
  });

  it('renders the success status when the subscribe call resolves', async () => {
    const user = userEvent.setup();
    vi.mocked(newsletterApi.subscribe).mockResolvedValue({ subscribed: true });
    render(<Footer />);

    await user.type(screen.getByLabelText(/email address/i), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/thanks for subscribing/i);
    expect(newsletterApi.subscribe).toHaveBeenCalledWith('learner@example.com');
  });

  it('renders the server error alert when the subscribe call rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(newsletterApi.subscribe).mockRejectedValue(new Error('Server error'));
    const { container } = render(<Footer />);

    await user.type(screen.getByLabelText(/email address/i), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(container.querySelector('#nl-server-error')).toBeInTheDocument();
    });
    const alert = container.querySelector('#nl-server-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not call the service for an invalid email', async () => {
    const user = userEvent.setup();
    render(<Footer />);

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(newsletterApi.subscribe).not.toHaveBeenCalled();
  });
});
