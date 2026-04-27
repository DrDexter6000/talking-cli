import type { HeuristicResult } from '../types.js';

/**
 * MCP-specific types for audit-mcp heuristics (M1–M4).
 * Kept separate from core types.ts to avoid leaking MCP concepts into the main engine.
 */

export interface McpToolDefinition {
  name: string;
  description: string;
  annotations?: {
    readOnlyHint?: boolean;
    idempotentHint?: boolean;
    destructiveHint?: boolean;
  };
}

export interface McpEngineOutput {
  serverDir: string;
  m1: HeuristicResult;
  m2: HeuristicResult;
  m3?: HeuristicResult;
  m4?: HeuristicResult;
  totalScore: number;
  rulesetVersion: string;
}
