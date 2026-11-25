import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import PrivacyPage from '../page';
import { PRIVACY_SECTIONS } from '@/lib/legal-sections';

// next/link and TopBar are not needed for these assertions
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <div data-testid="topbar" />,
}));

describe('PrivacyPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders TOC links and first section heading without stubbing IntersectionObserver', () => {
    // IntersectionObserver is undefined in jsdom — the page should not throw
    render(<PrivacyPage />);

    // TOC link for the first section
    expect(screen.getAllByRole('link', { name: 'Overview' }).length).toBeGreaterThan(0);

    // First section heading
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('calls observe once per section id when IntersectionObserver is stubbed', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();

    const MockIO = vi.fn(function () {
      return { observe, disconnect, unobserve: vi.fn() };
    });
    vi.stubGlobal('IntersectionObserver', MockIO);

    // Provide DOM elements for each section id
    for (const { id } of PRIVACY_SECTIONS) {
      const el = document.createElement('section');
      el.id = id;
      document.body.appendChild(el);
    }

    render(<PrivacyPage />);

    expect(observe).toHaveBeenCalledTimes(PRIVACY_SECTIONS.length);

    // cleanup DOM
    for (const { id } of PRIVACY_SECTIONS) {
      document.getElementById(id)?.remove();
    }
  });
});
