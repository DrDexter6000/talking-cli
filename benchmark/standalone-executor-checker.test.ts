import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  StandaloneExecutor,
  type StandaloneConversationMessage,
  type StandaloneLLMProvider,
} from "./runner/standalone-executor.js";
import type { BenchmarkTask } from "./runner/types.js";

const TEMP_ROOT = resolve(tmpdir(), "talking-cli-standalone-checker-tests");

function makeProvider(finalText: string): StandaloneLLMProvider {
  return {
    async call(_messages: StandaloneConversationMessage[]) {
      return {
        content: [{ type: "text", text: finalText }],
        stop_reason: "end_turn",
        usage: { input_tokens: 7, output_tokens: 3 },
      };
    },
  };
}

describe("standalone executor checker integration", () => {
  afterEach(() => {
    try {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it("uses the task checker verdict instead of hardcoding pass=true", async () => {
    const outputDir = resolve(TEMP_ROOT, "failing-checker");
    mkdirSync(outputDir, { recursive: true });

    const task: BenchmarkTask = {
      id: "task-checker-fail",
      prompt: "Read a file and return its contents.",
      checker: "checkReadSpecificFile",
      difficulty: "easy",
    };

    const executor = new StandaloneExecutor(makeProvider("short"));
    const result = await executor.runTask(task, "mute", {
      outputDir,
      disableMcp: true,
    });

    expect(result.pass).toBe(false);
    expect(result.outcome).toBe("stop_reason_end_turn");
  });
});
