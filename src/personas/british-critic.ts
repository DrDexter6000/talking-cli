import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const britishCriticPersona: PersonaRenderer = {
  key: 'british-critic',
  name: 'British Critic',
  description:
    'Dry wit, precise venom, cultural references. Like a theatre reviewer who has seen too many bad third acts.',

  renderHeader(totalScore: number, hasCustomTools: boolean): string {
    if (totalScore === 100) {
      if (hasCustomTools) {
        return (
          chalk.green.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.green(
            'A rare standing ovation. Every tool speaks with the precision of a well-rehearsed soliloquy.',
          )
        );
      }
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green('A rare standing ovation. The script is taut and well-paced.')
      );
    }
    if (totalScore >= 80) {
      if (hasCustomTools) {
        return (
          chalk.yellow.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.yellow(
            'Promising, but uneven. Like a debut novel with a strong opening and a sagging middle.',
          )
        );
      }
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow(
          'Promising, but the programme notes are over-written. No performers to review.',
        )
      );
    }
    if (totalScore >= 50) {
      if (hasCustomTools) {
        return (
          chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.hex('#FF8800')(
            'One might charitably call this a work in progress. The script is bloated, and half the cast has forgotten their lines.',
          )
        );
      }
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'One might charitably call this a work in progress. The script is bloated, and there is no cast to speak of — H2 through H4 were skipped.',
        )
      );
    }
    if (hasCustomTools) {
      return (
        chalk.red.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.red(
          'A catastrophic opening night. The audience — forgive me, the agent — is sitting in stunned silence.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red(
        'A catastrophic opening night. The script is unstageable, and there is no cast to save it.',
      )
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `This programme note has the heft of a Wagner opera without the music. Cut ${overBy} lines. Move every "if the user does X, do Y" into the stage direction — that is, the tool's response.`;
    } else if (overBy > 50) {
      advice = `The script exceeds its budget by ${overBy} lines (${timesOver}×). Does each paragraph serve the prologue, or the scene after the curtain rises? What comes after belongs to the performers.`;
    } else {
      advice = `A modest overrun of ${overBy} lines. Tighten the prose and migrate post-scene guidance to the performers' stage directions.`;
    }

    return [
      chalk.bold('H1 · Script Budget · ') + chalk.red('FAIL'),
      `Your programme note is ${raw.lineCount} lines. The budget is ${raw.maxLines}.`,
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
      chalk.bold('H2 · Stage Direction Coverage · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} performer(s) have no stage directions. They are standing in the dark: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty/zero-result scenario. Make them return a "hints" field.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} performer(s) are half-directed: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario is missing (error vs empty-result) and add the missing fixture.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} performer(s) are hitting their marks. Brava.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Stage Directions · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} passed fixtures contain stage directions (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'The performers need instruction. Make them return a "hints" or "suggestions" field.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Actionable Directions · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} stage directions have actionable content (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A stage direction should be specific. "Try again" is amateur. "Try broadening your query with fewer filters" is direction.',
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
    const lines: string[] = [chalk.bold('M1 · Script Purity · ') + chalk.red('FAIL')];

    for (const t of failed) {
      const patterns = t.matchedPatterns.join(', ');
      lines.push(`  ${t.name}: programme note contains director's notes [${patterns}]`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'The programme note tells the audience what the play is. The stage direction tells the performers what to do. One page, two purposes — a category error.',
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
    const lines: string[] = [chalk.bold('M2 · Cast Credits · ') + chalk.red(m2.verdict)];

    for (const t of failed) {
      const missing: string[] = [];
      if (!t.hasReadOnly) missing.push('readOnly');
      if (!t.hasIdempotent) missing.push('idempotent');
      if (!t.hasDestructive) missing.push('destructive');
      lines.push(`  ${t.name}: missing ${missing.join(', ')} credit`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Every performer must be credited with their full role. The audience — forgive me, the agent — cannot guess.',
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
    const lines: string[] = [chalk.bold('M3 · Performance Notes · ') + chalk.red(m3.verdict)];

    for (const s of failed) {
      const reason =
        s.responseLength < 20 ? 'actor forgot their lines' : 'no stage direction given';
      lines.push(`  ${s.toolName} (${s.scenarioType}): ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When the scene falls flat, the director must offer a note. Silence is not direction.',
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
    const lines: string[] = [chalk.bold('M4 · Curtain Call Feedback · ') + chalk.red(m4.verdict)];

    for (const e of failed) {
      const reason = e.isStackTrace
        ? 'reading the technical rider aloud'
        : e.isHttpDump
          ? 'reciting box office numbers'
          : 'no constructive criticism';
      lines.push(`  ${e.toolName}: ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When a performer forgets their lines, tell them how to recover. Do not simply announce the house lights are broken.',
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
