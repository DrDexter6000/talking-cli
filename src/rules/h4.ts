import { runFixture } from '../runner/fixture-runner.js';
import type { DiscoveryResult, HeuristicResult } from '../types.js';

const HINT_FIELDS = ['hints', 'suggestions', 'guidance', 'next_steps', 'recommendations'];

const GENERIC_PHRASES = [
  /try again( later)?$/i,
  /something went wrong/i,
  /an error (has )?occurred/i,
  /error occurred/i,
  /please try again/i,
  /unexpected error/i,
  /operation failed/i,
  /request failed/i,
  /processing error/i,
  /internal error/i,
  /service (unavailable|temporarily unavailable)/i,
  /contact support/i,
  /no results found$/i,
  /access denied/i,
  /permission denied/i,
  /forbidden/i,
  /not found$/i,
  /unauthorized/i,
  /bad request$/i,
  /input validation error/i,
  /required (property|parameter|field)/i,
  /field required/i,
  /is required$/i,
];

const ACTION_VERB_RE =
  /\b(try|use|check|broaden|narrow|increase|decrease|add|remove|update|verify|ensure|specify|provide|review|navigate|run|install|set|configure|restart|replace|modify|enable|disable|adjust|select|choose|open|close|create|delete|clear|reset|confirm|apply)\b/i;

function isActionableString(text: string): boolean {
  if (text.length === 0) return false;

  // Reject generic phrases first
  for (const pattern of GENERIC_PHRASES) {
    if (pattern.test(text)) return false;
  }

  // Look for verb + concrete direction (action verb + enough substance)
  if (ACTION_VERB_RE.test(text) && text.length >= 10) return true;

  // Short strings (< 10 chars) without action verbs are not actionable
  // Longer strings without action verbs are conservatively not actionable
  return false;
}

function isActionable(value: unknown): boolean {
  if (typeof value === 'string') {
    return isActionableString(value.trim());
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.some((item) => typeof item === 'string' && isActionableString(item.trim()));
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
