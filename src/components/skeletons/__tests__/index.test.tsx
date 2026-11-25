import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as skeletons from '../index';
import { CourseCardSkeleton as CoursesCourseCardSkeleton } from '@/components/courses/CourseCardSkeleton';

const skeletonsDir = fileURLToPath(new URL('..', import.meta.url));

const componentModules = readdirSync(skeletonsDir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.endsWith('.test.tsx') && !file.endsWith('.stories.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();

const barrelModules = [
  ...new Set(
    [...readFileSync(new URL('../index.ts', import.meta.url), 'utf8').matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map(
      (match) => match[1],
    ),
  ),
].sort();

describe('skeletons barrel (src/components/skeletons/index.ts)', () => {
  it.each([
    'CourseCardSkeleton',
    'DashboardSkeleton',
    'QuickStatsSkeleton',
    'ContinueLearningSkeletonList',
    'CourseGridSkeleton',
    'CourseDetailSkeleton',
  ])('exports %s', (name) => {
    expect(skeletons[name as keyof typeof skeletons]).toBeTypeOf('function');
  });

  it('re-exports every component file in the folder and nothing else', () => {
    const missing = componentModules.filter((name) => !barrelModules.includes(name));
    const extra = barrelModules.filter((name) => !componentModules.includes(name));

    expect(
      { missing, extra },
      [
        'src/components/skeletons/index.ts is out of sync with the folder.',
        `Component files not exported from the barrel: ${missing.join(', ') || '(none)'}`,
        `Barrel exports pointing at missing files: ${extra.join(', ') || '(none)'}`,
      ].join('\n'),
    ).toEqual({ missing: [], extra: [] });
  });
});

/**
 * Two components share the name CourseCardSkeleton. They are intentionally different:
 * the skeletons one (barrel) is the full card placeholder with per-bar pulses, while the
 * courses one is a lighter card that pulses as a whole. These assertions pin that
 * difference so a change to either is a deliberate decision.
 */
describe('CourseCardSkeleton variants', () => {
  it('both expose an accessible "Loading course" label', () => {
    const barrel = render(<skeletons.CourseCardSkeleton />);
    expect(barrel.getByLabelText('Loading course')).toBeInTheDocument();
    barrel.unmount();

    const courses = render(<CoursesCourseCardSkeleton />);
    expect(courses.getByLabelText('Loading course')).toBeInTheDocument();
  });

  it('skeletons/CourseCardSkeleton renders 10 individually pulsing placeholders', () => {
    const { container } = render(<skeletons.CourseCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(10);
  });

  it('courses/CourseCardSkeleton renders 8 placeholders inside one pulsing card', () => {
    const { container } = render(<CoursesCourseCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(container.querySelectorAll('.bg-ink-100')).toHaveLength(8);
  });
});
