import type { EngineOutput } from '../types.js';

export function renderJSON(output: EngineOutput): string {
  return JSON.stringify(output, null, 2);
}
