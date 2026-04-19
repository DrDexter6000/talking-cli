import chalk from 'chalk';
import type { HeuristicResult } from '../types.js';
import type { PersonaRenderer } from './types.js';

export const nbaCoachPersona: PersonaRenderer = {
  key: 'nba-coach',
  name: 'NBA Coach',
  description:
    'Encouraging but blunt. Uses basketball metaphors. Calls out laziness, celebrates hustle.',

  renderHeader(totalScore: number, hasCustomTools: boolean): string {
    if (totalScore === 100) {
      if (hasCustomTools) {
        return (
          chalk.green.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.green(
            'Championship calibre. Every tool is talking, every possession counts. Beautiful basketball.',
          )
        );
      }
      return (
        chalk.green.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.green('Championship calibre. Clean playbook, no unnecessary pages.')
      );
    }
    if (totalScore >= 80) {
      if (hasCustomTools) {
        return (
          chalk.yellow.bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.yellow(
            'Solid game, but we are leaving points on the table. A few tools need to step up their communication.',
          )
        );
      }
      return (
        chalk.yellow.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.yellow(
          'Solid game, but the playbook is getting wordy. No roster to coach on communication.',
        )
      );
    }
    if (totalScore >= 50) {
      if (hasCustomTools) {
        return (
          chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
          '\n' +
          chalk.hex('#FF8800')(
            'Listen up. Our defense on SKILL.md bloat is nonexistent, and half the roster is not talking on the court.',
          )
        );
      }
      return (
        chalk.hex('#FF8800').bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.hex('#FF8800')(
          'Listen up. Our defense on SKILL.md bloat is nonexistent. No roster to speak of — H2 through H4 were skipped.',
        )
      );
    }
    if (hasCustomTools) {
      return (
        chalk.red.bold(`Score: ${totalScore}/100`) +
        '\n' +
        chalk.red(
          'This is a blowout. We are getting out-rebounded by silence and out-scored by blank tool returns. Time out.',
        )
      );
    }
    return (
      chalk.red.bold(`Score: ${totalScore}/100`) +
      '\n' +
      chalk.red(
        'This is a blowout. The playbook is a mess and there is no roster to put on the floor.',
      )
    );
  },

  renderH1(h1: HeuristicResult): string {
    const raw = h1.raw as { lineCount: number; maxLines: number };
    const overBy = raw.lineCount - raw.maxLines;
    const timesOver = (raw.lineCount / raw.maxLines).toFixed(1);

    let advice: string;
    if (overBy > 200) {
      advice = `This playbook is thicker than a pre-game scouting report on LeBron. Cut ${overBy} pages. Every "if the user does X, do Y" belongs in the huddle, not the playbook.`;
    } else if (overBy > 50) {
      advice = `You are ${overBy} plays over the playbook limit (${timesOver}×). Ask every paragraph: "Does this only matter after a possession?" If yes — move it to the huddle.`;
    } else {
      advice = `Just ${overBy} plays over. Tighten the sets and move post-possession guidance into the huddle call.`;
    }

    return [
      chalk.bold('H1 · Playbook Budget · ') + chalk.red('FAIL'),
      `Your playbook is ${raw.lineCount} plays. The limit is ${raw.maxLines}.`,
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
      chalk.bold('H2 · Huddle Coverage · ') +
        (uncovered.length > 0 ? chalk.red('FAIL') : chalk.yellow('PARTIAL')),
    ];

    if (uncovered.length > 0) {
      const names = uncovered.map((t) => t.name).join(', ');
      lines.push(
        `${uncovered.length} player(s) have zero huddle calls. They are not talking: ${names}`,
      );
      lines.push(
        chalk.cyan('→ ') +
          `Add talking-cli-fixtures for [${names}]. One error scenario, one empty/zero-result scenario. Make them return a "hints" field.`,
      );
    }

    if (partial.length > 0) {
      const names = partial.map((t) => t.name).join(', ');
      lines.push(`${partial.length} player(s) are half-covered: ${names}`);
      lines.push(
        chalk.cyan('→ ') +
          `Check which scenario is missing (error vs empty-result) and add the missing fixture.`,
      );
    }

    if (passing.length > 0) {
      lines.push(`${passing.length} player(s) are calling out screens. Good hustle.`);
    }

    return lines.join('\n');
  },

  renderH3(h3: HeuristicResult): string {
    const raw = h3.raw as { withHints: number; passed: number; total: number };
    return [
      chalk.bold('H3 · Huddle Calls · ') + chalk.red(h3.verdict),
      `${raw.withHints}/${raw.passed} passed fixtures contain huddle calls (hints, suggestions, guidance, next_steps, recommendations).`,
      chalk.cyan('→ ') +
        'Make your players call out the defense. Return a "hints" or "suggestions" field.',
    ].join('\n');
  },

  renderH4(h4: HeuristicResult): string {
    const raw = h4.raw as { actionable: number; passed: number; total: number };
    return [
      chalk.bold('H4 · Actionable Huddles · ') + chalk.red(h4.verdict),
      `${raw.actionable}/${raw.passed} huddle calls have actionable content (string ≥ 10 chars or non-empty array).`,
      chalk.cyan('→ ') +
        'A huddle call should be specific. "Try again" is lazy. "Try broadening your query with fewer filters" is coaching.',
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
    const lines: string[] = [chalk.bold('M1 · Playbook Purity · ') + chalk.red('FAIL')];

    for (const t of failed) {
      const patterns = t.matchedPatterns.join(', ');
      lines.push(`  ${t.name}: scouting report contains game strategy [${patterns}]`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'The scouting report (description) says what the play does. The huddle (response) says when and how to run it. Keep strategy out of the report.',
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
    const lines: string[] = [chalk.bold('M2 · Player Tags · ') + chalk.red(m2.verdict)];

    for (const t of failed) {
      const missing: string[] = [];
      if (!t.hasReadOnly) missing.push('readOnly');
      if (!t.hasIdempotent) missing.push('idempotent');
      if (!t.hasDestructive) missing.push('destructive');
      lines.push(`  ${t.name}: missing ${missing.join(', ')} tag`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'Every player needs three tags on their jersey. Without them the ref does not know if a play is safe to run.',
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
    const lines: string[] = [chalk.bold('M3 · In-Game Coaching · ') + chalk.red(m3.verdict)];

    for (const s of failed) {
      const reason = s.responseLength < 20 ? 'player stood silent' : 'no coaching in the huddle';
      lines.push(`  ${s.toolName} (${s.scenarioType}): ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        'When the play breaks down, the coach must call the next play. A silent timeout kills the possession.',
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
    const lines: string[] = [chalk.bold('M4 · Timeout Speech · ') + chalk.red(m4.verdict)];

    for (const e of failed) {
      const reason = e.isStackTrace
        ? 'reading the rulebook instead of coaching'
        : e.isHttpDump
          ? 'reciting box scores'
          : 'no actionable advice';
      lines.push(`  ${e.toolName}: ${reason}`);
    }

    lines.push(
      chalk.cyan('→ ') +
        "When a player fouls out, tell them how to adjust. Don't just hand them the referee report.",
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
