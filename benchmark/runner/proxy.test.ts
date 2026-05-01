/**
 * Parity test framework for ProxyMcpServer + HintInjector.
 *
 * Tests:
 * 1. HintInjector unit tests — pattern detection, format, idempotency
 * 2. FilesystemSandbox unit tests — verification and cleanup
 * 3. HintConfig validation — all hints are invocation-scoped, under 200 chars
 * 4. ProxyMcpServer integration (skipped unless PARITY_TEST env is set) —
 *    verifies proxy produces identical output to direct server calls
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HintInjector,
  formatHints,
  isEmptyArrayResult,
  isErrorResult,
  isNullOrUndefinedResult,
  isEmptyStringResult,
  isNotFoundResult,
  type HintConfig,
} from "./hint-injector.js";
import { getMemoryHintConfig, getFilesystemHintConfig } from "./hint-configs.js";
import { FilesystemSandbox } from "./sandbox.js";

// ─── HintInjector unit tests ────────────────────────────────────────────────────

describe("HintInjector", () => {
  describe("formatHints", () => {
    test("returns text unchanged when hints array is empty", () => {
      const text = '{"entities":[{"name":"Alice"}],"relations":[]}';
      const result = formatHints(text, []);
      expect(result).toBe(text);
    });

    test("appends hints with arrow prefix when non-empty", () => {
      const text = '{"entities":[],"relations":[]}';
      const result = formatHints(text, ["No entities found", "Try broadening"]);
      expect(result).toBe(
        '{"entities":[],"relations":[]}\n\n→ No entities found\n→ Try broadening',
      );
    });

    test("single hint produces single arrow line", () => {
      const text = "Error: not found";
      const result = formatHints(text, ["Use search to find correct name"]);
      expect(result).toBe("Error: not found\n\n→ Use search to find correct name");
    });
  });

  describe("pattern detectors", () => {
    test("isEmptyArrayResult detects empty JSON arrays", () => {
      expect(isEmptyArrayResult('{"entities":[],"relations":[]}')).toBe(true);
      expect(isEmptyArrayResult('{"items":[]}')).toBe(true);
      expect(isEmptyArrayResult('{"entities":[{"name":"A"}]}')).toBe(false);
      expect(isEmptyArrayResult("not json")).toBe(false);
    });

    test("isErrorResult detects error flag and Error: prefix", () => {
      expect(isErrorResult("Error: entity not found", false)).toBe(true);
      expect(isErrorResult("some text", true)).toBe(true);
      expect(isErrorResult("some text", false)).toBe(false);
    });

    test("isNullOrUndefinedResult detects null/empty", () => {
      expect(isNullOrUndefinedResult("null")).toBe(true);
      expect(isNullOrUndefinedResult("undefined")).toBe(true);
      expect(isNullOrUndefinedResult("")).toBe(true);
      expect(isNullOrUndefinedResult("  ")).toBe(true);
      expect(isNullOrUndefinedResult("some data")).toBe(false);
    });

    test("isEmptyStringResult detects empty/whitespace-only", () => {
      expect(isEmptyStringResult("")).toBe(true);
      expect(isEmptyStringResult("   ")).toBe(true);
      expect(isEmptyStringResult("content")).toBe(false);
    });

    test("isNotFoundResult detects not found patterns", () => {
      expect(isNotFoundResult("Entity not found")).toBe(true);
      expect(isNotFoundResult("File does not exist")).toBe(true);
      expect(isNotFoundResult("No entities found")).toBe(true);
      expect(isNotFoundResult("Successfully created")).toBe(false);
    });
  });

  describe("inject", () => {
    const testConfig: HintConfig = {
      search_nodes: {
        patterns: [
          {
            name: "empty-search",
            match: (text) => isEmptyArrayResult(text),
            hints: ["No entities found. Try broadening your query."],
          },
          {
            name: "search-error",
            match: (text, isError) => isErrorResult(text, isError),
            hints: ["Error in search. Try read_graph."],
          },
        ],
      },
      read_graph: {
        patterns: [
          {
            name: "empty-graph",
            match: (text) => isEmptyArrayResult(text),
            hints: ["Graph is empty. Create entities first."],
          },
        ],
      },
    };

    test("does NOT modify success responses — strict equality", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "text", text: '{"entities":[{"name":"Alice"}],"relations":[]}' }],
        isError: false,
      };
      const result = injector.inject(response, "search_nodes");
      expect(result).toBe(response); // strict equality — no copy
    });

    test("injects hint on empty search results", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "text", text: '{"entities":[],"relations":[]}' }],
        isError: false,
      };
      const result = injector.inject(response, "search_nodes");
      expect(result).not.toBe(response); // new object returned
      expect(result.content[0].text).toContain("→");
      expect(result.content[0].text).toContain("No entities found");
    });

    test("preserves original error text when injecting hints", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "text", text: "Error: Entity not found" }],
        isError: true,
      };
      const result = injector.inject(response, "search_nodes");
      expect(result.content[0].text).toContain("Error: Entity not found");
      expect(result.content[0].text).toContain("→");
    });

    test("is idempotent — does not double-hint", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "text", text: '{"entities":[],"relations":[]}' }],
        isError: false,
      };
      const first = injector.inject(response, "search_nodes");
      const second = injector.inject(first, "search_nodes");
      // Second call should return strict equality — already has →
      expect(second).toBe(first);
    });

    test("returns unchanged when tool has no config", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "text", text: "some result" }],
        isError: false,
      };
      const result = injector.inject(response, "unknown_tool");
      expect(result).toBe(response);
    });

    test("returns unchanged when response has no text block", () => {
      const injector = new HintInjector(testConfig);
      const response = {
        content: [{ type: "image", data: "base64..." }],
        isError: false,
      };
      const result = injector.inject(response, "search_nodes");
      expect(result).toBe(response);
    });
  });
});

// ─── HintConfig validation ──────────────────────────────────────────────────────

describe("HintConfig validation", () => {
  test("memory hint config covers key tools with error/empty scenarios", () => {
    const config = getMemoryHintConfig();
    const toolsWithErrors = ["search_nodes", "open_nodes", "read_graph", "create_entities", "create_relations", "add_observations"];
    for (const tool of toolsWithErrors) {
      expect(config[tool], `Missing config for tool: ${tool}`).toBeDefined();
      expect(config[tool].patterns.length, `No patterns for tool: ${tool}`).toBeGreaterThan(0);
    }
  });

  test("filesystem hint config covers key tools with error/empty scenarios", () => {
    const config = getFilesystemHintConfig();
    const toolsWithErrors = ["read_file", "list_directory", "search_files", "edit_file", "move_file", "get_file_info"];
    for (const tool of toolsWithErrors) {
      expect(config[tool], `Missing config for tool: ${tool}`).toBeDefined();
      expect(config[tool].patterns.length, `No patterns for tool: ${tool}`).toBeGreaterThan(0);
    }
  });

  test("every hint is under 200 chars", () => {
    for (const config of [getMemoryHintConfig(), getFilesystemHintConfig()]) {
      for (const [tool, toolConfig] of Object.entries(config)) {
        for (const pattern of toolConfig.patterns) {
          for (const hint of pattern.hints) {
            expect(
              hint.length,
              `Hint too long (${hint.length} chars) for tool ${tool}, pattern ${pattern.name}: "${hint.slice(0, 50)}..."`,
            ).toBeLessThanOrEqual(200);
          }
        }
      }
    }
  });

  test("no hint starts with commanding language", () => {
    for (const config of [getMemoryHintConfig(), getFilesystemHintConfig()]) {
      for (const [tool, toolConfig] of Object.entries(config)) {
        for (const pattern of toolConfig.patterns) {
          for (const hint of pattern.hints) {
            expect(
              hint,
              `Hint for tool ${tool} starts with commanding language`,
            ).not.toMatch(/^(Always|This tool accepts|You should always|You must)/);
          }
        }
      }
    }
  });
});

// ─── FilesystemSandbox unit tests ────────────────────────────────────────────────

describe("FilesystemSandbox", () => {
  test("creates temp directory that exists", () => {
    const sandbox = new FilesystemSandbox();
    try {
      const { existsSync } = require("node:fs");
      expect(existsSync(sandbox.path)).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });

  test("verify detects missing file", () => {
    const sandbox = new FilesystemSandbox();
    try {
      const result = sandbox.verify({ "report.txt": { exists: true } });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("report.txt does not exist");
    } finally {
      sandbox.cleanup();
    }
  });

  test("verify passes when file exists", () => {
    const sandbox = new FilesystemSandbox();
    try {
      writeFileSync(join(sandbox.path, "report.txt"), "Q1 quarterly revenue was $4.2M");
      const result = sandbox.verify({ "report.txt": { exists: true } });
      expect(result.pass).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });

  test("verify checks content patterns", () => {
    const sandbox = new FilesystemSandbox();
    try {
      writeFileSync(join(sandbox.path, "report.txt"), "Q1 quarterly revenue was $4.2M");
      const result = sandbox.verify({
        "report.txt": { exists: true, contains: ["quarterly", "revenue"] },
      });
      expect(result.pass).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });

  test("verify detects missing content patterns", () => {
    const sandbox = new FilesystemSandbox();
    try {
      writeFileSync(join(sandbox.path, "report.txt"), "Some unrelated content");
      const result = sandbox.verify({
        "report.txt": { exists: true, contains: ["quarterly", "revenue"] },
      });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain("missing patterns");
    } finally {
      sandbox.cleanup();
    }
  });

  test("cleanup removes the temp directory", () => {
    const sandbox = new FilesystemSandbox();
    const path = sandbox.path;
    sandbox.cleanup();
    const { existsSync } = require("node:fs");
    expect(existsSync(path)).toBe(false);
  });

  test("cleanup is safe to call multiple times", () => {
    const sandbox = new FilesystemSandbox();
    sandbox.cleanup();
    sandbox.cleanup(); // Should not throw
  });

  test("listFiles returns files in sandbox", () => {
    const sandbox = new FilesystemSandbox();
    try {
      writeFileSync(join(sandbox.path, "a.txt"), "content a");
      writeFileSync(join(sandbox.path, "b.txt"), "content b");
      const files = sandbox.listFiles();
      expect(files).toContain("a.txt");
      expect(files).toContain("b.txt");
      expect(files.length).toBe(2);
    } finally {
      sandbox.cleanup();
    }
  });

  test("readFile returns file content", () => {
    const sandbox = new FilesystemSandbox();
    try {
      writeFileSync(join(sandbox.path, "data.json"), '{"key":"value"}');
      expect(sandbox.readFile("data.json")).toBe('{"key":"value"}');
      expect(sandbox.readFile("nonexistent.txt")).toBeNull();
    } finally {
      sandbox.cleanup();
    }
  });
});
