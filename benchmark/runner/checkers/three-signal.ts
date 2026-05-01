import type { CheckerResult } from "./types.js";

// ─── Three-Signal Types ───────────────────────────────────────────────────────

/** A single signal score within a three-signal checker result. */
export interface SignalScore {
  name: string;
  weight: number;
  score: number; // 0–1
  reason?: string;
}

/** Result from a three-signal checker: tool-call (40%) + task completion (40%) + process quality (20%). */
export interface ThreeSignalResult extends CheckerResult {
  score: number; // weighted sum (always set, not optional like CheckerResult)
  signals: SignalScore[];
  signalBreakdown: string;
}

/** Options for buildThreeSignalResult. */
interface BuildOptions {
  passThreshold?: number; // default 0.6
}

// ─── Build ────────────────────────────────────────────────────────────────────

/**
 * Build a ThreeSignalResult from evaluated signals.
 * Weighted sum of signal scores, pass threshold 0.6 (consistent with existing rubric).
 */
export function buildThreeSignalResult(
  taskLabel: string,
  signals: SignalScore[],
  options?: BuildOptions,
): ThreeSignalResult {
  const passThreshold = options?.passThreshold ?? 0.6;
  const score = signals.reduce((sum, s) => sum + s.weight * s.score, 0);
  const pass = score >= passThreshold;

  const passedSubchecks = signals
    .filter((s) => s.score >= 0.6)
    .map((s) => s.name);

  const failedSignals = signals.filter((s) => s.score < 0.6);
  const passedSignals = signals.filter((s) => s.score >= 0.6);

  const reason =
    failedSignals.length === 0
      ? `${taskLabel}: all signals passed (score ${score.toFixed(2)})`
      : `${taskLabel}: passed [${passedSignals.map((s) => s.name).join(", ")}], missed [${failedSignals.map((s) => s.name).join(", ")}] (score ${score.toFixed(2)})`;

  const breakdown = signals
    .map((s) => `${s.name}: ${s.score.toFixed(1)}/${s.weight.toFixed(1)}`)
    .join(" | ");

  return {
    pass,
    reason,
    score,
    passedSubchecks,
    signals,
    signalBreakdown: `${breakdown} → Score: ${score.toFixed(2)}`,
  };
}

// ─── Anti-Cheat Enforcement ───────────────────────────────────────────────────

/** Informational tool calls that should not count as substantive. */
const INFORMATIONAL_TOOLS = new Set([
  "list_tools",
  "list_allowed_directories",
]);

interface AntiCheatOptions {
  informationalCalls?: number;
}

/**
 * Enforce anti-cheat: zero substantive tool calls → automatic fail.
 * Signal scores are still computed and reported for analysis.
 */
export function enforceAntiCheat(
  result: ThreeSignalResult,
  toolCallCount: number,
  options?: AntiCheatOptions,
): ThreeSignalResult {
  const informationalCalls = options?.informationalCalls ?? 0;
  const substantiveCalls = toolCallCount - informationalCalls;

  if (substantiveCalls === 0) {
    return {
      ...result,
      pass: false,
      score: 0,
      reason: `Zero tool calls — automatic fail (anti-cheat). Signals were: ${result.signalBreakdown}`,
    };
  }

  // Suspiciously low: only 1 substantive call
  if (substantiveCalls === 1) {
    return {
      ...result,
      reason: `${result.reason} [warning: low tool-call count (${substantiveCalls} substantive)]`,
    };
  }

  return result;
}
