import type { BenchmarkTask, TaskSignals } from "./types.js";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_SOURCES = new Set(["field", "synth-error", "expert"]);
const VALID_HINT_TRIGGERS = new Set([
  "empty", "error", "ambiguous", "none",
  // Legacy values (deprecated but still accepted)
  "permission", "schema",
]);
const VALID_SERVERS = new Set(["filesystem", "memory", "fetch"]);

/**
 * Runtime type guard for BenchmarkTask — no Zod, no schema library.
 * Validates required fields and optional Round 4 fields when present.
 */
export function validateTask(task: unknown): task is BenchmarkTask {
  if (typeof task !== "object" || task === null) return false;
  const t = task as Record<string, unknown>;

  // Required fields
  if (typeof t.id !== "string" || t.id.length === 0) return false;
  if (typeof t.prompt !== "string" || t.prompt.length === 0) return false;
  if (typeof t.checker !== "string" || t.checker.length === 0) return false;
  if (typeof t.difficulty !== "string" || !VALID_DIFFICULTIES.has(t.difficulty)) {
    return false;
  }

  // Optional: source
  if (t.source !== undefined) {
    if (typeof t.source !== "string" || !VALID_SOURCES.has(t.source)) return false;
    // source="field" requires source_url
    if (t.source === "field") {
      if (typeof t.source_url !== "string" || (t.source_url as string).length === 0) {
        return false;
      }
    }
  }

  // Optional: source_url (just check it's a non-empty string when present without source)
  if (t.source_url !== undefined && t.source !== undefined && t.source !== "field") {
    // source_url is allowed for non-field sources but must be string if present
    if (typeof t.source_url !== "string") return false;
  }

  // Optional: hint_trigger
  if (t.hint_trigger !== undefined) {
    if (typeof t.hint_trigger !== "string" || !VALID_HINT_TRIGGERS.has(t.hint_trigger)) {
      return false;
    }
  }

  // Optional: server
  if (t.server !== undefined) {
    if (typeof t.server !== "string" || !VALID_SERVERS.has(t.server)) return false;
  }

  // Optional: signals
  if (t.signals !== undefined) {
    if (!isValidSignals(t.signals)) return false;
  }

  // Optional: rationale, adaptation_notes — just check they're strings if present
  if (t.rationale !== undefined && typeof t.rationale !== "string") return false;
  if (t.adaptation_notes !== undefined && typeof t.adaptation_notes !== "string") return false;

  return true;
}

function isValidSignals(signals: unknown): signals is TaskSignals {
  if (typeof signals !== "object" || signals === null) return false;
  const s = signals as Record<string, unknown>;

  // expectedTools: non-empty string array
  if (!Array.isArray(s.expectedTools)) return false;
  if (s.expectedTools.length === 0) return false;
  if (s.expectedTools.some((t: unknown) => typeof t !== "string")) return false;

  // expectedParams: optional Record<string, string>
  if (s.expectedParams !== undefined) {
    if (typeof s.expectedParams !== "object" || s.expectedParams === null) return false;
    for (const val of Object.values(s.expectedParams)) {
      if (typeof val !== "string") return false;
    }
  }

  // taskCriteria: non-empty string array
  if (!Array.isArray(s.taskCriteria)) return false;
  if (s.taskCriteria.length === 0) return false;
  if (s.taskCriteria.some((c: unknown) => typeof c !== "string")) return false;

  return true;
}

/**
 * Assert-style validator — throws a descriptive error on invalid input.
 */
export function assertValidTask(task: unknown): BenchmarkTask {
  if (!validateTask(task)) {
    const hints: string[] = [];
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task: expected an object");
    }
    const t = task as Record<string, unknown>;
    if (typeof t.id !== "string" || t.id.length === 0) hints.push("id must be a non-empty string");
    if (typeof t.prompt !== "string" || t.prompt.length === 0) {
      hints.push("prompt must be a non-empty string");
    }
    if (typeof t.checker !== "string" || t.checker.length === 0) {
      hints.push("checker must be a non-empty string");
    }
    if (typeof t.difficulty !== "string" || !VALID_DIFFICULTIES.has(t.difficulty)) {
      hints.push(`difficulty must be one of: ${[...VALID_DIFFICULTIES].join(", ")}`);
    }
    if (t.source !== undefined && typeof t.source === "string" && t.source === "field") {
      if (typeof t.source_url !== "string" || (t.source_url as string).length === 0) {
        hints.push("source_url is required when source is 'field'");
      }
    }
    if (t.source !== undefined && (typeof t.source !== "string" || !VALID_SOURCES.has(t.source))) {
      hints.push(`source must be one of: ${[...VALID_SOURCES].join(", ")}`);
    }
    if (t.hint_trigger !== undefined && (typeof t.hint_trigger !== "string" || !VALID_HINT_TRIGGERS.has(t.hint_trigger))) {
      hints.push(`hint_trigger must be one of: ${[...VALID_HINT_TRIGGERS].join(", ")}`);
    }
    if (t.server !== undefined && (typeof t.server !== "string" || !VALID_SERVERS.has(t.server))) {
      hints.push(`server must be one of: ${[...VALID_SERVERS].join(", ")}`);
    }
    if (t.signals !== undefined) {
      const s = t.signals as Record<string, unknown>;
      if (Array.isArray(s.expectedTools) && s.expectedTools.length === 0) {
        hints.push("signals.expectedTools must be a non-empty array");
      }
      if (Array.isArray(s.taskCriteria) && s.taskCriteria.length === 0) {
        hints.push("signals.taskCriteria must be a non-empty array");
      }
    }
    throw new Error(`Invalid task: ${hints.join("; ")}`);
  }
  return task;
}
