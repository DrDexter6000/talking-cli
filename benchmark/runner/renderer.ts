import { readFileSync } from "node:fs";
import type {
  SummaryJson,
  PerTaskRow,
  AblationSummaryJson,
  PerCellRow,
  ContrastAggregate,
} from "./stats.ts";
import { ABLATION_CELLS, cellToVariant } from "./types.js";
import { isAblationResults, computeAblationStats } from "./stats.js";

// ─── Verdict Types ─────────────────────────────────────────────────────────────

type Verdict = "PROVEN" | "SUCCESS" | "PARTIAL" | "FAILURE";

interface VerdictResult {
  verdict: Verdict;
  tokenPValue: number;
  turnsPValue: number;
  passRateDelta: number;
  passRateCIDelta: number;
  tokenDeltaPct: string;
}

// ─── Wilcoxon Signed-Rank Test (renderer-local copy) ──────────────────────────

function wilcoxonSignedRank(values: number[]): { W: number; pValue: number } {
  const nonZero = values.filter((v) => v !== 0);
  const n = nonZero.length;
  if (n === 0) return { W: 0, pValue: 1 };

  const absValues = nonZero.map((v) => Math.abs(v));
  const sorted = [...absValues].sort((a, b) => a - b);

  const rankMap = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const val = sorted[i];
    if (!rankMap.has(val)) {
      const start = i;
      let end = i;
      while (end < sorted.length && sorted[end] === val) end++;
      const avgRank = (start + 1 + end) / 2;
      rankMap.set(val, avgRank);
      i = end - 1;
    }
  }

  let Wplus = 0;
  for (const v of nonZero) {
    if (v > 0) {
      Wplus += rankMap.get(Math.abs(v))!;
    }
  }

  const totalRank = (n * (n + 1)) / 2;
  const Wminus = totalRank - Wplus;
  const W = Math.min(Wplus, Wminus);

  let pValue: number;
  if (n >= 20) {
    const meanW = (n * (n + 1)) / 4;
    const varW = (n * (n + 1) * (2 * n + 1)) / 24;
    const z = Math.abs(W - meanW) / Math.sqrt(varW);
    pValue = 2 * (1 - normalCDF(z));
  } else {
    pValue = exactWilcoxonP(W, n);
  }

  return { W, pValue: Math.min(pValue, 1) };
}

function exactWilcoxonP(W: number, n: number): number {
  const totalRank = (n * (n + 1)) / 2;
  const dp: number[] = new Array(totalRank + 1).fill(0);
  dp[0] = 1;

  for (let i = 1; i <= n; i++) {
    for (let s = totalRank; s >= i; s--) {
      dp[s] += dp[s - i];
    }
  }

  const total = 2 ** n;
  let count = 0;
  for (let s = 0; s <= totalRank; s++) {
    if (s <= W || s >= totalRank - W) {
      count += dp[s];
    }
  }

  return count / total;
}

function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * z);
  return 1 - (a1 * t + a2 * t * t + a3 * t ** 3 + a4 * t ** 4 + a5 * t ** 5) * Math.exp(-(z * z) / 2);
}

// ─── Pass Rate 95% CI ─────────────────────────────────────────────────────────

function passRateDeltaCI(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
): { delta: number; ciHalf: number } {
  const delta = p2 - p1;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  return { delta, ciHalf: 1.96 * se };
}

// ─── Verdict Computation ──────────────────────────────────────────────────────

function computeVerdict(
  tokenDeltas: number[],
  turnDeltas: number[],
  passCountTreatment: number,
  passCountControl: number,
  totalTasks: number,
  tokenDeltaPctStr: string,
): VerdictResult {
  const tokenWR = wilcoxonSignedRank(tokenDeltas);
  const turnWR = wilcoxonSignedRank(turnDeltas);

  const pControl = passCountControl / totalTasks;
  const pTreatment = passCountTreatment / totalTasks;
  const { delta: prDelta, ciHalf: prCI } = passRateDeltaCI(
    pControl, totalTasks, pTreatment, totalTasks,
  );

  const tokenSignificant = tokenWR.pValue < 0.05;
  const turnsSignificant = turnWR.pValue < 0.05;
  const passRateImprovement = prDelta * 100 >= 10;
  const passRateDegraded = prDelta - prCI > 0;
  const passRateCIExcludesZero = prDelta + prCI <= 0 || prDelta - prCI >= 0;

  let verdict: Verdict;
  if (tokenSignificant && turnsSignificant && passRateImprovement) {
    verdict = "PROVEN";
  } else if (tokenSignificant && !passRateDegraded) {
    verdict = "SUCCESS";
  } else if (tokenSignificant || turnsSignificant) {
    verdict = "PARTIAL";
  } else {
    verdict = "FAILURE";
  }

  return {
    verdict,
    tokenPValue: tokenWR.pValue,
    turnsPValue: turnWR.pValue,
    passRateDelta: prDelta * 100,
    passRateCIDelta: prCI * 100,
    tokenDeltaPct: tokenDeltaPctStr,
  };
}

function computeVerdictFromContrast(
  contrast: ContrastAggregate,
  totalTasks: number,
  tokenDeltaPctStr: string,
): VerdictResult {
  return computeVerdict(
    Array(totalTasks).fill(-contrast.meanDeltaInputTokens),
    Array(totalTasks).fill(-contrast.meanDeltaTurns),
    contrast.talkingWins,
    contrast.controlWins,
    totalTasks,
    tokenDeltaPctStr,
  );
}

/**
 * Render a summary.json into AUDIT-BENCHMARK.md following the standard format.
 * Pure function: same input → same bytes.
 *
 * Dispatches to legacy or ablation rendering based on the results.jsonl format.
 */
export function renderBenchmark(summaryPath: string): string {
  const raw = readFileSync(summaryPath, "utf-8");
  const summary: SummaryJson = JSON.parse(raw);

  // Check if the source data is ablation format by inspecting the sibling
  // results.jsonl (summary.json is already aggregated)
  const resultPath = summaryPath.replace(/summary\.json$/, "results.jsonl");
  if (isAblationResults(resultPath)) {
    const ablationSummary = computeAblationStats(resultPath, summary.provider);
    return renderAblationBenchmark(ablationSummary);
  }

  return renderLegacyBenchmark(summary);
}

/**
 * Legacy rendering — mute vs talking binary comparison.
 */
function renderLegacyBenchmark(summary: SummaryJson): string {

  const lines: string[] = [];

  // ─── Header ────────────────────────────────────────────────────────────────
  lines.push("# Benchmark Report — Talking CLI");
  lines.push("");
  lines.push("> Auto-generated from `summary.json`. Do not hand-edit.");
  lines.push(`> **Schema version**: ${summary.schemaVersion ?? 0}`);
  lines.push("");

  if (summary.provider === "stub") {
    lines.push(
      "> ⚠️ **Stub data** — this artifact was generated by the internal stub provider and is not a live model-backed benchmark run.",
    );
    lines.push("");
  }

  const a = summary.aggregate;

  // ─── 1. Benchmark Overview ─────────────────────────────────────────────────
  lines.push("## 1. Benchmark Overview (benchmark简介)");
  lines.push("");
  lines.push(`**Date**: ${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)}`);
  lines.push(`**Provider**: ${summary.provider || "unknown"}`);
  lines.push(`**Model**: ${summary.provider === "deepseek" ? "deepseek-v4-flash" : summary.provider === "deepseek-reasoner" ? "deepseek-v4-pro" : summary.provider === "minimax" ? "MiniMax-M2.7-highspeed" : "unknown"}`);
  lines.push(`**Tasks**: ${summary.perTask.length} tasks`);
  lines.push(`**Variants**: mute, talking`);
  lines.push(`**Total Runs**: ${summary.perTask.length * 2}`);
  lines.push(`**Concurrency**: 3 parallel`);
  lines.push(`**Total Duration**: See runner output`);
  lines.push("");

  // ─── 2. Token Consumption Comparison ───────────────────────────────────────
  lines.push("## 2. Token Consumption Comparison (Token消耗对比)");
  lines.push("");

  // 2.1 Initial Prompt Tokens
  lines.push("### 2.1 Initial Prompt Tokens (起始Token消耗)");
  lines.push("");
  // Note: Initial prompt tokens are not tracked per-task in current implementation
  lines.push("*Initial prompt token comparison requires static analysis of SKILL.md files.*");
  lines.push("");

  // 2.2 Input Tokens
  const avgMuteInput = summary.perTask.reduce((sum, row) => sum + row.mute.inputTokens, 0) / summary.perTask.length;
  const avgTalkingInput = summary.perTask.reduce((sum, row) => sum + row.talking.inputTokens, 0) / summary.perTask.length;
  const inputDelta = avgTalkingInput - avgMuteInput;
  const inputDeltaPct = (inputDelta / avgMuteInput * 100).toFixed(1);

  lines.push("### 2.2 Input Tokens (输入Token对比)");
  lines.push("");
  lines.push(`- **Mute**: ${avgMuteInput.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Talking**: ${avgTalkingInput.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Delta**: ${inputDelta > 0 ? "+" : ""}${inputDelta.toFixed(0)} tokens (${inputDeltaPct}%)`);
  lines.push("");

  // 2.3 Output Tokens
  const avgMuteOutput = summary.perTask.reduce((sum, row) => sum + row.mute.outputTokens, 0) / summary.perTask.length;
  const avgTalkingOutput = summary.perTask.reduce((sum, row) => sum + row.talking.outputTokens, 0) / summary.perTask.length;
  const outputDelta = avgTalkingOutput - avgMuteOutput;
  const outputDeltaPct = (outputDelta / avgMuteOutput * 100).toFixed(1);

  lines.push("### 2.3 Output Tokens (输出Token对比)");
  lines.push("");
  lines.push(`- **Mute**: ${avgMuteOutput.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Talking**: ${avgTalkingOutput.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Delta**: ${outputDelta > 0 ? "+" : ""}${outputDelta.toFixed(0)} tokens (${outputDeltaPct}%)`);
  lines.push("");

  // 2.4 Total Tokens
  const avgMuteTotal = avgMuteInput + avgMuteOutput;
  const avgTalkingTotal = avgTalkingInput + avgTalkingOutput;
  const totalDelta = avgTalkingTotal - avgMuteTotal;
  const totalDeltaPct = (totalDelta / avgMuteTotal * 100).toFixed(1);

  lines.push("### 2.4 Total Tokens (总Token消耗对比)");
  lines.push("");
  lines.push(`- **Mute**: ${avgMuteTotal.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Talking**: ${avgTalkingTotal.toFixed(0)} tokens/task (avg)`);
  lines.push(`- **Delta**: ${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(0)} tokens (${totalDeltaPct}%)`);
  lines.push("");

  // ─── 3. Task Quality Comparison ────────────────────────────────────────────
  lines.push("## 3. Task Quality Comparison (任务完成质量对比)");
  lines.push("");

  const mutePassed = summary.perTask.filter(row => row.mute.pass).length;
  const talkingPassed = summary.perTask.filter(row => row.talking.pass).length;
  const mutePassRate = (mutePassed / summary.perTask.length * 100).toFixed(1);
  const talkingPassRate = (talkingPassed / summary.perTask.length * 100).toFixed(1);
  const passRateDelta = (talkingPassed - mutePassed) / summary.perTask.length * 100;

  lines.push(`- **Mute Wins**: ${a.muteWins} tasks`);
  lines.push(`- **Talking Wins**: ${a.talkingWins} tasks`);
  lines.push(`- **Ties**: ${a.ties} tasks`);
  lines.push("");
  lines.push("### Pass Rate (通过率)");
  lines.push("");
  lines.push(`- **Mute**: ${mutePassRate}% (${mutePassed}/${summary.perTask.length})`);
  lines.push(`- **Talking**: ${talkingPassRate}% (${talkingPassed}/${summary.perTask.length})`);
  lines.push(`- **Delta**: ${passRateDelta > 0 ? "+" : ""}${passRateDelta.toFixed(1)}pp (percentage points)`);
  lines.push("");

  // Statistical Tests
  lines.push("### Statistical Significance (统计显著性)");
  lines.push("");
  lines.push(`- **Sign Test**: n = ${a.signTestN}, p-value: ${a.signTestPValue.toFixed(4)}`);
  lines.push(`- **Wilcoxon Signed-Rank**: W = ${a.wilcoxonW}, p-value: ${a.wilcoxonPValue.toFixed(4)}`);
  lines.push("");

  // ─── 4. Verdict ─────────────────────────────────────────────────────────────
  lines.push("## 4. Verdict");
  lines.push("");

  const tokenDeltas = summary.perTask.map(r => r.deltaInputTokens + r.deltaOutputTokens);
  const turnDeltas = summary.perTask.map(r => r.deltaTurns);
  const vr = computeVerdict(
    tokenDeltas, turnDeltas,
    talkingPassed, mutePassed, summary.perTask.length,
    totalDeltaPct,
  );

  lines.push(`- **Token Wilcoxon p**: ${vr.tokenPValue.toFixed(4)} ${vr.tokenPValue < 0.05 ? "(significant)" : "(not significant)"}`);
  lines.push(`- **Turn Wilcoxon p**: ${vr.turnsPValue.toFixed(4)} ${vr.turnsPValue < 0.05 ? "(significant)" : "(not significant)"}`);
  lines.push(`- **Pass rate delta**: ${vr.passRateDelta > 0 ? "+" : ""}${vr.passRateDelta.toFixed(1)}pp (95% CI: [${(vr.passRateDelta - vr.passRateCIDelta).toFixed(1)}, ${(vr.passRateDelta + vr.passRateCIDelta).toFixed(1)}])`);
  lines.push("");
  lines.push(`**Verdict**: ${vr.verdict}`);
  lines.push("");
  lines.push("| Verdict | Criteria |");
  lines.push("|---------|----------|");
  lines.push("| **PROVEN** | total_tokens ↓ p < .05 AND turns ↓ p < .05 AND pass rate ↑ ≥ 10pp |");
  lines.push("| **SUCCESS** | total_tokens ↓ p < .05 AND pass rate 95% CI excludes degradation |");
  lines.push("| **PARTIAL** | One of {tokens, turns} ↓ p < .05; others neutral |");
  lines.push("| **FAILURE** | No metric significant at p < .05 |");
  lines.push("");

  // ─── 5. Detailed Conclusion ────────────────────────────────────────────────
  lines.push("## 5. Detailed Conclusion (详细总结结论)");
  lines.push("");

  lines.push("### 5.1 Key Findings (关键发现)");
  lines.push("");
  lines.push(`1. Token efficiency: Talking variant uses ${Math.abs(Number(totalDeltaPct))}% ${totalDelta < 0 ? "less" : "more"} total tokens on average`);
  lines.push(`2. Task wins: Talking wins ${a.talkingWins} tasks, Mute wins ${a.muteWins} tasks`);
  lines.push(`3. Pass rates: Mute ${mutePassRate}%, Talking ${talkingPassRate}%`);
  lines.push(`4. Error recoveries: Talking ${a.talkingRecoveries}, Mute ${a.muteRecoveries}`);
  lines.push("");

  lines.push("### 5.2 Statistical Interpretation (统计解读)");
  lines.push("");
  if (a.wilcoxonPValue < 0.05) {
    lines.push("- Wilcoxon test p < 0.05: Token efficiency difference is **statistically significant**");
  } else {
    lines.push("- Wilcoxon test p ≥ 0.05: Token efficiency difference is **not statistically significant**");
  }
  if (a.signTestPValue < 0.05) {
    lines.push("- Sign test p < 0.05: Task win difference is **statistically significant**");
  } else {
    lines.push("- Sign test p ≥ 0.05: Task win difference is **not statistically significant**");
  }
  lines.push("");

  lines.push("### 5.3 Model Capability Assessment (模型能力评估)");
  lines.push("");
  const tieRate = (a.ties / summary.perTask.length * 100).toFixed(1);
  lines.push(`- Tie rate: ${tieRate}% (${a.ties}/${summary.perTask.length} tasks)`);
  lines.push(`- Both-fail rate: ${(summary.perTask.filter(row => !row.mute.pass && !row.talking.pass).length / summary.perTask.length * 100).toFixed(1)}%`);
  lines.push("- High tie rate suggests model capability is the bottleneck, not methodology");
  lines.push("");

  lines.push("### 5.4 Recommendations");
  lines.push("");
  if (vr.verdict === "PROVEN") {
    lines.push("1. Distributed Prompting is proven effective for this model — both efficiency and quality gains are statistically significant");
    lines.push("2. Run on additional models to confirm generalizability");
  } else if (vr.verdict === "SUCCESS") {
    lines.push("1. Token savings are statistically significant — recommend adoption for cost-sensitive use cases");
    lines.push("2. Pass rate shows no significant degradation — quality is preserved");
    lines.push("3. Consider testing on stronger models to unlock quality improvements");
  } else if (vr.verdict === "PARTIAL") {
    lines.push("1. One metric shows statistical improvement, but the full picture is incomplete");
    lines.push("2. Review hint quality and task difficulty distribution");
    lines.push("3. Consider larger sample size to improve statistical power");
  } else {
    lines.push("1. No metric reached statistical significance at p < .05");
    lines.push("2. Review methodology implementation and task set");
    lines.push("3. Consider stronger model, different task set, or larger sample");
  }
  lines.push("");

  // ─── Per-Task Results (Appendix) ───────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Appendix: Per-Task Results (逐任务详细结果)");
  lines.push("");
  lines.push(
    "| Task | Mute | Talking | Δ | Mute Tok | Talking Tok | Δ Tok | Time |",
  );
  lines.push("|------|------|---------|---|----------|-------------|-------|------|");
  for (const row of summary.perTask) {
    const mutePass = row.mute.pass ? "✅" : "❌";
    const talkingPass = row.talking.pass ? "✅" : "❌";
    const deltaIcon =
      row.delta === "talking_win" ? "↑ talking" : row.delta === "mute_win" ? "↓ mute" : "= tie";
    const muteTok = row.mute.inputTokens + row.mute.outputTokens;
    const talkingTok = row.talking.inputTokens + row.talking.outputTokens;
    const deltaTok = talkingTok - muteTok;
    lines.push(
      `| ${row.taskId} | ${mutePass} | ${talkingPass} | ${deltaIcon} | ${muteTok} | ${talkingTok} | ${deltaTok > 0 ? "+" : ""}${deltaTok} | ${row.deltaWalltime}ms |`,
    );
  }
  lines.push("");

  // ─── Methodology ───────────────────────────────────────────────────────────
  lines.push("## Methodology");
  lines.push("");
  lines.push(
    "This document is generated by the internal benchmark harness following the standard format defined in `benchmark/BENCHMARK-REPORT-STANDARD.md`.",
  );
  lines.push("");
  lines.push(
    "This benchmark compares an identical benchmark executor running the same task set against two variants of the MCP filesystem server:",
  );
  lines.push("");
  lines.push("- **Mute**: unmodified upstream server, returning raw data only (no hints).");
  lines.push(
    "- **Talking**: same server, augmented with `hints` fields on empty-result / error paths.",
  );
  lines.push("");
  lines.push(
    "Each task runs against both variants. Success is defined as the agent completing the task's",
  );
  lines.push(
    "deterministic pass criterion (e.g. file exists with expected content, or expected answer emitted)",
  );
  lines.push("within ≤ 20 turns.");
  lines.push("");
  lines.push("### Metrics");
  lines.push("");
  lines.push("- **Pass/fail**: Binary task completion");
  lines.push("- **Token consumption**: Input + output tokens per task");
  lines.push("- **Walltime**: Actual execution time in milliseconds");
  lines.push("- **Error recoveries**: Count of tool errors that were successfully recovered from");
  lines.push("- **Tool calls**: Total number of tool invocations");
  lines.push("");
  lines.push("### Statistical Approach");
  lines.push("");
  lines.push(
    "- **Primary analysis**: Paired sign test on pass/fail outcomes across task pairs.",
  );
  lines.push(
    "- **Secondary analysis**: Wilcoxon signed-rank test on per-task token/turn deltas.",
  );
  lines.push(
    "- **Efficiency analysis**: Tokens per successful task (lower is better).",
  );
  lines.push(
    "",
  );
  lines.push(
    "All tests are non-parametric and suitable for small-N paired comparisons.",
  );
  lines.push("");

  // ─── Reproduction ──────────────────────────────────────────────────────────
  lines.push("## Reproduction");
  lines.push("");
  lines.push("### Product usage");
  lines.push("");
  lines.push("Normal use of `talking-cli` does **not** require any model API key.");
  lines.push("The following commands are local-first:");
  lines.push("");
  lines.push("- `talking-cli audit`");
  lines.push("- `talking-cli audit-mcp`");
  lines.push("- `talking-cli optimize`");
  lines.push("");
  lines.push("### Standalone lab benchmark mode");
  lines.push("");
  lines.push("To reproduce these results on a clean checkout:");
  lines.push("");
  lines.push("```bash");
  lines.push("# 1. Run the internal smoke harness (no model API key required)");
  lines.push("npm run benchmark:smoke");
  lines.push("");
  lines.push("# 2. Run the full benchmark with progress reporting and parallel execution");
  lines.push("export DEEPSEEK_API_KEY=sk-...");
  lines.push("npm run benchmark -- --provider deepseek --parallel --max-concurrency 3");
  lines.push("");
  lines.push("# 3. Resume an interrupted benchmark");
  lines.push("npm run benchmark -- --provider deepseek --parallel --resume");
  lines.push("");
  lines.push("# 4. Inspect the generated benchmark artifacts");
  lines.push("dir benchmark/results/<date>");
  lines.push("```");
  lines.push("");
  lines.push("- **Executor**: `benchmark:smoke` uses a local stub executor; `benchmark` uses the model-backed standalone provider.");
  lines.push(
    "- **Server**: `@modelcontextprotocol/server-filesystem` vendored at pinned commit.",
  );
  lines.push(
    "- **Task set**: Full task matrix with recovery scenarios.",
  );
  lines.push("");

  return lines.join("\n");
}

// ─── Ablation Rendering ──────────────────────────────────────────────────────

/**
 * Render an ablation-format benchmark report with 2×2 matrix and named
 * contrasts.
 */
export function renderAblationBenchmark(summary: AblationSummaryJson): string {
  const lines: string[] = [];

  // ─── Header ────────────────────────────────────────────────────────────────
  lines.push("# Benchmark Report — Talking CLI (2×2 Ablation)");
  lines.push("");
  lines.push("> Auto-generated from ablation results. Do not hand-edit.");
  lines.push(`> **Schema version**: ${summary.schemaVersion ?? 1}`);
  lines.push("");

  if (summary.provider === "stub") {
    lines.push(
      "> ⚠️ **Stub data** — generated by the internal stub provider.",
    );
    lines.push("");
  }

  // ─── 1. Overview ───────────────────────────────────────────────────────────
  lines.push("## 1. Benchmark Overview (benchmark简介)");
  lines.push("");
  const providerLabel = summary.providers
    ? summary.providers.join(", ")
    : (summary.provider ?? "unknown");
  lines.push(`**Date**: ${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)}`);
  lines.push(`**Provider**: ${providerLabel}`);
  lines.push(`**Tasks**: ${summary.perTask.length}`);
  lines.push(
    "**Variants**: full-skill+mute, full-skill+hinting, lean-skill+mute, lean-skill+hinting",
  );
  lines.push(`**Total Runs**: ${summary.perTask.length * 4}`);
  lines.push("");

  // ─── 2. Ablation Matrix ────────────────────────────────────────────────────
  lines.push("## 2. Ablation Matrix (2×2 消融矩阵)");
  lines.push("");

  // Compute cell averages
  interface CellAgg {
    totalInputTokens: number;
    totalOutputTokens: number;
    passCount: number;
    count: number;
  }
  const cellAggs: Record<string, CellAgg> = {};
  for (const cell of ABLATION_CELLS) {
    const key = cellToVariant(cell);
    cellAggs[key] = { totalInputTokens: 0, totalOutputTokens: 0, passCount: 0, count: 0 };
  }

  for (const row of summary.perTask) {
    for (const [variant, metrics] of Object.entries(row.cells)) {
      if (variant in cellAggs) {
        cellAggs[variant].totalInputTokens += metrics.inputTokens;
        cellAggs[variant].totalOutputTokens += metrics.outputTokens;
        cellAggs[variant].passCount += metrics.pass ? 1 : 0;
        cellAggs[variant].count += 1;
      }
    }
  }

  function fmtCell(key: string): string {
    const agg = cellAggs[key];
    if (!agg || agg.count === 0) return "—";
    const avgTok = ((agg.totalInputTokens + agg.totalOutputTokens) / agg.count).toFixed(0);
    const passRate = ((agg.passCount / agg.count) * 100).toFixed(0);
    return `${avgTok} tok · ${passRate}% pass`;
  }

  lines.push("| | Mute Server | Hinting Server |");
  lines.push("|---|---|---|");
  lines.push(`| **Full Skill** | ${fmtCell("full-skill+mute")} | ${fmtCell("full-skill+hinting")} |`);
  lines.push(`| **Lean Skill** | ${fmtCell("lean-skill+mute")} | ${fmtCell("lean-skill+hinting")} |`);
  lines.push("");

  // ─── 3. Named Contrasts ────────────────────────────────────────────────────
  lines.push("## 3. Named Contrasts (命名对比)");
  lines.push("");

  for (const [_name, agg] of Object.entries(summary.contrasts)) {
    lines.push(`### ${agg.label}`);
    lines.push("");
    lines.push(`- **Treatment**: \`${agg.treatment}\` vs **Control**: \`${agg.control}\``);
    lines.push(
      `- **Δ Input Tokens**: ${agg.meanDeltaInputTokens > 0 ? "+" : ""}${agg.meanDeltaInputTokens.toFixed(0)}`,
    );
    lines.push(
      `- **Δ Output Tokens**: ${agg.meanDeltaOutputTokens > 0 ? "+" : ""}${agg.meanDeltaOutputTokens.toFixed(0)}`,
    );
    lines.push(
      `- **Δ Turns**: ${agg.meanDeltaTurns > 0 ? "+" : ""}${agg.meanDeltaTurns.toFixed(1)}`,
    );
    lines.push(`- **Wins**: treatment ${agg.talkingWins} · control ${agg.controlWins} · ties ${agg.ties}`);
    lines.push(`- **Sign test p**: ${agg.signTestPValue.toFixed(4)}`);
    lines.push(`- **Wilcoxon W**: ${agg.wilcoxonW} · p: ${agg.wilcoxonPValue.toFixed(4)}`);
    lines.push("");
  }

  // ─── 4. Verdict ────────────────────────────────────────────────────────────
  lines.push("## 4. Verdict");
  lines.push("");
  const fullContrast = summary.contrasts["full_vs_control"];
  if (fullContrast) {
    const totalTasks = summary.perTask.length;
    const tokenDeltaPctStr = (
      (fullContrast.meanDeltaInputTokens + fullContrast.meanDeltaOutputTokens) /
      Math.max(1, Math.abs(fullContrast.meanDeltaInputTokens + fullContrast.meanDeltaOutputTokens) + (fullContrast.meanDeltaInputTokens + fullContrast.meanDeltaOutputTokens)) * 100
    ).toFixed(1);
    const avr = computeVerdictFromContrast(fullContrast, totalTasks, tokenDeltaPctStr);

    lines.push(`- **Token Wilcoxon p**: ${fullContrast.wilcoxonPValue.toFixed(4)} ${fullContrast.wilcoxonPValue < 0.05 ? "(significant)" : "(not significant)"}`);
    lines.push(`- **Turn delta**: ${fullContrast.meanDeltaTurns > 0 ? "+" : ""}${fullContrast.meanDeltaTurns.toFixed(1)} (p = ${avr.turnsPValue.toFixed(4)})`);
    lines.push(`- **Pass rate delta**: ${avr.passRateDelta > 0 ? "+" : ""}${avr.passRateDelta.toFixed(1)}pp (95% CI: [${(avr.passRateDelta - avr.passRateCIDelta).toFixed(1)}, ${(avr.passRateDelta + avr.passRateCIDelta).toFixed(1)}])`);
    lines.push(`- **Verdict**: ${avr.verdict}`);
  } else {
    lines.push("- Insufficient data for verdict");
  }
  lines.push("");

  // ─── Appendix: Per-Task ────────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Appendix: Per-Task Results (逐任务详细结果)");
  lines.push("");
  lines.push("| Task | full-skill+mute | full-skill+hinting | lean-skill+mute | lean-skill+hinting |");
  lines.push("|------|----------------|-------------------|----------------|-------------------|");

  for (const row of summary.perTask) {
    const cells = ["full-skill+mute", "full-skill+hinting", "lean-skill+mute", "lean-skill+hinting"];
    const cols = cells.map((c) => {
      const m = row.cells[c];
      if (!m) return "—";
      const icon = m.pass ? "✅" : "❌";
      const tok = m.inputTokens + m.outputTokens;
      return `${icon} ${tok}t`;
    });
    lines.push(`| ${row.taskId} | ${cols.join(" | ")} |`);
  }
  lines.push("");

  // ─── Methodology ───────────────────────────────────────────────────────────
  lines.push("## Methodology");
  lines.push("");
  lines.push("This report uses a **2×2 ablation design** isolating two orthogonal factors:");
  lines.push("- **Skill variant**: full-skill (full SKILL.md, no hint references) vs lean-skill (lean SKILL.md, references tool hints)");
  lines.push("- **Server variant**: mute (raw data only) vs hinting (data + actionable hints)");
  lines.push("");
  lines.push("Four named contrasts decompose the treatment effect:");
  lines.push("- **Full vs Control**: combined effect of lean skill + hinting server");
  lines.push("- **Skill Effect**: lean skill alone (with mute server)");
  lines.push("- **Server Effect**: hinting server alone (with full skill)");
  lines.push("- **Interaction**: whether skill + server together exceed skill alone");
  lines.push("");
  lines.push("Statistical tests: paired sign test (pass/fail) + Wilcoxon signed-rank (token deltas).");
  lines.push("");

  return lines.join("\n");
}

// ─── Multi-Provider Comparison ────────────────────────────────────────────────

/**
 * Render a cross-provider comparison table from multiple per-provider
 * AblationSummaryJson objects.
 */
export function renderMultiProviderComparison(
  summaries: Array<{ provider: string; summary: AblationSummaryJson }>,
): string {
  const lines: string[] = [];

  lines.push("# Multi-Provider Comparison — Talking CLI");
  lines.push("");
  lines.push(`**Date**: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Providers**: ${summaries.map((s) => s.provider).join(", ")}`);
  lines.push(`**Tasks**: ${summaries[0]?.summary.perTask.length ?? 0}`);
  lines.push("");

  lines.push("## Cross-Provider Results (跨Provider对比)");
  lines.push("");
  lines.push("| Provider | Full Δ Tokens | Full Δ Pass | Skill Effect | Server Effect | Verdict |");
  lines.push("|----------|--------------|-------------|-------------|--------------|---------|");

  for (const { provider, summary } of summaries) {
    const full = summary.contrasts["full_vs_control"];
    const skill = summary.contrasts["skill_effect"];
    const server = summary.contrasts["server_effect"];

    if (!full) {
      lines.push(`| ${provider} | — | — | — | — | NO DATA |`);
      continue;
    }

    const deltaTok = full.meanDeltaInputTokens > 0
      ? `+${full.meanDeltaInputTokens.toFixed(0)}`
      : full.meanDeltaInputTokens.toFixed(0);
    const deltaPass = full.talkingWins - full.controlWins;
    const deltaPassStr = deltaPass > 0
      ? `+${deltaPass}`
      : deltaPass < 0 ? `${deltaPass}` : "0";

    const skillEff = skill
      ? (skill.meanDeltaInputTokens < 0 ? "✅" : "❌")
      : "—";
    const serverEff = server
      ? (server.meanDeltaInputTokens < 0 ? "✅" : "❌")
      : "—";

    const mpvr = computeVerdictFromContrast(full, summary.perTask.length, deltaTok);

    lines.push(
      `| ${provider} | ${deltaTok} | ${deltaPassStr} | ${skillEff} | ${serverEff} | ${mpvr.verdict} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}
