import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as checkout from '../index';

const checkoutDir = fileURLToPath(new URL('..', import.meta.url));

/** Component modules in the folder, ignoring tests and stories. */
const componentModules = readdirSync(checkoutDir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.endsWith('.test.tsx') && !file.endsWith('.stories.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();

/** Modules the barrel re-exports from, parsed from its source. */
const barrelModules = [
  ...new Set(
    [...readFileSync(new URL('../index.ts', import.meta.url), 'utf8').matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map(
      (match) => match[1],
    ),
  ),
].sort();

describe('checkout barrel (src/components/checkout/index.ts)', () => {
  it('resolves every named export to a defined value', () => {
    const exportNames = Object.keys(checkout);
    expect(exportNames.length).toBeGreaterThan(0);

    const undefinedExports = exportNames.filter(
      (name) => checkout[name as keyof typeof checkout] === undefined,
    );
    expect(undefinedExports, `Barrel exports resolving to undefined: ${undefinedExports.join(', ')}`).toEqual([]);
  });

  it('re-exports every component file in the folder and nothing else', () => {
    const missing = componentModules.filter((name) => !barrelModules.includes(name));
    const extra = barrelModules.filter((name) => !componentModules.includes(name));

    expect(
      { missing, extra },
      [
        'src/components/checkout/index.ts is out of sync with the folder.',
        `Component files not exported from the barrel: ${missing.join(', ') || '(none)'}`,
        `Barrel exports pointing at missing files: ${extra.join(', ') || '(none)'}`,
      ].join('\n'),
    ).toEqual({ missing: [], extra: [] });
  });
});
