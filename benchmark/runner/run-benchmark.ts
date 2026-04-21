import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeStats } from "./stats.js";
import { renderBenchmark } from "./renderer.js";
import type { BenchmarkExecutor, BenchmarkTask } from "./types.js";

type RunBenchmarkOptions = {
  taskLimit?: number;
  disableMcp?: boolean;
  provider?: string;
  variants?: string[];
};

export async function runBenchmark(
  executor: BenchmarkExecutor,
  taskDir: string,
  resultDir: string,
  options: RunBenchmarkOptions = {},
): Promise<void> {
  mkdirSync(resultDir, { recursive: true });

  const taskFiles = readdirSync(taskDir)
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  const tasks = taskFiles.map((file) => {
    const raw = readFileSync(resolve(taskDir, file), "utf-8");
    return JSON.parse(raw) as BenchmarkTask;
  });
  const limitedTasks = options.taskLimit ? tasks.slice(0, options.taskLimit) : tasks;
  const benchmarkResults = [];

  const variants = options.variants ?? ["mute", "talking"];
  for (const task of limitedTasks) {
    for (const variant of variants) {
      benchmarkResults.push(
        await executor.runTask(task, variant, {
          outputDir: resultDir,
          disableMcp: options.disableMcp,
        }),
      );
    }
  }

  writeFileSync(
    resolve(resultDir, "results.jsonl"),
    benchmarkResults.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf-8",
  );

  const summary = computeStats(resultDir);
  if (options.provider) {
    summary.provider = options.provider;
  }
  const summaryPath = resolve(resultDir, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  const rendered = renderBenchmark(summaryPath);
  writeFileSync(resolve(resultDir, "AUDIT-BENCHMARK.md"), rendered, "utf-8");
}
