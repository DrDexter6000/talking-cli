import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const britishCriticPersona: PersonaRenderer = {
  key: 'british-critic',
  name: 'British Critic',
  description:
    'Dry wit, precise venom, cultural references. Like a theatre reviewer who has seen too many bad third acts.',

  renderHeader(totalScore: number): string {
    if (totalScore === 100) {
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green(
          'A rare standing ovation. Every tool speaks with the precision of a well-rehearsed soliloquy.',
        )
      );
    }
    if (totalScore >= 80) {
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow(
          'Promising, but uneven. Like a debut novel with a strong opening and a sagging middle.',
        )
      );
    }
    if (totalScore >= 50) {
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'One might charitably call this a work in progress. The script is bloated, and half the cast has forgotten their lines.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red(
        'A catastrophic opening night. The audience — forgive me, the agent — is sitting in stunned silence.',
      )
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `This is not a programme note; it is an unauthorised autobiography. Remove ${overBy} pages immediately. Every "if the actor returns X, the audience should Y" direction belongs in the prompt, not the programme.`;
    } else if (overBy > 50) {
      advice = `You have exceeded the house limit by ${overBy} pages (${timesOver}× the programme budget). Ask of every paragraph: "Does this only matter after a specific scene?" If yes — cut it and whisper it to the actor instead.`;
    } else {
      advice = `A mere ${overBy} pages over the limit. Tighten the prose and move post-scene notes into the prompt's stage directions.`;
    }

    return [
      chalk.bold('H1 · Programme Note Bloat · ') + chalk.red('FAIL'),
      `Your programme runs to ${raw.lineCount} pages. The house limit is ${raw.maxLines}.`,
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
      chalk.bold('H2 · Rehearsal Coverage · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} performer(s) have never rehearsed. They step on stage and say nothing: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Write rehearsal notes for [${names}]. One scene where everything goes wrong, one where nothing happens. Each must end with a "hints" direction.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} performer(s) have learned only half their lines: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Determine which scene is missing (the catastrophe or the void) and rehearse it.`,
      );
    }

    if (passing.length > 0) {
      lines.push(
        `${passing.length} performer(s) deliver their lines with conviction. One applauds.`,
      );
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Stage Directions · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} rehearsals include stage directions (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Every performer should exit the stage with a direction — a "hints" field telling the agent what scene comes next.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Specificity of Direction · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} stage directions are actionable (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A direction should be precise. "Try again" is a shrug. "Try broadening your query with fewer filters" is a direction worth following.',
    ].join('\n');
  },

  renderFooter(totalScore: number): string {
    if (totalScore === 100) {
      return chalk.green('No notes. Take your bow.');
    }
    return (
      chalk.dim('---\nRevise according to the notes above, then run ') +
      chalk.bold('npx talking-cli audit') +
      chalk.dim(' again. The curtain rises when you are ready.')
    );
  },
};
