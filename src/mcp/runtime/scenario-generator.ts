import type { McpToolDefinition } from '../types.js';
import type { TestScenario } from './types.js';

export function generateScenarios(tool: McpToolDefinition): TestScenario[] {
  const scenarios: TestScenario[] = [];

  // Never test destructive tools
  if (tool.annotations?.destructiveHint) {
    return [];
  }

  const isReadOnly = tool.annotations?.readOnlyHint === true;

  // Error scenario: always safe (invalid args shouldn't execute logic)
  scenarios.push({
    toolName: tool.name,
    args: generateInvalidArgs(tool),
    expectedType: 'error',
    description: `Invalid arguments for ${tool.name}`,
  });

  // Empty-result scenario: only for explicitly read-only tools
  if (isReadOnly) {
    scenarios.push({
      toolName: tool.name,
      args: generateEmptyResultArgs(tool),
      expectedType: 'empty',
      description: `Empty-result query for ${tool.name}`,
    });
  }

  return scenarios;
}

function generateInvalidArgs(_tool: McpToolDefinition): Record<string, unknown> {
  // Omit all required fields by returning empty object
  // Some servers validate at call time, others validate at execution time
  // An empty object is the safest "invalid" input
  return {};
}

function generateEmptyResultArgs(tool: McpToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  // We don't have access to inputSchema in our static types, so we use heuristics
  // based on the tool name and description
  const nameLower = tool.name.toLowerCase();
  const descLower = tool.description.toLowerCase();

  // Fallback: table-specific tools
  if (descLower.includes('table') || nameLower.includes('table')) {
    args.table = '__nonexistent_table__';
    return args;
  }

  // Search / query / list tools
  if (
    nameLower.includes('search') ||
    nameLower.includes('query') ||
    nameLower.includes('list') ||
    nameLower.includes('find')
  ) {
    args.query = '__NONEXISTENT_7f3a9b__';
    return args;
  }

  // File / read tools
  if (
    nameLower.includes('read') ||
    nameLower.includes('file') ||
    nameLower.includes('path') ||
    descLower.includes('file')
  ) {
    args.path = '/__nonexistent__/file.txt';
    return args;
  }

  // ID lookup tools
  if (nameLower.includes('get') || nameLower.includes('by_id') || nameLower.includes('lookup')) {
    args.id = '__nonexistent_id__';
    return args;
  }

  // Last resort: empty object may produce no results for some tools
  return args;
}
