import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TASKS_DIR = resolve(__dirname, "tasks");
const RUNNER_DIR = resolve(__dirname, "runner");

describe("Phase 1 Task 1.2 · Task-set schema + first 5 tasks", () => {
  it("discovers benchmark/tasks/*.json and asserts ≥ 20 files", () => {
    expect(existsSync(TASKS_DIR)).toBe(true);
    const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("category histogram is roughly balanced (≥8 error/empty, ≥3 neutral, remaining spread)", () => {
    const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    const categories: string[] = [];
    for (const file of files) {
      const raw = readFileSync(resolve(TASKS_DIR, file), "utf-8");
      const task = JSON.parse(raw);
      categories.push(task.category || "uncategorized");
    }
    const hist: Record<string, number> = {};
    for (const c of categories) hist[c] = (hist[c] || 0) + 1;
    const errorEmpty = (hist["error/empty"] || 0) + (hist["not-found"] || 0) + (hist["search"] || 0);
    const neutral = hist["neutral"] || 0;
    expect(errorEmpty).toBeGreaterThanOrEqual(8);
    expect(neutral).toBeGreaterThanOrEqual(3);
  });

  it("each task file has {id, prompt, checker, difficulty}", () => {
    const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = readFileSync(resolve(TASKS_DIR, file), "utf-8");
      const task = JSON.parse(raw);
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("prompt");
      expect(task).toHaveProperty("checker");
      expect(task).toHaveProperty("difficulty");
      expect(typeof task.id).toBe("string");
      expect(typeof task.prompt).toBe("string");
      expect(typeof task.checker).toBe("string");
      expect(["easy", "medium", "hard"]).toContain(task.difficulty);
    }
  });

  it("checker map resolves each task.checker to a function of arity ≥ 2", async () => {
    const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    const { checkers } = await import(resolve(RUNNER_DIR, "checker.ts"));

    for (const file of files) {
      const raw = readFileSync(resolve(TASKS_DIR, file), "utf-8");
      const task = JSON.parse(raw);
      const checkerName = task.checker as string;
      expect(checkers).toHaveProperty(checkerName);
      const checkerFn = checkers[checkerName];
      expect(typeof checkerFn).toBe("function");
      expect(checkerFn.length).toBeGreaterThanOrEqual(2);
    }
  });
});
