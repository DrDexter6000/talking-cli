#!/usr/bin/env node
import { Command } from 'commander';
import { discoverSkillMd, discoverTools, discoverFixtures } from './discovery.js';
import { runEngine } from './engine.js';
import { renderCoach } from './renderers/coach.js';
import { renderCI, getExitCode } from './renderers/ci.js';
import { renderJSON } from './renderers/json.js';
import { generatePlan } from './optimize/plan-generator.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function runAudit(
  skillDir: string,
  options: { ci?: boolean; json?: boolean }
): Promise<void> {
  const skillMdPath = discoverSkillMd(skillDir);
  const tools = discoverTools(skillDir);
  const fixtures = discoverFixtures(skillDir);

  const engineOutput = await runEngine({
    skillMdPath,
    tools,
    fixtures,
  });

  if (options.json) {
    console.log(renderJSON(engineOutput));
  } else if (options.ci) {
    console.log(renderCI(engineOutput));
    process.exitCode = getExitCode(engineOutput);
  } else {
    console.log(renderCoach(engineOutput));
  }
}

export async function runOptimize(
  skillDir: string,
  options: { apply?: boolean }
): Promise<void> {
  if (options.apply) {
    console.error('Error: --apply is not implemented in P1. Deferred to P3.');
    process.exit(1);
  }

  const skillMdPath = discoverSkillMd(skillDir);
  const tools = discoverTools(skillDir);
  const fixtures = discoverFixtures(skillDir);

  const engineOutput = await runEngine({
    skillMdPath,
    tools,
    fixtures,
  });

  const plan = generatePlan(engineOutput);
  const planPath = resolve(skillDir, 'TALKING-CLI-OPTIMIZATION.md');
  writeFileSync(planPath, plan, 'utf-8');
  console.log(`Optimization plan written to: ${planPath}`);
}

const program = new Command();

program
  .name('talking-cli')
  .description('A linter that audits agent skills: is your CLI mute?')
  .version('0.1.0');

program
  .command('audit <skill-dir>')
  .description('Audit a skill directory')
  .option('--ci', 'machine-readable CI mode')
  .option('--json', 'JSON output')
  .action(async (skillDir: string, options: { ci?: boolean; json?: boolean }) => {
    try {
      await runAudit(skillDir, options);
    } catch (err) {
      if (err instanceof Error && err.name === 'DiscoveryError') {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }
  });

program
  .command('optimize <skill-dir>')
  .description('Generate optimization plan')
  .option('--apply', 'apply fixes (deferred to P3)')
  .action(async (skillDir: string, options: { apply?: boolean }) => {
    try {
      await runOptimize(skillDir, options);
    } catch (err) {
      if (err instanceof Error && err.name === 'DiscoveryError') {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }
  });

const isMainModule =
  process.argv[1]?.includes('cli.js') ||
  process.argv[1]?.includes('cli.cjs') ||
  process.argv[1]?.includes('cli.ts');

if (isMainModule) {
  program.parse();
}
