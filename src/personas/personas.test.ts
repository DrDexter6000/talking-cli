import { describe, expect, it } from 'vitest';
import type { HeuristicResult } from '../types.js';
import { defaultPersona, emotionalDamageDadPersona, getPersona, isValidPersona } from './index.js';

function makeH1(verdict: HeuristicResult['verdict'], lineCount = 200): HeuristicResult {
  return { verdict, score: verdict === 'PASS' ? 100 : 0, raw: { lineCount, maxLines: 150 } };
}

describe('Persona selector', () => {
  it('getPersona returns default for undefined', () => {
    expect(getPersona(undefined)).toBe(defaultPersona);
  });

  it('getPersona returns correct persona by key', () => {
    expect(getPersona('emotional-damage-dad')).toBe(emotionalDamageDadPersona);
  });

  it('isValidPersona recognizes all keys', () => {
    expect(isValidPersona('default')).toBe(true);
    expect(isValidPersona('emotional-damage-dad')).toBe(true);
    expect(isValidPersona('invalid')).toBe(false);
    expect(isValidPersona('nba-coach')).toBe(false);
    expect(isValidPersona('british-critic')).toBe(false);
    expect(isValidPersona('zen-master')).toBe(false);
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

describe('Emotional Damage Dad persona', () => {
  it('uses Chinglish and cousin comparison at 100', () => {
    const text = emotionalDamageDadPersona.renderHeader(100, true);
    expect(text).toContain('cousin');
    expect(text).toContain("Don't get cocky");
  });

  it('shouts EMOTIONAL DAMAGE at low scores', () => {
    const text = emotionalDamageDadPersona.renderHeader(25, true);
    expect(text).toContain('EMOTIONAL DAMAGE');
    expect(text).toContain('shame');
  });

  it('brags about youth in H1', () => {
    const text = emotionalDamageDadPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('When I was your age');
    expect(text).toContain('ONE NAPKIN');
    expect(text).toContain('457');
  });

  it('calls tools "kids" and fixtures "homework"', () => {
    const text = emotionalDamageDadPersona.renderH2({
      verdict: 'FAIL',
      score: 0,
      raw: { tools: [{ name: 'search', verdict: 'FAIL', score: 0 }] },
    });
    expect(text).toContain('kid(s) no do homework');
  });
});
