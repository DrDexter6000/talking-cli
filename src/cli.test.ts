import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runAudit, runInit, runMcpAudit, runOptimize } from './cli.js';
import { DiscoveryError } from './discovery.js';
import { McpDiscoveryError } from './mcp/discovery.js';

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
      `console.log(JSON.stringify({ hints: ['Review the available options'] }));`,
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

function createMcpServerDir(opts: {
  tools?: Array<{ name: string; description: string; annotations?: Record<string, boolean> }>;
}): string {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-'));
  const pkg = { name: 'test-server', main: 'index.js' };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));

  const tools = opts.tools ?? [];
  const registrations: string[] = [];

  for (const t of tools) {
    const annotationStr = t.annotations
      ? `, annotations: { readOnlyHint: ${t.annotations.readOnlyHint ?? false}, idempotentHint: ${t.annotations.idempotentHint ?? false}, destructiveHint: ${t.annotations.destructiveHint ?? false} }`
      : '';
    registrations.push(
      `server.registerTool("${t.name}", { description: "${t.description}"${annotationStr} });`,
    );
  }

  writeFileSync(join(dir, 'index.js'), `const server = {};\n${registrations.join('\n')}\n`);

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

  it('uses --persona emotional-damage-dad for custom voice', async () => {
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
      await runAudit(dir, { persona: 'emotional-damage-dad' });
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('Your Essay Too Long');
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

describe('runMcpAudit', () => {
  it('outputs coach report by default', async () => {
    const dir = createMcpServerDir({
      tools: [
        {
          name: 'search',
          description: 'Search for files',
          annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runMcpAudit(dir, {});
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('100/100');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('outputs JSON with --json', async () => {
    const dir = createMcpServerDir({
      tools: [
        {
          name: 'read',
          description: 'Read a file',
          annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runMcpAudit(dir, { json: true });
      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.totalScore).toBe(100);
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('outputs CI text with --ci', async () => {
    const dir = createMcpServerDir({
      tools: [
        {
          name: 'bloat',
          description:
            'This is a very long description that exceeds the five hundred character limit for sure because it just keeps going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going',
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runMcpAudit(dir, { ci: true });
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('FAIL');
      expect(output).not.toContain('\x1b[');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('uses --persona emotional-damage-dad for custom voice', async () => {
    const strategyDesc = 'Use this tool when you need to search files. First, check permissions.';
    const dir = createMcpServerDir({
      tools: [
        {
          name: 'bloat',
          description: strategyDesc,
          annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runMcpAudit(dir, { persona: 'emotional-damage-dad' });
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('Essay Purity');
    } finally {
      logSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('rejects invalid --persona with error', async () => {
    const dir = createMcpServerDir({
      tools: [{ name: 'read', description: 'Read a file' }],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    try {
      await runMcpAudit(dir, { persona: 'invalid-persona' });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown persona'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('throws McpDiscoveryError for missing package.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-mcp-'));
    try {
      await expect(runMcpAudit(dir, {})).rejects.toThrow(McpDiscoveryError);
    } finally {
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

describe('runInit', () => {
  it('creates skill directory with SKILL.md and fixtures', () => {
    const tmpBase = mkdtempSync(join(tmpdir(), 'talking-cli-init-'));
    const skillDir = join(tmpBase, 'my-test-skill');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      runInit('my-test-skill', { dir: skillDir });

      expect(existsSync(skillDir)).toBe(true);
      expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(join(skillDir, 'talking-cli-fixtures'))).toBe(true);
      expect(existsSync(join(skillDir, 'talking-cli-fixtures', 'search-error.fixture.json'))).toBe(
        true,
      );
      expect(existsSync(join(skillDir, 'talking-cli-fixtures', 'search-empty.fixture.json'))).toBe(
        true,
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Created skill directory'));
    } finally {
      logSpy.mockRestore();
      rmSync(tmpBase, { recursive: true });
    }
  });

  it('generates SKILL.md under 150 lines', () => {
    const tmpBase = mkdtempSync(join(tmpdir(), 'talking-cli-init-'));
    const skillDir = join(tmpBase, 'my-skill');
    try {
      runInit('my-skill', { dir: skillDir });

      const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8');
      const lineCount = content.split('\n').length;
      expect(lineCount).toBeLessThan(150);
    } finally {
      rmSync(tmpBase, { recursive: true });
    }
  });

  it('includes skill name in SKILL.md title', () => {
    const tmpBase = mkdtempSync(join(tmpdir(), 'talking-cli-init-'));
    const skillDir = join(tmpBase, 'cool-search');
    try {
      runInit('cool-search', { dir: skillDir });

      const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Cool Search');
    } finally {
      rmSync(tmpBase, { recursive: true });
    }
  });

  it('generates valid fixture files', () => {
    const tmpBase = mkdtempSync(join(tmpdir(), 'talking-cli-init-'));
    const skillDir = join(tmpBase, 'fixture-test');
    try {
      runInit('fixture-test', { dir: skillDir });

      const errorFixture = JSON.parse(
        readFileSync(join(skillDir, 'talking-cli-fixtures', 'search-error.fixture.json'), 'utf-8'),
      );
      expect(errorFixture.tool).toBe('search');
      expect(errorFixture.scenario).toBe('error');
      expect(errorFixture.assert.output_has_field).toBe('hints');

      const emptyFixture = JSON.parse(
        readFileSync(join(skillDir, 'talking-cli-fixtures', 'search-empty.fixture.json'), 'utf-8'),
      );
      expect(emptyFixture.tool).toBe('search');
      expect(emptyFixture.scenario).toBe('empty');
      expect(emptyFixture.assert.output_has_field).toBe('hints');
    } finally {
      rmSync(tmpBase, { recursive: true });
    }
  });

  it('rejects if directory already exists', () => {
    const tmpBase = mkdtempSync(join(tmpdir(), 'talking-cli-init-'));
    const skillDir = join(tmpBase, 'existing-skill');
    mkdirSync(skillDir, { recursive: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    try {
      runInit('existing-skill', { dir: skillDir });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(tmpBase, { recursive: true });
    }
  });
});
