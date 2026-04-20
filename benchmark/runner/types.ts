export interface BenchmarkTask {
  id: string;
  prompt: string;
  checker: string;
  difficulty: string;
  category?: string;
}

export interface BenchmarkToolDefinition {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface BenchmarkRunResult {
  taskId: string;
  variant: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  walltime: number;
  outcome: "completed" | "timeout" | "error" | "stop_reason_end_turn";
  pass: boolean;
}

export interface BenchmarkRunOptions {
  outputDir: string;
  sandboxDir?: string;
  maxTurns?: number;
  temperature?: number;
  mcpInitTimeout?: number;
  turnTimeout?: number;
  serverCommand?: string;
  serverArgs?: string[];
  disableMcp?: boolean;
}

export interface BenchmarkExecutor {
  runTask(
    task: BenchmarkTask,
    variant: string,
    options: BenchmarkRunOptions,
  ): Promise<BenchmarkRunResult>;
}
