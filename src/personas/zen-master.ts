import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const zenMasterPersona: PersonaRenderer = {
  key: 'zen-master',
  name: 'Zen Master',
  description:
    'Calm, spacious, uses silence and反问. Like a bell that rings only when struck by understanding.',

  renderHeader(totalScore: number, hasCustomTools: boolean): string {
    if (totalScore === 100) {
      if (hasCustomTools) {
        return (
          chalk.green.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.green('The river flows clearly. Every stone speaks when the water asks.')
        );
      }
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green('The river flows clearly. The scroll is the right length.')
      );
    }
    if (totalScore >= 80) {
      if (hasCustomTools) {
        return (
          chalk.yellow.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.yellow('The path is mostly clear. A few stones remain unturned.')
        );
      }
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow('The path is mostly clear. The scroll has a few unnecessary words.')
      );
    }
    if (totalScore >= 50) {
      if (hasCustomTools) {
        return (
          chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.hex('#FF8800')('You have built a large temple. But do the bells ring?')
        );
      }
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'You have built a large temple. But there are no bells to ring — H2 through H4 were skipped.',
        )
      );
    }
    if (hasCustomTools) {
      return (
        chalk.red.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.red('A garden of silence. The wind blows, but no chime answers.')
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red('A garden without bells. The wind blows, but there is nothing to ring.')
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
      advice = `The scroll exceeds its frame by ${overBy} lines. Tighten the words. Move what comes after the bell into the bell itself.`;
    }

    return [
      chalk.bold('H1 · Scroll Length · ') + chalk.red('FAIL'),
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
      chalk.bold('H2 · Bell Coverage · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} bell(s) have no voice. They do not ring when struck: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty/zero-result scenario. Make them return a "hints" field.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} bell(s) are half-voiced: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario is missing (error vs empty-result) and add the missing fixture.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} bell(s) ring clearly. The temple breathes.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Bell Whispers · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} passed fixtures contain whispers (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'The bell must speak when struck. Make it return a "hints" or "suggestions" field.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Meaningful Whispers · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} whispers carry meaning (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A whisper should guide. "Try again" is wind. "Try broadening your query with fewer filters" is a whisper with direction.',
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
    const lines: string[] = [chalk.bold('M1 · Bell Purity · ') + chalk.red('FAIL')];

    for (const t of failed) {
      const patterns = t.matchedPatterns.join(', ');
      lines.push(`  ${t.name}: inscription carries words for after the strike [${patterns}]`);
    }

    lines.push(
      chalk.cyan('→ ') +
        "The bell's name tells the striker what it is. The bell's sound tells the striker what to hear. Do not carve the sound into the name.",
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
    const lines: string[] = [chalk.bold('M2 · Bell Markings · ') + chalk.red(m2.verdict)];

    for (const t of failed) {
      const missing: string[] = [];
      if (!t.hasReadOnly) missing.push('readOnly');
      if (!t.hasIdempotent) missing.push('idempotent');
      if (!t.hasDestructive) missing.push('destructive');
      lines.push(`  ${t.name}: missing ${missing.join(', ')} marking`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Every bell must carry three marks. Without them, the striker does not know what kind of sound will come.',
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
    const lines: string[] = [chalk.bold('M3 · Bell Echo · ') + chalk.red(m3.verdict)];

    for (const s of failed) {
      const reason = s.responseLength < 20 ? 'sound does not carry' : 'no echo returns';
      lines.push(`  ${s.toolName} (${s.scenarioType}): ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When the bell is struck and no sound returns, the mountain must answer. A tool that returns silence teaches nothing.',
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
    const lines: string[] = [chalk.bold('M4 · Strike Aftermath · ') + chalk.red(m4.verdict)];

    for (const e of failed) {
      const reason = e.isStackTrace
        ? 'the bell cracked, revealing the forge'
        : e.isHttpDump
          ? 'the wind carries noise from the valley'
          : 'no teaching in the sound';
      lines.push(`  ${e.toolName}: ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When the bell rings false, the striker must learn why. The crack in the bell is the beginning of wisdom.',
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
