export interface CheckerResult {
  pass: boolean;
  reason: string;
  /** Rubric score 0.0–1.0 for hard-tier tasks. Optional: easy/medium checkers omit this. */
  score?: number;
  /** Named sub-checks that passed, for rubric transparency */
  passedSubchecks?: string[];
}

/** A single rubric dimension: name, weight (0–1, sum to 1.0), and pass/fail. */
export interface RubricDimension {
  name: string;
  weight: number;
  passed: boolean;
}

/** Checker function returning {pass, reason} and optionally {score, passedSubchecks} for rubric tasks. */
export type CheckerFn = (finalTurn: unknown, fs: Record<string, string>) => CheckerResult;
