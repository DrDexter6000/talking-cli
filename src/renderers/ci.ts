import type { EngineOutput } from '../types.js';

export function renderCI(output: EngineOutput): string {
  const lines: string[] = [];

  lines.push(`Score: ${output.totalScore}/100`);
  lines.push('');

  if (output.h1.verdict !== 'PASS') {
    const raw = output.h1.raw as { lineCount: number; maxLines: number };
    lines.push(
      `H1: ${output.h1.verdict} — SKILL.md is ${raw.lineCount} lines (max ${raw.maxLines})`,
    );
  }

  if (output.h2.verdict !== 'PASS' && output.h2.verdict !== 'NOT_APPLICABLE') {
    const raw = output.h2.raw as { tools: Array<{ name: string; verdict: string }> };
    for (const tool of raw.tools) {
      if (tool.verdict !== 'PASS') {
        lines.push(`H2: ${tool.verdict} — tool "${tool.name}"`);
      }
    }
  }

  if (output.h3.verdict !== 'PASS' && output.h3.verdict !== 'NOT_APPLICABLE') {
    const raw = output.h3.raw as { withHints: number; passed: number };
    lines.push(
      `H3: ${output.h3.verdict} — ${raw.withHints}/${raw.passed} fixtures have hint fields`,
    );
  }

  if (output.h4.verdict !== 'PASS' && output.h4.verdict !== 'NOT_APPLICABLE') {
    const raw = output.h4.raw as { actionable: number; passed: number };
    lines.push(`H4: ${output.h4.verdict} — ${raw.actionable}/${raw.passed} hints are actionable`);
  }

  if (output.totalScore === 100) {
    lines.push('All checks passed.');
  }

  return lines.join('\n');
}

export function getExitCode(output: EngineOutput): number {
  return output.totalScore === 100 ? 0 : 1;
}
