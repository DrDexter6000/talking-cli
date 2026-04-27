import type { HeuristicResult } from '../../types.js';
import type { McpToolDefinition } from '../types.js';

/**
 * M1 · Contract Purity
 *
 * Checks whether an MCP tool's description violates Rule 1 of Talking CLI:
 * "The Contract does not explain, it constrains."
 *
 * In MCP, the `description` field is part of C1 (Contract). It should tell
 * the agent what the tool accepts and returns — not how to use it, when to
 * call it, or what to do after it returns. Those belong in Prompt-On-Call,
 * i.e. the tool's runtime response.
 *
 * Because MCP has no SKILL.md, developers often shove usage guidance into
 * descriptions. This makes descriptions bloated with strategy that should
 * live in the response. M1 detects these boundary violations.
 *
 * A tool fails M1 if its description contains any strategy/guidance phrases.
 */

const STRATEGY_PATTERNS = [
  // Usage timing / conditions
  /use this tool when/i,
  /when to use/i,
  /how to use/i,
  /you should/i,
  /here'?s how to/i,
  /only use this/i,
  /prefer this tool/i,
  /best used when/i,
  /ideal for/i,
  /recommended when/i,

  // Multi-step procedures
  /\bfirst,?\s+(?:check|verify|ensure|call|use|make|read|write|then|next|you)/i,
  /\bstep\s+\d+/i,
  /follow these steps/i,
  /\bthen\s+(?:you|call|use|check|verify|read|write)/i,
  /after that/i,
  /\bnext,?\s+(?:you|then|call|use|check|read|write)/i,

  // Conditional guidance
  /if you (need|want|are|have)/i,
  /depending on/i,
  /unless you/i,
  /make sure (that|to)/i,

  // Best practices / policy
  /best practice/i,
  /recommended (approach|way|method)/i,
  /it is (recommended|advisable|suggested)/i,
  /\b(always|never)\s+(use|call|check|specify)/i,
  /avoid (using|calling)/i,
  /do not (use|call|specify)/i,
  /important:/i,
  /note:/i,
  /be careful/i,
  /caution/i,

  // Call-order guidance
  /before calling/i,
  /after calling/i,
  /call this (before|after)/i,
  /you must (first|then)/i,
  /ensure that/i,
  /verify that/i,
];

export interface M1Raw {
  tools: Array<{
    name: string;
    hasGuidancePhrases: boolean;
    matchedPatterns: string[];
    passed: boolean;
  }>;
}

export function evaluateM1(tools: McpToolDefinition[]): HeuristicResult {
  const toolResults = tools.map((tool) => {
    const matchedPatterns = STRATEGY_PATTERNS.filter((p) => p.test(tool.description)).map(
      (p) => p.source,
    );
    const hasGuidancePhrases = matchedPatterns.length > 0;
    const passed = !hasGuidancePhrases;

    return {
      name: tool.name,
      hasGuidancePhrases,
      matchedPatterns,
      passed,
    };
  });

  const allPassed = toolResults.every((t) => t.passed);

  return {
    verdict: allPassed ? 'PASS' : 'FAIL',
    score: allPassed ? 100 : 0,
    raw: { tools: toolResults } as M1Raw,
  };
}
