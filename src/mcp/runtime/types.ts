import type { McpToolDefinition } from '../types.js';

export interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
}

export interface McpTransport {
  initialize(): Promise<void>;
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  close(): Promise<void>;
}

export interface TestScenario {
  toolName: string;
  args: Record<string, unknown>;
  expectedType: 'error' | 'empty';
  description: string;
}

export interface ScenarioResult {
  scenario: TestScenario;
  result: ToolResult;
  responseText: string;
}

export interface RuntimeConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
  initializeTimeoutMs?: number;
}
