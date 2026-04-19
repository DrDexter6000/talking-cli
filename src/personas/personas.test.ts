import { describe, expect, it } from 'vitest';
import type { HeuristicResult } from '../types.js';
import {
  britishCriticPersona,
  defaultPersona,
  emotionalDamageDadPersona,
  getPersona,
  isValidPersona,
  nbaCoachPersona,
  zenMasterPersona,
} from './index.js';

function makeH1(verdict: HeuristicResult['verdict'], lineCount = 200): HeuristicResult {
  return { verdict, score: verdict === 'PASS' ? 100 : 0, raw: { lineCount, maxLines: 150 } };
}

describe('Persona selector', () => {
  it('getPersona returns default for undefined', () => {
    expect(getPersona(undefined)).toBe(defaultPersona);
  });

  it('getPersona returns correct persona by key', () => {
    expect(getPersona('nba-coach')).toBe(nbaCoachPersona);
    expect(getPersona('british-critic')).toBe(britishCriticPersona);
    expect(getPersona('zen-master')).toBe(zenMasterPersona);
    expect(getPersona('emotional-damage-dad')).toBe(emotionalDamageDadPersona);
  });

  it('isValidPersona recognizes all keys', () => {
    expect(isValidPersona('default')).toBe(true);
    expect(isValidPersona('nba-coach')).toBe(true);
    expect(isValidPersona('british-critic')).toBe(true);
    expect(isValidPersona('zen-master')).toBe(true);
    expect(isValidPersona('emotional-damage-dad')).toBe(true);
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

describe('NBA Coach persona', () => {
  it('uses basketball metaphors in header', () => {
    const text = nbaCoachPersona.renderHeader(100, true);
    expect(text).toContain('Championship');
  });

  it('uses basketball language for failures', () => {
    const text = nbaCoachPersona.renderHeader(25, true);
    expect(text).toContain('blowout');
  });

  it('renders H1 as playbook bloat', () => {
    const text = nbaCoachPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('playbook');
    expect(text).toContain('457');
  });
});

describe('British Critic persona', () => {
  it('uses theatre metaphors in header', () => {
    const text = britishCriticPersona.renderHeader(100, true);
    expect(text).toContain('standing ovation');
  });

  it('uses dry wit for failures', () => {
    const text = britishCriticPersona.renderHeader(25, true);
    expect(text).toContain('catastrophic opening night');
  });

  it('renders H1 as programme note bloat', () => {
    const text = britishCriticPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('programme');
    expect(text).toContain('457');
  });
});

describe('Zen Master persona', () => {
  it('uses nature metaphors in header', () => {
    const text = zenMasterPersona.renderHeader(100, true);
    expect(text).toContain('river');
  });

  it('uses silence metaphors for failures', () => {
    const text = zenMasterPersona.renderHeader(25, true);
    expect(text).toContain('garden of silence');
  });

  it('renders H1 as scroll bloat', () => {
    const text = zenMasterPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('scroll');
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
