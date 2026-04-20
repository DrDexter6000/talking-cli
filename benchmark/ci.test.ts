import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CI_PATH = resolve(__dirname, "..", ".github", "workflows", "benchmark.yml");
const PACKAGE_JSON_PATH = resolve(__dirname, "..", "package.json");

describe("Phase 1 Task 1.7 · CI smoke tier", () => {
  it("benchmark.yml workflow file exists", () => {
    expect(() => readFileSync(CI_PATH, "utf-8")).not.toThrow();
  });

  it("smoke job references benchmark:smoke script", () => {
    const wf = readFileSync(CI_PATH, "utf-8");
    expect(wf).toContain("benchmark:smoke");
  });

  it("full run is gated behind workflow_dispatch", () => {
    const wf = readFileSync(CI_PATH, "utf-8");
    expect(wf).toContain("workflow_dispatch");
  });

  it("ANTHROPIC_API_KEY passed as secret, not hardcoded", () => {
    const wf = readFileSync(CI_PATH, "utf-8");
    expect(wf).toContain("${{ secrets.ANTHROPIC_API_KEY }}");
    expect(wf).not.toContain("sk-ant-");
  });

  it("package scripts wire the smoke benchmark to a real entrypoint", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.["benchmark:build"]).toContain("tsc -p benchmark/tsconfig.json");
    expect(pkg.scripts?.["benchmark:smoke"]).toContain("benchmark/dist/cli.js");
    expect(pkg.scripts?.["benchmark:smoke"]).not.toContain("echo");
    expect(pkg.scripts?.benchmark).toContain("benchmark/dist/cli.js");
  });
});
