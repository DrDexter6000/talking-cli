import type { HeuristicResult } from '../../types.js';
import type { ScenarioResult } from '../runtime/types.js';

export const M4_ACTIONABLE_PATTERNS = [
  /try\s+(?:again|using|with)/i,
  /check\s+(?:that|if|your|the)/i,
  /ensure|make\s+sure/i,
  /valid\s+(?:format|value|input)/i,
  /expected\s+(?:format|value|type)/i,
  /must\s+be/i,
  /should\s+be/i,
  /required/i,
  /missing/i,
  /incorrect/i,
  /supported\s+(?:values|formats)/i,
  /see\s+(?:also|documentation|docs)/i,
  /refer\s+to/i,
  /example/i,
  /retry\s+(?:after|in)/i,
  /wait\s+(?:for|until)/i,
];

export interface M4Raw {
  errors: Array<{
    toolName: string;
    errorText: string;
    isActionable: boolean;
    matchedPatterns: string[];
    isStackTrace: boolean;
    isHttpDump: boolean;
  }>;
}

export function evaluateM4(results: ScenarioResult[]): HeuristicResult {
  const errorResults = results.filter((r) => r.result.isError);

  if (errorResults.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      score: 100,
      raw: { reason: 'No errors were triggered' },
    };
  }

  const errorDetails = errorResults.map((r) => {
    const text = r.responseText;
    const matchedPatterns = M4_ACTIONABLE_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
    const isStackTrace = /at\s+\S+\s*\([^)]*:\d+:\d+\)/.test(text);
    const isHttpDump = /HTTP\/\d\.\d/.test(text) || /Status:\s*\d{3}/.test(text);

    const isActionable =
      text.length >= 15 && !isStackTrace && !isHttpDump && matchedPatterns.length > 0;

    return {
      toolName: r.scenario.toolName,
      errorText: text,
      isActionable,
      matchedPatterns,
      isStackTrace,
      isHttpDump,
    };
  });

  const actionableCount = errorDetails.filter((e) => e.isActionable).length;
  const score = Math.round((actionableCount / errorDetails.length) * 100);

  let verdict: HeuristicResult['verdict'];
  if (score >= 80) verdict = 'PASS';
  else if (score >= 50) verdict = 'PARTIAL';
  else verdict = 'FAIL';

  return {
    verdict,
    score,
    raw: { errors: errorDetails } as M4Raw,
  };
}
