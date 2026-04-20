import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runBenchmark } from "./runner/run-benchmark.js";
import type { BenchmarkExecutor, BenchmarkRunOptions, BenchmarkRunResult, BenchmarkTask } from "./runner/types.js";

class FakeExecutor implements BenchmarkExecutor {
  public readonly calls: Array<{ taskId: string; variant: string; outputDir: string }> = [];

  async runTask(
    task: BenchmarkTask,
    variant: string,
    options: BenchmarkRunOptions,
  ): Promise<BenchmarkRunResult> {
    this.calls.push({ taskId: task.id, variant, outputDir: options.outputDir });
    const talking = variant === "talking";
    return {
      taskId: task.id,
      variant,
      turns: talking ? 2 : 3,
      inputTokens: talking ? 40 : 55,
      outputTokens: talking ? 20 : 25,
      walltime: talking ? 120 : 150,
      outcome: talking ? "completed" : "timeout",
      pass: talking,
    };
  }
}

const TEMP_ROOT = resolve(tmpdir(), "talking-cli-benchmark-tests");

function writeTask(taskDir: string, task: BenchmarkTask): void {
  writeFileSync(resolve(taskDir, `${task.id}.json`), JSON.stringify(task, null, 2), "utf-8");
}

describe("benchmark runner entrypoint", () => {
  afterEach(() => {
    try {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    } catch {
      // best-effort cleanup on Windows
    }
  });

  it("limits the run to the requested number of tasks and writes summary artifacts", async () => {
    const taskDir = resolve(TEMP_ROOT, "tasks");
    const resultDir = resolve(TEMP_ROOT, "results");
    mkdirSync(taskDir, { recursive: true });

    writeTask(taskDir, {
      id: "task-a",
      prompt: "Prompt A",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });
    writeTask(taskDir, {
      id: "task-b",
      prompt: "Prompt B",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });
    writeTask(taskDir, {
      id: "task-c",
      prompt: "Prompt C",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });

    const executor = new FakeExecutor();
    await runBenchmark(executor, taskDir, resultDir, { taskLimit: 2 });

    expect(executor.calls).toHaveLength(4);
    expect(executor.calls.map((call) => `${call.taskId}:${call.variant}`)).toEqual([
      "task-a:mute",
      "task-a:talking",
      "task-b:mute",
      "task-b:talking",
    ]);

    expect(existsSync(resolve(resultDir, "results.jsonl"))).toBe(true);
    expect(existsSync(resolve(resultDir, "summary.json"))).toBe(true);
    expect(existsSync(resolve(resultDir, "AUDIT-BENCHMARK.md"))).toBe(true);

    const summary = JSON.parse(readFileSync(resolve(resultDir, "summary.json"), "utf-8"));
    expect(summary.perTask).toHaveLength(2);
    expect(summary.aggregate.talkingWins).toBe(2);
    expect(summary.aggregate.muteWins).toBe(0);
    expect(summary.aggregate.ties).toBe(0);
  });

  it("runs task files in deterministic alphabetical order", async () => {
    const taskDir = resolve(TEMP_ROOT, "unordered-tasks");
    const resultDir = resolve(TEMP_ROOT, "unordered-results");
    mkdirSync(taskDir, { recursive: true });

    writeTask(taskDir, {
      id: "task-c",
      prompt: "Prompt C",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });
    writeTask(taskDir, {
      id: "task-a",
      prompt: "Prompt A",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });
    writeTask(taskDir, {
      id: "task-b",
      prompt: "Prompt B",
      checker: "checkSearchResults",
      difficulty: "easy",
      category: "search",
    });

    const executor = new FakeExecutor();
    await runBenchmark(executor, taskDir, resultDir, { taskLimit: 2 });

    expect(executor.calls.map((call) => `${call.taskId}:${call.variant}`)).toEqual([
      "task-a:mute",
      "task-a:talking",
      "task-b:mute",
      "task-b:talking",
    ]);
  });
});
