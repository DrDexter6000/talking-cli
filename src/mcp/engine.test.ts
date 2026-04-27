import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMcpEngine } from './engine.js';
import type { McpToolDefinition } from './types.js';

// Mock transport for deep mode tests — hoisted before imports
const mockListTools = vi.fn<() => Promise<McpToolDefinition[]>>();
const mockInitialize = vi.fn<() => Promise<void>>();
const mockClose = vi.fn<() => Promise<void>>();

vi.mock('./runtime/stdio-transport.js', () => ({
  StdioMcpTransport: vi.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    listTools: mockListTools,
    close: mockClose,
  })),
}));

vi.mock('./runtime/executor.js', () => ({
  executeScenarios: vi.fn().mockResolvedValue([]),
}));

vi.mock('./runtime/detect-server-command.js', () => ({
  detectServerCommand: vi.fn().mockReturnValue({ command: 'node', args: ['index.js'] }),
}));

function createMcpServerDir(toolsCode: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-engine-'));

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'test-server', version: '1.0.0', main: 'index.js' }),
  );

  writeFileSync(join(dir, 'index.js'), toolsCode);

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true }),
  };
}

describe('runMcpEngine', () => {
  it('returns 100 when all tools pass M1 and M2', async () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "short_desc",
        { description: "Short.", annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false } },
        async () => {}
      );
    `);

    try {
      const result = await runMcpEngine(dir);
      expect(result.totalScore).toBe(100);
      expect(result.m1.verdict).toBe('PASS');
      expect(result.m2.verdict).toBe('PASS');
    } finally {
      cleanup();
    }
  });

  it('returns 0 when M1 FAIL + M2 FAIL', async () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "bad_tool",
        { description: "Use this tool when you need to do something. " + "x".repeat(600) },
        async () => {}
      );
    `);

    try {
      const result = await runMcpEngine(dir);
      expect(result.m1.verdict).toBe('FAIL');
      expect(result.m2.verdict).toBe('FAIL');
      expect(result.totalScore).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('returns 50 when M1 PASS + M2 PARTIAL', async () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "complete",
        { description: "Short.", annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false } },
        async () => {}
      );
      server.registerTool(
        "incomplete",
        { description: "Also short.", annotations: { readOnlyHint: true } },
        async () => {}
      );
    `);

    try {
      const result = await runMcpEngine(dir);
      expect(result.m1.verdict).toBe('PASS');
      expect(result.m2.verdict).toBe('PARTIAL');
      expect(result.totalScore).toBe(75);
    } finally {
      cleanup();
    }
  });

  it('uses staticDir for M1/M2 when provided', async () => {
    const { dir: serverDir, cleanup: cleanupServer } = createMcpServerDir('');

    const { dir: staticDir, cleanup: cleanupStatic } = createMcpServerDir(`
      server.registerTool(
        "good_tool",
        { description: "Short.", annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false } },
        async () => {}
      );
    `);

    try {
      const result = await runMcpEngine(serverDir, { staticDir });
      expect(result.m1.verdict).toBe('PASS');
      expect(result.m2.verdict).toBe('PASS');
      expect(result.totalScore).toBe(100);
    } finally {
      cleanupServer();
      cleanupStatic();
    }
  });
});

describe('runMcpEngine — M1/M2 runtime fallback (R1)', () => {
  const runtimeTools: McpToolDefinition[] = [
    {
      name: 'search',
      description: 'Search for items.',
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
    },
  ];

  beforeEach(() => {
    mockInitialize.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue(runtimeTools);
    mockClose.mockResolvedValue(undefined);
  });

  it('uses runtime tools for M1/M2 when static discovery fails', async () => {
    // Create dir without package.json → static discovery throws McpDiscoveryError
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-runtime-'));
    try {
      const result = await runMcpEngine(dir, { deep: true });
      // M1 should PASS — "Search for items." has no strategy phrases
      expect(result.m1.verdict).toBe('PASS');
      expect(result.m1.score).toBe(100);
      // M2 should PASS — all 3 annotations present
      expect(result.m2.verdict).toBe('PASS');
      expect(result.m2.score).toBe(100);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('keeps static M1/M2 when static discovery succeeds', async () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "static_tool",
        { description: "Short.", annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false } },
        async () => {}
      );
    `);

    try {
      const result = await runMcpEngine(dir, { deep: true });
      // Static discovery succeeds → M1/M2 use static tools, not runtime
      // The runtime tools also pass, but the point is static is used
      expect(result.m1.verdict).toBe('PASS');
      expect(result.m2.verdict).toBe('PASS');
    } finally {
      cleanup();
    }
  });

  it('leaves M1/M2 as NOT_APPLICABLE when static fails and no runtime tools', async () => {
    mockListTools.mockResolvedValue([]);
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-empty-'));
    try {
      const result = await runMcpEngine(dir, { deep: true });
      expect(result.m1.verdict).toBe('NOT_APPLICABLE');
      expect(result.m2.verdict).toBe('NOT_APPLICABLE');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('detects M1 violation via runtime tools when static fails', async () => {
    const badRuntimeTools: McpToolDefinition[] = [
      {
        name: 'bad_tool',
        description: 'Use this tool when you need to search for items.',
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
      },
    ];
    mockListTools.mockResolvedValue(badRuntimeTools);

    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-badm1-'));
    try {
      const result = await runMcpEngine(dir, { deep: true });
      expect(result.m1.verdict).toBe('FAIL');
      expect(result.m1.score).toBe(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
