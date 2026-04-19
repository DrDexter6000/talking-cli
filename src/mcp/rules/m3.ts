import type { HeuristicResult } from '../../types.js';
import type { ScenarioResult } from '../runtime/types.js';

export const M3_GUIDANCE_PATTERNS = [
  /try\s+(?:using|with|a|the)/i,
  /consider\s+(?:using|trying)/i,
  /you\s+(?:can|could|should|might)\s+(?:try|use|check)/i,
  /suggest/i,
  /recommend/i,
  /next\s+step/i,
  /broaden|narrow|refine/i,
  /use\s+(?:the\s+)?\w+\s+tool/i,
  /check\s+(?:your|the|that|if)/i,
  /ensure|make\s+sure/i,
  /instead/i,
  /alternatively/i,
  /see\s+(?:also|documentation|docs)/i,
  /refer\s+to/i,
  /please\s+(?:provide|specify)/i,
  /one\s+of\s+(?:the\s+following|these)/i,
  /available\s+(?:options|values|choices)/i,
];

export interface M3Raw {
  scenarios: Array<{
    toolName: string;
    scenarioType: 'error' | 'empty';
    responseText: string;
    responseLength: number;
    hasGuidance: boolean;
    matchedPatterns: string[];
  }>;
}

export function evaluateM3(results: ScenarioResult[]): HeuristicResult {
  if (results.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      score: 100,
      raw: { reason: 'No scenarios were tested (all tools destructive or ambiguous)' },
    };
  }

  const scenarioResults = results.map((r) => {
    const text = r.responseText;
    const matchedPatterns = M3_GUIDANCE_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);

    const hasGuidance = text.length >= 20 && !isRawJson(text) && matchedPatterns.length > 0;

    return {
      toolName: r.scenario.toolName,
      scenarioType: r.scenario.expectedType,
      responseText: text,
      responseLength: text.length,
      hasGuidance,
      matchedPatterns,
    };
  });

  const withGuidance = scenarioResults.filter((s) => s.hasGuidance).length;
  const score = Math.round((withGuidance / scenarioResults.length) * 100);

  let verdict: HeuristicResult['verdict'];
  if (score >= 80) verdict = 'PASS';
  else if (score >= 50) verdict = 'PARTIAL';
  else verdict = 'FAIL';

  return {
    verdict,
    score,
    raw: { scenarios: scenarioResults } as M3Raw,
  };
}

function isRawJson(text: string): boolean {
  if (text.length < 2) return false;
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
