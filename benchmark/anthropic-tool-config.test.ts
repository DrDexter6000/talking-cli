import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./runner/providers.js";
import type {
  StandaloneConversationMessage,
  StandaloneLLMProvider,
} from "./runner/standalone-executor.js";

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
const ORIGINAL_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;

describe("anthropic-compatible benchmark provider configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_ANTHROPIC_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY;
    if (ORIGINAL_ANTHROPIC_BASE_URL === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = ORIGINAL_ANTHROPIC_BASE_URL;
    if (ORIGINAL_ANTHROPIC_MODEL === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = ORIGINAL_ANTHROPIC_MODEL;
  });

  it("uses custom base URL, model, and tool definitions for anthropic-compatible requests", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_BASE_URL = "https://api.minimaxi.com/anthropic";
    process.env.ANTHROPIC_MODEL = "MiniMax-M2.7-highspeed";

    let capturedUrl = "";
    let capturedRequest: RequestInit | undefined;
    const fetchMock = vi.fn(async (url: string, request?: RequestInit) => {
      capturedUrl = url;
      capturedRequest = request;
      return {
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "done" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createProvider("anthropic") as StandaloneLLMProvider;
    await provider.call(
      [
        { role: "user", content: "system" },
        { role: "tool", toolUseId: "toolu_test123", name: "search_files", content: "[]", isError: false },
      ] as StandaloneConversationMessage[],
      0,
      [{ name: "search_files", description: "Search files", inputSchema: { type: "object" } }],
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe("https://api.minimaxi.com/anthropic/v1/messages");
    const body = JSON.parse(String(capturedRequest?.body ?? "")) as Record<string, unknown>;
    expect(body.model).toBe("MiniMax-M2.7-highspeed");
    expect(body.tools).toEqual([
      { name: "search_files", description: "Search files", input_schema: { type: "object" } },
    ]);
    expect(body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "system" }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_test123", content: "[]", is_error: false }] },
    ]);
    expect(body.temperature).toBe(1.0);
    expect(body.max_tokens).toBe(30720);
  });
});
