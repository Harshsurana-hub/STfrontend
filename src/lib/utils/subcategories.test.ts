import { describe, expect, it } from 'vitest';
import { deriveSubcategories } from './subcategories';
import type { Course } from '@/types';

function makeCourse(title: string): Course {
  return {
    id: title,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    description: '',
    category: 'Test',
    level: 'BEGINNER',
    language: 'English',
    thumbnailUrl: null,
    previewVideoUrl: null,
    price: 0,
    originalPrice: 0,
    platformFeePercent: 0,
    status: 'ACTIVE',
    totalLessons: 1,
    totalDuration: 60,
    totalEnrollments: 0,
    totalRevenue: 0,
    txHash: null,
    approvedAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instructor: { name: 'Test', stellarAddress: 'GTEST', avatarUrl: null },
    modules: [],
    _count: { enrollments: 0 },
  } as unknown as Course;
}

describe('deriveSubcategories', () => {
  it('returns [] for empty course list', () => {
    expect(deriveSubcategories([], 'Photography')).toEqual([]);
  });

  it('returns [] when all titles consist only of stop words', () => {
    const courses = [
      makeCourse('learn the complete beginner course'),
      makeCourse('advanced professional masterclass guide'),
    ];
    expect(deriveSubcategories(courses, 'Photography')).toEqual([]);
  });

  it('excludes the category name words from results', () => {
    const courses = [
      makeCourse('web design basics'),
      makeCourse('web development crash'),
    ];
    // 'web' is 3 chars (excluded by length rule >3), but 'development' should be excluded
    // because it matches the category name word
    const result = deriveSubcategories(courses, 'Web Development');
    expect(result.map((r) => r.toLowerCase())).not.toContain('development');
    expect(result.map((r) => r.toLowerCase())).not.toContain('web');
  });

  it('sorts ties alphabetically', () => {
    const courses = [
      makeCourse('alpha design'),
      makeCourse('bravo design'),
      makeCourse('charlie design'),
      makeCourse('alpha bravo'),
      makeCourse('bravo charlie'),
      makeCourse('alpha charlie'),
    ];
    // alpha=3, bravo=3, charlie=3 — all tied; alphabetical order expected
    const result = deriveSubcategories(courses, 'Test');
    expect(result).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('returns at most 3 results', () => {
    const courses = Array.from({ length: 10 }, (_, i) =>
      makeCourse(`term${String(i).padStart(2, '0')} title extra`),
    );
    expect(deriveSubcategories(courses, 'Test').length).toBeLessThanOrEqual(3);
  });

  it('sorts by frequency (most frequent first)', () => {
    const courses = [
      makeCourse('bravo bravo'),
      makeCourse('alpha alpha alpha'),
      makeCourse('charlie'),
    ];
    const result = deriveSubcategories(courses, 'Test');
    expect(result[0]).toBe('Alpha');
    expect(result[1]).toBe('Bravo');
  });
});
