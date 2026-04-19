import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverMcpTools, McpDiscoveryError } from './discovery.js';

function createMcpServerDir(toolsCode: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-'));

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

describe('discoverMcpTools', () => {
  it('throws when package.json is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-'));
    expect(() => discoverMcpTools(dir)).toThrow(McpDiscoveryError);
    rmSync(dir, { recursive: true });
  });

  it('extracts single tool with simple description', () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "read_file",
        {
          title: "Read File",
          description: "Read a file from disk.",
          annotations: { readOnlyHint: true }
        },
        async (args) => {}
      );
    `);

    try {
      const tools = discoverMcpTools(dir);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('read_file');
      expect(tools[0].description).toBe('Read a file from disk.');
      expect(tools[0].annotations).toEqual({ readOnlyHint: true });
    } finally {
      cleanup();
    }
  });

  it('extracts concatenated description strings', () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "write_file",
        {
          title: "Write File",
          description: "Create a new file. " +
            "Use with caution as it will overwrite.",
          annotations: { readOnlyHint: false, destructiveHint: true }
        },
        async (args) => {}
      );
    `);

    try {
      const tools = discoverMcpTools(dir);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('write_file');
      expect(tools[0].description).toBe(
        'Create a new file. Use with caution as it will overwrite.',
      );
    } finally {
      cleanup();
    }
  });

  it('extracts multiple tools', () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.registerTool(
        "search",
        { description: "Search files.", annotations: { readOnlyHint: true } },
        async () => {}
      );

      server.registerTool(
        "delete",
        { description: "Delete a file.", annotations: { destructiveHint: true } },
        async () => {}
      );
    `);

    try {
      const tools = discoverMcpTools(dir);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['search', 'delete']);
    } finally {
      cleanup();
    }
  });

  it('handles server.tool() alias', () => {
    const { dir, cleanup } = createMcpServerDir(`
      server.tool(
        "list_dir",
        { description: "List directory contents.", annotations: { readOnlyHint: true } },
        async () => {}
      );
    `);

    try {
      const tools = discoverMcpTools(dir);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('list_dir');
    } finally {
      cleanup();
    }
  });

  it('returns empty array when no tool calls found', () => {
    const { dir, cleanup } = createMcpServerDir(`
      console.log("No tools here");
    `);

    try {
      const tools = discoverMcpTools(dir);
      expect(tools).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});
