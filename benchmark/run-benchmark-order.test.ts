import { describe, expect, it, vi } from "vitest";
import type { BenchmarkExecutor, BenchmarkRunOptions, BenchmarkRunResult, BenchmarkTask } from "./runner/types.js";

class FakeExecutor implements BenchmarkExecutor {
  public readonly calls: Array<{ taskId: string; variant: string }> = [];

  async runTask(
    task: BenchmarkTask,
    variant: string,
    _options: BenchmarkRunOptions,
  ): Promise<BenchmarkRunResult> {
    this.calls.push({ taskId: task.id, variant });
    return {
      taskId: task.id,
      variant,
      turns: 1,
      inputTokens: 0,
      outputTokens: 0,
      walltime: 0,
      outcome: "completed",
      pass: true,
    };
  }
}

describe("benchmark runner task ordering", () => {
  it("sorts task files before execution", async () => {
    vi.resetModules();

    const writtenFiles: Array<{ path: string; content: string }> = [];

    vi.doMock("node:fs", () => ({
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => ["task-c.json", "task-a.json", "task-b.json"]),
      readFileSync: vi.fn((filePath: string) => {
        if (filePath.endsWith("task-a.json")) {
          return JSON.stringify({ id: "task-a", prompt: "A", checker: "checkSearchResults", difficulty: "easy" });
        }
        if (filePath.endsWith("task-b.json")) {
          return JSON.stringify({ id: "task-b", prompt: "B", checker: "checkSearchResults", difficulty: "easy" });
        }
        if (filePath.endsWith("task-c.json")) {
          return JSON.stringify({ id: "task-c", prompt: "C", checker: "checkSearchResults", difficulty: "easy" });
        }
        if (filePath.endsWith("summary.json")) {
          return JSON.stringify({ perTask: [], aggregate: { talkingWins: 0, muteWins: 0, ties: 0, signTestN: 0, signTestPValue: 1, meanDeltaInputTokens: 0, meanDeltaOutputTokens: 0, wilcoxonW: 0, wilcoxonPValue: 1 }, tieCount: 0 });
        }
        throw new Error(`Unexpected file read: ${filePath}`);
      }),
      writeFileSync: vi.fn((filePath: string, content: string) => {
        writtenFiles.push({ path: filePath, content });
      }),
    }));

    vi.doMock("./runner/stats.js", () => ({
      computeStats: vi.fn(() => ({
        perTask: [],
        aggregate: {
          talkingWins: 0,
          muteWins: 0,
          ties: 0,
          signTestN: 0,
          signTestPValue: 1,
          meanDeltaInputTokens: 0,
          meanDeltaOutputTokens: 0,
          wilcoxonW: 0,
          wilcoxonPValue: 1,
        },
        tieCount: 0,
      })),
    }));

    vi.doMock("./runner/renderer.js", () => ({
      renderBenchmark: vi.fn(() => "rendered"),
    }));

    const { runBenchmark } = await import("./runner/run-benchmark.js");
    const executor = new FakeExecutor();

    await runBenchmark(executor, "virtual-task-dir", "virtual-results", { taskLimit: 2 });

    expect(executor.calls.map((call) => `${call.taskId}:${call.variant}`)).toEqual([
      "task-a:full-skill+mute",
      "task-a:full-skill+hinting",
      "task-a:lean-skill+mute",
      "task-a:lean-skill+hinting",
      "task-b:full-skill+mute",
      "task-b:full-skill+hinting",
      "task-b:lean-skill+mute",
      "task-b:lean-skill+hinting",
    ]);
    expect(writtenFiles.some((file) => file.path.endsWith("results.jsonl"))).toBe(true);
  });
});
