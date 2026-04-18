import { describe, expect, it } from 'vitest';
import type { EngineOutput } from '../types.js';
import { getExitCode, renderCI } from './ci.js';
import { renderCoach } from './coach.js';
import { renderJSON } from './json.js';

function makeOutput(overrides: Partial<EngineOutput> = {}): EngineOutput {
  return {
    skillDir: '/tmp/skill',
    skillLineCount: 200,
    h1: { verdict: 'PASS', score: 100, raw: { lineCount: 100, maxLines: 150 } },
    h2: { verdict: 'PASS', score: 100, raw: { tools: [] } },
    totalScore: 100,
    ...overrides,
  };
}

describe('Coach Renderer', () => {
  it('celebrates perfect score', () => {
    const out = makeOutput();
    const result = renderCoach(out);
    expect(result).toContain('100/100');
    expect(result).toContain('Flawless');
    expect(result).toMatchSnapshot('perfect-score');
  });

  it('roasts H1 + H2 failures with actionable fixes', () => {
    const out = makeOutput({
      skillLineCount: 457,
      h1: { verdict: 'FAIL', score: 0, raw: { lineCount: 457, maxLines: 150 } },
      h2: {
        verdict: 'FAIL',
        score: 0,
        raw: {
          tools: [
            { name: 'search', verdict: 'FAIL', score: 0 },
            { name: 'write', verdict: 'PARTIAL', score: 50 },
          ],
        },
      },
      totalScore: 0,
    });
    const result = renderCoach(out);
    expect(result).toContain('0/100');
    expect(result).toContain('Yikes');
    expect(result).toContain('457 lines');
    expect(result).toContain('search');
    expect(result).toContain('write');
    expect(result).toMatchSnapshot('h1-fail-h2-fail');
  });

  it('handles H2 PARTIAL correctly', () => {
    const out = makeOutput({
      h2: {
        verdict: 'PARTIAL',
        score: 50,
        raw: {
          tools: [
            { name: 'search', verdict: 'PASS', score: 100 },
            { name: 'write', verdict: 'PARTIAL', score: 50 },
          ],
        },
      },
      totalScore: 75,
    });
    const result = renderCoach(out);
    expect(result).toContain('PARTIAL');
    expect(result).toContain('write');
  });
});

describe('CI Renderer', () => {
  it('outputs plain text with no color codes', () => {
    const out = makeOutput({
      totalScore: 25,
      h1: { verdict: 'FAIL', score: 0, raw: { lineCount: 200, maxLines: 150 } },
      h2: {
        verdict: 'PARTIAL',
        score: 50,
        raw: { tools: [{ name: 'search', verdict: 'PARTIAL', score: 50 }] },
      },
    });
    const result = renderCI(out);
    expect(result).toContain('25/100');
    expect(result).toContain('H1: FAIL');
    expect(result).not.toMatch(new RegExp(`${String.fromCharCode(0x1b)}\\[`)); // no ANSI escape codes
  });

  it('returns exit code 0 for perfect score', () => {
    const out = makeOutput();
    expect(getExitCode(out)).toBe(0);
  });

  it('returns exit code 1 for failures', () => {
    const out = makeOutput({ totalScore: 50, h1: { verdict: 'FAIL', score: 0, raw: {} } });
    expect(getExitCode(out)).toBe(1);
  });
});

describe('JSON Renderer', () => {
  it('round-trips EngineOutput', () => {
    const out = makeOutput({
      h1: { verdict: 'FAIL', score: 0, raw: { lineCount: 200, maxLines: 150 } },
    });
    const json = renderJSON(out);
    const parsed = JSON.parse(json);
    expect(parsed.totalScore).toBe(out.totalScore);
    expect(parsed.h1.verdict).toBe('FAIL');
  });

  it('produces valid JSON', () => {
    const out = makeOutput();
    const json = renderJSON(out);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
