import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  StandaloneExecutor,
  type StandaloneConversationMessage,
  type StandaloneLLMProvider,
} from "./runner/standalone-executor.js";
import type { BenchmarkTask } from "./runner/types.js";

const RESULTS_DIR = resolve(__dirname, "results");

function makeResponse(
  content: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }>,
  stopReason: string,
  inputTok = 100,
  outputTok = 50,
) {
  return { content, stop_reason: stopReason, usage: { input_tokens: inputTok, output_tokens: outputTok } };
}

// Stub LLM provider — deterministic record playback
function stubLLM(): StandaloneLLMProvider {
  return {
    async call(_message: StandaloneConversationMessage[], _turnId: number) {
      return makeResponse([], "end_turn");
    },
  };
}

// Stub that always returns more tool_use (for cap test)
function infiniteStubLLM(): StandaloneLLMProvider {
  return {
    async call(_message: StandaloneConversationMessage[], _turnId: number) {
      return makeResponse(
        [{ type: "tool_use", id: `tool-${_turnId}`, name: "search_files", input: { path: "/", pattern: "*" } }],
        "tool_use"
      );
    },
  };
}

describe("Phase 1 Task 1.3 · Standalone executor (deterministic capture)", () => {
  afterEach(() => {
    // Clean up fixture
    const rawFile = resolve(RESULTS_DIR, "fixture", "raw.jsonl");
    const rawDir = resolve(RESULTS_DIR, "fixture");
    if (existsSync(rawFile)) rmSync(rawFile, { force: true });
    if (existsSync(rawDir) && rmSync) {
      try { rmSync(rawDir, { recursive: true }); } catch {
        /* Windows may lock deleted files */
      }
    }
  });

  it("runTask returns the expected record shape with a stub LLM", async () => {
    const fixtureDir = resolve(RESULTS_DIR, "fixture");
    mkdirSync(fixtureDir, { recursive: true });

    const stubTask: BenchmarkTask = {
      id: "test-stub",
      prompt: "Hello, world",
      checker: "checkSearchResults",
      difficulty: "easy",
    };

    const executor = new StandaloneExecutor(stubLLM());
    const result = await executor.runTask(stubTask, "mute", {
      maxTurns: 20, temperature: 0, outputDir: fixtureDir,
      mcpInitTimeout: 1000,
    });

    expect(result).toHaveProperty("turns");
    expect(result).toHaveProperty("inputTokens");
    expect(result).toHaveProperty("outputTokens");
    expect(result).toHaveProperty("pass");
    expect(result).toHaveProperty("walltime");
    expect(result).toHaveProperty("outcome");
    expect(typeof result.turns).toBe("number");
    expect(typeof result.inputTokens).toBe("number");
    expect(typeof result.outputTokens).toBe("number");
    expect(result.outcome).toBe("stop_reason_end_turn");
  });

  it("re-running the same stub task produces consistent raw.jsonl (modulo timestamp)", async () => {
    const run1Dir = resolve(RESULTS_DIR, "fixture-run1");
    const run2Dir = resolve(RESULTS_DIR, "fixture-run2");
    // Clean before test, not just after
    try { rmSync(run1Dir, { recursive: true, force: true }); } catch {}
    try { rmSync(run2Dir, { recursive: true, force: true }); } catch {}
    mkdirSync(run1Dir, { recursive: true });
    mkdirSync(run2Dir, { recursive: true });

    const stubTask: BenchmarkTask = {
      id: "test-stub-determinism",
      prompt: "Hello, world",
      checker: "checkSearchResults",
      difficulty: "easy",
    };

    const executor = new StandaloneExecutor(stubLLM());
    await executor.runTask(stubTask, "mute", { maxTurns: 20, temperature: 0, outputDir: run1Dir, mcpInitTimeout: 1000 });
    await executor.runTask(stubTask, "mute", { maxTurns: 20, temperature: 0, outputDir: run2Dir, mcpInitTimeout: 1000 });

    const raw1 = readFileSync(resolve(run1Dir, "raw.jsonl"), "utf-8");
    const raw2 = readFileSync(resolve(run2Dir, "raw.jsonl"), "utf-8");

    // Normalize timestamps for comparison
    const norm1 = raw1.replace(/"timestamp":"[^"]*"/g, '"timestamp":"NORMALIZED"');
    const norm2 = raw2.replace(/"timestamp":"[^"]*"/g, '"timestamp":"NORMALIZED"');

    expect(norm1).toBe(norm2);

    // Clean up
    try { rmSync(run1Dir, { recursive: true, force: true }); } catch { /* Windows lock */ }
    try { rmSync(run2Dir, { recursive: true, force: true }); } catch { /* Windows lock */ }
  }, 30000);

  it("returns timeout outcome when maxTurns is exceeded", async () => {
    const capDir = resolve(RESULTS_DIR, "fixture-cap");
    mkdirSync(capDir, { recursive: true });

    const neverEndingTask: BenchmarkTask = {
      id: "test-cap",
      prompt: "Keep going",
      checker: "checkSearchResults",
      difficulty: "easy",
    };

    const executor = new StandaloneExecutor(infiniteStubLLM());
    const result = await executor.runTask(neverEndingTask, "mute", {
      maxTurns: 3,
      temperature: 0,
      outputDir: capDir,
      mcpInitTimeout: 1000,
    });

    expect(result.outcome).toBe("timeout");

    try { rmSync(capDir, { recursive: true }); } catch { /* Windows lock */ }
  });
});
