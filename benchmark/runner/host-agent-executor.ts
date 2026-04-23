import type {
  BenchmarkExecutor,
  BenchmarkRunOptions,
  BenchmarkRunResult,
  BenchmarkTask,
} from "./types.js";

export class HostAgentExecutor implements BenchmarkExecutor {
  async runTask(
    _task: BenchmarkTask,
    _variant: string,
    _options: BenchmarkRunOptions,
  ): Promise<BenchmarkRunResult> {
    throw new Error(
      "HostAgentExecutor not implemented yet. This mode is reserved for running the benchmark through the surrounding coding-agent host.",
    );
  }
}
