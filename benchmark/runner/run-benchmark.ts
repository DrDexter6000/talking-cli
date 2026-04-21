import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { computeStats } from "./stats.js";
import { renderBenchmark } from "./renderer.js";
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
};

type ProgressCallback = (completed: number, total: number, currentTask: string, currentVariant: string, result?: BenchmarkRunResult) => void;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function printProgress(completed: number, total: number, currentTask: string, currentVariant: string, result?: BenchmarkRunResult) {
  const percent = ((completed / total) * 100).toFixed(1);
  const status = result 
    ? `${result.pass ? "✅" : "❌"} ${result.turns}turns ${result.inputTokens + result.outputTokens}tok`
    : "running...";
  console.log(`[${completed}/${total}] ${percent}% | ${currentVariant} | ${currentTask} | ${status}`);
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
    return { ...result, walltime: Date.now() - startTime };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Task ${task.id} (${variant}) failed: ${errMsg}`);
    return {
      taskId: task.id,
      variant,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      walltime: Date.now() - startTime,
      outcome: "error",
      pass: false,
    };
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
  const total = tasks.length * variants.length;
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

  // Create work items
  const workItems: { task: BenchmarkTask; variant: string }[] = [];
  for (const task of tasks) {
    for (const variant of variants) {
      // Skip if already completed
      const alreadyDone = results.some(r => r.taskId === task.id && r.variant === variant);
      if (!alreadyDone) {
        workItems.push({ task, variant });
      }
    }
  }

  // Process work items with concurrency limit
  const queue = [...workItems];
  
  return new Promise((resolve, reject) => {
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

      const { task, variant } = queue.shift()!;
      const promise = runTaskWithTimeout(executor, task, variant, options, resultDir)
        .then(result => {
          results.push(result);
          completed++;
          onProgress(completed, total, task.id, variant, result);
          
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
          onProgress(completed, total, task.id, variant);
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
  const benchmarkResults: BenchmarkRunResult[] = [];

  const variants = options.variants ?? ["mute", "talking"];
  const totalRuns = limitedTasks.length * variants.length;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           TALKING CLI BENCHMARK RUNNER v0.6                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`📋 Configuration:`);
  console.log(`   Tasks: ${limitedTasks.length} | Variants: ${variants.join(", ")} | Total runs: ${totalRuns}`);
  console.log(`   Parallel: ${options.parallel ? `Yes (max ${options.maxConcurrency ?? 3})` : "No"}`);
  console.log(`   Resume: ${options.resume ? "Yes" : "No"}`);
  console.log(`   Output: ${resultDir}`);
  console.log("");

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
    let completed = 0;
    for (const task of limitedTasks) {
      for (const variant of variants) {
        completed++;
        printProgress(completed, totalRuns, task.id, variant);
        
        const result = await runTaskWithTimeout(executor, task, variant, options, resultDir);
        benchmarkResults.push(result);
        printProgress(completed, totalRuns, task.id, variant, result);
        
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

  // Final save
  writeFileSync(
    resolve(resultDir, "results.jsonl"),
    benchmarkResults.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf-8",
  );

  const elapsed = Date.now() - startTime;
  console.log("");
  console.log(`✅ Benchmark complete in ${formatDuration(elapsed)}`);
  console.log(`   Results: ${benchmarkResults.filter(r => r.pass).length}/${benchmarkResults.length} passed`);

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
