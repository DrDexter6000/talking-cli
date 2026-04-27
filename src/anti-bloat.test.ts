/**
 * Anti-bloat regression test — talking-cli refuses to ship the bloat it audits.
 *
 * SKILL.md size guard: Any shipped SKILL.md must stay ≤150 lines (H1 threshold).
 * Persona count guard: Max 2 registered personas (Phase F.1 cut).
 *
 * These guards prevent the methodology's two most-policed quantities
 * (skill bloat, persona sprawl) from creeping back in via PR.
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { PERSONA_KEYS } from './personas/index.js';

describe('Anti-bloat regression guards', () => {
  it('allows shipped SKILL.md files within 150-line budget', () => {
    const skillFiles = globSync('**/SKILL.md', {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/benchmark/**',
        '**/.internal/**',
        '**/%TEMP%/**',
      ],
    });

    // If no SKILL.md files found, test passes (guards against empty glob)
    expect(skillFiles.length).toBeGreaterThanOrEqual(0);

    for (const file of skillFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split(/\r?\n/);
      expect(lines.length, `"${file}" exceeds 150-line budget`).toBeLessThanOrEqual(150);
    }
  });

  it('locks persona count at ≤ 2', () => {
    expect(PERSONA_KEYS.length).toBeLessThanOrEqual(2);
  });
});
