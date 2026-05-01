/**
 * Hint injection engine — detects error/empty/ambiguous tool responses
 * and appends contextual hints, while leaving success responses untouched.
 *
 * Output format is byte-identical to the existing withHints() in
 * benchmark/servers/variants/talking/hints.ts:
 *   text + "\n\n" + hints.map(h => "→ " + h).join("\n")
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

/** A single hint to append to a tool response */
export interface HintEntry {
  /** The hint text (without the "→ " prefix — that's added during formatting) */
  hint: string;
}

/**
 * Pattern that triggers hints. Matches against the raw tool response text.
 * If multiple patterns match, all their hints are collected.
 */
export interface HintPattern {
  /** Unique name for logging/debugging */
  name: string;
  /** Pattern detector — returns true if this pattern applies */
  match: (text: string, isError: boolean) => boolean;
  /** Hints to append when this pattern matches */
  hints: string[];
}

/**
 * Per-tool hint configuration. Maps a tool name to a set of patterns
 * and their associated hints.
 */
export interface ToolHintConfig {
  patterns: HintPattern[];
}

/**
 * Full hint config: maps tool names to their hint configurations.
 */
export type HintConfig = Record<string, ToolHintConfig>;

// ─── Format function (byte-identical to withHints) ──────────────────────────────

/**
 * Format hints for appending to tool response text.
 * If hints array is empty, returns the original text unchanged (strict equality).
 * If non-empty, returns text + "\n\n" + hints with "→ " prefix joined by "\n".
 */
export function formatHints(text: string, hints: string[]): string {
  if (hints.length === 0) return text;
  return text + "\n\n" + hints.map(h => `→ ${h}`).join("\n");
}

// ─── Pattern detectors (reusable across tools) ──────────────────────────────────

/** Detect empty JSON objects like {"entities":[],"relations":[]} */
export function isEmptyArrayResult(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const values = Object.values(parsed);
    return values.length > 0 && values.every(v => Array.isArray(v) && v.length === 0);
  } catch {
    return false;
  }
}

/** Detect null/undefined results */
export function isNullOrUndefinedResult(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed === "null" || trimmed === "undefined" || trimmed === "";
}

/** Detect error responses — either isError flag or text starting with "Error:" */
export function isErrorResult(text: string, isError: boolean): boolean {
  return isError || text.trim().startsWith("Error:");
}

/** Detect empty string results */
export function isEmptyStringResult(text: string): boolean {
  return text.trim() === "";
}

/** Detect zero-match search results (JSON with empty arrays) */
export function isZeroMatchResult(text: string): boolean {
  return isEmptyArrayResult(text);
}

/** Detect "not found" patterns in error messages */
export function isNotFoundResult(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("not found") || lower.includes("does not exist") || lower.includes("no entities");
}

// ─── HintInjector class ─────────────────────────────────────────────────────────

/**
 * Injects hints into MCP tool call responses based on configured patterns.
 *
 * - Success responses pass through untouched (strict equality — no copy).
 * - Error/empty responses have hints appended after the original text.
 * - Idempotent: if text already contains "→", no additional hints are injected.
 */
export class HintInjector {
  private readonly config: HintConfig;
  private readonly verbose: boolean;

  constructor(config: HintConfig, verbose = false) {
    this.config = config;
    this.verbose = verbose;
  }

  /**
   * Inject hints into a tool call response.
   *
   * @param response - The raw MCP tool call response with content array
   * @param toolName - Name of the tool that was called
   * @returns The response, either unmodified (success) or with hints appended
   */
  inject<T extends { content: Array<{ type: string; text?: string }>; isError?: boolean }>(
    response: T,
    toolName: string,
  ): T {
    const toolConfig = this.config[toolName];
    if (!toolConfig) return response;

    // Find the first text content block
    const textBlock = response.content.find(c => c.type === "text" && c.text !== undefined);
    if (!textBlock || textBlock.text === undefined) return response;

    const originalText = textBlock.text;
    const isError = response.isError ?? false;

    // Idempotent: if text already contains hints, don't inject again
    if (originalText.includes("→")) return response;

    // Collect matching hints
    const matchedHints: string[] = [];
    for (const pattern of toolConfig.patterns) {
      if (pattern.match(originalText, isError)) {
        matchedHints.push(...pattern.hints);
      }
    }

    // No hints matched — return unmodified (strict equality)
    if (matchedHints.length === 0) return response;

    // Append hints to the text
    const newText = formatHints(originalText, matchedHints);

    if (this.verbose) {
      console.error(`[HintInjector] Tool=${toolName}, patterns matched: ${matchedHints.length} hints injected`);
    }

    // Return a shallow copy with modified text
    return {
      ...response,
      content: response.content.map(block =>
        block === textBlock
          ? { ...block, text: newText }
          : block,
      ),
    };
  }
}
