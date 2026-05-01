import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { main } from "./cli.js";

const TEMP_ROOT = resolve(tmpdir(), "talking-cli-benchmark-cli-tests");

describe("benchmark CLI", () => {
  afterEach(() => {
    try {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    } catch {
      // best-effort cleanup on Windows
    }
  });

  it("runs the stub provider and writes benchmark artifacts", async () => {
    const outputDir = resolve(TEMP_ROOT, "smoke-run");

    await main(["--provider", "stub", "--limit", "2", "--output-dir", outputDir]);

    expect(existsSync(resolve(outputDir, "summary.json"))).toBe(true);
    expect(existsSync(resolve(outputDir, "AUDIT-BENCHMARK.md"))).toBe(true);

    const summary = JSON.parse(readFileSync(resolve(outputDir, "summary.json"), "utf-8"));
    expect(summary.perTask).toHaveLength(2);
  }, 15000);

  it("rejects unknown providers with a clear error", async () => {
    await expect(main(["--provider", "unsupported"])).rejects.toThrow(
      /Unknown provider/i,
    );
  });
});
