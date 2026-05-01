import { describe, it, expect } from "vitest";
import { scoreToolCallCorrectness } from "./tool-call-signal.js";

/** Minimal type for conversation turns used in tests. */
interface TestTurn {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  tool_use?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
}

describe("A.2.2 · scoreToolCallCorrectness", () => {
  it("scores 1.0 for correct tool with correct params", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "/sandbox/report.txt", content: "quarterly data" },
            },
          },
        ],
      },
      { role: "tool", content: "Successfully wrote to /sandbox/report.txt" },
      { role: "assistant", content: "I've written the file." },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["write_file"],
      params: { path: "report" },
    });
    expect(result.score).toBe(1.0);
    expect(result.reason).toContain("write_file");
  });

  it("scores 0.0 when no tool calls present", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: "I have written the file report.txt with the quarterly data.",
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["write_file"],
    });
    expect(result.score).toBe(0.0);
    expect(result.reason).toContain("no tool calls");
  });

  it("scores 0.0 for wrong tool", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            function: {
              name: "read_file",
              arguments: { path: "/sandbox/report.txt" },
            },
          },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["write_file"],
    });
    expect(result.score).toBe(0.0);
    expect(result.reason).toContain("Wrong tool");
  });

  it("scores 0.5 for correct tool with partial params", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "/sandbox/other.txt", content: "data" },
            },
          },
        ],
      },
    ];
    // Expected param "report" but got "other"
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["write_file"],
      params: { path: "report" },
    });
    expect(result.score).toBe(0.5);
    expect(result.reason).toContain("partial");
  });

  it("handles Anthropic-format tool_use blocks", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_use: [
          {
            name: "search_nodes",
            input: { query: "test" },
          },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["search_nodes"],
    });
    expect(result.score).toBe(1.0);
  });

  it("handles multiple expected tools — scores 1.0 when all called", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "read_file", arguments: { path: "/a.txt" } } },
        ],
      },
      { role: "tool", content: "file content" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "write_file", arguments: { path: "/b.txt", content: "..." } } },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["read_file", "write_file"],
    });
    expect(result.score).toBe(1.0);
  });

  it("handles multiple expected tools — scores 0.5 when only half called", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "read_file", arguments: { path: "/a.txt" } } },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["read_file", "write_file"],
    });
    expect(result.score).toBe(0.5);
  });

  it("supports regex patterns for param matching", () => {
    const conversation: TestTurn[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "/sandbox/report-2024-Q1.txt", content: "data" },
            },
          },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["write_file"],
      params: { path: /report.*\.txt$/ },
    });
    expect(result.score).toBe(1.0);
  });

  it("handles empty conversation", () => {
    const result = scoreToolCallCorrectness([], {
      tools: ["write_file"],
    });
    expect(result.score).toBe(0.0);
  });

  it("ignores text-only assistant turns", () => {
    const conversation: TestTurn[] = [
      { role: "assistant", content: "Let me read that file for you." },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { function: { name: "read_file", arguments: { path: "/a.txt" } } },
        ],
      },
    ];
    const result = scoreToolCallCorrectness(conversation, {
      tools: ["read_file"],
    });
    expect(result.score).toBe(1.0);
  });
});
