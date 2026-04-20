import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./runner/providers.js";
import type { StandaloneLLMProvider } from "./runner/standalone-executor.js";

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
const ORIGINAL_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;

describe("anthropic provider handles extended-thinking responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_ANTHROPIC_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY;
    if (ORIGINAL_ANTHROPIC_BASE_URL === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = ORIGINAL_ANTHROPIC_BASE_URL;
    if (ORIGINAL_ANTHROPIC_MODEL === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = ORIGINAL_ANTHROPIC_MODEL;
  });

  it("filters out thinking blocks and returns only text and tool_use blocks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [
          { type: "thinking", thinking: "Let me reason about this..." },
          { type: "text", text: "Here is the answer." },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createProvider("anthropic") as StandaloneLLMProvider;
    const result = await provider.call([{ role: "user", content: "hello" }], 0);

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: "text", text: "Here is the answer." });
    expect(result.stop_reason).toBe("end_turn");
  });

  it("passes through max_tokens stop_reason without rewriting it", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "partial" }],
        stop_reason: "max_tokens",
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createProvider("anthropic") as StandaloneLLMProvider;
    const result = await provider.call([{ role: "user", content: "hello" }], 0);

    expect(result.stop_reason).toBe("max_tokens");
  });

  it("handles response with only thinking blocks (no actionable content)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [
          { type: "thinking", thinking: "Hmm..." },
        ],
        stop_reason: "max_tokens",
        usage: { input_tokens: 48, output_tokens: 16 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createProvider("anthropic") as StandaloneLLMProvider;
    const result = await provider.call([{ role: "user", content: "hello" }], 0);

    expect(result.content).toHaveLength(0);
    expect(result.stop_reason).toBe("max_tokens");
  });

  it("sends max_tokens 30720 in the request body", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    let capturedBody: Record<string, unknown> = {};
    const fetchMock = vi.fn(async (_url: string, request?: RequestInit) => {
      capturedBody = JSON.parse(String(request?.body ?? "{}")) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createProvider("anthropic") as StandaloneLLMProvider;
    await provider.call([{ role: "user", content: "test" }], 0);

    expect(capturedBody.max_tokens).toBe(30720);
    expect(capturedBody.temperature).toBe(1.0);
  });
});
