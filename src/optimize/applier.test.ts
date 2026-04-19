import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EngineOutput } from '../types.js';
import { ApplyError, runApply } from './applier.js';

function makeEngineOutput(overrides: Partial<EngineOutput> = {}): EngineOutput {
  return {
    skillDir: '/tmp/skill',
    skillLineCount: 100,
    h1: { verdict: 'PASS', score: 100, raw: { lineCount: 100, maxLines: 150 } },
    h2: { verdict: 'PASS', score: 100, raw: { tools: [] } },
    h3: { verdict: 'PASS', score: 100, raw: { withHints: 0, passed: 0, total: 0 } },
    h4: { verdict: 'PASS', score: 100, raw: { actionable: 0, passed: 0, total: 0 } },
    totalScore: 100,
    hasCustomTools: true,
    ...overrides,
  };
}

function createGitSkillDir(opts: { dirty?: boolean }): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-apply-'));

  execSync('git init', { cwd: dir });
  execSync('git config user.email "test@test.com"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });

  // Create minimal skill structure
  const skillContent = Array.from({ length: 10 }, (_, i) => `Line ${i}`).join('\n');
  writeFileSync(join(dir, 'SKILL.md'), skillContent);
  mkdirSync(join(dir, 'tools'));
  writeFileSync(join(dir, 'tools', 'search.js'), 'console.log(JSON.stringify({hints:["ok"]}));');

  execSync('git add -A', { cwd: dir });
  execSync('git commit -m "init"', { cwd: dir });

  if (opts.dirty) {
    writeFileSync(join(dir, 'dirty.txt'), 'dirty');
  }

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true }),
  };
}

describe('runApply', () => {
  it('rejects when not in a git repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-apply-'));
    try {
      const output = makeEngineOutput();
      await expect(runApply(dir, output)).rejects.toThrow(ApplyError);
      await expect(runApply(dir, output)).rejects.toThrow('Not a git repository');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('rejects when working tree is dirty', async () => {
    const { dir, cleanup } = createGitSkillDir({ dirty: true });
    try {
      const output = makeEngineOutput();
      await expect(runApply(dir, output)).rejects.toThrow(ApplyError);
      await expect(runApply(dir, output)).rejects.toThrow('Working tree is dirty');
    } finally {
      cleanup();
    }
  });

  it('creates branch and fixture templates for H2 FAIL tools', async () => {
    const { dir, cleanup } = createGitSkillDir({});
    try {
      const output = makeEngineOutput({
        h2: {
          verdict: 'FAIL',
          score: 0,
          raw: { tools: [{ name: 'search', verdict: 'FAIL' }] },
        },
      });

      await runApply(dir, output);

      // Verify branch exists
      const branches = execSync('git branch', { cwd: dir, encoding: 'utf-8' });
      expect(branches).toContain('talking-cli/optimize-');

      // Extract branch name
      const match = branches.match(/talking-cli\/optimize-\d+/);
      expect(match).toBeTruthy();
      const branchName = match?.[0];

      // Verify we are back on original branch (not the optimize branch)
      const currentBranch = execSync('git branch --show-current', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
      expect(currentBranch).not.toBe(branchName);

      // Verify fixture files on the optimization branch
      execSync(`git checkout ${branchName}`, { cwd: dir });

      expect(existsSync(join(dir, 'talking-cli-fixtures', 'search.error.fixture.json'))).toBe(true);
      expect(
        existsSync(join(dir, 'talking-cli-fixtures', 'search.empty-result.fixture.json')),
      ).toBe(true);

      // Verify commits
      const log = execSync('git log --oneline', { cwd: dir, encoding: 'utf-8' });
      expect(log).toContain('[H2] Add fixture templates for search');
      expect(log).toContain('[PLAN] Write optimization plan');
    } finally {
      cleanup();
    }
  });
});
