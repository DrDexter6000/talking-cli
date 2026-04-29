import { describe, expect, it } from 'vitest';
import type { HeuristicResult } from '../types.js';
import { defaultPersona, getPersona, isValidPersona } from './index.js';

function makeH1(verdict: HeuristicResult['verdict'], lineCount = 200): HeuristicResult {
  return { verdict, score: verdict === 'PASS' ? 100 : 0, raw: { lineCount, maxLines: 150 } };
}

describe('Persona selector', () => {
  it('getPersona returns default for undefined', () => {
    expect(getPersona(undefined)).toBe(defaultPersona);
  });

  it('isValidPersona recognizes all keys', () => {
    expect(isValidPersona('default')).toBe(true);
    expect(isValidPersona('invalid')).toBe(false);
  });
});

describe('Default persona', () => {
  it('renders perfect score header', () => {
    const text = defaultPersona.renderHeader(100, true);
    expect(text).toContain('Flawless');
  });

  it('renders failing score header', () => {
    const text = defaultPersona.renderHeader(25, true);
    expect(text).toContain('Yikes');
  });

  it('renders H1 with actionable advice', () => {
    const text = defaultPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('manifesto');
    expect(text).toContain('457');
  });
});
