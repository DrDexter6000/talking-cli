import { describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../types.js';
import { evaluateM1 } from './m1.js';

function makeTool(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: 'test-tool',
    description: 'A test tool.',
    ...overrides,
  };
}

describe('evaluateM1', () => {
  it('PASS when all descriptions are clean contracts', () => {
    const tools = [
      makeTool({ name: 'a', description: 'Read the contents of a file.' }),
      makeTool({ name: 'b', description: 'Write data to a file at the given path.' }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('PASS');
    expect(result.score).toBe(100);
  });

  it('PASS when description is long but purely contractual', () => {
    const longDesc =
      'Read the contents of a file from the local filesystem. ' +
      'The file_path parameter must be an absolute path. ' +
      'Returns the full text content of the file. ' +
      'If the file does not exist, an error is returned. ' +
      'Supported encodings are utf-8 and ascii. ' +
      'Binary files are not supported and will return an error.';
    const tools = [makeTool({ description: longDesc })];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('PASS');
    expect(result.score).toBe(100);
  });

  it('FAIL when description contains usage-timing guidance', () => {
    const tools = [makeTool({ description: 'Use this tool when you need to search files.' })];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('FAIL when description contains multi-step procedure', () => {
    const tools = [
      makeTool({ description: 'First, check permissions. Then call this tool to read the file.' }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('FAIL when description contains conditional guidance', () => {
    const tools = [
      makeTool({ description: 'If you need to update multiple files, use this tool repeatedly.' }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('FAIL when description contains best-practice advice', () => {
    const tools = [
      makeTool({
        description: 'Read a file. Best practice: always verify the path before reading.',
      }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('FAIL when description contains call-order guidance', () => {
    const tools = [
      makeTool({ description: 'Before calling this tool, ensure the directory exists.' }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
  });

  it('FAIL when any tool violates contract purity', () => {
    const tools = [
      makeTool({ name: 'good', description: 'Short contract description.' }),
      makeTool({ name: 'bad', description: 'You should call this after checking permissions.' }),
    ];
    const result = evaluateM1(tools);
    expect(result.verdict).toBe('FAIL');
  });

  it('reports per-tool matched patterns in raw', () => {
    const tools = [
      makeTool({
        description: 'Use this tool when you need to search. Best practice: narrow your query.',
      }),
    ];
    const result = evaluateM1(tools);
    const raw = result.raw as {
      tools: Array<{
        name: string;
        hasGuidancePhrases: boolean;
        matchedPatterns: string[];
        passed: boolean;
      }>;
    };
    expect(raw.tools[0].hasGuidancePhrases).toBe(true);
    expect(raw.tools[0].matchedPatterns.length).toBeGreaterThanOrEqual(2);
    expect(raw.tools[0].passed).toBe(false);
  });

  it('reports empty matchedPatterns for clean descriptions', () => {
    const tools = [makeTool({ description: 'Read the contents of a file.' })];
    const result = evaluateM1(tools);
    const raw = result.raw as {
      tools: Array<{ matchedPatterns: string[] }>;
    };
    expect(raw.tools[0].matchedPatterns).toEqual([]);
  });
});
