import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StdioMcpTransport } from './stdio-transport.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createTransport(): StdioMcpTransport {
  return new StdioMcpTransport({
    command: 'node',
    args: [resolve(__dirname, '__fixtures__/mock-server.cjs')],
    timeoutMs: 5000,
    initializeTimeoutMs: 5000,
  });
}

describe('StdioMcpTransport', () => {
  it('initializes and discovers tools', async () => {
    const transport = createTransport();
    try {
      await transport.initialize();
      const tools = await transport.listTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('search');
      expect(tools[1].name).toBe('delete');
    } finally {
      await transport.close();
    }
  });

  it('calls a tool successfully', async () => {
    const transport = createTransport();
    try {
      await transport.initialize();
      const result = await transport.callTool('search', { query: 'hello' });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Found 3 results.');
    } finally {
      await transport.close();
    }
  });

  it('receives error response from tool', async () => {
    const transport = createTransport();
    try {
      await transport.initialize();
      const result = await transport.callTool('search', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing query parameter');
    } finally {
      await transport.close();
    }
  });

  it('handles empty-result query', async () => {
    const transport = createTransport();
    try {
      await transport.initialize();
      const result = await transport.callTool('search', { query: '__NONEXISTENT_7f3a9b__' });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No results found');
    } finally {
      await transport.close();
    }
  });

  it('handles unknown tool with protocol error', async () => {
    const transport = createTransport();
    try {
      await transport.initialize();
      const result = await transport.callTool('unknown_tool', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Protocol error');
    } finally {
      await transport.close();
    }
  });

  it('cleans up on close', async () => {
    const transport = createTransport();
    await transport.initialize();
    await transport.close();
    // Should not throw
  });
});
