import { describe, expect, it } from 'vitest';
import type { EngineOutput } from '../types.js';
import { generatePlan } from './plan-generator.js';

function makeOutput(overrides: Partial<EngineOutput> = {}): EngineOutput {
  return {
    skillDir: '/tmp/skill/',
    skillLineCount: 100,
    h1: { verdict: 'PASS', score: 100, raw: { lineCount: 100, maxLines: 150 } },
    h2: { verdict: 'PASS', score: 100, raw: { tools: [] } },
    totalScore: 100,
    hasCustomTools: true,
    ...overrides,
  };
}

describe('generatePlan', () => {
  it('includes H1 fix when H1 FAILs', () => {
    const out = makeOutput({
      totalScore: 50,
      skillLineCount: 200,
      h1: { verdict: 'FAIL', score: 0, raw: { lineCount: 200, maxLines: 150 } },
    });
    const plan = generatePlan(out);
    expect(plan).toContain('200 lines');
    expect(plan).toContain('H1 · Reduce SKILL.md line count');
    expect(plan).toContain('SKILL.md');
  });

  it('includes H2 fix for uncovered tools', () => {
    const out = makeOutput({
      totalScore: 50,
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
    });
    const plan = generatePlan(out);
    expect(plan).toContain('search.error.fixture.json');
    expect(plan).toContain('search.empty.fixture.json');
    expect(plan).toContain('write');
    expect(plan).toContain('H2 · Add hint coverage to tools');
  });

  it('includes H2 fix for partial tools', () => {
    const out = makeOutput({
      totalScore: 75,
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
    });
    const plan = generatePlan(out);
    expect(plan).toContain('write');
    expect(plan).toContain('missing required scenario coverage');
  });

  it('never mentions H3 or H4', () => {
    const out = makeOutput({ totalScore: 100 });
    const plan = generatePlan(out);
    expect(plan).not.toContain('H3');
    expect(plan).not.toContain('H4');
  });

  it('celebrates perfect score', () => {
    const out = makeOutput({ totalScore: 100 });
    const plan = generatePlan(out);
    expect(plan).toContain('100/100');
    expect(plan).toContain('Nothing to fix');
  });
});
