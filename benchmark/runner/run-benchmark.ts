import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { computeStats } from "./stats.js";
import { renderBenchmark } from "./renderer.js";
import { ABLATION_CELLS, cellToVariant } from "./types.js";
import type { BenchmarkExecutor, BenchmarkTask, BenchmarkRunResult } from "./types.js";

type RunBenchmarkOptions = {
  taskLimit?: number;
  disableMcp?: boolean;
  provider?: string;
  variants?: string[];
  parallel?: boolean;
  maxConcurrency?: number;
  progressInterval?: number;
  resume?: boolean;
  repeat?: number;
  verbose?: boolean;
};

type ProgressCallback = (completed: number, total: number, currentTask: string, currentVariant: string, result?: BenchmarkRunResult) => void;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

let lastProgressTime = Date.now();
let lastProgressCompleted = 0;

function printProgress(completed: number, total: number, currentTask: string, currentVariant: string, result?: BenchmarkRunResult) {
  const percent = ((completed / total) * 100).toFixed(1);
  const status = result 
    ? `${result.pass ? "✅" : "❌"} ${result.turns}turns ${result.inputTokens + result.outputTokens}tok`
    : "running...";
  console.log(`[${completed}/${total}] ${percent}% | ${currentVariant} | ${currentTask} | ${status}`);
  
  // Progress heartbeat every 2-5 minutes to prevent user thinking it's hung
  const now = Date.now();
  const elapsed = now - lastProgressTime;
  const completedSinceLast = completed - lastProgressCompleted;
  
  // Report every 3 minutes OR every 10 tasks, whichever comes first
  if (elapsed > 180_000 || completedSinceLast >= 10) {
    const rate = elapsed > 0 ? (completedSinceLast / (elapsed / 60000)).toFixed(1) : "0";
    const remaining = total - completed;
    const etaMinutes = rate !== "0" ? (remaining / Number(rate)).toFixed(0) : "?";
    
    console.log("");
    console.log(`⏱️  Progress heartbeat: ${completed}/${total} (${percent}%)`);
    console.log(`   Speed: ${rate} tasks/min | ETA: ~${etaMinutes} min`);
    console.log(`   Current: ${currentVariant} | ${currentTask}`);
    console.log("");
    
    lastProgressTime = now;
    lastProgressCompleted = completed;
  }
}

async function runTaskWithTimeout(
  executor: BenchmarkExecutor,
  task: BenchmarkTask,
  variant: string,
  options: RunBenchmarkOptions,
  resultDir: string,
): Promise<BenchmarkRunResult> {
  const startTime = Date.now();
  try {
    const result = await executor.runTask(task, variant, {
      outputDir: resultDir,
      disableMcp: options.disableMcp,
    });
    return { ...result, walltime: Date.now() - startTime, provider: options.provider };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Task ${task.id} (${variant}) failed: ${errMsg}`);
    return {
      taskId: task.id,
      variant,
      provider: options.provider,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      walltime: Date.now() - startTime,
      outcome: "error",
      pass: false,
    };
  }
}

function writeTrace(
  resultDir: string,
  taskId: string,
  variant: string,
  trial: number,
  totalTrials: number,
): void {
  const tracesDir = resolve(resultDir, "traces");
  mkdirSync(tracesDir, { recursive: true });
  const trialSuffix = totalTrials > 1 ? `-${trial}` : "";
  const tracePath = resolve(tracesDir, `${taskId}-${variant}${trialSuffix}.jsonl`);

  // Copy relevant lines from raw.jsonl matching this task+variant
  const rawPath = resolve(resultDir, "raw.jsonl");
  if (existsSync(rawPath)) {
    const rawLines = readFileSync(rawPath, "utf-8").split("\n").filter(l => l.trim());
    const relevant = rawLines.filter(l => {
      try {
        const entry = JSON.parse(l) as { taskId?: string; variant?: string };
        return entry.taskId === taskId && entry.variant === variant;
      } catch {
        return false;
      }
    });
    if (relevant.length > 0) {
      writeFileSync(tracePath, relevant.join("\n") + "\n", "utf-8");
    }
  }
}

async function runParallel(
  executor: BenchmarkExecutor,
  tasks: BenchmarkTask[],
  variants: string[],
  resultDir: string,
  options: RunBenchmarkOptions,
  onProgress: ProgressCallback,
): Promise<BenchmarkRunResult[]> {
  const maxConcurrency = options.maxConcurrency ?? 3;
  const trials = options.repeat ?? 1;
  const total = tasks.length * variants.length * trials;
  const results: BenchmarkRunResult[] = [];
  const running = new Set<Promise<void>>();
  let completed = 0;

  // Load existing results if resuming
  const resultsPath = resolve(resultDir, "results.jsonl");
  if (options.resume && existsSync(resultsPath)) {
    const existing = readFileSync(resultsPath, "utf-8")
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as BenchmarkRunResult);
    results.push(...existing);
    completed = existing.length;
    console.log(`📥 Resumed from ${existing.length} existing results`);
  }

  // Create work items (include trial index)
  const workItems: { task: BenchmarkTask; variant: string; trial: number }[] = [];
  for (const task of tasks) {
    for (const variant of variants) {
      for (let trial = 0; trial < trials; trial++) {
        // Skip if already completed (only when trials === 1 for backward compat)
        if (trials === 1) {
          const alreadyDone = results.some(
            r => r.taskId === task.id && r.variant === variant
              && (r.provider ?? undefined) === (options.provider ?? undefined),
          );
          if (alreadyDone) continue;
        }
        workItems.push({ task, variant, trial });
      }
    }
  }

  // Process work items with concurrency limit
  const queue = [...workItems];
  
  return new Promise((resolve) => {
    const errors: Error[] = [];
    
    function startNext() {
      if (queue.length === 0) {
        if (running.size === 0) {
          if (errors.length > 0) {
            console.error(`\n⚠️ ${errors.length} tasks failed but continuing...`);
          }
          resolve(results);
        }
        return;
      }

      const { task, variant, trial } = queue.shift()!;
      const suffix = trials > 1 ? ` (trial ${trial + 1}/${trials})` : "";
      const promise = runTaskWithTimeout(executor, task, variant, options, resultDir)
        .then(result => {
          results.push(result);
          completed++;
          onProgress(completed, total, task.id, variant + suffix, result);

          // Write trace file on failure or verbose
          if (!result.pass || options.verbose) {
            writeTrace(resultDir, task.id, variant, trial, trials);
          }
          
          // Auto-save progress every 5 results
          if (completed % 5 === 0) {
            writeFileSync(
              resultsPath,
              results.map(r => JSON.stringify(r)).join("\n") + "\n",
              "utf-8",
            );
          }
          
          running.delete(promise);
          startNext();
        })
        .catch(error => {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push(new Error(`${task.id} (${variant}): ${errMsg}`));
          completed++;
          onProgress(completed, total, task.id, variant + suffix);
          running.delete(promise);
          startNext();
        });

      running.add(promise);
    }

    // Start initial batch
    for (let i = 0; i < Math.min(maxConcurrency, queue.length); i++) {
      startNext();
    }
  });
}

export async function runBenchmark(
  executor: BenchmarkExecutor,
  taskDir: string,
  resultDir: string,
  options: RunBenchmarkOptions = {},
): Promise<void> {
  const startTime = Date.now();
  mkdirSync(resultDir, { recursive: true });

  const taskFiles = readdirSync(taskDir)
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  const tasks = taskFiles.map((file) => {
    const raw = readFileSync(resolve(taskDir, file), "utf-8");
    return JSON.parse(raw) as BenchmarkTask;
  });
  const limitedTasks = options.taskLimit ? tasks.slice(0, options.taskLimit) : tasks;

  // Compute corpus hash for reproducibility
  const corpusHash = createHash("sha256");
  for (const task of limitedTasks) {
    corpusHash.update(JSON.stringify(task));
  }
  const corpusHashHex = corpusHash.digest("hex").slice(0, 16);

  const benchmarkResults: BenchmarkRunResult[] = [];

  const variants = options.variants ?? ABLATION_CELLS.map(cellToVariant);
  const totalRuns = limitedTasks.length * variants.length * (options.repeat ?? 1);

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           TALKING CLI BENCHMARK RUNNER v0.6                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`📋 Configuration:`);
  console.log(`   Tasks: ${limitedTasks.length} | Variants: ${variants.join(", ")} | Total runs: ${totalRuns}`);
  console.log(`   Parallel: ${options.parallel ? `Yes (max ${options.maxConcurrency ?? 3})` : "No"}`);
  console.log(`   Repeat: ${options.repeat ?? 1} | Verbose: ${options.verbose ? "Yes" : "No"}`);
  console.log(`   Resume: ${options.resume ? "Yes" : "No"}`);
  console.log(`   Output: ${resultDir}`);
  console.log("");

  // Reset progress tracking
  lastProgressTime = Date.now();
  lastProgressCompleted = 0;

  if (options.parallel) {
    benchmarkResults.push(...await runParallel(
      executor,
      limitedTasks,
      variants,
      resultDir,
      options,
      printProgress,
    ));
  } else {
    const trials = options.repeat ?? 1;
    let completed = 0;
    for (const task of limitedTasks) {
      for (const variant of variants) {
        for (let trial = 0; trial < trials; trial++) {
          completed++;
          const suffix = trials > 1 ? ` (trial ${trial + 1}/${trials})` : "";
          printProgress(completed, totalRuns, task.id, variant + suffix);

          const result = await runTaskWithTimeout(executor, task, variant, options, resultDir);
          benchmarkResults.push(result);
          printProgress(completed, totalRuns, task.id, variant + suffix, result);

          // Write trace file on failure or verbose
          if (!result.pass || options.verbose) {
            writeTrace(resultDir, task.id, variant, trial, trials);
          }

          // Auto-save every 5 results
          if (completed % 5 === 0) {
            writeFileSync(
              resolve(resultDir, "results.jsonl"),
              benchmarkResults.map(r => JSON.stringify(r)).join("\n") + "\n",
              "utf-8",
            );
          }
        }
      }
    }
  }

  // Final save
  writeFileSync(
    resolve(resultDir, "results.jsonl"),
    benchmarkResults.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf-8",
  );

  // Save corpus hash metadata
  writeFileSync(
    resolve(resultDir, "corpus-metadata.json"),
    JSON.stringify({ corpusHash: corpusHashHex, taskCount: limitedTasks.length, taskDir, timestamp: new Date().toISOString() }, null, 2),
    "utf-8",
  );

  const elapsed = Date.now() - startTime;
  console.log("");
  console.log(`✅ Benchmark complete in ${formatDuration(elapsed)}`);
  console.log(`   Results: ${benchmarkResults.filter(r => r.pass).length}/${benchmarkResults.length} passed`);
  console.log(`   Corpus hash: ${corpusHashHex}`);

  // Compute and save stats
  const summary = computeStats(resultDir);
  if (options.provider) {
    summary.provider = options.provider;
  }
  const summaryPath = resolve(resultDir, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  const rendered = renderBenchmark(summaryPath);
  writeFileSync(resolve(resultDir, "AUDIT-BENCHMARK.md"), rendered, "utf-8");

  console.log(`   Summary: ${summaryPath}`);
  console.log(`   Report: ${resolve(resultDir, "AUDIT-BENCHMARK.md")}`);
}
