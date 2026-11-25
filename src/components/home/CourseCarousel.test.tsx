import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CourseCarousel } from './CourseCarousel';
import type { Course } from '@/types';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

vi.mock('@/components/courses/CourseCard', () => ({
  CourseCard: ({ course }: { course: { title: string } }) => (
    <div data-testid="course-card">{course.title}</div>
  ),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

const mockCourses: Course[] = [
  {
    id: 'course-1',
    title: 'Course 1',
    description: 'Desc 1',
    category: 'Development',
    level: 'Beginner',
    price: 10,
    instructor: { id: 'inst-1', name: 'Instructor 1' },
    thumbnailUrl: '/thumb1.jpg',
    published: true,
  },
  {
    id: 'course-2',
    title: 'Course 2',
    description: 'Desc 2',
    category: 'Design',
    level: 'Intermediate',
    price: 20,
    instructor: { id: 'inst-2', name: 'Instructor 2' },
    thumbnailUrl: '/thumb2.jpg',
    published: true,
  },
  {
    id: 'course-3',
    title: 'Course 3',
    description: 'Desc 3',
    category: 'Marketing',
    level: 'Advanced',
    price: 30,
    instructor: { id: 'inst-3', name: 'Instructor 3' },
    thumbnailUrl: '/thumb3.jpg',
    published: true,
  },
];

describe('CourseCarousel reduced motion autoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 200 });
    Element.prototype.scrollBy = vi.fn();
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not advance carousel on timer when useReducedMotion returns true', () => {
    vi.mocked(useReducedMotion).mockReturnValue({
      prefersReducedMotion: true,
      hasManualOverride: false,
      setManualOverride: vi.fn(),
      clearManualOverride: vi.fn(),
      mounted: true,
    });

    render(
      <CourseCarousel
        title="Featured Courses"
        seeAllHref="/courses"
        courses={mockCourses}
        autoplay={true}
        autoplayInterval={4000}
      />,
    );

    const scrollBySpy = vi.spyOn(Element.prototype, 'scrollBy');
    const scrollToSpy = vi.spyOn(Element.prototype, 'scrollTo');
    scrollBySpy.mockClear();
    scrollToSpy.mockClear();

    act(() => {
      vi.advanceTimersByTime(4000);
      vi.advanceTimersByTime(4000);
    });

    expect(scrollBySpy).not.toHaveBeenCalled();
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('advances carousel on timer when useReducedMotion returns false', () => {
    vi.mocked(useReducedMotion).mockReturnValue({
      prefersReducedMotion: false,
      hasManualOverride: false,
      setManualOverride: vi.fn(),
      clearManualOverride: vi.fn(),
      mounted: true,
    });

    render(
      <CourseCarousel
        title="Featured Courses"
        seeAllHref="/courses"
        courses={mockCourses}
        autoplay={true}
        autoplayInterval={4000}
      />,
    );

    const scrollBySpy = vi.spyOn(Element.prototype, 'scrollBy');
    scrollBySpy.mockClear();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(scrollBySpy).toHaveBeenCalledTimes(1);
    expect(scrollBySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'smooth',
      }),
    );
  });

  it('allows manual arrow and dot navigation even when reduced motion is preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue({
      prefersReducedMotion: true,
      hasManualOverride: false,
      setManualOverride: vi.fn(),
      clearManualOverride: vi.fn(),
      mounted: true,
    });

    render(
      <CourseCarousel
        title="Featured Courses"
        seeAllHref="/courses"
        courses={mockCourses}
        autoplay={true}
      />,
    );

    const scrollToSpy = vi.spyOn(Element.prototype, 'scrollTo');

    const dotButtons = screen.getAllByRole('tab');
    expect(dotButtons.length).toBe(mockCourses.length);

    fireEvent.click(dotButtons[1]);
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'smooth',
      }),
    );
  });
});
