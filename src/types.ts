/**
 * Domain types shared across all modules.
 * Changing these is expensive — get them right.
 */

export interface HeuristicResult {
  verdict: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_APPLICABLE';
  score: number; // 0–100
  raw: unknown; // rule-specific details for renderers
}

export interface EngineOutput {
  skillDir: string;
  skillLineCount: number;
  h1: HeuristicResult;
  h2: HeuristicResult;
  totalScore: number; // P1: simple average of h1.score and h2.score
}

export interface Fixture {
  tool: string;
  scenario: string;
  description?: string;
  command: string[];
  env?: Record<string, string>;
  timeout_ms?: number;
  assert: {
    output_has_field: string;
  };
}

export interface DiscoveredTool {
  name: string;
  ext: string;
  path: string;
}

export interface DiscoveredFixture {
  name: string;
  tool: string;
  scenario: string;
  path: string;
  fixture: Fixture; // full parsed fixture content
}

export interface DiscoveryResult {
  skillMdPath: string;
  tools: DiscoveredTool[];
  fixtures: DiscoveredFixture[];
}

// Runtime validation helpers (no external schema library for P1 simplicity)

export function isValidFixture(obj: unknown): obj is Fixture {
  if (typeof obj !== 'object' || obj === null) return false;
  const f = obj as Record<string, unknown>;
  if (typeof f.tool !== 'string') return false;
  if (typeof f.scenario !== 'string') return false;
  if (!Array.isArray(f.command) || f.command.some((c) => typeof c !== 'string')) {
    return false;
  }
  if (typeof f.assert !== 'object' || f.assert === null) return false;
  const assert = f.assert as Record<string, unknown>;
  if (typeof assert.output_has_field !== 'string') return false;
  return true;
}

export function assertFixture(obj: unknown): Fixture {
  if (!isValidFixture(obj)) {
    throw new Error(
      'Invalid fixture: missing required fields (tool, scenario, command, assert.output_has_field)',
    );
  }
  return obj;
}
