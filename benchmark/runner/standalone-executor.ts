import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BenchmarkExecutor,
  BenchmarkRunOptions,
  BenchmarkRunResult,
  BenchmarkTask,
  BenchmarkToolDefinition,
} from "./types.js";
import { SCHEMA_VERSION, variantToCell, type AblationCell } from "./types.js";
import { checkers, type CheckerResult } from "./checker.js";

type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type LLMResponse = {
  content: LLMContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
};

export type StandaloneConversationMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "assistant_content"; content: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> }
  | { role: "tool"; toolUseId: string; name: string; content: string; isError?: boolean };

export interface StandaloneLLMProvider {
  call(
    messages: StandaloneConversationMessage[],
    turnId: number,
    tools?: BenchmarkToolDefinition[],
  ): Promise<LLMResponse>;
}

type RawJournalEntry = {
  taskId: string;
  variant: string;
  turn: number;
  role: string;
  tool_name?: string;
  tool_result?: string;
  content?: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
};

function truncate(s: string, max = 2000): string {
  return s.length > max ? s.slice(0, max) + "...[truncated]" : s;
}

type JsonRpcMsg = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
};

type JsonRpcOut = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: unknown;
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema: unknown;
};

type ToolResult = {
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
};

const RUNNER_DIR = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = basename(dirname(RUNNER_DIR)) === "dist"
  ? dirname(dirname(RUNNER_DIR))
  : dirname(RUNNER_DIR);

class McpSubprocess {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<
    number | string,
    { resolve: (msg: JsonRpcMsg) => void; reject: (err: Error) => void }
  >();
  private buffer = "";
  private stderrBuf = "";
  private dead = false;

  constructor(command: string, args: string[], cwd?: string) {
    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env: { ...process.env },
      windowsHide: true,
    });
    // Capture stderr for diagnostics (replace silent drain)
    this.proc.stderr?.on("data", (chunk: Buffer) => {
      this.stderrBuf += chunk.toString("utf-8");
    });
    this.proc.on("exit", (code, signal) => {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      const stderrSnippet = this.stderrBuf.slice(-500);
      const err = new Error(
        `Server process exited (${detail})${stderrSnippet ? `\nStderr (last 500 chars):\n${stderrSnippet}` : ""}`,
      );
      for (const [, entry] of this.pending) {
        entry.reject(err);
      }
      this.pending.clear();
      this.dead = true;
    });
    this.proc.on("error", (err) => {
      for (const [, entry] of this.pending) {
        entry.reject(new Error(`Server process error: ${err.message}`));
      }
      this.pending.clear();
      this.dead = true;
    });
    this.proc.stdout?.on("data", (chunk: Buffer) => this.onData(chunk));
    this.proc.stdout?.on("end", () => {
      if (!this.dead) {
        const err = new Error("Server stdout closed unexpectedly");
        for (const [, entry] of this.pending) {
          entry.reject(err);
        }
        this.pending.clear();
        this.dead = true;
      }
    });
  }

  async initialize(timeoutMs = 10000): Promise<void> {
    const res = await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "talking-cli-benchmark", version: "0.5.0" },
      },
      timeoutMs,
    );
    if (res.error) throw new Error(`MCP init failed: ${res.error.message}`);
    this.notify("notifications/initialized");
  }

  async listTools(timeoutMs = 10000): Promise<McpTool[]> {
    const res = await this.request("tools/list", {}, timeoutMs);
    if (res.error) throw new Error(`tools/list failed: ${res.error.message}`);
    return (res.result as { tools: McpTool[] }).tools ?? [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    timeoutMs = 30000,
  ): Promise<ToolResult> {
    const res = await this.request("tools/call", { name, arguments: args }, timeoutMs);
    if (res.error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${res.error.message}` }],
      };
    }
    const result = res.result as { content?: ToolResult["content"]; isError?: boolean };
    return {
      content: result?.content ?? [{ type: "text", text: "" }],
      isError: result?.isError ?? false,
    };
  }

  async close(): Promise<void> {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.proc && !this.proc.killed) this.proc.kill("SIGKILL");
          resolve();
        }, 2000);
        this.proc?.on("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.proc = null;
    this.pending.clear();
    this.dead = false;
    this.stderrBuf = "";
  }

  /** Return captured stderr (last 50KB) for diagnostics. */
  getStderr(): string {
    const MAX = 50 * 1024;
    if (this.stderrBuf.length <= MAX) return this.stderrBuf;
    return this.stderrBuf.slice(-MAX);
  }

  async waitForReady(timeoutMs = 15000): Promise<void> {
    // Check if server already signaled ready or is dead
    if (this.stderrBuf.includes("running on stdio")) return;
    if (this.dead) throw new Error("Server process died before becoming ready");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const snippet = this.stderrBuf.slice(-500);
        reject(
          new Error(
            `Server never signaled ready within ${timeoutMs}ms${snippet ? `\nStderr (last 500 chars):\n${snippet}` : ""}`,
          ),
        );
      }, timeoutMs);

      const onData = (chunk: Buffer): void => {
        this.stderrBuf += chunk.toString("utf-8");
        if (this.stderrBuf.includes("running on stdio")) {
          clearTimeout(timer);
          this.proc?.stderr?.removeListener("data", onData);
          resolve();
        }
      };

      this.proc?.stderr?.on("data", onData);

      // Also reject if process dies while waiting
      this.proc?.on("exit", () => {
        clearTimeout(timer);
        reject(new Error("Server process exited while waiting for ready signal"));
      });
    });
  }

  private request(method: string, params: unknown, timeoutMs = 10000): Promise<JsonRpcMsg> {
    if (this.dead) {
      return Promise.reject(new Error(`Cannot send ${method}: server process is dead`));
    }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const stderrSnippet = this.stderrBuf.slice(-500);
        reject(
          new Error(
            `${method} timed out after ${timeoutMs}ms${stderrSnippet ? `\nStderr (last 500 chars):\n${stderrSnippet}` : ""}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve: (msg) => {
        clearTimeout(timer);
        resolve(msg);
      }, reject: (err) => {
        clearTimeout(timer);
        reject(err);
      } });
      const payload: JsonRpcOut = { jsonrpc: "2.0", id, method, params };
      this.proc?.stdin?.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private notify(method: string, params?: unknown): void {
    const payload: JsonRpcOut = { jsonrpc: "2.0", method };
    if (params !== undefined) payload.params = params;
    this.proc?.stdin?.write(`${JSON.stringify(payload)}\n`);
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf-8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMsg;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (entry) entry.resolve(msg);
        }
      } catch {
        // Ignore non-JSON lines from server logs.
      }
    }
  }
}

function getServerConfig(variant: string, sandboxDir: string): { command: string; args: string[] } {
  const benchDir = BENCHMARK_DIR;
  const serverDir = variant === "mute"
    ? resolve(benchDir, "servers/variants/mute/dist/variants/mute/index.js")
    : resolve(benchDir, "servers/variants/talking/dist/variants/talking/index.js");
  return { command: "node", args: [serverDir, sandboxDir] };
}

function getServerConfigForCell(cell: AblationCell, sandboxDir: string): { command: string; args: string[] } {
  const benchDir = BENCHMARK_DIR;
  const serverDir = cell.server === "mute"
    ? resolve(benchDir, "servers/variants/mute/dist/variants/mute/index.js")
    : resolve(benchDir, "servers/variants/talking/dist/variants/talking/index.js");
  return { command: "node", args: [serverDir, sandboxDir] };
}

export class StandaloneExecutor implements BenchmarkExecutor {
  constructor(private readonly llm: StandaloneLLMProvider) {}

  private loadSystemPromptForCell(cell: AblationCell): string {
    const skillDir = resolve(BENCHMARK_DIR, "skills");
    const skillFile = cell.skill === "full-skill" ? "full-skill.md" : "lean-skill.md";
    const skillPath = join(skillDir, skillFile);
    if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
    return "You are a benchmark executor with access to MCP filesystem tools. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.";
  }

  private loadSystemPrompt(variant: string): string {
    const skillDir = resolve(BENCHMARK_DIR, "skills");
    
    if (variant === "bloated" || variant === "full-skill") {
      const fullPath = join(skillDir, "full-skill.md");
      if (existsSync(fullPath)) {
        return readFileSync(fullPath, "utf-8");
      }
    }
    
    if (variant === "talking" || variant === "lean-skill") {
      const leanPath = join(skillDir, "lean-skill.md");
      if (existsSync(leanPath)) {
        return readFileSync(leanPath, "utf-8");
      }
    }
    
    // Default system prompt for mute variant
    return "You are a benchmark executor with access to MCP filesystem tools. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.";
  }

  private readonly RUBRIC_THRESHOLD = 0.6;

  private isHardTask(task: BenchmarkTask): boolean {
    return task.difficulty === "hard" || task.tier === "hard";
  }

  private computePass(task: BenchmarkTask, result: CheckerResult): boolean {
    if (this.isHardTask(task) && result.score !== undefined) {
      return result.score >= this.RUBRIC_THRESHOLD;
    }
    return result.pass;
  }

  private evaluateTask(task: BenchmarkTask, finalTurn: unknown): CheckerResult {
    const checker = checkers[task.checker];
    if (!checker) {
      throw new Error(`Unknown benchmark checker: ${task.checker}`);
    }

    return checker(finalTurn, {});
  }

  async runTask(
    task: BenchmarkTask,
    variant: string,
    options: BenchmarkRunOptions,
  ): Promise<BenchmarkRunResult> {
    const maxTurns = options.maxTurns ?? 20;
    const outputDir = options.outputDir;
    const taskHash = createHash("sha256").update(JSON.stringify(task)).digest("hex").slice(0, 16);

    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    const rawPath = resolve(outputDir, "raw.jsonl");

    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadInputTokens = 0;
    let totalCacheCreationInputTokens = 0;
    let turnCount = 0;
    let errorRecoveries = 0;
    let totalToolCalls = 0;
    let timeToFirstTool = 0;
    const uniqueToolNames = new Set<string>();

    // Load system prompt based on variant
    const cell = variantToCell(variant);
    const systemPrompt = cell
      ? this.loadSystemPromptForCell(cell)
      : this.loadSystemPrompt(variant);

    // Compute sandbox dir early so we can rewrite paths in the task prompt
    let useMcp = !options.disableMcp;
    let mcp: McpSubprocess | null = null;
    let mcpTools: BenchmarkToolDefinition[] = [];
    let isOwnSandbox = false;
    const sandboxDir = useMcp
      ? (options.sandboxDir ?? mkdtempSync(join(tmpdir(), "talking-cli-benchmark-")))
      : "";

    if (useMcp) {
      isOwnSandbox = !options.sandboxDir;
      if (!isOwnSandbox && !existsSync(sandboxDir)) {
        mkdirSync(sandboxDir, { recursive: true });
      }
    }

    // Rewrite task prompt paths: /tmp/benchmark-sandbox → actual sandbox dir
    // Use forward slashes to match the prompt style regardless of platform
    const normalizedSandbox = sandboxDir.replace(/\\/g, "/");
    const rewrittenPrompt = task.prompt.replace(
      /\/tmp\/benchmark-sandbox/g,
      normalizedSandbox,
    );

    const messages: StandaloneConversationMessage[] = [
      { role: "user", content: systemPrompt + "\n\nUser request: " + rewrittenPrompt },
    ];

    if (useMcp) {
      try {
        const serverConf = options.serverCommand
          ? { command: options.serverCommand, args: options.serverArgs ?? [sandboxDir] }
          : cell
            ? getServerConfigForCell(cell, sandboxDir)
            : getServerConfig(variant, sandboxDir);
        mcp = new McpSubprocess(serverConf.command, serverConf.args);
        const initTimeout = options.mcpInitTimeout ?? 10000;
        await mcp.waitForReady(initTimeout);
        await mcp.initialize(initTimeout);
        mcpTools = await mcp.listTools(initTimeout);
      } catch (mcpError) {
        const errMsg = mcpError instanceof Error ? mcpError.message : String(mcpError);
        console.error(`[benchmark] MCP init failed for ${variant} variant: ${errMsg}`);
        useMcp = false;
      }
    }

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        turnCount = turn + 1;

        let response: LLMResponse;
        try {
          const turnTimeoutMs = options.turnTimeout ?? 300_000; // 5 minutes default
          response = await Promise.race([
            this.llm.call(messages, turn, mcpTools),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`LLM call timed out after ${turnTimeoutMs}ms`)), turnTimeoutMs),
            ),
          ]);
        } catch {
          const elapsed = Date.now() - startTime;
          const entry: RawJournalEntry = {
            taskId: task.id,
            variant,
            turn,
            role: "error",
            content: truncate("LLM call timed out"),
            input_tokens: 0,
            output_tokens: 0,
            timestamp: new Date().toISOString(),
          };
          appendFileSync(rawPath, JSON.stringify(entry) + "\n");
          return {
            turns: turnCount,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            pass: false,
            walltime: elapsed,
            outcome: "error",
            taskId: task.id,
            variant,
            schemaVersion: SCHEMA_VERSION,
            taskHash,
            errorRecoveries,
            toolCalls: totalToolCalls,
            uniqueTools: uniqueToolNames.size,
            timeToFirstTool: timeToFirstTool || elapsed,
            serverStderr: mcp?.getStderr(),
            cacheReadInputTokens: totalCacheReadInputTokens,
            cacheCreationInputTokens: totalCacheCreationInputTokens,
          };
        }

        const inputToks = response.usage?.input_tokens ?? 0;
        const outputToks = response.usage?.output_tokens ?? 0;
        totalInputTokens += inputToks;
        totalOutputTokens += outputToks;
        totalCacheReadInputTokens += response.usage?.cache_read_input_tokens ?? 0;
        totalCacheCreationInputTokens += response.usage?.cache_creation_input_tokens ?? 0;

        const assistantText = response.content
          .filter((block): block is Extract<LLMContentBlock, { type: "text" }> => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        const assistantEntry: RawJournalEntry = {
          taskId: task.id,
          variant,
          turn,
          role: "assistant",
          content: assistantText ? truncate(assistantText) : undefined,
          input_tokens: inputToks,
          output_tokens: outputToks,
          timestamp: new Date().toISOString(),
        };
        appendFileSync(rawPath, JSON.stringify(assistantEntry) + "\n");

        const toolUses = response.content.filter(
          (block): block is Extract<LLMContentBlock, { type: "tool_use" }> => block.type === "tool_use",
        );

        if (toolUses.length === 0) {
          // Add the assistant's text response to conversation history
          const finalText = response.content
            .filter((block): block is Extract<LLMContentBlock, { type: "text" }> => block.type === "text")
            .map((block) => block.text)
            .join("\n");
          messages.push({ role: "assistant", content: finalText });
          const elapsed = Date.now() - startTime;
          const checkerResult = this.evaluateTask(task, finalText);
          const passed = this.computePass(task, checkerResult);
          return {
            turns: turnCount,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            pass: passed,
            walltime: elapsed,
            outcome: "stop_reason_end_turn",
            taskId: task.id,
            variant,
            schemaVersion: SCHEMA_VERSION,
            taskHash,
            errorRecoveries,
            toolCalls: totalToolCalls,
            uniqueTools: uniqueToolNames.size,
            timeToFirstTool: timeToFirstTool || elapsed,
            timeToSuccess: passed ? elapsed : 0,
            score: checkerResult.score,
            passedSubchecks: checkerResult.passedSubchecks,
            serverStderr: mcp?.getStderr(),
            cacheReadInputTokens: totalCacheReadInputTokens,
            cacheCreationInputTokens: totalCacheCreationInputTokens,
          };
        }

        // Track time to first tool call
        if (totalToolCalls === 0) {
          timeToFirstTool = Date.now() - startTime;
        }
        totalToolCalls += toolUses.length;
        for (const tool of toolUses) {
          uniqueToolNames.add(tool.name);
        }

        // Add assistant's full response to conversation history (preserves tool_use blocks
        // for multi-turn coherence — required by Anthropic API and MiniMax extended-thinking).
        messages.push({
          role: "assistant_content",
          content: response.content,
        });

        for (const tool of toolUses) {
          const toolCallEntry: RawJournalEntry = {
            taskId: task.id,
            variant,
            turn,
            role: "tool_call",
            tool_name: tool.name,
            input_tokens: inputToks,
            output_tokens: outputToks,
            timestamp: new Date().toISOString(),
          };
          appendFileSync(rawPath, JSON.stringify(toolCallEntry) + "\n");
        }

        if (useMcp && mcp) {
          for (const tool of toolUses) {
            try {
              const result = await mcp.callTool(tool.name, tool.input, 30000);
              const text = result.content
                .filter((content) => content.type === "text")
                .map((content) => content.text ?? "")
                .join("\n");
              messages.push({
                role: "tool",
                toolUseId: tool.id,
                name: tool.name,
                content: text,
                isError: result.isError,
              });
              const toolResultEntry: RawJournalEntry = {
                taskId: task.id,
                variant,
                turn,
                role: "tool_result",
                tool_name: tool.name,
                tool_result: result.isError ? "error" : "success",
                content: text ? truncate(text) : undefined,
                input_tokens: 0,
                output_tokens: 0,
                timestamp: new Date().toISOString(),
              };
              appendFileSync(rawPath, JSON.stringify(toolResultEntry) + "\n");

              // Track error recoveries
              if (result.isError) {
                errorRecoveries++;
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              messages.push({
                role: "tool",
                toolUseId: tool.id,
                name: tool.name,
                content: msg,
                isError: true,
              });
              errorRecoveries++;
            }
          }
        } else {
          for (const tool of toolUses) {
            messages.push({
              role: "tool",
              toolUseId: tool.id,
              name: tool.name,
              content: "mock response",
              isError: false,
            });
          }
        }
      }

      const elapsed = Date.now() - startTime;
      return {
        turns: turnCount,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        pass: false,
        walltime: elapsed,
        outcome: "timeout",
        taskId: task.id,
        variant,
        schemaVersion: SCHEMA_VERSION,
        taskHash,
        errorRecoveries,
        toolCalls: totalToolCalls,
        uniqueTools: uniqueToolNames.size,
        timeToFirstTool: timeToFirstTool || elapsed,
        serverStderr: mcp?.getStderr(),
        cacheReadInputTokens: totalCacheReadInputTokens,
        cacheCreationInputTokens: totalCacheCreationInputTokens,
      };
    } finally {
      if (mcp) await mcp.close();
      if (isOwnSandbox && sandboxDir) {
        try { rmSync(sandboxDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
      }
    }
  }
}
