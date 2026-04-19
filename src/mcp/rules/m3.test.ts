import { describe, expect, it } from 'vitest';
import type { ScenarioResult } from '../runtime/types.js';
import { evaluateM3, M3_GUIDANCE_PATTERNS } from './m3.js';

describe('evaluateM3', () => {
  it('returns NOT_APPLICABLE when no scenarios', () => {
    const result = evaluateM3([]);
    expect(result.verdict).toBe('NOT_APPLICABLE');
    expect(result.score).toBe(100);
  });

  it('PASS when all scenarios have guidance', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: {
          content: [{ type: 'text', text: 'No results found. Try broadening your search.' }],
          isError: false,
        },
        responseText: 'No results found. Try broadening your search.',
      },
    ];
    const r = evaluateM3(results);
    expect(r.verdict).toBe('PASS');
    expect(r.score).toBe(100);
  });

  it('FAIL when no guidance detected', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: { content: [{ type: 'text', text: '[]' }], isError: false },
        responseText: '[]',
      },
    ];
    const r = evaluateM3(results);
    expect(r.verdict).toBe('FAIL');
    expect(r.score).toBe(0);
  });

  it('PARTIAL when some have guidance', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: {
          content: [{ type: 'text', text: 'No results found. Try broadening your search.' }],
          isError: false,
        },
        responseText: 'No results found. Try broadening your search.',
      },
      {
        scenario: { toolName: 'read', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Not found' }], isError: true },
        responseText: 'Not found',
      },
    ];
    const r = evaluateM3(results);
    expect(r.verdict).toBe('PARTIAL');
    expect(r.score).toBe(50);
  });

  it('flags raw JSON as no guidance', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'api', args: {}, expectedType: 'empty', description: '' },
        result: { content: [{ type: 'text', text: '{"results":[]}' }], isError: false },
        responseText: '{"results":[]}',
      },
    ];
    const r = evaluateM3(results);
    expect(r.score).toBe(0);
  });

  it('marks short responses as no guidance', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: { content: [{ type: 'text', text: 'Error' }], isError: true },
        responseText: 'Error',
      },
    ];
    const r = evaluateM3(results);
    expect(r.score).toBe(0);
  });

  it('captures matched patterns in raw', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: { content: [{ type: 'text', text: 'Try using fewer filters.' }], isError: false },
        responseText: 'Try using fewer filters.',
      },
    ];
    const r = evaluateM3(results);
    const raw = r.raw as { scenarios: Array<{ matchedPatterns: string[] }> };
    expect(raw.scenarios[0].matchedPatterns.length).toBeGreaterThan(0);
  });
});

describe('M3_GUIDANCE_PATTERNS', () => {
  it('matches "Try using"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Try using fewer filters'))).toBe(true);
  });

  it('matches "broaden"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Try to broaden your search'))).toBe(true);
  });

  it('does not match bare JSON', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('{"results":[]}'))).toBe(false);
  });

  // New patterns — Phase 1 expansion
  it('matches "see also"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('No tables found. See also: list_tables'))).toBe(
      true,
    );
  });

  it('matches "refer to"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Refer to the user manual for details'))).toBe(
      true,
    );
  });

  it('matches "please provide"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Please provide a valid path'))).toBe(true);
  });

  it('matches "please specify"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Please specify the table name'))).toBe(true);
  });

  it('matches "one of the following"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Use one of the following values'))).toBe(true);
  });

  it('matches "available options"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Available options: --json, --csv'))).toBe(true);
  });

  it('matches "available values"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('Available values: A, B, C'))).toBe(true);
  });

  // False positive guards
  it('does not match "I see"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('I see what you mean'))).toBe(false);
  });

  it('does not match bare "example" in non-guidance context', () => {
    // Note: "example" is not in M3 patterns (it's in M4). This verifies no accidental overlap.
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('This is an example server'))).toBe(false);
  });

  it('does not match "one of" without "the following" or "these"', () => {
    expect(M3_GUIDANCE_PATTERNS.some((p) => p.test('One of my favorites'))).toBe(false);
  });
});
