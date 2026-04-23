import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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
import { checkers } from "./checker.js";

type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type LLMResponse = {
  content: LLMContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
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
  private pending = new Map<number | string, (msg: JsonRpcMsg) => void>();
  private buffer = "";

  constructor(command: string, args: string[], cwd?: string) {
    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env: { ...process.env },
      windowsHide: true,
    });
    this.proc.stderr?.on("data", () => {
      /* drain */
    });
    this.proc.stdout?.on("data", (chunk: Buffer) => this.onData(chunk));
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
  }

  private request(method: string, params: unknown, timeoutMs = 10000): Promise<JsonRpcMsg> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
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
          const resolve = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (resolve) resolve(msg);
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
    ? resolve(benchDir, "servers/mute/dist/index.js")
    : resolve(benchDir, "servers/talking/dist/index.js");
  return { command: "node", args: [serverDir, sandboxDir] };
}

function getServerConfigForCell(cell: AblationCell, sandboxDir: string): { command: string; args: string[] } {
  const benchDir = BENCHMARK_DIR;
  const serverDir = cell.server === "mute"
    ? resolve(benchDir, "servers/mute/dist/index.js")
    : resolve(benchDir, "servers/talking/dist/index.js");
  return { command: "node", args: [serverDir, sandboxDir] };
}

export class StandaloneExecutor implements BenchmarkExecutor {
  constructor(private readonly llm: StandaloneLLMProvider) {}

  private loadSystemPromptForCell(cell: AblationCell): string {
    const skillDir = resolve(BENCHMARK_DIR, "skills");
    const skillFile = cell.skill === "bloated" ? "bloated-skill.md" : "talking-skill.md";
    const skillPath = join(skillDir, skillFile);
    if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
    return "You are a benchmark executor with access to MCP filesystem tools. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.";
  }

  private loadSystemPrompt(variant: string): string {
    const skillDir = resolve(BENCHMARK_DIR, "skills");
    
    if (variant === "bloated") {
      const bloatedPath = join(skillDir, "bloated-skill.md");
      if (existsSync(bloatedPath)) {
        return readFileSync(bloatedPath, "utf-8");
      }
    }
    
    if (variant === "talking") {
      const talkingPath = join(skillDir, "talking-skill.md");
      if (existsSync(talkingPath)) {
        return readFileSync(talkingPath, "utf-8");
      }
    }
    
    // Default system prompt for mute variant
    return "You are a benchmark executor with access to MCP filesystem tools. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.";
  }

  private evaluateTask(task: BenchmarkTask, finalTurn: unknown): boolean {
    const checker = checkers[task.checker];
    if (!checker) {
      throw new Error(`Unknown benchmark checker: ${task.checker}`);
    }

    return checker(finalTurn, {}).pass;
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
    let turnCount = 0;
    let errorRecoveries = 0;
    let totalToolCalls = 0;
    let timeToFirstTool = 0;

    // Load system prompt based on variant
    const cell = variantToCell(variant);
    const systemPrompt = cell
      ? this.loadSystemPromptForCell(cell)
      : this.loadSystemPrompt(variant);
    const messages: StandaloneConversationMessage[] = [
      { role: "user", content: systemPrompt + "\n\nUser request: " + task.prompt },
    ];

    let useMcp = !options.disableMcp;
    let mcp: McpSubprocess | null = null;
    let mcpTools: BenchmarkToolDefinition[] = [];
    if (useMcp) {
      try {
        const sandboxDir = options.sandboxDir ?? "/tmp/benchmark-sandbox";
        if (!existsSync(sandboxDir)) mkdirSync(sandboxDir, { recursive: true });
        const serverConf = options.serverCommand
          ? { command: options.serverCommand, args: options.serverArgs ?? [sandboxDir] }
          : cell
            ? getServerConfigForCell(cell, sandboxDir)
            : getServerConfig(variant, sandboxDir);
        mcp = new McpSubprocess(serverConf.command, serverConf.args);
        const initTimeout = options.mcpInitTimeout ?? 10000;
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
            timeToFirstTool: timeToFirstTool || elapsed,
          };
        }

        const inputToks = response.usage?.input_tokens ?? 0;
        const outputToks = response.usage?.output_tokens ?? 0;
        totalInputTokens += inputToks;
        totalOutputTokens += outputToks;

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
          return {
            turns: turnCount,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            pass: this.evaluateTask(task, finalText),
            walltime: elapsed,
            outcome: "stop_reason_end_turn",
            taskId: task.id,
            variant,
            schemaVersion: SCHEMA_VERSION,
            taskHash,
            errorRecoveries,
            toolCalls: totalToolCalls,
            timeToFirstTool: timeToFirstTool || elapsed,
            timeToSuccess: this.evaluateTask(task, finalText) ? elapsed : 0,
          };
        }

        // Track time to first tool call
        if (totalToolCalls === 0) {
          timeToFirstTool = Date.now() - startTime;
        }
        totalToolCalls += toolUses.length;

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
        timeToFirstTool: timeToFirstTool || elapsed,
      };
    } finally {
      if (mcp) await mcp.close();
    }
  }
}
