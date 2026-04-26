// ─── 2×2 Ablation Types ──────────────────────────────────────────────────────

/** The two orthogonal dimensions of the ablation */
export type SkillVariant = "full-skill" | "lean-skill";
export type ServerVariant = "mute" | "hinting";

/** A single cell in the 2×2 matrix */
export interface AblationCell {
  skill: SkillVariant;
  server: ServerVariant;
}

/** The 4 canonical cells, in fixed order */
export const ABLATION_CELLS: AblationCell[] = [
  { skill: "full-skill", server: "mute" },      // Cell 1: pure control
  { skill: "full-skill", server: "hinting" },    // Cell 2: server-only effect
  { skill: "lean-skill", server: "mute" },        // Cell 3: skill-only effect
  { skill: "lean-skill", server: "hinting" },     // Cell 4: full treatment
];

/** Serialize to flat string for JSONL storage */
export function cellToVariant(cell: AblationCell): string {
  return `${cell.skill}+${cell.server}`;
}

/** Parse flat string back to structured cell (returns null for legacy variants) */
export function variantToCell(variant: string): AblationCell | null {
  const parts = variant.split("+");
  if (parts.length === 2) {
    let [skill, server] = parts;
    // Support legacy variant strings for reading old result files
    if (skill === "bloated") skill = "full-skill";
    if (skill === "talking") skill = "lean-skill";
    if (server === "talking") server = "hinting";
    if ((skill === "full-skill" || skill === "lean-skill") &&
        (server === "mute" || server === "hinting")) {
      return { skill: skill as SkillVariant, server: server as ServerVariant };
    }
  }
  return null;
}

/** Check if a variant string is legacy (pre-ablation) */
export function isLegacyVariant(variant: string): boolean {
  return variant === "mute" || variant === "talking";
}

/** Named pairwise comparisons for the 2×2 ablation */
export const ABLATION_CONTRASTS = [
  { name: "full_vs_control",  label: "Full vs Control (Lean+Hints vs Full+Mute)",  treatment: "lean-skill+hinting", control: "full-skill+mute" },
  { name: "skill_effect",     label: "Skill Effect (Lean Skill vs Full Skill)",     treatment: "lean-skill+mute",    control: "full-skill+mute" },
  { name: "server_effect",    label: "Server Effect (Hints in Tools vs Mute Tools)", treatment: "full-skill+hinting", control: "full-skill+mute" },
  { name: "interaction",      label: "Skill + Server Interaction",                  treatment: "lean-skill+hinting", control: "lean-skill+mute" },
] as const;

// ─── Core Types ──────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;

export interface BenchmarkTask {
  id: string;
  prompt: string;
  checker: string;
  difficulty: string;
  category?: string;
  tier?: "easy" | "medium" | "hard";
  hint_trigger?: "empty" | "permission" | "schema" | "none";
}

export interface BenchmarkToolDefinition {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface BenchmarkRunResult {
  taskId: string;
  variant: string;
  provider?: string;
  schemaVersion?: number;
  taskHash?: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  walltime: number;
  outcome: "completed" | "timeout" | "error" | "stop_reason_end_turn";
  pass: boolean;
  // Extended metrics
  errorRecoveries?: number;        // Number of times agent recovered from error
  toolCalls?: number;              // Total tool calls made
  uniqueTools?: number;            // Number of unique tools used
  hintUtilization?: number;        // Percentage of hints that led to action
  timeToFirstTool?: number;        // Time until first tool call (ms)
  timeToSuccess?: number;          // Time until pass (ms), 0 if failed
  /** Rubric score for hard-tier tasks (0.0–1.0) */
  score?: number;
  /** Named sub-checks that passed */
  passedSubchecks?: string[];
  /** Captured MCP server stderr (last 50KB) */
  serverStderr?: string;
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
