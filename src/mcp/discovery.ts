import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { McpToolDefinition } from './types.js';

export class McpDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpDiscoveryError';
  }
}

/**
 * Discover MCP tool definitions by statically parsing the server's entry point.
 *
 * Strategy:
 * 1. Read package.json to find the entry point (main / module).
 * 2. Read the entry point source file.
 * 3. Extract all `server.registerTool(` and `server.tool(` call sites.
 * 4. Parse name (first arg), description, and annotations from the config object (second arg).
 *
 * Limitations (Phase 1):
 * - Supports only TypeScript/JavaScript source files.
 * - Expects tool name as a literal double-quoted string (first arg).
 * - Expects config object as the second arg (Anthropic MCP SDK style).
 * - Description may be a single string or concatenated with `+`.
 * - Does not follow imports/re-exports; only scans the entry point file.
 */
export function discoverMcpTools(serverDir: string): McpToolDefinition[] {
  const packageJsonPath = resolve(serverDir, 'package.json');

  let packageJson: Record<string, unknown>;
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    throw new McpDiscoveryError(`Cannot read or parse package.json in ${serverDir}`);
  }

  const entry =
    typeof packageJson.main === 'string'
      ? packageJson.main
      : typeof packageJson.module === 'string'
        ? packageJson.module
        : 'index.js';

  const entryPath = resolve(serverDir, entry);

  let content: string;
  try {
    content = readFileSync(entryPath, 'utf-8');
  } catch {
    throw new McpDiscoveryError(`Cannot read entry point ${entryPath}`);
  }

  return parseToolCalls(content);
}

function parseToolCalls(content: string): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];

  // Match both server.registerTool( and server.tool(
  const regex = /server\.(?:registerTool|tool)\s*\(/g;
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    const startIndex = match.index + match[0].length;
    const tool = extractToolDefinition(content, startIndex);
    if (tool) {
      tools.push(tool);
    }
    match = regex.exec(content);
  }

  return tools;
}

function extractToolDefinition(content: string, startIndex: number): McpToolDefinition | null {
  let i = startIndex;
  const len = content.length;

  // --- Parse first argument: tool name (double-quoted string) ---
  while (i < len && /\s/.test(content[i])) i++;
  if (content[i] !== '"') return null;
  i++;
  const nameEnd = content.indexOf('"', i);
  if (nameEnd === -1) return null;
  const name = content.slice(i, nameEnd);
  i = nameEnd + 1;

  // --- Skip to comma separating first and second args ---
  while (i < len && content[i] !== ',') i++;
  if (i >= len) return null;
  i++; // skip comma

  // --- Parse second argument: config object { ... } ---
  while (i < len && /\s/.test(content[i])) i++;
  if (content[i] !== '{') return null;

  const configStart = i;
  let braceDepth = 1;
  i++;
  while (i < len && braceDepth > 0) {
    if (content[i] === '{') braceDepth++;
    else if (content[i] === '}') braceDepth--;
    i++;
  }
  const configText = content.slice(configStart, i);

  // --- Extract fields from config ---
  const description = extractDescription(configText);
  const annotations = extractAnnotations(configText);

  return { name, description, annotations };
}

/**
 * Extract the description string from a config object text.
 *
 * Handles:
 *   description: "single string"
 *   description: "part one" + "part two" + "part three"
 *
 * Does NOT handle template literals or variables (Phase 1 limitation).
 */
function extractDescription(configText: string): string {
  // Look for description: followed by a string expression
  const descMatch = configText.match(
    /description\s*:\s*((?:"(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*)+)/,
  );
  if (!descMatch) return '';

  const fullMatch = descMatch[1];
  const strings: string[] = [];
  const stringRegex = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null = stringRegex.exec(fullMatch);
  while (m !== null) {
    strings.push(m[1]);
    m = stringRegex.exec(fullMatch);
  }

  return strings.join('');
}

/**
 * Extract annotations object from a config object text.
 */
function extractAnnotations(configText: string): McpToolDefinition['annotations'] | undefined {
  const annMatch = configText.match(/annotations\s*:\s*\{([^}]*)\}/);
  if (!annMatch) return undefined;

  const annText = annMatch[1];
  const result: NonNullable<McpToolDefinition['annotations']> = {};

  if (/readOnlyHint\s*:\s*true/.test(annText)) result.readOnlyHint = true;
  if (/readOnlyHint\s*:\s*false/.test(annText)) result.readOnlyHint = false;
  if (/idempotentHint\s*:\s*true/.test(annText)) result.idempotentHint = true;
  if (/idempotentHint\s*:\s*false/.test(annText)) result.idempotentHint = false;
  if (/destructiveHint\s*:\s*true/.test(annText)) result.destructiveHint = true;
  if (/destructiveHint\s*:\s*false/.test(annText)) result.destructiveHint = false;

  return Object.keys(result).length > 0 ? result : undefined;
}
