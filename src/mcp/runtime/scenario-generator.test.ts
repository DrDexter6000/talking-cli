import { describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../types.js';
import { generateScenarios } from './scenario-generator.js';

function makeTool(
  name: string,
  description: string,
  annotations?: McpToolDefinition['annotations'],
): McpToolDefinition {
  return { name, description, annotations };
}

describe('generateScenarios', () => {
  it('returns empty for destructive tools', () => {
    const tool = makeTool('delete', 'Delete a file', { destructiveHint: true });
    expect(generateScenarios(tool)).toEqual([]);
  });

  it('generates error-only scenario for ambiguous tools (no annotations)', () => {
    const tool = makeTool('query', 'Query data');
    const scenarios = generateScenarios(tool);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].expectedType).toBe('error');
  });

  it('generates error-only scenario for ambiguous tools with only readOnly false', () => {
    const tool = makeTool('write', 'Write data', { readOnlyHint: false });
    const scenarios = generateScenarios(tool);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].expectedType).toBe('error');
  });

  it('generates error scenario for readOnly tools', () => {
    const tool = makeTool('search', 'Search files', { readOnlyHint: true });
    const scenarios = generateScenarios(tool);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].expectedType).toBe('error');
    expect(scenarios[1].expectedType).toBe('empty');
  });

  it('generates only error scenario for idempotent non-readOnly tools', () => {
    const tool = makeTool('toggle', 'Toggle setting', { idempotentHint: true });
    const scenarios = generateScenarios(tool);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].expectedType).toBe('error');
  });

  it('generates empty-result args for search tools', () => {
    const tool = makeTool('search', 'Search files', { readOnlyHint: true });
    const scenarios = generateScenarios(tool);
    const empty = scenarios.find((s) => s.expectedType === 'empty');
    expect(empty?.args).toHaveProperty('query');
    expect((empty?.args as Record<string, string>).query).toContain('NONEXISTENT');
  });

  it('generates empty-result args for read tools', () => {
    const tool = makeTool('read_file', 'Read a file', { readOnlyHint: true });
    const scenarios = generateScenarios(tool);
    const empty = scenarios.find((s) => s.expectedType === 'empty');
    expect(empty?.args).toHaveProperty('path');
    expect((empty?.args as Record<string, string>).path).toContain('nonexistent');
  });

  it('generates empty-result args for table tools', () => {
    const tool = makeTool('list_rows', 'List table rows', { readOnlyHint: true });
    const scenarios = generateScenarios(tool);
    const empty = scenarios.find((s) => s.expectedType === 'empty');
    expect(empty?.args).toHaveProperty('table');
    expect((empty?.args as Record<string, string>).table).toContain('nonexistent');
  });

  it('error scenario always has empty args', () => {
    const tool = makeTool('search', 'Search files', { readOnlyHint: true });
    const scenarios = generateScenarios(tool);
    const error = scenarios.find((s) => s.expectedType === 'error');
    expect(error?.args).toEqual({});
  });
});
