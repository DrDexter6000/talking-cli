/**
 * ProxyMcpServer — JSON-RPC forwarding core with hint injection.
 *
 * Spawns the original npm MCP server as a child process, pipes
 * stdin/stdout bidirectionally, and intercepts tools/call responses
 * for hint injection. All other JSON-RPC messages pass through
 * transparently.
 *
 * Built on the proven McpSubprocess pattern from standalone-executor.ts.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { HintInjector, type HintConfig } from "./hint-injector.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ProxyOptions {
  /** Hint config for injection. If null/undefined, proxy is transparent. */
  hintConfig: HintConfig | null;
  /** Log hint injections to stderr for debugging */
  verbose?: boolean;
}

type JsonRpcMsg = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
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

type PendingEntry = {
  resolve: (msg: JsonRpcMsg) => void;
  reject: (err: Error) => void;
  method?: string; // Track which method this pending request is for
};

// ─── ProxyMcpServer ─────────────────────────────────────────────────────────────

export class ProxyMcpServer {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number | string, PendingEntry>();
  private buffer = "";
  private stderrBuf = "";
  private dead = false;
  private readonly hintInjector: HintInjector | null;

  constructor(
    private readonly serverCommand: string,
    private readonly serverArgs: string[],
    private readonly env: Record<string, string>,
    private readonly options: ProxyOptions,
  ) {
    this.hintInjector = options.hintConfig
      ? new HintInjector(options.hintConfig, options.verbose)
      : null;
  }

  /**
   * Start the underlying MCP server subprocess.
   */
  async start(): Promise<void> {
    this.proc = spawn(this.serverCommand, this.serverArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
      windowsHide: true,
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      this.stderrBuf += chunk.toString("utf-8");
    });

    this.proc.on("exit", (code, signal) => {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      const err = new Error(`Server process exited (${detail})`);
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

  /**
   * Wait for the server to signal readiness (via stderr).
   */
  async waitForReady(timeoutMs = 15000): Promise<void> {
    const READY_SIGNALS = ["running on stdio", "Starting default (STDIO) server"];
    const isReady = () => READY_SIGNALS.some(s => this.stderrBuf.includes(s));

    if (isReady()) return;
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
        if (isReady()) {
          clearTimeout(timer);
          this.proc?.stderr?.removeListener("data", onData);
          resolve();
        }
      };

      this.proc?.stderr?.on("data", onData);
      this.proc?.on("exit", () => {
        clearTimeout(timer);
        reject(new Error("Server process exited while waiting for ready signal"));
      });
    });
  }

  /**
   * Initialize the MCP connection (protocol handshake).
   */
  async initialize(timeoutMs = 10000, clientName = "talking-cli-proxy"): Promise<JsonRpcMsg> {
    const res = await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: clientName, version: "1.0.0" },
      },
      timeoutMs,
    );
    if (res.error) throw new Error(`MCP init failed: ${res.error.message}`);
    this.notify("notifications/initialized");
    return res;
  }

  /**
   * List available tools from the server.
   */
  async listTools(timeoutMs = 10000): Promise<McpTool[]> {
    const res = await this.request("tools/list", {}, timeoutMs);
    if (res.error) throw new Error(`tools/list failed: ${res.error.message}`);
    return (res.result as { tools: McpTool[] }).tools ?? [];
  }

  /**
   * Call a tool on the server. Response may have hints injected
   * if hintConfig was provided and the response matches an error/empty pattern.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
    timeoutMs = 30000,
  ): Promise<ToolResult> {
    const res = await this.request("tools/call", { name, arguments: args }, timeoutMs, name);

    if (res.error) {
      const rawResult: ToolResult = {
        isError: true,
        content: [{ type: "text", text: `Error: ${res.error.message}` }],
      };
      // Apply hint injection even to error responses
      if (this.hintInjector) {
        return this.hintInjector.inject(rawResult, name);
      }
      return rawResult;
    }

    const result = res.result as { content?: ToolResult["content"]; isError?: boolean };
    const toolResult: ToolResult = {
      content: result?.content ?? [{ type: "text", text: "" }],
      isError: result?.isError ?? false,
    };

    // Apply hint injection to the tool result
    if (this.hintInjector) {
      return this.hintInjector.inject(toolResult, name);
    }

    return toolResult;
  }

  /**
   * Clean shutdown: SIGTERM → 2s grace → SIGKILL.
   */
  async close(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    this.dead = true;
    for (const [, entry] of this.pending) entry.reject(new Error("Server closed"));
    this.pending.clear();
    if (proc && !proc.killed) {
      proc.removeAllListeners();
      proc.stdout?.removeAllListeners();
      proc.stderr?.removeAllListeners();
      proc.stdin?.destroy();
      proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 2000);
        proc.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
  }

  /** Return captured stderr (last 50KB) for diagnostics. */
  getStderr(): string {
    const MAX = 50 * 1024;
    if (this.stderrBuf.length <= MAX) return this.stderrBuf;
    return this.stderrBuf.slice(-MAX);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private request(
    method: string,
    params: unknown,
    timeoutMs = 10000,
    toolName?: string,
  ): Promise<JsonRpcMsg> {
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
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        method: toolName,
      });
      const payload = { jsonrpc: "2.0", id, method, params };
      this.proc?.stdin?.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private notify(method: string): void {
    this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
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
