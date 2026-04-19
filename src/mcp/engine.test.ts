import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMcpEngine } from './engine.js';

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
