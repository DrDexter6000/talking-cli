// ─── Types ────────────────────────────────────────────────────────────────────

/** A conversation turn (OpenAI or Anthropic format). */
export interface ConversationTurn {
  role: string;
  content: string | null;
  /** OpenAI-format tool calls. */
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  /** Anthropic-format tool use blocks. */
  tool_use?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
}

/** Expected tools and optional parameter patterns. */
export interface ExpectedTools {
  tools: string[];
  params?: Record<string, string | RegExp>;
}

interface ScoreResult {
  score: number;
  reason: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score tool-call correctness by inspecting conversation history.
 *
 * Scoring:
 * - 1.0 = correct tool(s) + correct params
 * - 0.5 = correct tool(s) but partial/missing params, or only some expected tools called
 * - 0.0 = wrong tool, no tool calls, or completely wrong params
 */
export function scoreToolCallCorrectness(
  conversation: ConversationTurn[],
  expected: ExpectedTools,
): ScoreResult {
  // Extract all tool calls from conversation (both formats)
  const calledTools: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const turn of conversation) {
    if (turn.tool_calls) {
      for (const tc of turn.tool_calls) {
        calledTools.push({ name: tc.function.name, args: tc.function.arguments });
      }
    }
    if (turn.tool_use) {
      for (const tu of turn.tool_use) {
        calledTools.push({ name: tu.name, args: tu.input });
      }
    }
  }

  // Zero tool calls = automatic 0.0
  if (calledTools.length === 0) {
    return { score: 0.0, reason: "Agent made no tool calls (hallucinated text only)" };
  }

  // Check which expected tools were called
  const expectedSet = new Set(expected.tools);
  const calledNames = new Set(calledTools.map((t) => t.name));
  const matchedTools = expected.tools.filter((t) => calledNames.has(t));
  const toolMatchRatio = matchedTools.length / expected.tools.length;

  // No expected tools were called → 0.0
  if (matchedTools.length === 0) {
    const called = [...calledNames].join(", ");
    return { score: 0.0, reason: `Wrong tool(s): called [${called}], expected [${expected.tools.join(", ")}]` };
  }

  // Not all expected tools called → partial (0.5) at best
  if (toolMatchRatio < 1.0) {
    const missing = expected.tools.filter((t) => !calledNames.has(t));
    return {
      score: 0.5,
      reason: `Partial tool match: called [${matchedTools.join(", ")}], missing [${missing.join(", ")}]`,
    };
  }

  // All expected tools called — check params if specified
  if (expected.params) {
    const paramResult = scoreParams(calledTools, expected.tools, expected.params);
    if (paramResult.allMatch) {
      return { score: 1.0, reason: `Correct tools and params: ${expected.tools.join(", ")}` };
    }
    return {
      score: 0.5,
      reason: `Correct tools, partial params: ${paramResult.detail}`,
    };
  }

  // All tools matched, no param check → 1.0
  return { score: 1.0, reason: `Correct tools: ${expected.tools.join(", ")}` };
}

/** Check if called tools have params matching expected patterns. */
function scoreParams(
  calledTools: Array<{ name: string; args: Record<string, unknown> }>,
  expectedTools: string[],
  expectedParams: Record<string, string | RegExp>,
): { allMatch: boolean; detail: string } {
  const mismatches: string[] = [];
  const matches: string[] = [];

  for (const [paramKey, pattern] of Object.entries(expectedParams)) {
    let found = false;
    for (const call of calledTools) {
      const value = call.args[paramKey];
      if (value === undefined) continue;

      const strValue = String(value);
      if (pattern instanceof RegExp) {
        if (pattern.test(strValue)) {
          found = true;
          matches.push(paramKey);
          break;
        }
      } else {
        // Semantic match: expected string is contained in actual value
        if (strValue.toLowerCase().includes(pattern.toLowerCase())) {
          found = true;
          matches.push(paramKey);
          break;
        }
      }
    }
    if (!found) {
      mismatches.push(paramKey);
    }
  }

  if (mismatches.length === 0) {
    return { allMatch: true, detail: `all params matched: ${matches.join(", ")}` };
  }
  return {
    allMatch: false,
    detail: `matched [${matches.join(", ")}], missed [${mismatches.join(", ")}]`,
  };
}
