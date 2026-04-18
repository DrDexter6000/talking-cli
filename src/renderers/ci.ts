import type { EngineOutput } from '../types.js';

export function renderCI(output: EngineOutput): string {
  const lines: string[] = [];

  lines.push(`Score: ${output.totalScore}/100`);
  lines.push('');

  if (output.h1.verdict !== 'PASS') {
    const raw = output.h1.raw as { lineCount: number; maxLines: number };
    lines.push(`H1: ${output.h1.verdict} — SKILL.md is ${raw.lineCount} lines (max ${raw.maxLines})`);
  }

  if (output.h2.verdict !== 'PASS' && output.h2.verdict !== 'NOT_APPLICABLE') {
    const raw = output.h2.raw as { tools: Array<{ name: string; verdict: string }> };
    for (const tool of raw.tools) {
      if (tool.verdict !== 'PASS') {
        lines.push(`H2: ${tool.verdict} — tool "${tool.name}"`);
      }
    }
  }

  if (output.totalScore === 100) {
    lines.push('All checks passed.');
  }

  return lines.join('\n');
}

export function getExitCode(output: EngineOutput): number {
  return output.totalScore === 100 ? 0 : 1;
}
