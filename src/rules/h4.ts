import { runFixture } from '../runner/fixture-runner.js';
import type { DiscoveryResult, HeuristicResult } from '../types.js';

const HINT_FIELDS = ['hints', 'suggestions', 'guidance', 'next_steps', 'recommendations'];

function isActionable(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length >= 10;
  }
  if (Array.isArray(value)) {
    return value.length >= 1 && typeof value[0] === 'string' && value[0].trim().length > 0;
  }
  return false;
}

export async function evaluateH4(discovery: DiscoveryResult): Promise<HeuristicResult> {
  const { fixtures, skillMdPath, tools } = discovery;
  const skillDir = skillMdPath.replace(/SKILL\.md$/, '');

  if (tools.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      score: 100,
      raw: { reason: 'No tools found' },
    };
  }

  if (fixtures.length === 0) {
    return {
      verdict: 'FAIL',
      score: 0,
      raw: { reason: 'No fixtures found', actionable: 0, passed: 0, total: 0 },
    };
  }

  const results = await Promise.all(fixtures.map((f) => runFixture(f.fixture, skillDir)));
  const passedResults = results.filter((r) => r.status === 'passed');

  if (passedResults.length === 0) {
    return {
      verdict: 'FAIL',
      score: 0,
      raw: {
        reason: 'No fixtures passed',
        actionable: 0,
        passed: 0,
        total: fixtures.length,
      },
    };
  }

  const actionable = passedResults.filter((r) => {
    const parsed = r.parsed as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return false;
    return HINT_FIELDS.some((field) => {
      if (!(field in parsed)) return false;
      return isActionable(parsed[field]);
    });
  });

  const score = Math.round((actionable.length / passedResults.length) * 100);

  let verdict: HeuristicResult['verdict'];
  if (score >= 80) verdict = 'PASS';
  else if (score >= 50) verdict = 'PARTIAL';
  else verdict = 'FAIL';

  return {
    verdict,
    score,
    raw: {
      actionable: actionable.length,
      passed: passedResults.length,
      total: fixtures.length,
    },
  };
}
