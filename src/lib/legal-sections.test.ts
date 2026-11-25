import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS } from './legal-sections';

describe('PRIVACY_SECTIONS', () => {
  it('has unique ids', () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty labels', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('has non-empty ids', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.id.trim().length).toBeGreaterThan(0);
    }
  });
});
