import type { HeuristicResult } from '../../types.js';
import type { McpToolDefinition } from '../types.js';

/**
 * M2 · Annotation Completeness
 *
 * Checks whether every MCP tool has all three annotation hints populated:
 * readOnlyHint, idempotentHint, destructiveHint.
 *
 * These annotations are the MCP community's proto-hint infrastructure — they tell
 * the agent whether a tool is safe to call speculatively. Missing annotations
 * force the agent to infer safety from the description, which wastes context budget.
 */

export interface M2Raw {
  tools: Array<{
    name: string;
    hasReadOnly: boolean;
    hasIdempotent: boolean;
    hasDestructive: boolean;
    passed: boolean;
  }>;
}

export function evaluateM2(tools: McpToolDefinition[]): HeuristicResult {
  const toolResults = tools.map((tool) => {
    const hasReadOnly = tool.annotations?.readOnlyHint !== undefined;
    const hasIdempotent = tool.annotations?.idempotentHint !== undefined;
    const hasDestructive = tool.annotations?.destructiveHint !== undefined;
    const passed = hasReadOnly && hasIdempotent && hasDestructive;

    return {
      name: tool.name,
      hasReadOnly,
      hasIdempotent,
      hasDestructive,
      passed,
    };
  });

  if (tools.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      score: 100,
      raw: { reason: 'No tools discovered' },
    };
  }

  const passedCount = toolResults.filter((t) => t.passed).length;
  const score = Math.round((passedCount / tools.length) * 100);

  let verdict: HeuristicResult['verdict'];
  if (score >= 80) verdict = 'PASS';
  else if (score >= 50) verdict = 'PARTIAL';
  else verdict = 'FAIL';

  return {
    verdict,
    score,
    raw: { tools: toolResults } as M2Raw,
  };
}
