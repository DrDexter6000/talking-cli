import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runAudit, runOptimize } from './cli.js';
import { DiscoveryError } from './discovery.js';

function createSkillDir(opts: {
  skillLines?: number;
  tools?: string[];
  fixtures?: Array<{ tool: string; scenario: string }>;
}): string {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-cli-'));

  const skillLines = opts.skillLines ?? 100;
  const skillContent = Array.from({ length: skillLines }, (_, i) => `Line ${i}`).join('\n');
  writeFileSync(join(dir, 'SKILL.md'), skillContent);

  const tools = opts.tools ?? [];
  const fixtures = opts.fixtures ?? [];

  if (tools.length > 0) {
    mkdirSync(join(dir, 'tools'));
  }
  if (fixtures.length > 0) {
    mkdirSync(join(dir, 'talking-cli-fixtures'));
  }

  for (const name of tools) {
    writeFileSync(
      join(dir, 'tools', `${name}.js`),
      `console.log(JSON.stringify({ hints: ['hint'] }));`,
    );
  }

  for (const f of fixtures) {
    const name = `${f.tool}.${f.scenario}.fixture.json`;
    const fixture = {
      tool: f.tool,
      scenario: f.scenario,
      command: ['node', join(dir, 'tools', `${f.tool}.js`)],
      assert: { output_has_field: 'hints' },
    };
    writeFileSync(join(dir, 'talking-cli-fixtures', name), JSON.stringify(fixture));
  }

  return dir;
}

describe('runAudit', () => {
  it('outputs coach report by default', async () => {
    const dir = createSkillDir({
      skillLines: 100,
      tools: ['search'],
      fixtures: [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty' },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runAudit(dir, {});
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('100/100');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('outputs JSON with --json', async () => {
    const dir = createSkillDir({ skillLines: 100 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runAudit(dir, { json: true });
      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.totalScore).toBe(100);
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('outputs CI text with --ci', async () => {
    const dir = createSkillDir({ skillLines: 200 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runAudit(dir, { ci: true });
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('FAIL');
      expect(output).not.toContain('\x1b[');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('throws DiscoveryError for missing SKILL.md', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-cli-'));
    try {
      await expect(runAudit(dir, {})).rejects.toThrow(DiscoveryError);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('uses --persona nba-coach for custom voice', async () => {
    const dir = createSkillDir({
      skillLines: 200,
      tools: ['search'],
      fixtures: [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty' },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runAudit(dir, { persona: 'nba-coach' });
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('playbook');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('rejects invalid --persona with error', async () => {
    const dir = createSkillDir({ skillLines: 100 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    try {
      await runAudit(dir, { persona: 'invalid-persona' });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown persona'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });
});

describe('runOptimize', () => {
  it('writes plan file', async () => {
    const dir = createSkillDir({ skillLines: 200 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runOptimize(dir, {});
      const planPath = join(dir, 'TALKING-CLI-OPTIMIZATION.md');
      expect(existsSync(planPath)).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Optimization plan written to'));
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('rejects with ApplyError for --apply outside git repo', async () => {
    const dir = createSkillDir({ skillLines: 100 });
    try {
      await expect(runOptimize(dir, { apply: true })).rejects.toThrow('Not a git repository');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
