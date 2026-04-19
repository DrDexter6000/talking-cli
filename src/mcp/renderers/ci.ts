import type { McpEngineOutput } from '../types.js';

export function renderMcpCI(output: McpEngineOutput): string {
  const lines: string[] = [];

  lines.push(`Score: ${output.totalScore}/100`);
  lines.push('');

  if (output.m1.verdict !== 'PASS') {
    const raw = output.m1.raw as {
      tools: Array<{
        name: string;
        hasGuidancePhrases: boolean;
        matchedPatterns: string[];
        passed: boolean;
      }>;
    };
    for (const tool of raw.tools) {
      if (!tool.passed) {
        const patterns = tool.matchedPatterns.join(', ');
        lines.push(
          `M1: FAIL — "${tool.name}": description contains strategy/guidance [${patterns}]`,
        );
      }
    }
  }

  if (output.m2.verdict !== 'PASS' && output.m2.verdict !== 'NOT_APPLICABLE') {
    const raw = output.m2.raw as {
      tools: Array<{
        name: string;
        hasReadOnly: boolean;
        hasIdempotent: boolean;
        hasDestructive: boolean;
        passed: boolean;
      }>;
    };
    for (const tool of raw.tools) {
      if (!tool.passed) {
        const missing: string[] = [];
        if (!tool.hasReadOnly) missing.push('readOnlyHint');
        if (!tool.hasIdempotent) missing.push('idempotentHint');
        if (!tool.hasDestructive) missing.push('destructiveHint');
        lines.push(`M2: FAIL — "${tool.name}" missing ${missing.join(', ')}`);
      }
    }
  }

  if (output.m3 && output.m3.verdict !== 'PASS' && output.m3.verdict !== 'NOT_APPLICABLE') {
    const raw = output.m3.raw as {
      scenarios: Array<{
        toolName: string;
        scenarioType: string;
        hasGuidance: boolean;
      }>;
    };
    for (const s of raw.scenarios) {
      if (!s.hasGuidance) {
        lines.push(`M3: FAIL — "${s.toolName}" (${s.scenarioType}) lacks actionable guidance`);
      }
    }
  }

  if (output.m4 && output.m4.verdict !== 'PASS' && output.m4.verdict !== 'NOT_APPLICABLE') {
    const raw = output.m4.raw as {
      errors: Array<{
        toolName: string;
        isActionable: boolean;
        isStackTrace: boolean;
        isHttpDump: boolean;
      }>;
    };
    for (const e of raw.errors) {
      if (!e.isActionable) {
        const reason = e.isStackTrace
          ? 'raw stack trace'
          : e.isHttpDump
            ? 'raw HTTP response'
            : 'not actionable';
        lines.push(`M4: FAIL — "${e.toolName}" error is ${reason}`);
      }
    }
  }

  if (output.totalScore === 100) {
    lines.push('All checks passed.');
  }

  return lines.join('\n');
}

export function getMcpExitCode(output: McpEngineOutput): number {
  return output.totalScore === 100 ? 0 : 1;
}
