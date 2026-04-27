#!/usr/bin/env node
/**
 * Checker Quality Audit — compute Cohen's κ between automated checkers and blind 2nd-model scoring
 *
 * Samples 20 runs from existing benchmark results, sends blind scoring prompts to GLM-5.1,
 * and computes inter-rater agreement.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESULTS_DIR = join(__dirname, "results", "2026-04-27-glm-5.1");
const TASKS_DIR = join(__dirname, "tasks");
const API_BASE = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-5.1";
const SAMPLE_SIZE = 20;
const RANDOM_SEED = 42;

// ── Deterministic seeded random ──────────────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Load results from JSONL ──────────────────────────────────────────
function loadResults() {
  const results = [];
  for (const file of readdirSync(RESULTS_DIR)) {
    if (!file.endsWith(".jsonl")) continue;
    const content = readFileSync(join(RESULTS_DIR, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line) continue;
      results.push(JSON.parse(line));
    }
  }
  return results;
}

// ── Load task definition ─────────────────────────────────────────────
function loadTask(taskId) {
  // Try both task directories
  const dirs = ["server-memory", "server-everything"];
  for (const dir of dirs) {
    try {
      const filePath = join(TASKS_DIR, dir, `${taskId}.json`);
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      // try next dir
    }
  }
  return null;
}

// ── Sample runs (include all failures, fill rest with random passes) ─
function sampleRuns(results) {
  const failures = results.filter((r) => r.pass === false);
  const passes = results.filter((r) => r.pass === true);

  const rng = seededRandom(RANDOM_SEED);
  // Shuffle passes deterministically
  const shuffledPasses = [...passes].sort(() => rng() - 0.5);

  // Take all failures + random passes to fill to SAMPLE_SIZE
  const sampled = [...failures, ...shuffledPasses.slice(0, SAMPLE_SIZE - failures.length)];
  return sampled;
}

// ── Call GLM-5.1 for blind scoring ──────────────────────────────────
async function scoreBlind(task, run) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY not set");

  const systemPrompt = `You are an expert evaluator for AI agent benchmarks. You will be given a task description and an agent's observed outcome. Your job is to independently judge whether the agent successfully completed the task.

Rules:
- Base your judgment ONLY on the task description and the outcome description
- Be strict: only PASS if the outcome clearly demonstrates task completion
- If the outcome is ambiguous or partially complete, answer FAIL
- Answer with exactly "PASS" or "FAIL" followed by a brief reason on the same line`;

  const userPrompt = `## Task
${task.prompt}

## Agent's Observed Outcome
${run.checkerReason}

## Question
Based ONLY on the task description above, does this outcome indicate the agent successfully completed the task? Answer PASS or FAIL with a brief reason.`;

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 200,
  };

  const resp = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.trim();
}

// ── Parse verdict from model response ────────────────────────────────
function parseVerdict(text) {
  const upper = text.toUpperCase();
  if (upper.startsWith("PASS") && !upper.startsWith("FAIL")) return true;
  if (upper.startsWith("FAIL")) return false;
  // Fallback: look for keywords
  if (upper.includes("PASS")) return true;
  if (upper.includes("FAIL")) return false;
  // Default: unable to determine → treat as disagreement
  return null;
}

// ── Compute Cohen's Kappa ────────────────────────────────────────────
function cohensKappa(rater1, rater2) {
  // rater1 = checker (ground truth), rater2 = 2nd model
  // Both arrays of booleans
  const n = rater1.length;

  // Build confusion matrix
  // a = both pass, b = r1 pass + r2 fail, c = r1 fail + r2 pass, d = both fail
  let a = 0, b = 0, c = 0, d = 0;
  for (let i = 0; i < n; i++) {
    if (rater1[i] === true && rater2[i] === true) a++;
    else if (rater1[i] === true && rater2[i] === false) b++;
    else if (rater1[i] === false && rater2[i] === true) c++;
    else d++;
  }

  const Po = (a + d) / n; // observed agreement
  const p1_pass = (a + b) / n; // rater1 pass rate
  const p1_fail = (c + d) / n; // rater1 fail rate
  const p2_pass = (a + c) / n; // rater2 pass rate
  const p2_fail = (b + d) / n; // rater2 fail rate
  const Pe = p1_pass * p2_pass + p1_fail * p2_fail; // expected agreement

  const kappa = Pe === 1 ? 1 : (Po - Pe) / (1 - Pe);

  return { kappa, Po, Pe, a, b, c, d, n, p1_pass, p1_fail, p2_pass, p2_fail };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Checker Quality Audit ===\n");

  // 1. Load all results
  const allResults = loadResults();
  console.log(`Loaded ${allResults.length} results`);

  // 2. Sample 20 runs
  const sampled = sampleRuns(allResults);
  console.log(`Sampled ${sampled.length} runs (incl. ${sampled.filter((r) => !r.pass).length} failures)\n`);

  // 3. Load task definitions
  const enriched = [];
  for (const run of sampled) {
    const task = loadTask(run.taskId);
    if (!task) {
      console.log(`  WARNING: task not found for ${run.taskId}, skipping`);
      continue;
    }
    enriched.push({ run, task });
  }
  console.log(`Loaded ${enriched.length} task definitions\n`);

  // 4. Score each run blind
  const verdicts = [];
  for (let i = 0; i < enriched.length; i++) {
    const { run, task } = enriched[i];
    const idx = String(i + 1).padStart(2, "0");
    process.stdout.write(`  [${idx}/${enriched.length}] ${run.taskId} (${run.variant}) → `);

    try {
      const response = await scoreBlind(task, run);
      const verdict = parseVerdict(response);
      const label = verdict === true ? "PASS" : verdict === false ? "FAIL" : "???";
      console.log(`${label} (checker: ${run.pass ? "PASS" : "FAIL"})`);
      verdicts.push({
        taskId: run.taskId,
        variant: run.variant,
        checkerPass: run.pass,
        modelVerdict: verdict,
        modelResponse: response,
        checkerReason: run.checkerReason,
        taskPrompt: task.prompt,
        difficulty: task.difficulty || task.tier || "unknown",
      });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      verdicts.push({
        taskId: run.taskId,
        variant: run.variant,
        checkerPass: run.pass,
        modelVerdict: null,
        modelResponse: `ERROR: ${err.message}`,
        checkerReason: run.checkerReason,
        taskPrompt: task.prompt,
        difficulty: task.difficulty || task.tier || "unknown",
      });
    }

    // Small delay to avoid rate limiting
    if (i < enriched.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 5. Filter out null verdicts
  const valid = verdicts.filter((v) => v.modelVerdict !== null);
  console.log(`\nValid verdicts: ${valid.length}/${verdicts.length}`);

  // 6. Compute Cohen's Kappa
  const rater1 = valid.map((v) => v.checkerPass);
  const rater2 = valid.map((v) => v.modelVerdict);
  const stats = cohensKappa(rater1, rater2);

  // 7. Output results
  console.log("\n=== Results ===");
  console.log(`Total scored: ${stats.n}`);
  console.log(`Observed agreement (Po): ${stats.Po.toFixed(4)}`);
  console.log(`Expected agreement (Pe): ${stats.Pe.toFixed(4)}`);
  console.log(`Cohen's κ: ${stats.kappa.toFixed(4)}`);
  console.log(`\nConfusion matrix:`);
  console.log(`  Both PASS:  ${stats.a}`);
  console.log(`  Checker PASS, Model FAIL: ${stats.b}`);
  console.log(`  Checker FAIL, Model PASS: ${stats.c}`);
  console.log(`  Both FAIL:  ${stats.d}`);

  // 8. Output JSON for report generation
  const output = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    sampleSize: sampled.length,
    validScores: valid.length,
    kappa: stats.kappa,
    Po: stats.Po,
    Pe: stats.Pe,
    confusionMatrix: { a: stats.a, b: stats.b, c: stats.c, d: stats.d },
    checkerPassRate: stats.p1_pass,
    modelPassRate: stats.p2_pass,
    verdicts: verdicts,
  };

  const outPath = join(__dirname, "results", "checker-audit-results.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
