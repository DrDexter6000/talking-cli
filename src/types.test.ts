import { describe, expect, it } from 'vitest';
import {
  assertFixture,
  type DiscoveryResult,
  type EngineOutput,
  type Fixture,
  type HeuristicResult,
  isValidFixture,
} from './types.js';

describe('HeuristicResult', () => {
  it('accepts valid verdicts at compile time', () => {
    const results: HeuristicResult['verdict'][] = ['PASS', 'FAIL', 'PARTIAL', 'NOT_APPLICABLE'];
    expect(results).toHaveLength(4);
  });

  it('score is numeric 0–100', () => {
    const r: HeuristicResult = { verdict: 'PASS', score: 100, raw: {} };
    expect(r.score).toBe(100);
  });
});

describe('EngineOutput', () => {
  it('is JSON-serializable', () => {
    const out: EngineOutput = {
      skillDir: '/tmp/skill',
      skillLineCount: 200,
      h1: { verdict: 'FAIL', score: 0, raw: { lineCount: 200 } },
      h2: { verdict: 'PARTIAL', score: 50, raw: { tools: [] } },
      totalScore: 25,
    };
    const json = JSON.stringify(out);
    const parsed = JSON.parse(json) as EngineOutput;
    expect(parsed.totalScore).toBe(25);
    expect(parsed.h1.verdict).toBe('FAIL');
  });

  it('contains no functions after serialization', () => {
    const out: EngineOutput = {
      skillDir: '/tmp/skill',
      skillLineCount: 0,
      h1: { verdict: 'PASS', score: 100, raw: null },
      h2: { verdict: 'NOT_APPLICABLE', score: 100, raw: null },
      totalScore: 100,
    };
    const json = JSON.stringify(out);
    expect(json).not.toContain('function');
  });
});

describe('Fixture runtime validation', () => {
  const valid: Fixture = {
    tool: 'search',
    scenario: 'empty-result',
    command: ['node', 'tools/search.js'],
    assert: { output_has_field: 'hints' },
  };

  it('accepts a valid fixture', () => {
    expect(isValidFixture(valid)).toBe(true);
    expect(assertFixture(valid)).toEqual(valid);
  });

  it('rejects missing assert', () => {
    const bad = { tool: 'search', scenario: 'x', command: ['a'] };
    expect(isValidFixture(bad)).toBe(false);
    expect(() => assertFixture(bad)).toThrow('Invalid fixture');
  });

  it('rejects missing command', () => {
    const bad = { tool: 'search', scenario: 'x', assert: { output_has_field: 'hints' } };
    expect(isValidFixture(bad)).toBe(false);
  });

  it('rejects non-string command elements', () => {
    const bad = {
      tool: 'search',
      scenario: 'x',
      command: ['a', 1],
      assert: { output_has_field: 'hints' },
    };
    expect(isValidFixture(bad)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidFixture(null)).toBe(false);
  });

  it('rejects string', () => {
    expect(isValidFixture('not a fixture')).toBe(false);
  });
});

describe('DiscoveryResult', () => {
  it('holds tools and fixtures arrays', () => {
    const d: DiscoveryResult = {
      skillMdPath: '/tmp/skill/SKILL.md',
      tools: [{ name: 'search', ext: '.js', path: '/tmp/skill/tools/search.js' }],
      fixtures: [
        {
          name: 'search.error.fixture.json',
          tool: 'search',
          scenario: 'error',
          path: '/tmp/skill/fixtures/search.error.fixture.json',
        },
      ],
    };
    expect(d.tools).toHaveLength(1);
    expect(d.fixtures).toHaveLength(1);
  });
});
