import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { renderBenchmark } from "./runner/renderer.ts";

describe("Phase 1 Task 1.6 · AUDIT-BENCHMARK.md generator", () => {
  it("renders the same summary.json to identical markdown bytes", () => {
    const fixturePath = resolve(__dirname, "fixtures", "render-fixture.json");
    const out1 = renderBenchmark(fixturePath);
    const out2 = renderBenchmark(fixturePath);
    expect(out1).toBe(out2);
  });

  it("includes methodology and reproduction sections", () => {
    const fixturePath = resolve(__dirname, "fixtures", "render-fixture.json");
    const doc = renderBenchmark(fixturePath);
    expect(doc).toContain("Methodology");
    expect(doc).toContain("Reproduction");
    expect(doc).toContain("sign test");
    expect(doc).toContain("Wilcoxon");
  });

  it("renders per-task rows and aggregate section from summary.json", () => {
    const fixturePath = resolve(__dirname, "fixtures", "render-fixture.json");
    const doc = renderBenchmark(fixturePath);
    expect(doc).toContain("Per-Task Results");
    expect(doc).toContain("Aggregate Stats");
    expect(doc).toContain("task-a");
  });

  it("includes p-values alongside point estimates", () => {
    const fixturePath = resolve(__dirname, "fixtures", "render-fixture.json");
    const doc = renderBenchmark(fixturePath);
    expect(doc).toMatch(/p[- ]?value:\s*[\d.]+/i);
    expect(doc).toContain("Sign test");
  });

  it("renders a prominent disclaimer for stub benchmark summaries", () => {
    const fixturePath = resolve(__dirname, "fixtures", "render-fixture-stub.json");
    const doc = renderBenchmark(fixturePath);
    expect(doc).toContain("Stub data");
    expect(doc).toContain("not a live model-backed benchmark run");
  });
});
