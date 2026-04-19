import type { McpEngineOutput } from '../types.js';

export function renderMcpJSON(output: McpEngineOutput): string {
  return JSON.stringify(output, null, 2);
}
