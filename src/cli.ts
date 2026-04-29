#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
    const persona = getPersona(personaKey as 'default' | undefined);
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
    noSpawn?: boolean;
    command?: string[];
    staticDir?: string;
  },
): Promise<void> {
  const engineOutput = await runMcpEngine(serverDir, {
    deep: options.deep && !options.noSpawn,
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
    const persona = getPersona(personaKey as 'default' | undefined);
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

function generateSkillMd(skillName: string): string {
  const title = skillName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `# ${title} — Agent Skill Definition

## What This Tool Does

${title} provides [describe core functionality here].
It [describe what the agent should know about this tool].

## Commands

### \`search --query <term>\`
Searches for [resource]. Returns matching results with hints.

### \`list\`
Lists available [resources]. Returns a summary with guidance.

## Error Handling

When a command encounters issues, the response includes a \`hints\` array
with specific recovery steps:

- **No results found** → hints suggest broadening the query or trying
  alternative terms
- **Invalid input** → hints describe the expected format and provide
  an example
- **Permission denied** → hints explain what access level is needed

Example error response:
\`\`\`json
{
  "error": "No results for 'xyz'",
  "hints": ["Try broadening your query with fewer filters",
            "Use 'list' to see available categories"]
}
\`\`\`

## Integration

\`\`\`bash
# CLI usage
${skillName} search --query "example"

# In agent workflows, always check the hints field:
# response.hints → array of actionable next-step suggestions
\`\`\`

## Scoring

| Score | Verdict |
|-------|---------|
| ≥80   | PASS — ship it |
| 50–79 | PARTIAL — fix before release |
| <50   | FAIL — needs significant work |
`;
}

export function runInit(skillName: string, options: { dir?: string }): void {
  const baseDir = options.dir ?? skillName;

  if (existsSync(baseDir)) {
    console.error(`Directory already exists: ${baseDir}`);
    process.exit(1);
  }

  mkdirSync(baseDir, { recursive: true });

  writeFileSync(resolve(baseDir, 'SKILL.md'), generateSkillMd(skillName), 'utf-8');

  const fixturesDir = resolve(baseDir, 'talking-cli-fixtures');
  mkdirSync(fixturesDir, { recursive: true });

  const errorFixture = {
    tool: 'search',
    scenario: 'error',
    command: [
      'echo',
      '{"error":"search failed","hints":["Try broadening your query with fewer filters"]}',
    ],
    assert: { output_has_field: 'hints' },
  };
  writeFileSync(
    resolve(fixturesDir, 'search-error.fixture.json'),
    JSON.stringify(errorFixture, null, 2),
  );

  const emptyFixture = {
    tool: 'search',
    scenario: 'empty',
    command: ['echo', '{"results":[],"hints":["No results found. Try removing some filters"]}'],
    assert: { output_has_field: 'hints' },
  };
  writeFileSync(
    resolve(fixturesDir, 'search-empty.fixture.json'),
    JSON.stringify(emptyFixture, null, 2),
  );

  console.log(`Created skill directory: ${baseDir}/`);
}

const program = new Command();

program
  .name('talking-cli')
  .description('A linter that audits agent skills: is your CLI mute?')
  .version(`0.2.0 (ruleset ${HEURISTIC_VERSION})`);

program
  .command('audit <skill-dir>')
  .description('Audit a skill directory')
  .option('--ci', 'machine-readable CI mode')
  .option('--json', 'JSON output')
  .option('--persona <name>', 'coach persona: default')
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
  .option('--no-spawn', 'force static-only analysis (M1/M2), never spawn a server')
  .option(
    '--command <parts...>',
    'override server launch command (e.g. --command npx --command -y --command @modelcontextprotocol/server-memory)',
  )
  .option(
    '--static-dir <dir>',
    'directory for static analysis (M1/M2) when it differs from the server spawn directory',
  )
  .option('--persona <name>', 'coach persona: default')
  .action(
    async (
      serverDir: string,
      options: {
        ci?: boolean;
        json?: boolean;
        persona?: string;
        deep?: boolean;
        noSpawn?: boolean;
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
  .command('init <skill-name>')
  .description('Scaffold a new skill directory')
  .option('--dir <path>', 'output directory (default: <skill-name>)')
  .action((skillName: string, options: { dir?: string }) => {
    runInit(skillName, options);
  });

program
  .command('optimize <skill-dir>')
  .description('Generate optimization plan')
  .option('--apply', 'auto-apply fixes via git branch + per-fix commits')
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
