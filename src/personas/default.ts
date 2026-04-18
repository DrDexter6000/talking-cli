import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const defaultPersona: PersonaRenderer = {
  key: 'default',
  name: 'Coach',
  description: 'Plain-language, direct, and sharp — the default talking-cli voice.',

  renderHeader(totalScore: number): string {
    if (totalScore === 100) {
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green("Flawless. Your CLI actually talks back. I'm almost proud.")
      );
    }
    if (totalScore >= 80) {
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow('Not bad. A few mute spots, but we can fix them.')
      );
    }
    if (totalScore >= 50) {
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Okay, listen up. Your skill is half mute and your SKILL.md is eating the budget alive.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('Yikes. Your CLI is so quiet I can hear the tokens screaming in agony.')
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
