import { describe, expect, it } from "vitest";
import { assertValidTask, validateTask } from "./validate-task.js";

describe("validateTask", () => {
  it("rejects task without required fields", () => {
    expect(validateTask({})).toBe(false);
    expect(validateTask({ id: "" })).toBe(false);
    expect(validateTask({ id: "x", prompt: "" })).toBe(false);
    expect(validateTask({ id: "x", prompt: "p", checker: "" })).toBe(false);
    expect(
      validateTask({ id: "x", prompt: "p", checker: "c", difficulty: "" }),
    ).toBe(false);
  });

  it("accepts well-formed Round 4 task", () => {
    const task = {
      id: "r4-001",
      prompt: "Transform the config file",
      checker: "checkConfigTransform",
      difficulty: "medium" as const,
      source: "field" as const,
      source_url: "https://github.com/example/issues/42",
      server: "filesystem" as const,
      signals: {
        expectedTools: ["read_file", "write_file"],
        expectedParams: { encoding: "utf-8" },
        taskCriteria: ["output file exists", "valid JSON"],
      },
      rationale: "Real user reported config migration failure",
      adaptation_notes: "Simplified from multi-file to single-file",
    };
    expect(validateTask(task)).toBe(true);
  });

  it("accepts legacy task without new fields", () => {
    const task = {
      id: "legacy-001",
      prompt: "Do the thing",
      checker: "checkBasic",
      difficulty: "easy" as const,
    };
    expect(validateTask(task)).toBe(true);
  });

  it("rejects task with invalid difficulty", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "extreme",
      }),
    ).toThrow(/difficulty/);
  });

  it("rejects field task without source_url", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "easy",
        source: "field",
      }),
    ).toThrow(/source_url/);
  });

  it("accepts synth-error task with source_url", () => {
    const task = {
      id: "synth-001",
      prompt: "Recover from error",
      checker: "checkRecovery",
      difficulty: "hard" as const,
      source: "synth-error" as const,
      source_url: "https://github.com/example/issues/99",
    };
    expect(validateTask(task)).toBe(true);
  });

  it("rejects invalid hint_trigger value", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "easy",
        hint_trigger: "unknown",
      }),
    ).toThrow(/hint_trigger/);
  });

  it("rejects invalid server value", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "easy",
        server: "unknown-server",
      }),
    ).toThrow(/server/);
  });

  it("rejects signals without expectedTools", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "easy",
        signals: {
          expectedTools: [],
          taskCriteria: ["valid"],
        },
      }),
    ).toThrow(/expectedTools/);
  });

  it("rejects signals without taskCriteria", () => {
    expect(
      () => assertValidTask({
        id: "x",
        prompt: "p",
        checker: "c",
        difficulty: "easy",
        signals: {
          expectedTools: ["read_file"],
          taskCriteria: [],
        },
      }),
    ).toThrow(/taskCriteria/);
  });
});
