import type { Course } from '@/types';

export const STOP_WORDS = new Set([
  'about', 'advanced', 'beginner', 'complete', 'course', 'courses', 'from',
  'guide', 'learn', 'masterclass', 'professional', 'skills', 'the', 'with',
]);

/**
 * Derives up to 3 subcategory labels from course titles for a given category.
 * Excludes stop words and the category's own name words, counts terms > 3 chars,
 * sorts by frequency then alphabetically, and capitalises the results.
 */
export function deriveSubcategories(courses: Course[], categoryName: string): string[] {
  const excluded = new Set([
    ...STOP_WORDS,
    ...categoryName.toLowerCase().split(/\s+/),
  ]);
  const counts = new Map<string, number>();

  for (const course of courses) {
    for (const word of course.title.toLowerCase().split(/\s+/)) {
      const term = word.replace(/[^a-z]/g, '');
      if (term.length > 3 && !excluded.has(term)) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1));
}
