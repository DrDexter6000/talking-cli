import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerTaskRow {
  taskId: string;
  mute: { pass: boolean; inputTokens: number; outputTokens: number; turns: number };
  talking: { pass: boolean; inputTokens: number; outputTokens: number; turns: number };
  delta: "talking_win" | "mute_win" | "tie";
  deltaInputTokens: number; // talking - mute (negative = talking cheaper)
  deltaOutputTokens: number;
  deltaTurns: number;
}

export interface AggregateStats {
  talkingWins: number;
  muteWins: number;
  ties: number;
  signTestN: number;
  signTestPValue: number;
  // Token deltas
  meanDeltaInputTokens: number;
  meanDeltaOutputTokens: number;
  // Wilcoxon
  wilcoxonW: number;
  wilcoxonPValue: number;
}

export interface SummaryJson {
  provider?: string;
  perTask: PerTaskRow[];
  aggregate: AggregateStats;
  tieCount: number;
}

type LegacyRawEntry = {
  taskId: string;
  variant: string;
  input_tokens?: number;
  output_tokens?: number;
  outcome?: string;
};

type BenchmarkResultEntry = {
  taskId: string;
  variant: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  outcome: string;
  pass: boolean;
};

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Read raw.jsonl from fixtureDir and compute per-task + aggregate stats.
 */
export function computeStats(fixtureDir: string): SummaryJson {
  const resultPath = resolve(fixtureDir, "results.jsonl");
  const rawPath = resolve(fixtureDir, "raw.jsonl");

  if (existsSync(resultPath)) {
    return computeStatsFromResults(resultPath);
  }

  return computeStatsFromLegacyRaw(rawPath);
}

function computeStatsFromResults(resultPath: string): SummaryJson {
  const entries = readNonEmptyLines(resultPath).map(
    (line) => JSON.parse(line) as BenchmarkResultEntry,
  );

  const taskMap = new Map<string, { mute?: BenchmarkResultEntry; talking?: BenchmarkResultEntry }>();
  for (const entry of entries) {
    if (!taskMap.has(entry.taskId)) {
      taskMap.set(entry.taskId, {});
    }

    const slot = taskMap.get(entry.taskId);
    if (!slot) continue;

    if (entry.variant === "mute") slot.mute = entry;
    else if (entry.variant === "talking") slot.talking = entry;
  }

  return summarizeTaskMap(taskMap, (entry) => ({
    pass: entry.pass,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    turns: entry.turns,
  }));
}

function computeStatsFromLegacyRaw(rawPath: string): SummaryJson {
  const entries = readNonEmptyLines(rawPath).map((line) => JSON.parse(line) as LegacyRawEntry);

  const taskMap = new Map<string, { mute?: LegacyRawEntry; talking?: LegacyRawEntry }>();
  for (const entry of entries) {
    if (!taskMap.has(entry.taskId)) {
      taskMap.set(entry.taskId, {});
    }
    const slot = taskMap.get(entry.taskId);
    if (!slot) continue;
    if (entry.variant === "mute") slot.mute = entry;
    else if (entry.variant === "talking") slot.talking = entry;
  }

  return summarizeTaskMap(taskMap, (entry) => ({
    pass: entry.outcome !== "error" && entry.outcome !== "timeout",
    inputTokens: entry.input_tokens ?? 0,
    outputTokens: entry.output_tokens ?? 0,
    turns: 1,
  }));
}

function summarizeTaskMap<TEntry>(
  taskMap: Map<string, { mute?: TEntry; talking?: TEntry }>,
  toMetrics: (entry: TEntry) => {
    pass: boolean;
    inputTokens: number;
    outputTokens: number;
    turns: number;
  },
): SummaryJson {
  const perTask: PerTaskRow[] = [];
  for (const [taskId, slot] of taskMap) {
    const muteMetrics = slot.mute
      ? toMetrics(slot.mute)
      : { pass: false, inputTokens: 0, outputTokens: 0, turns: 0 };
    const talkingMetrics = slot.talking
      ? toMetrics(slot.talking)
      : { pass: false, inputTokens: 0, outputTokens: 0, turns: 0 };

    let delta: "talking_win" | "mute_win" | "tie";
    if (talkingMetrics.pass && !muteMetrics.pass) delta = "talking_win";
    else if (muteMetrics.pass && !talkingMetrics.pass) delta = "mute_win";
    else delta = "tie";

    perTask.push({
      taskId,
      mute: {
        pass: muteMetrics.pass,
        inputTokens: muteMetrics.inputTokens,
        outputTokens: muteMetrics.outputTokens,
        turns: muteMetrics.turns,
      },
      talking: {
        pass: talkingMetrics.pass,
        inputTokens: talkingMetrics.inputTokens,
        outputTokens: talkingMetrics.outputTokens,
        turns: talkingMetrics.turns,
      },
      delta,
      deltaInputTokens: talkingMetrics.inputTokens - muteMetrics.inputTokens,
      deltaOutputTokens: talkingMetrics.outputTokens - muteMetrics.outputTokens,
      deltaTurns: talkingMetrics.turns - muteMetrics.turns,
    });
  }

  // Aggregate
  const talkingWins = perTask.filter((r) => r.delta === "talking_win").length;
  const muteWins = perTask.filter((r) => r.delta === "mute_win").length;
  const ties = perTask.filter((r) => r.delta === "tie").length;
  const signTestN = talkingWins + muteWins;
  const signTestPValue = signTestP(signTestN, Math.max(talkingWins, muteWins));

  // Mean token deltas (only for non-ties in outcome)
  const nonTieRows = perTask.filter((r) => r.delta !== "tie");
  const meanDeltaInputTokens = nonTieRows.length > 0
    ? nonTieRows.reduce((s, r) => s + r.deltaInputTokens, 0) / nonTieRows.length
    : 0;
  const meanDeltaOutputTokens = nonTieRows.length > 0
    ? nonTieRows.reduce((s, r) => s + r.deltaOutputTokens, 0) / nonTieRows.length
    : 0;

  // Wilcoxon signed-rank on input token deltas
  const allDeltas = perTask.map((r) => r.deltaInputTokens);
  const { W: wilcoxonW, pValue: wilcoxonPValue } = wilcoxonSignedRank(allDeltas);

  return {
    perTask,
    aggregate: {
      talkingWins,
      muteWins,
      ties,
      signTestN,
      signTestPValue,
      meanDeltaInputTokens,
      meanDeltaOutputTokens,
      wilcoxonW,
      wilcoxonPValue,
    },
    tieCount: ties,
  };
}

function readNonEmptyLines(filePath: string): string[] {
  return readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// ─── Sign test ────────────────────────────────────────────────────────────────

/**
 * Two-tailed sign test p-value.
 * n = number of non-tied pairs, k = count of wins for the larger group.
 */
function signTestP(n: number, k: number): number {
  if (n === 0) return 1;
  // Sum of binomial probabilities from k to n
  let p = 0;
  for (let i = k; i <= n; i++) {
    p += binomialCoeff(n, i) * Math.pow(0.5, n);
  }
  // Two-tailed
  return Math.min(2 * p, 1);
}

function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > Math.floor(n / 2)) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

// ─── Wilcoxon signed-rank test (hand-rolled) ──────────────────────────────────

interface WilcoxonResult {
  W: number;
  pValue: number;
}

function wilcoxonSignedRank(values: number[]): WilcoxonResult {
  // Exclude zeros
  const nonZero = values.filter((v) => v !== 0);
  const n = nonZero.length;

  if (n === 0) return { W: 0, pValue: 1 };

  // Rank by absolute value
  const absValues = nonZero.map((v) => Math.abs(v));
  const sorted = [...absValues].sort((a, b) => a - b);

  // Assign ranks (handle ties by averaging)
  const rankMap = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const val = sorted[i];
    if (!rankMap.has(val)) {
      // Find all occurrences of this value
      const start = i;
      let end = i;
      while (end < sorted.length && sorted[end] === val) end++;
      const avgRank = (start + 1 + end) / 2; // 1-based
      rankMap.set(val, avgRank);
      i = end - 1;
    }
  }

  // Sum ranks for positive values
  let Wplus = 0;
  for (const v of nonZero) {
    if (v > 0) {
      Wplus += rankMap.get(Math.abs(v))!;
    }
  }

  // W is the smaller of sum of positive/negative ranks
  const totalRank = (n * (n + 1)) / 2;
  const Wminus = totalRank - Wplus;
  const W = Math.min(Wplus, Wminus);

  // Normal approximation for p-value (for n >= 5)
  // For small n, we use exact distribution
  let pValue: number;
  if (n >= 20) {
    // Normal approximation
    const meanW = (n * (n + 1)) / 4;
    const varW = (n * (n + 1) * (2 * n + 1)) / 24;
    const z = Math.abs(W - meanW) / Math.sqrt(varW);
    pValue = 2 * (1 - normalCDF(z));
  } else {
    // Exact: enumerate the distribution
    pValue = exactWilcoxonP(W, n);
  }

  return { W, pValue: Math.min(pValue, 1) };
}

function exactWilcoxonP(W: number, n: number): number {
  // Count number of ways to assign signs that yield W' <= W
  const totalRank = (n * (n + 1)) / 2;
  // Use dynamic programming to count ways to get each possible sum
  // dp[s] = number of ways to have a positive rank sum of exactly s
  const dp: number[] = new Array(totalRank + 1).fill(0);
  dp[0] = 1;

  for (let i = 1; i <= n; i++) {
    for (let s = totalRank; s >= i; s--) {
      dp[s] += dp[s - i];
    }
  }

  // Total possible sign assignments
  const total = Math.pow(2, n);

  // Two-tailed: count ways where W' <= W or W' >= totalRank - W
  let count = 0;
  for (let s = 0; s <= totalRank; s++) {
    if (s <= W || s >= totalRank - W) {
      count += dp[s];
    }
  }

  return count / total;
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 7.1.26)
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * z);
  return 1 - (a1 * t + a2 * t * t + a3 * Math.pow(t, 3) + a4 * Math.pow(t, 4) + a5 * Math.pow(t, 5)) * Math.exp(-(z * z) / 2);
}
