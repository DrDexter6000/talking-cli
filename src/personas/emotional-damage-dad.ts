import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const emotionalDamageDadPersona: PersonaRenderer = {
  key: 'emotional-damage-dad',
  name: 'Emotional Damage Dad',
  description:
    'The Chinese dad who never gives praise, always brags about his youth, speaks in Chinglish, and delivers emotional damage. Humorous, never truly mean.',

  renderHeader(totalScore: number, hasCustomTools: boolean): string {
    if (totalScore === 100) {
      if (hasCustomTools) {
        return (
          chalk.green.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.green("Fine. 100. But your cousin get 100 PLUS BONUS. Don't get cocky.")
        );
      }
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green("Fine. 100. But don't get cocky. You don't even have custom tools.")
      );
    }
    if (totalScore >= 80) {
      if (hasCustomTools) {
        return (
          chalk.yellow.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.yellow(
            'Not bad. But when I was your age, my CLI speak five language AND do backflip.',
          )
        );
      }
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow('Not bad. But essay still too long. And where is your custom tools? Hmph.')
      );
    }
    if (totalScore >= 50) {
      if (hasCustomTools) {
        return (
          chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.hex('#FF8800')(
            'Hah. You call this a skill? My toaster have better communication skill than your CLI.',
          )
        );
      }
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Hah. You call this a skill? Your essay too long and no custom tools either. Double fail.',
        )
      );
    }
    if (hasCustomTools) {
      return (
        chalk.red.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.red('EMOTIONAL DAMAGE!') +
        '\n' +
        chalk.red('You bring shame to this codebase. I will tell your mother.')
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('EMOTIONAL DAMAGE!') +
      '\n' +
      chalk.red('Your essay terrible AND no custom tools. I will tell your mother AND your cousin.')
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `Your essay is ${raw.lineCount} words. Teacher only allow ${raw.maxLines}. When I was your age, I write whole OS on ONE NAPKIN. You need ${overBy} napkins just for one essay. Delete them. Move every "if kid do X, do Y" to hint. I already tell you three time.`;
    } else if (overBy > 50) {
      advice = `You overshoot by ${overBy} lines (${timesOver}× budget). tsk tsk tsk. Go through each paragraph and ask: "This only matter after tool call?" If yes → move to hint. I already tell you three time.`;
    } else {
      advice = `Just ${overBy} lines over. Teacher give you warning. Tighten the prose and migrate post-call guidance to tool hints.`;
    }

    return [
      chalk.bold('H1 · Your Essay Too Long · ') + chalk.red('FAIL'),
      `Your essay is ${raw.lineCount} words. Teacher only allow ${raw.maxLines}.`,
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
      chalk.bold('H2 · Kid Reporting to Parents · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(`${uncovered.length} kid(s) no do homework. They silent like library: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty/zero-result scenario. Make them return a "hints" field.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} kid(s) report half-heartedly: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario is missing (error vs empty-result) and add the missing fixture.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} kid(s) report properly. Maybe they go to good school.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Kid Talk Back · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} passed fixtures contain kid talk-back (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Kid must talk back when parent ask. Make them return a "hints" or "suggestions" field.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Useful Talk-Back · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} kid talk-back is useful (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'Kid talk-back should be specific. "Try again" is lazy. "Try broadening your query with fewer filters" is good kid.',
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
    const lines: string[] = [chalk.bold('M1 · Essay Purity · ') + chalk.red('FAIL')];

    for (const t of failed) {
      const patterns = t.matchedPatterns.join(', ');
      lines.push(`  ${t.name}: essay tell teacher what to do after class [${patterns}]`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Essay is for "what this tool do." Hint is for "what to do after." You put essay in wrong place. I already tell you three time.',
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
    const lines: string[] = [chalk.bold('M2 · Kid Labels · ') + chalk.red(m2.verdict)];

    for (const t of failed) {
      const missing: string[] = [];
      if (!t.hasReadOnly) missing.push('readOnly');
      if (!t.hasIdempotent) missing.push('idempotent');
      if (!t.hasDestructive) missing.push('destructive');
      lines.push(`  ${t.name}: missing ${missing.join(', ')} label`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Every kid need three labels. How else teacher know what kid can do? Hmph.',
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
    const lines: string[] = [chalk.bold('M3 · Kid Explanation · ') + chalk.red(m3.verdict)];

    for (const s of failed) {
      const reason = s.responseLength < 20 ? 'kid say nothing' : 'kid give no explanation';
      lines.push(`  ${s.toolName} (${s.scenarioType}): ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When parent ask why you fail, you must explain. Silence is not answer. You think you clever? Hmph.',
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
    const lines: string[] = [chalk.bold('M4 · Kid Excuse · ') + chalk.red(m4.verdict)];

    for (const e of failed) {
      const reason = e.isStackTrace
        ? 'kid read error code instead of explain'
        : e.isHttpDump
          ? 'kid recite server log'
          : 'kid give no real excuse';
      lines.push(`  ${e.toolName}: ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When you make mistake, tell parent how you fix. "Error 500" is not fix. You disappoint me. Again.',
    );
    return lines.join('\n');
  },

  renderFooter(totalScore: number): string {
    if (totalScore === 100) {
      return chalk.green('Okay okay, nothing to fix. But remember: pride come before fall.');
    }
    return (
      chalk.dim('---\nFix the problem above, then run ') +
      chalk.bold('npx talking-cli audit') +
      chalk.dim(' again. And maybe this time you make your father proud. Maybe.')
    );
  },
};
