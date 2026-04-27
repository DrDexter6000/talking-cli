import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const defaultPersona: PersonaRenderer = {
  key: 'default',
  name: 'Coach',
  description: 'Plain-language, direct, and sharp — the default talking-cli voice.',

  renderHeader(totalScore: number, hasCustomTools: boolean): string {
    if (totalScore === 100) {
      if (hasCustomTools) {
        return (
          chalk.green.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.green("Flawless. Your CLI actually talks back. I'm almost proud.")
        );
      }
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green('Flawless. Your SKILL.md stays within budget. No custom tools detected.')
      );
    }
    if (totalScore >= 80) {
      if (hasCustomTools) {
        return (
          chalk.yellow.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.yellow('Not bad. A few mute spots, but we can fix them.')
        );
      }
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow('Not bad. Your SKILL.md is solid, but no custom tools were detected.')
      );
    }
    if (totalScore >= 50) {
      if (hasCustomTools) {
        return (
          chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.hex('#FF8800')(
            'Okay, listen up. Your skill is half mute and your SKILL.md is eating the budget alive.',
          )
        );
      }
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Okay, listen up. Your SKILL.md is eating the budget alive. No custom tools were detected — H2 through H4 were skipped.',
        )
      );
    }
    if (hasCustomTools) {
      return (
        chalk.red.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.red('Yikes. Your CLI is so quiet I can hear the tokens screaming in agony.')
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('Yikes. Your SKILL.md needs serious trimming. No custom tools detected.')
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `This is not a SKILL.md, it's a manifesto. Delete ${overBy} lines minimum. Move every "if the tool returns X, do Y" paragraph into the tool's response as a hint.`;
    } else if (overBy > 50) {
      advice = `You overshot by ${overBy} lines (${timesOver}× budget). Go through each section and ask: "Does this only matter after a specific tool call?" If yes → move it to a hint.`;
    } else {
      advice = `Just ${overBy} lines over. Tighten the prose and migrate post-call guidance to tool hints.`;
    }

    return [
      chalk.bold('H1 · Line Count · ') + chalk.red('FAIL'),
      `Your SKILL.md is ${raw.lineCount} lines. The budget is ${raw.maxLines}.`,
      chalk.cyan('→ ') + advice,
    ].join('\n');
  },

  renderH2(h2: HeuristicResult): string {
    const raw = h2.raw as { tools: Array<{ name: string; verdict: string; score: number }> };
    const tools = raw.tools;

    const uncovered = tools.filter((t) => t.verdict === 'FAIL');
    const partial = tools.filter((t) => t.verdict === 'PARTIAL');
    const passing = tools.filter((t) => t.verdict === 'PASS');

    const lines: string[] = [
      chalk.bold('H2 · Hint Coverage · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} tool(s) have zero fixtures. They don't speak at all: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty/zero-result scenario. Make them return a "hints" field.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} tool(s) are half-covered: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario is missing (error vs empty-result) and add the missing fixture.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} tool(s) actually talk back. Good job on those.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Structured Hints · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} passed fixtures contain hint fields (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Make your tools return a "hints" or "suggestions" field alongside raw data.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Actionable Guidance · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} hint fields have actionable content (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'Hints should be specific. "Try again" is too short. "Try broadening your query with fewer filters" is actionable.',
    ].join('\n');
  },

  renderM1(m1: HeuristicResult): string {
    const raw = m1.raw as {
      tools: Array<{
        name: string;
        hasGuidancePhrases: boolean;
        matchedPatterns: string[];
        passed: boolean;
      }>;
    };
    const failed = raw.tools.filter((t) => !t.passed);
    const lines: string[] = [chalk.bold('M1 · Contract Purity · ') + chalk.red('FAIL')];

    for (const t of failed) {
      const patterns = t.matchedPatterns.join(', ');
      lines.push(`  ${t.name}: description contains strategy/guidance [${patterns}]`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Descriptions are C1 (Contract) — they constrain, not explain. Move "when to use" / "how to use" / "first do X" guidance into the tool response (Prompt-On-Call).',
    );
    return lines.join('\n');
  },

  renderM2(m2: HeuristicResult): string {
    const raw = m2.raw as {
      tools: Array<{
        name: string;
        hasReadOnly: boolean;
        hasIdempotent: boolean;
        hasDestructive: boolean;
        passed: boolean;
      }>;
    };
    const failed = raw.tools.filter((t) => !t.passed);
    const lines: string[] = [chalk.bold('M2 · Annotation Completeness · ') + chalk.red(m2.verdict)];

    for (const t of failed) {
      const missing: string[] = [];
      if (!t.hasReadOnly) missing.push('readOnlyHint');
      if (!t.hasIdempotent) missing.push('idempotentHint');
      if (!t.hasDestructive) missing.push('destructiveHint');
      lines.push(`  ${t.name}: missing ${missing.join(', ')}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Add readOnlyHint, idempotentHint, and destructiveHint to every tool. Agents need these to decide when it is safe to call speculatively.',
    );
    return lines.join('\n');
  },

  renderM3(m3: HeuristicResult): string {
    const raw = m3.raw as {
      scenarios: Array<{
        toolName: string;
        scenarioType: string;
        hasGuidance: boolean;
        responseLength: number;
      }>;
    };
    const failed = raw.scenarios.filter((s) => !s.hasGuidance);
    const lines: string[] = [chalk.bold('M3 · Response Guidance · ') + chalk.red(m3.verdict)];

    for (const s of failed) {
      const reason = s.responseLength < 20 ? 'response too short' : 'no actionable guidance';
      lines.push(`  ${s.toolName} (${s.scenarioType}): ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        "When a tool returns an empty or partial result, tell the agent what to do next. Don't leave them guessing.",
    );
    return lines.join('\n');
  },

  renderM4(m4: HeuristicResult): string {
    const raw = m4.raw as {
      errors: Array<{
        toolName: string;
        isActionable: boolean;
        isStackTrace: boolean;
        isHttpDump: boolean;
      }>;
    };
    const failed = raw.errors.filter((e) => !e.isActionable);
    const lines: string[] = [chalk.bold('M4 · Error Actionability · ') + chalk.red(m4.verdict)];

    for (const e of failed) {
      const reason = e.isStackTrace
        ? 'raw stack trace'
        : e.isHttpDump
          ? 'raw HTTP response'
          : 'not actionable';
      lines.push(`  ${e.toolName}: ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Error messages should tell the agent how to recover. Raw stack traces and HTTP dumps waste context budget.',
    );
    return lines.join('\n');
  },

  renderFooter(totalScore: number): string {
    if (totalScore === 100) {
      return chalk.green('Nothing to fix. Go ship it.');
    }
    return (
      chalk.dim('---\nFix the issues above, then run ') +
      chalk.bold('npx talking-cli audit') +
      chalk.dim(' again to see your new score.')
    );
  },
};
