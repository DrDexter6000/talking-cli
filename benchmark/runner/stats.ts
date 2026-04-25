import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isLegacyVariant,
  ABLATION_CONTRASTS,
  type BenchmarkRunResult,
  type BenchmarkTask,
} from "./types.js";

// ─── Ablation Types ───────────────────────────────────────────────────────────

export interface MetricValues {
  pass: boolean;
  inputTokens: number;
  outputTokens: number;
  turns: number;
  walltime: number;
  errorRecoveries?: number;
  toolCalls?: number;
}

export interface PerCellRow {
  taskId: string;
  cells: Record<string, MetricValues>;
  contrasts: Record<string, ContrastResult>;
}

export interface ContrastResult {
  label: string;
  deltaPass: number;
  deltaInputTokens: number;
  deltaOutputTokens: number;
  deltaTurns: number;
  deltaWalltime: number;
}

export interface ContrastAggregate {
  label: string;
  treatment: string;
  control: string;
  meanDeltaInputTokens: number;
  meanDeltaOutputTokens: number;
  meanDeltaTurns: number;
  talkingWins: number;
  controlWins: number;
  ties: number;
  signTestPValue: number;
  wilcoxonW: number;
  wilcoxonPValue: number;
}

export interface AblationSummaryJson {
  schemaVersion?: number;
  provider?: string;
  providers?: string[];
  perTask: PerCellRow[];
  contrasts: Record<string, ContrastAggregate>;
  tieCount: number;
}

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface PerTaskRow {
  taskId: string;
  mute: { 
    pass: boolean; 
    inputTokens: number; 
    outputTokens: number; 
    turns: number;
    walltime: number;
    errorRecoveries?: number;
    toolCalls?: number;
  };
  talking: { 
    pass: boolean; 
    inputTokens: number; 
    outputTokens: number; 
    turns: number;
    walltime: number;
    errorRecoveries?: number;
    toolCalls?: number;
  };
  delta: "talking_win" | "mute_win" | "tie";
  deltaInputTokens: number; // talking - mute (negative = talking cheaper)
  deltaOutputTokens: number;
  deltaTurns: number;
  deltaWalltime: number;
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
  // Time deltas
  meanDeltaWalltime: number;
  medianDeltaWalltime: number;
  // Recovery metrics
  talkingRecoveries: number;
  muteRecoveries: number;
  // Efficiency
  tokensPerTaskTalking: number;
  tokensPerTaskMute: number;
  // Wilcoxon
  wilcoxonW: number;
  wilcoxonPValue: number;
}

export interface SummaryJson {
  schemaVersion?: number;
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
  provider?: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  walltime: number;
  outcome: string;
  pass: boolean;
  errorRecoveries?: number;
  toolCalls?: number;
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
    walltime: entry.walltime,
    errorRecoveries: entry.errorRecoveries,
    toolCalls: entry.toolCalls,
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
    walltime: 0,
  }));
}

function summarizeTaskMap<TEntry>(
  taskMap: Map<string, { mute?: TEntry; talking?: TEntry }>,
  toMetrics: (entry: TEntry) => {
    pass: boolean;
    inputTokens: number;
    outputTokens: number;
    turns: number;
    walltime: number;
    errorRecoveries?: number;
    toolCalls?: number;
  },
): SummaryJson {
  const perTask: PerTaskRow[] = [];
  for (const [taskId, slot] of taskMap) {
    const muteMetrics = slot.mute
      ? toMetrics(slot.mute)
      : { pass: false, inputTokens: 0, outputTokens: 0, turns: 0, walltime: 0 };
    const talkingMetrics = slot.talking
      ? toMetrics(slot.talking)
      : { pass: false, inputTokens: 0, outputTokens: 0, turns: 0, walltime: 0 };

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
        walltime: muteMetrics.walltime,
        errorRecoveries: muteMetrics.errorRecoveries,
        toolCalls: muteMetrics.toolCalls,
      },
      talking: {
        pass: talkingMetrics.pass,
        inputTokens: talkingMetrics.inputTokens,
        outputTokens: talkingMetrics.outputTokens,
        turns: talkingMetrics.turns,
        walltime: talkingMetrics.walltime,
        errorRecoveries: talkingMetrics.errorRecoveries,
        toolCalls: talkingMetrics.toolCalls,
      },
      delta,
      deltaInputTokens: talkingMetrics.inputTokens - muteMetrics.inputTokens,
      deltaOutputTokens: talkingMetrics.outputTokens - muteMetrics.outputTokens,
      deltaTurns: talkingMetrics.turns - muteMetrics.turns,
      deltaWalltime: talkingMetrics.walltime - muteMetrics.walltime,
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

  // Time metrics
  const meanDeltaWalltime = nonTieRows.length > 0
    ? nonTieRows.reduce((s, r) => s + r.deltaWalltime, 0) / nonTieRows.length
    : 0;
  const sortedWalltime = [...perTask.map(r => r.deltaWalltime)].sort((a, b) => a - b);
  const medianDeltaWalltime = sortedWalltime.length > 0
    ? sortedWalltime[Math.floor(sortedWalltime.length / 2)]
    : 0;

  // Recovery metrics
  const talkingRecoveries = perTask.reduce((sum, r) => sum + (r.talking.errorRecoveries ?? 0), 0);
  const muteRecoveries = perTask.reduce((sum, r) => sum + (r.mute.errorRecoveries ?? 0), 0);

  // Efficiency: tokens per successful task
  const talkingSuccessCount = perTask.filter(r => r.talking.pass).length;
  const muteSuccessCount = perTask.filter(r => r.mute.pass).length;
  const tokensPerTaskTalking = talkingSuccessCount > 0
    ? perTask.filter(r => r.talking.pass).reduce((s, r) => s + r.talking.inputTokens + r.talking.outputTokens, 0) / talkingSuccessCount
    : 0;
  const tokensPerTaskMute = muteSuccessCount > 0
    ? perTask.filter(r => r.mute.pass).reduce((s, r) => s + r.mute.inputTokens + r.mute.outputTokens, 0) / muteSuccessCount
    : 0;

  // Wilcoxon signed-rank on input token deltas
  const allDeltas = perTask.map((r) => r.deltaInputTokens);
  const { W: wilcoxonW, pValue: wilcoxonPValue } = wilcoxonSignedRank(allDeltas);

  return {
    schemaVersion: 1,
    perTask,
    aggregate: {
      talkingWins,
      muteWins,
      ties,
      signTestN,
      signTestPValue,
      meanDeltaInputTokens,
      meanDeltaOutputTokens,
      meanDeltaWalltime,
      medianDeltaWalltime,
      talkingRecoveries,
      muteRecoveries,
      tokensPerTaskTalking,
      tokensPerTaskMute,
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

// ─── Ablation detection & computation ─────────────────────────────────────────

/**
 * Check whether a results.jsonl contains ablation-format entries (variant
 * contains "+") rather than legacy "mute"/"talking" variants.
 */
export function isAblationResults(resultPath: string): boolean {
  if (!existsSync(resultPath)) return false;
  const lines = readNonEmptyLines(resultPath);
  if (lines.length === 0) return false;
  try {
    const first = JSON.parse(lines[0]) as BenchmarkResultEntry;
    return !isLegacyVariant(first.variant) && first.variant.includes("+");
  } catch {
    return false;
  }
}

/**
 * Read results.jsonl with ablation variants (e.g. "talking+mute") and compute
 * per-cell stats + named contrasts with sign test & Wilcoxon.
 */
export function computeAblationStats(resultPath: string, provider?: string): AblationSummaryJson {
  const entries = readNonEmptyLines(resultPath).map(
    (line) => JSON.parse(line) as BenchmarkResultEntry,
  );

  // Group entries by taskId
  const taskMap = new Map<string, Map<string, BenchmarkResultEntry>>();
  const providers = new Set<string>();
  for (const entry of entries) {
    if (!taskMap.has(entry.taskId)) {
      taskMap.set(entry.taskId, new Map());
    }
    taskMap.get(entry.taskId)!.set(entry.variant, entry);
    if (entry.provider) providers.add(entry.provider);
  }

  // Build per-task rows with cells + contrast results
  const perTask: PerCellRow[] = [];
  for (const [taskId, variantMap] of taskMap) {
    const cells: Record<string, MetricValues> = {};
    for (const [variant, entry] of variantMap) {
      cells[variant] = {
        pass: entry.pass,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        turns: entry.turns,
        walltime: entry.walltime,
        errorRecoveries: entry.errorRecoveries,
        toolCalls: entry.toolCalls,
      };
    }

    const contrasts: Record<string, ContrastResult> = {};
    for (const contrast of ABLATION_CONTRASTS) {
      const treatment = variantMap.get(contrast.treatment);
      const control = variantMap.get(contrast.control);
      if (treatment && control) {
        contrasts[contrast.name] = {
          label: contrast.label,
          deltaPass:
            treatment.pass && !control.pass ? 1 :
            control.pass && !treatment.pass ? -1 : 0,
          deltaInputTokens: treatment.inputTokens - control.inputTokens,
          deltaOutputTokens: treatment.outputTokens - control.outputTokens,
          deltaTurns: treatment.turns - control.turns,
          deltaWalltime: treatment.walltime - control.walltime,
        };
      }
    }

    perTask.push({ taskId, cells, contrasts });
  }

  // Aggregate named contrasts
  const contrastAggregates: Record<string, ContrastAggregate> = {};
  for (const contrast of ABLATION_CONTRASTS) {
    const rows = perTask.filter((r) => r.contrasts[contrast.name]);
    if (rows.length === 0) continue;

    const deltas = rows.map((r) => r.contrasts[contrast.name]);

    const meanDeltaInputTokens =
      deltas.reduce((s, d) => s + d.deltaInputTokens, 0) / deltas.length;
    const meanDeltaOutputTokens =
      deltas.reduce((s, d) => s + d.deltaOutputTokens, 0) / deltas.length;
    const meanDeltaTurns =
      deltas.reduce((s, d) => s + d.deltaTurns, 0) / deltas.length;

    const talkingWins = deltas.filter((d) => d.deltaPass > 0).length;
    const controlWins = deltas.filter((d) => d.deltaPass < 0).length;
    const ties = deltas.filter((d) => d.deltaPass === 0).length;

    const signTestN = talkingWins + controlWins;
    const signTestPValue = signTestN > 0
      ? signTestP(signTestN, Math.max(talkingWins, controlWins))
      : 1;

    const tokenDeltas = deltas.map((d) => d.deltaInputTokens);
    const { W: wilcoxonW, pValue: wilcoxonPValue } = wilcoxonSignedRank(tokenDeltas);

    contrastAggregates[contrast.name] = {
      label: contrast.label,
      treatment: contrast.treatment,
      control: contrast.control,
      meanDeltaInputTokens,
      meanDeltaOutputTokens,
      meanDeltaTurns,
      talkingWins,
      controlWins,
      ties,
      signTestPValue,
      wilcoxonW,
      wilcoxonPValue,
    };
  }

  const tieCount = perTask.reduce(
    (sum, r) => {
      const fullContrast = r.contrasts["full_vs_control"];
      return sum + (fullContrast ? (fullContrast.deltaPass === 0 ? 1 : 0) : 0);
    },
    0,
  );

  const result: AblationSummaryJson = {
    schemaVersion: 1,
    perTask,
    contrasts: contrastAggregates,
    tieCount,
  };

  if (provider) {
    result.provider = provider;
  } else if (providers.size === 1) {
    result.provider = [...providers][0];
  } else if (providers.size > 1) {
    result.providers = [...providers].sort();
  }

  return result;
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

// ─── Rubric Score Aggregation ─────────────────────────────────────────────────

export interface TierScoreRow {
  tier: string;
  avgScore: number;
  count: number;
}

/**
 * Compute average rubric scores per tier for tasks that have score data.
 */
export function computeTierScores(
  results: BenchmarkRunResult[],
  tasks: BenchmarkTask[],
): TierScoreRow[] {
  const tierMap = new Map<string, BenchmarkRunResult[]>();
  for (const result of results) {
    const task = tasks.find((t) => t.id === result.taskId);
    const tier = task?.tier || task?.difficulty || "unknown";
    if (!tierMap.has(tier)) tierMap.set(tier, []);
    tierMap.get(tier)!.push(result);
  }

  return Array.from(tierMap.entries()).map(([tier, tierResults]) => {
    const scored = tierResults.filter((r) => r.score !== undefined);
    return {
      tier,
      avgScore:
        scored.length > 0
          ? scored.reduce((sum, r) => sum + r.score!, 0) / scored.length
          : 0,
      count: scored.length,
    };
  });
}
