import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeachPage from '../page';
import { ToastProvider } from '@/components/ui/ToastProvider';

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}));

const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/Full Name \*/i), {
    target: { value: 'Amina Bello' },
  });
  fireEvent.change(screen.getByLabelText(/Email Address \*/i), {
    target: { value: 'amina@example.com' },
  });
  fireEvent.change(
    screen.getByLabelText(/Why do you want to teach on SorobanLard\? \*/i),
    {
      target: {
        value:
          'I have 10 years of professional tailoring experience and want to mentor youth across Africa.',
      },
    }
  );
};

describe('Teach Landing Page (Issue #191)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders hero title and start teaching CTA', () => {
    render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    expect(
      screen.getByRole('heading', { name: /Share Your Knowledge, Earn Income/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Teaching/i })).toBeInTheDocument();
  });

  it('renders 3-step process', () => {
    render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    expect(screen.getByText('Plan Your Curriculum')).toBeInTheDocument();
    expect(screen.getByText('Record & Upload Video Lessons')).toBeInTheDocument();
    expect(screen.getByText('Publish & Earn Income')).toBeInTheDocument();
  });

  it('validates and submits instructor application form', () => {
    render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    const submitBtn = screen.getByRole('button', {
      name: /Submit Application/i,
    });
    fireEvent.click(submitBtn);

    fillForm();

    fireEvent.click(submitBtn);

    expect(screen.getByText(/Submitting Application.../i)).toBeInTheDocument();
  });
});

describe('Teach Landing Page submission timer (Issue #49)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('disables the submit button while submitting', () => {
    render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    fillForm();
    const submitBtn = screen.getByRole('button', { name: /Submit Application/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();
  });

  it('produces exactly one success toast for two rapid submits', () => {
    render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    fillForm();
    const submitBtn = screen.getByRole('button', { name: /Submit Application/i });

    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.getAllByText(/Application submitted!/i)
    ).toHaveLength(1);
  });

  it('clears the pending timer on unmount without state-update warnings', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { unmount } = render(
      <ToastProvider>
        <TeachPage />
      </ToastProvider>
    );

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    unmount();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const stateUpdateWarning = [...consoleErrorSpy.mock.calls, ...consoleWarnSpy.mock.calls]
      .flat()
      .some((arg) =>
        typeof arg === 'string' && /unmounted component|state update/i.test(arg)
      );

    expect(stateUpdateWarning).toBe(false);
  });
});
