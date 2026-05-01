// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreResult {
  score: number;
  reason: string;
}

export interface ProcessMetadata {
  turns: number;
  optimalTurns?: number;
  errors: number;
  recoveries: number;
  redundantCalls: number;
}

// ─── Task Completion Scoring ──────────────────────────────────────────────────

/**
 * Score task completion by checking if criteria strings appear in the final text.
 *
 * Scoring:
 * - 1.0 = all criteria met
 * - 0.5 = some criteria met (>= 1/3)
 * - 0.0 = no criteria met
 */
export function scoreTaskCompletion(
  finalText: string,
  criteria: string[],
): ScoreResult {
  if (criteria.length === 0) {
    return { score: 1.0, reason: "No criteria to check (vacuous pass)" };
  }

  const lower = finalText.toLowerCase();
  const met: string[] = [];
  const missed: string[] = [];

  for (const c of criteria) {
    if (lower.includes(c.toLowerCase())) {
      met.push(c);
    } else {
      missed.push(c);
    }
  }

  const ratio = met.length / criteria.length;
  let score: number;
  if (ratio >= 1.0) {
    score = 1.0;
  } else if (ratio >= 1 / 3) {
    score = 0.5;
  } else {
    score = 0.0;
  }

  const reason =
    missed.length === 0
      ? `All ${criteria.length} criteria met`
      : `Met [${met.join(", ")}], missed [${missed.join(", ")}] (${met.length}/${criteria.length})`;

  return { score, reason };
}

// ─── Process Quality Scoring ──────────────────────────────────────────────────

/**
 * Score process quality based on execution metadata.
 *
 * Components:
 * - Turn efficiency: ratio of optimal to actual turns
 * - Error recovery: agents that recover score higher than those with no errors
 * - Redundant call penalty: same tool + same params = waste
 *
 * MUST NOT penalize error recovery — recovery is a positive signal.
 */
export function scoreProcessQuality(metadata: ProcessMetadata): ScoreResult {
  const { turns, errors, recoveries, redundantCalls } = metadata;
  const optimalTurns = metadata.optimalTurns ?? turns; // default: assume current is optimal

  // Turn efficiency: 1.0 if at optimal, decreasing with more turns
  const turnEfficiency = optimalTurns > 0
    ? Math.min(1.0, optimalTurns / turns)
    : 1.0;

  // Error recovery bonus: recovering from errors is a POSITIVE signal
  // No errors = 0.8 base (good but not great)
  // Errors with full recovery = 1.0 (demonstrated resilience)
  // Errors without recovery = 0.3 (problematic)
  let recoveryScore: number;
  if (errors === 0) {
    recoveryScore = 0.8;
  } else if (recoveries >= errors) {
    recoveryScore = 1.0; // full recovery
  } else {
    recoveryScore = 0.3 + 0.7 * (recoveries / errors); // partial recovery
  }

  // Redundant call penalty: each redundant call reduces score
  const redundancyPenalty = Math.min(0.5, redundantCalls * 0.15);

  // Weighted composite: turn efficiency (40%), recovery (40%), redundancy (20%)
  const rawScore = 0.4 * turnEfficiency + 0.4 * recoveryScore + 0.2 * (1.0 - redundancyPenalty);
  const score = Math.max(0, Math.min(1, rawScore));

  const parts: string[] = [];
  parts.push(`Turns: ${turns}/${optimalTurns}`);
  parts.push(`Errors: ${errors}`);
  parts.push(`Recoveries: ${recoveries}/${errors}`);
  parts.push(`Redundant calls: ${redundantCalls}`);
  const reason = parts.join(" | ");

  return { score, reason };
}
