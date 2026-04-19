import { describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../types.js';
import { evaluateM2 } from './m2.js';

function makeTool(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: 'test-tool',
    description: 'A test tool.',
    ...overrides,
  };
}

describe('evaluateM2', () => {
  it('PASS when all tools have complete annotations', () => {
    const tools = [
      makeTool({
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
      }),
    ];
    const result = evaluateM2(tools);
    expect(result.verdict).toBe('PASS');
    expect(result.score).toBe(100);
  });

  it('FAIL when annotations are missing', () => {
    const tools = [makeTool({ annotations: { readOnlyHint: true } })];
    const result = evaluateM2(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('PARTIAL when some tools have annotations and some do not', () => {
    const tools = [
      makeTool({
        name: 'complete',
        annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
      }),
      makeTool({ name: 'incomplete', annotations: { readOnlyHint: true } }),
    ];
    const result = evaluateM2(tools);
    expect(result.verdict).toBe('PARTIAL');
    expect(result.score).toBe(50);
  });

  it('NOT_APPLICABLE when no tools discovered', () => {
    const result = evaluateM2([]);
    expect(result.verdict).toBe('NOT_APPLICABLE');
    expect(result.score).toBe(100);
  });

  it('distinguishes undefined vs explicitly false', () => {
    const tools = [
      makeTool({
        annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
      }),
    ];
    const result = evaluateM2(tools);
    expect(result.verdict).toBe('PASS');
  });
});
