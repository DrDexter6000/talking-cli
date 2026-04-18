import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EngineOutput } from '../types.js';
import { generatePlan } from './plan-generator.js';

export class ApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplyError';
  }
}

interface Fix {
  heuristic: string;
  description: string;
  files: string[];
}

function execGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApplyError(`Git command failed: git ${args.join(' ')} — ${message}`);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function applyH2Fixes(skillDir: string, engineOutput: EngineOutput, fixes: Fix[]): void {
  if (engineOutput.h2.verdict === 'PASS' || engineOutput.h2.verdict === 'NOT_APPLICABLE') {
    return;
  }

  const raw = engineOutput.h2.raw as {
    tools: Array<{ name: string; verdict: string }>;
  };
  const uncovered = raw.tools.filter((t) => t.verdict === 'FAIL');

  if (uncovered.length === 0) return;

  const fixturesDir = resolve(skillDir, 'talking-cli-fixtures');
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir);
  }

  for (const tool of uncovered) {
    const errorFixture = {
      tool: tool.name,
      scenario: 'error',
      command: ['node', `tools/${tool.name}.js`],
      assert: { output_has_field: 'hints' },
    };

    const emptyFixture = {
      tool: tool.name,
      scenario: 'empty-result',
      command: ['node', `tools/${tool.name}.js`],
      assert: { output_has_field: 'hints' },
    };

    const errorPath = resolve(fixturesDir, `${tool.name}.error.fixture.json`);
    const emptyPath = resolve(fixturesDir, `${tool.name}.empty-result.fixture.json`);

    writeFileSync(errorPath, `${JSON.stringify(errorFixture, null, 2)}\n`);
    writeFileSync(emptyPath, `${JSON.stringify(emptyFixture, null, 2)}\n`);

    fixes.push({
      heuristic: 'H2',
      description: `Add fixture templates for ${tool.name}`,
      files: [
        `talking-cli-fixtures/${tool.name}.error.fixture.json`,
        `talking-cli-fixtures/${tool.name}.empty-result.fixture.json`,
      ],
    });
  }
}

export async function runApply(skillDir: string, engineOutput: EngineOutput): Promise<void> {
  // 1. Ensure git repo
  try {
    execGit(skillDir, ['rev-parse', '--git-dir']);
  } catch {
    throw new ApplyError(
      'Not a git repository. --apply requires the skill directory to be inside a git repo.',
    );
  }

  // 2. Ensure clean working tree
  const status = execGit(skillDir, ['status', '--porcelain']);
  if (status.length > 0) {
    throw new ApplyError(
      'Working tree is dirty. Commit or stash your changes before running --apply.',
    );
  }

  // 3. Get current branch
  const originalBranch = execGit(skillDir, ['branch', '--show-current']);

  // 4. Create branch
  const branchName = `talking-cli/optimize-${formatDate(new Date())}`;
  execGit(skillDir, ['checkout', '-b', branchName]);

  const fixes: Fix[] = [];

  try {
    // 5. Apply H2 fixes
    applyH2Fixes(skillDir, engineOutput, fixes);

    // 6. Write plan
    const plan = generatePlan(engineOutput);
    const planPath = resolve(skillDir, 'TALKING-CLI-OPTIMIZATION.md');
    writeFileSync(planPath, plan, 'utf-8');
    fixes.push({
      heuristic: 'PLAN',
      description: 'Write optimization plan',
      files: ['TALKING-CLI-OPTIMIZATION.md'],
    });

    // 7. Commit each fix separately
    for (const fix of fixes) {
      for (const file of fix.files) {
        execGit(skillDir, ['add', file]);
      }
      execGit(skillDir, ['commit', '-m', `[${fix.heuristic}] ${fix.description}`]);
    }
  } catch (err) {
    // Rollback: checkout original branch, delete new branch
    execGit(skillDir, ['checkout', originalBranch]);
    execGit(skillDir, ['branch', '-D', branchName]);
    throw err;
  }

  // 8. Switch back to original branch
  execGit(skillDir, ['checkout', originalBranch]);

  console.log(`Optimization branch created: ${branchName}`);
  console.log(`Review: cd ${skillDir} && git diff ${originalBranch}..${branchName}`);
  console.log(`Merge:  cd ${skillDir} && git merge ${branchName}`);
}
