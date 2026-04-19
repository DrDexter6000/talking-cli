import { type ChildProcess, execSync, spawn } from 'node:child_process';
import type { McpToolDefinition } from '../types.js';
import type { McpTransport, RuntimeConfig, ToolResult } from './types.js';

function resolveWindowsCommand(
  command: string,
  args: string[] | undefined,
): { command: string; args: string[] } {
  if (process.platform !== 'win32') return { command, args: args ?? [] };
  if (command.includes('\\') || command.includes('/') || /\.(exe|cmd|bat|com)$/i.test(command)) {
    return { command, args: args ?? [] };
  }

  try {
    const result = execSync(`where ${command}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const paths = result.trim().split('\r\n');
    for (const p of paths) {
      const trimmed = p.trim();
      if (/\.(cmd|bat)$/i.test(trimmed)) {
        return { command: 'cmd', args: ['/c', command, ...(args ?? [])] };
      }
    }
  } catch {
    // Fall through to original command
  }
  return { command, args: args ?? [] };
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class StdioMcpTransport implements McpTransport {
  private process: ChildProcess | null = null;
  private pending = new Map<number | string, (msg: JsonRpcMessage) => void>();
  private nextId = 1;
  private buffer = '';
  private closed = false;

  constructor(private config: RuntimeConfig) {}

  async initialize(): Promise<void> {
    const { command, args, env, cwd } = this.config;
    const resolved = resolveWindowsCommand(command, args);

    this.process = spawn(resolved.command, resolved.args, {
      env: { ...process.env, ...env },
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (chunk: Buffer) => this.onData(chunk));
    this.process.stderr?.on('data', () => {
      /* drain stderr to avoid deadlock */
    });
    this.process.on('error', (err) => {
      throw new Error(`MCP server spawn failed: ${err.message}`);
    });

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('MCP server failed to start within 5s')),
        5000,
      );
      this.process?.on('spawn', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Initialize handshake
    const initResponse = await this.request(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'talking-cli', version: '0.1.0' },
      },
      this.config.initializeTimeoutMs ?? 30000,
    );

    if (initResponse.error) {
      throw new Error(
        `Initialize failed: ${initResponse.error.message} (code ${initResponse.error.code})`,
      );
    }

    // Send initialized notification
    this.sendNotification('notifications/initialized');
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const response = await this.request('tools/list', {}, this.config.timeoutMs ?? 10000);
    if (response.error) {
      throw new Error(`tools/list failed: ${response.error.message}`);
    }
    const result = response.result as { tools: McpToolDefinition[] } | undefined;
    return result?.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const response = await this.request(
      'tools/call',
      { name, arguments: args },
      this.config.timeoutMs ?? 10000,
    );

    if (response.error) {
      // Protocol error — treat as tool error with error message
      return {
        content: [
          {
            type: 'text',
            text: `Protocol error ${response.error.code}: ${response.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const result = response.result as
      | { content: ToolResult['content']; isError?: boolean }
      | undefined;

    return {
      content: result?.content ?? [],
      isError: result?.isError ?? false,
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 2000);
        this.process?.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    this.process = null;
    this.pending.clear();
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf-8');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMessage;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const resolve = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (resolve) resolve(msg);
        }
      } catch {
        // Ignore non-JSON lines (logs, etc.)
      }
    }
  }

  private send(method: string, params: unknown, id: number | string): void {
    const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };
    this.process?.stdin?.write(`${JSON.stringify(msg)}\n`);
  }

  private sendNotification(method: string): void {
    const msg: JsonRpcMessage = { jsonrpc: '2.0', method };
    this.process?.stdin?.write(`${JSON.stringify(msg)}\n`);
  }

  private request(method: string, params: unknown, timeoutMs: number): Promise<JsonRpcMessage> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });

      this.send(method, params, id);
    });
  }
}
