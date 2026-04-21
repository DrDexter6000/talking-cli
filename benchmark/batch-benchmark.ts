import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { StandaloneExecutor } from "./runner/standalone-executor.js";
import { createProvider } from "./runner/providers.js";
import type { BenchmarkTask } from "./runner/types.js";

const BENCHMARK_DIR = resolve(import.meta.dirname || ".");
const TASKS_DIR = resolve(BENCHMARK_DIR, "tasks");

async function runBatch(startIndex: number, batchSize: number) {
  const resultDir = resolve(BENCHMARK_DIR, "results", `token-efficiency-${new Date().toISOString().slice(0, 10)}`);
  mkdirSync(resultDir, { recursive: true });

  const taskFiles = readdirSync(TASKS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const tasks = taskFiles.map((file) => {
    const raw = readFileSync(resolve(TASKS_DIR, file), "utf-8");
    return JSON.parse(raw) as BenchmarkTask;
  });

  const batchTasks = tasks.slice(startIndex, startIndex + batchSize);
  console.log(`Running batch: tasks ${startIndex + 1} to ${startIndex + batchTasks.length} of ${tasks.length}`);

  const provider = createProvider("anthropic");
  const executor = new StandaloneExecutor(provider);

  // Run bloated variant
  console.log("\n=== Running BLOATED variant ===");
  for (const task of batchTasks) {
    console.log(`Task: ${task.id}`);
    const result = await executor.runTask(task, "bloated", {
      outputDir: resolve(resultDir, "bloated"),
      disableMcp: true,
    });
    console.log(`  Turns: ${result.turns}, Input: ${result.inputTokens}, Output: ${result.outputTokens}, Pass: ${result.pass}`);
  }

  // Run talking variant
  console.log("\n=== Running TALKING variant ===");
  for (const task of batchTasks) {
    console.log(`Task: ${task.id}`);
    const result = await executor.runTask(task, "talking", {
      outputDir: resolve(resultDir, "talking"),
      disableMcp: true,
    });
    console.log(`  Turns: ${result.turns}, Input: ${result.inputTokens}, Output: ${result.outputTokens}, Pass: ${result.pass}`);
  }

  console.log(`\nBatch ${startIndex + 1}-${startIndex + batchTasks.length} completed`);
}

// Run first batch of 5 tasks
runBatch(10, 5).catch(console.error);


