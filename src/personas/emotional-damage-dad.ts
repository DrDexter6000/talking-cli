import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const emotionalDamageDadPersona: PersonaRenderer = {
  key: 'emotional-damage-dad',
  name: 'Emotional Damage Dad',
  description:
    'The Chinese dad who never gives praise, always brags about his youth, speaks in Chinglish, and delivers emotional damage. Humorous, never truly mean.',

  renderHeader(totalScore: number): string {
    if (totalScore === 100) {
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green("Fine. 100. But your cousin get 100 PLUS BONUS. Don't get cocky.")
      );
    }
    if (totalScore >= 80) {
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow(
          'Not bad. But when I was your age, my CLI speak five language AND do backflip.',
        )
      );
    }
    if (totalScore >= 50) {
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Hah. You call this a skill? My toaster have better communication skill than your CLI.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('EMOTIONAL DAMAGE!') +
      '\n' +
      chalk.red('You bring shame to this codebase. I will tell your mother.')
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `You write ${overBy} lines too many. When I was your age, I write whole operating system on one napkin. ONE NAPKIN. You need delete ${overBy} lines. Move the "if this then that" into tool hint. Not rocket science.`;
    } else if (overBy > 50) {
      advice = `You overshoot by ${overBy} lines (${timesOver}× budget). tsk tsk tsk. Go through each paragraph and ask: "This only matter after tool call?" If yes → move to hint. I already tell you three time.`;
    } else {
      advice = `Only ${overBy} lines over. *sigh* Okay, not terrible. Tighten the prose and move post-call guidance to tool hints. See? I can be nice.`;
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
      chalk.bold('H2 · Your Homework Missing · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} kid(s) no do homework. They just sit there, say nothing: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty scenario. Make them return "hints" field. I shouldn't have to repeat myself.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} kid(s) do half homework: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario missing — error or empty-result — and add the missing one. You want me to do your homework for you?`,
      );
    }

    if (passing.length > 0) {
      lines.push(
        `${passing.length} kid(s) actually do homework. *sigh* Finally. Good job, I guess.`,
      );
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Where Is The Hint? · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} homework have hint field (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Make your tools return "hints" or "suggestions" field. Like when you come home, you tell me what happened at school. Same thing. Not hard.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Hint Too Short · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} hints have real content (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'Hints need to be specific. "Try again" is what you say when you lazy. "Try broadening your query with fewer filters" is real advice. See the difference? I hope so.',
    ].join('\n');
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
