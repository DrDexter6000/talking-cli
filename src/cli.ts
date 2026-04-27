#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { discoverFixtures, discoverSkillMd, discoverTools } from './discovery.js';
import { runEngine } from './engine.js';
import { runMcpEngine } from './mcp/engine.js';
import { getMcpExitCode, renderMcpCI } from './mcp/renderers/ci.js';
import { renderMcpCoach } from './mcp/renderers/coach.js';
import { renderMcpJSON } from './mcp/renderers/json.js';
import { runApply } from './optimize/applier.js';
import { generatePlan } from './optimize/plan-generator.js';
import { getPersona, isValidPersona, PERSONA_KEYS } from './personas/index.js';
import { getExitCode, renderCI } from './renderers/ci.js';
import { renderCoach } from './renderers/coach.js';
import { renderJSON } from './renderers/json.js';
import { HEURISTIC_VERSION } from './rules/VERSION.js';

export async function runAudit(
  skillDir: string,
  options: { ci?: boolean; json?: boolean; persona?: string },
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
    const personaKey = options.persona;
    if (personaKey && !isValidPersona(personaKey)) {
      console.error(`Unknown persona: "${personaKey}". Available: ${PERSONA_KEYS.join(', ')}`);
      process.exit(1);
    }
    const persona = getPersona(personaKey as 'default' | 'emotional-damage-dad' | undefined);
    console.log(renderCoach(engineOutput, persona));
  }
}

export async function runMcpAudit(
  serverDir: string,
  options: {
    ci?: boolean;
    json?: boolean;
    persona?: string;
    deep?: boolean;
    command?: string[];
    staticDir?: string;
  },
): Promise<void> {
  const engineOutput = await runMcpEngine(serverDir, {
    deep: options.deep,
    command: options.command,
    staticDir: options.staticDir,
  });

  if (options.json) {
    console.log(renderMcpJSON(engineOutput));
  } else if (options.ci) {
    console.log(renderMcpCI(engineOutput));
    process.exitCode = getMcpExitCode(engineOutput);
  } else {
    const personaKey = options.persona;
    if (personaKey && !isValidPersona(personaKey)) {
      console.error(`Unknown persona: "${personaKey}". Available: ${PERSONA_KEYS.join(', ')}`);
      process.exit(1);
    }
    const persona = getPersona(personaKey as 'default' | 'emotional-damage-dad' | undefined);
    console.log(renderMcpCoach(engineOutput, persona));
  }
}

export async function runOptimize(skillDir: string, options: { apply?: boolean }): Promise<void> {
  const skillMdPath = discoverSkillMd(skillDir);
  const tools = discoverTools(skillDir);
  const fixtures = discoverFixtures(skillDir);

  const engineOutput = await runEngine({
    skillMdPath,
    tools,
    fixtures,
  });

  if (options.apply) {
    await runApply(skillDir, engineOutput);
    return;
  }

  const plan = generatePlan(engineOutput);
  const planPath = resolve(skillDir, 'TALKING-CLI-OPTIMIZATION.md');
  writeFileSync(planPath, plan, 'utf-8');
  console.log(`Optimization plan written to: ${planPath}`);
}

const program = new Command();

program
  .name('talking-cli')
  .description('A linter that audits agent skills: is your CLI mute?')
  .version(`0.1.0 (ruleset ${HEURISTIC_VERSION})`);

program
  .command('audit <skill-dir>')
  .description('Audit a skill directory')
  .option('--ci', 'machine-readable CI mode')
  .option('--json', 'JSON output')
  .option('--persona <name>', 'coach persona: default, emotional-damage-dad')
  .action(async (skillDir: string, options: { ci?: boolean; json?: boolean; persona?: string }) => {
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
  .command('audit-mcp <server-dir>')
  .description('Audit an MCP server directory')
  .option('--ci', 'machine-readable CI mode')
  .option('--json', 'JSON output')
  .option('--deep', 'run runtime M3/M4 heuristics (spawns server)')
  .option(
    '--command <parts...>',
    'override server launch command (e.g. --command npx --command -y --command @modelcontextprotocol/server-memory)',
  )
  .option(
    '--static-dir <dir>',
    'directory for static analysis (M1/M2) when it differs from the server spawn directory',
  )
  .option('--persona <name>', 'coach persona: default, emotional-damage-dad')
  .action(
    async (
      serverDir: string,
      options: {
        ci?: boolean;
        json?: boolean;
        persona?: string;
        deep?: boolean;
        command?: string[];
        staticDir?: string;
      },
    ) => {
      try {
        await runMcpAudit(serverDir, options);
      } catch (err) {
        if (err instanceof Error && err.name === 'McpDiscoveryError') {
          console.error(err.message);
          process.exit(1);
        }
        throw err;
      }
    },
  );

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
