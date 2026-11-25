import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { CompareBar } from './CompareBar';
import { useCompareStore } from '@/lib/hooks/use-compare-store';
import type { Course } from '@/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseCourse: Course = {
  id: 'course-1',
  instructorAddress: 'instructor-1',
  title: 'Advanced Tailoring Techniques',
  description: 'Learn professional tailoring',
  category: 'Tailoring',
  level: 'Advanced',
  language: 'English',
  thumbnailUrl: null,
  previewVideoUrl: null,
  price: 49.99,
  platformFeePercent: 10,
  status: 'ACTIVE',
  totalLessons: 25,
  totalDuration: 7200,
  totalEnrollments: 150,
  totalRevenue: 7498.5,
  txHash: null,
  approvedAt: '2024-01-01T00:00:00Z',
  createdAt: '2023-12-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  instructor: {
    name: 'Jane Doe',
    stellarAddress: 'instructor-1',
    avatarUrl: null,
  },
  modules: [],
  _count: { enrollments: 150 },
  rating: 4.8,
  reviewCount: 45,
};

const courses: Course[] = [
  baseCourse,
  { ...baseCourse, id: 'course-2', title: 'Professional Photography', category: 'Photography' },
  { ...baseCourse, id: 'course-3', title: 'Baking Fundamentals', category: 'Baking' },
  { ...baseCourse, id: 'course-4', title: 'Makeup Masterclass', category: 'Makeup Artistry' },
];

const removeButtons = () =>
  screen.queryAllByRole('button', { name: /remove .* from comparison/i });

describe('CompareBar', () => {
  beforeEach(() => {
    act(() => {
      useCompareStore.getState().clear();
    });
  });

  it('renders nothing when the store is empty', () => {
    const { container } = render(<CompareBar />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/compare \(/i)).not.toBeInTheDocument();
  });

  it.each([1, 2, 3])('shows the count label for %i stored course(s)', (count) => {
    act(() => {
      courses.slice(0, count).forEach((course) => useCompareStore.getState().add(course));
    });

    render(<CompareBar />);

    expect(screen.getByText(`Compare (${count}/3)`)).toBeInTheDocument();
    expect(removeButtons()).toHaveLength(count);
  });

  it('does not render a fourth course (cap of three enforced by the store)', () => {
    act(() => {
      courses.forEach((course) => useCompareStore.getState().add(course));
    });

    render(<CompareBar />);

    expect(screen.getByText('Compare (3/3)')).toBeInTheDocument();
    expect(removeButtons()).toHaveLength(3);
    expect(screen.queryByText('Makeup Masterclass')).not.toBeInTheDocument();
  });
});
