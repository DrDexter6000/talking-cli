import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const nbaCoachPersona: PersonaRenderer = {
  key: 'nba-coach',
  name: 'NBA Coach',
  description:
    'Encouraging but blunt. Uses basketball metaphors. Calls out laziness, celebrates hustle.',

  renderHeader(totalScore: number): string {
    if (totalScore === 100) {
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green(
          'Championship calibre. Every tool is talking, every possession counts. Beautiful basketball.',
        )
      );
    }
    if (totalScore >= 80) {
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow(
          'Solid game, but we are leaving points on the table. A few tools need to step up their communication.',
        )
      );
    }
    if (totalScore >= 50) {
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Listen up. Our defense on SKILL.md bloat is nonexistent, and half the roster is not talking on the court.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red(
        'This is a blowout. We are getting out-rebounded by silence and out-scored by blank tool returns. Time out.',
      )
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `This playbook is ${overBy} pages too long. No team can execute a manifesto. Strip it down to the X's and O's — move every "if they do this, you do that" scenario into the huddle hint.`;
    } else if (overBy > 50) {
      advice = `You are ${overBy} plays over the playbook limit (${timesOver}× budget). Go through every page and ask: "Does this only matter after a specific possession?" If yes → move it to the tool's huddle.`;
    } else {
      advice = `Only ${overBy} plays over. Tighten the playbook and move post-possession guidance into the huddle hint.`;
    }

    return [
      chalk.bold('H1 · Playbook Bloat · ') + chalk.red('FAIL'),
      `Your playbook is ${raw.lineCount} pages. The limit is ${raw.maxLines}.`,
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
      chalk.bold('H2 · Communication on Court · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} player(s) have zero practice reps. They are not calling out on defense: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Get [${names}] into the gym. One turnover scenario, one missed-shot scenario. Make them call out a "hint" after every play.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} player(s) are half-practiced: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which drill is missing (turnover vs missed-shot) and run the missing rep.`,
      );
    }

    if (passing.length > 0) {
      lines.push(
        `${passing.length} player(s) are calling out loud and clear. Good hustle on those.`,
      );
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Huddle Calls · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} practice reps include huddle calls (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Every tool should finish its play with a huddle call — a "hints" field telling the agent what to do next.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Actionable Huddle Calls · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} huddle calls are actionable (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A huddle call should be specific. "Try again" is a lazy pass. "Try broadening your query with fewer filters" is a real play.',
    ].join('\n');
  },

  renderFooter(totalScore: number): string {
    if (totalScore === 100) {
      return chalk.green('No adjustments needed. Go win the chip.');
    }
    return (
      chalk.dim('---\nMake the adjustments above, then run ') +
      chalk.bold('npx talking-cli audit') +
      chalk.dim(' again and let us see some better basketball.')
    );
  },
};
