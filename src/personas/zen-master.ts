import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const zenMasterPersona: PersonaRenderer = {
  key: 'zen-master',
  name: 'Zen Master',
  description:
    'Calm, spacious, uses silence and反问. Like a bell that rings only when struck by understanding.',

  renderHeader(totalScore: number): string {
    if (totalScore === 100) {
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green('The river flows clearly. Every stone speaks when the water asks.')
      );
    }
    if (totalScore >= 80) {
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow('The path is mostly clear. A few stones remain unturned.')
      );
    }
    if (totalScore >= 50) {
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')('You have built a large temple. But do the bells ring?')
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('A garden of silence. The wind blows, but no chime answers.')
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `You have written ${raw.lineCount} words. But how many are necessary? A temple with too many halls confuses the visitor. Remove ${overBy} walls. Ask each word: "Does this only matter after the bell has rung?" If yes — let the bell carry it.`;
    } else if (overBy > 50) {
      advice = `The scroll is ${overBy} lines longer than the frame allows (${timesOver}× the space). Does each line serve the moment before the bell, or the moment after? What comes after belongs to the bell.`;
    } else {
      advice = `Only ${overBy} lines beyond the frame. Tighten the scroll, and let the bell speak what follows.`;
    }

    return [
      chalk.bold('H1 · The Scroll · ') + chalk.red('FAIL'),
      `Your scroll is ${raw.lineCount} lines. The frame holds ${raw.maxLines}.`,
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
      chalk.bold('H2 · The Bells · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} bell(s) have never been struck. They hang in silence: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `For [${names}], ring two notes: one when the bowl is empty, one when it breaks. Let each note end with a "hint" — a whisper of what comes next.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} bell(s) have been struck only once: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Which note is missing — the empty bowl or the broken one? Strike the missing note.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} bell(s) ring clearly. Their sound carries across the garden.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · The Whisper · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} bells carry a whisper (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'When the bell rings, let it also whisper. A "hints" field is the echo that tells the listener which path to walk.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · The Meaning of the Whisper · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} whispers carry meaning (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A whisper should be clear. "Try again" is wind. "Try broadening your query with fewer filters" is a signpost.',
    ].join('\n');
  },

  renderFooter(totalScore: number): string {
    if (totalScore === 100) {
      return chalk.green('The garden is complete. Sit and listen.');
    }
    return (
      chalk.dim('---\nTend to what needs tending, then run ') +
      chalk.bold('npx talking-cli audit') +
      chalk.dim(' again. The bell will tell you when the garden is ready.')
    );
  },
};
