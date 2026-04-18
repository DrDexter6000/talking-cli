import { describe, expect, it } from 'vitest';
import type { HeuristicResult } from '../types.js';
import {
  britishCriticPersona,
  defaultPersona,
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
  });

  it('isValidPersona recognizes all keys', () => {
    expect(isValidPersona('default')).toBe(true);
    expect(isValidPersona('nba-coach')).toBe(true);
    expect(isValidPersona('british-critic')).toBe(true);
    expect(isValidPersona('zen-master')).toBe(true);
    expect(isValidPersona('invalid')).toBe(false);
  });
});

describe('Default persona', () => {
  it('renders perfect score header', () => {
    const text = defaultPersona.renderHeader(100);
    expect(text).toContain('Flawless');
  });

  it('renders failing score header', () => {
    const text = defaultPersona.renderHeader(25);
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
    const text = nbaCoachPersona.renderHeader(100);
    expect(text).toContain('Championship');
  });

  it('uses basketball language for failures', () => {
    const text = nbaCoachPersona.renderHeader(25);
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
    const text = britishCriticPersona.renderHeader(100);
    expect(text).toContain('standing ovation');
  });

  it('uses dry wit for failures', () => {
    const text = britishCriticPersona.renderHeader(25);
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
    const text = zenMasterPersona.renderHeader(100);
    expect(text).toContain('river');
  });

  it('uses silence metaphors for failures', () => {
    const text = zenMasterPersona.renderHeader(25);
    expect(text).toContain('garden of silence');
  });

  it('renders H1 as scroll bloat', () => {
    const text = zenMasterPersona.renderH1(makeH1('FAIL', 457));
    expect(text).toContain('scroll');
    expect(text).toContain('457');
  });
});
