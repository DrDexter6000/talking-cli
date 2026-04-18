import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runEngine } from './engine.js';
import type { DiscoveryResult } from './types.js';

function createSkillDir(opts: {
  skillLines?: number;
  tools?: string[];
  fixtures?: Array<{ tool: string; scenario: string }>;
}): { discovery: DiscoveryResult; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-engine-'));

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

  const toolEntries = tools.map((name) => {
    writeFileSync(
      join(dir, 'tools', `${name}.js`),
      `console.log(JSON.stringify({ hints: ['hint'] }));`,
    );
    return { name, ext: '.js', path: join(dir, 'tools', `${name}.js`) };
  });

  const fixtureEntries = fixtures.map((f) => {
    const name = `${f.tool}.${f.scenario}.fixture.json`;
    const fixture = {
      tool: f.tool,
      scenario: f.scenario,
      command: ['node', join(dir, 'tools', `${f.tool}.js`)],
      assert: { output_has_field: 'hints' },
    };
    writeFileSync(join(dir, 'talking-cli-fixtures', name), JSON.stringify(fixture));
    return {
      name,
      tool: f.tool,
      scenario: f.scenario,
      path: join(dir, 'talking-cli-fixtures', name),
      fixture,
    };
  });

  const discovery: DiscoveryResult = {
    skillMdPath: join(dir, 'SKILL.md'),
    tools: toolEntries,
    fixtures: fixtureEntries,
  };

  return {
    discovery,
    cleanup: () => rmSync(dir, { recursive: true }),
  };
}

describe('runEngine', () => {
  it('returns totalScore 100 when all pass', async () => {
    const { discovery, cleanup } = createSkillDir({
      skillLines: 100,
      tools: ['search'],
      fixtures: [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty' },
      ],
    });
    try {
      const result = await runEngine(discovery);
      expect(result.totalScore).toBe(100);
      expect(result.h1.verdict).toBe('PASS');
      expect(result.h2.verdict).toBe('PASS');
      expect(result.skillLineCount).toBe(100);
    } finally {
      cleanup();
    }
  });

  it('returns totalScore 25 when H1 FAIL + H2 PARTIAL', async () => {
    const { discovery, cleanup } = createSkillDir({
      skillLines: 200,
      tools: ['search'],
      fixtures: [{ tool: 'search', scenario: 'error' }],
    });
    try {
      const result = await runEngine(discovery);
      expect(result.totalScore).toBe(25);
      expect(result.h1.verdict).toBe('FAIL');
      expect(result.h2.verdict).toBe('PARTIAL');
    } finally {
      cleanup();
    }
  });

  it('returns totalScore 100 when H1 PASS + H2 NOT_APPLICABLE', async () => {
    const { discovery, cleanup } = createSkillDir({
      skillLines: 100,
      tools: [],
      fixtures: [],
    });
    try {
      const result = await runEngine(discovery);
      expect(result.totalScore).toBe(100);
      expect(result.h1.verdict).toBe('PASS');
      expect(result.h2.verdict).toBe('NOT_APPLICABLE');
    } finally {
      cleanup();
    }
  });

  it('output shape matches EngineOutput', async () => {
    const { discovery, cleanup } = createSkillDir({
      skillLines: 50,
      tools: ['search'],
      fixtures: [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty' },
      ],
    });
    try {
      const result = await runEngine(discovery);
      expect(result).toHaveProperty('skillDir');
      expect(result).toHaveProperty('skillLineCount');
      expect(result).toHaveProperty('h1');
      expect(result).toHaveProperty('h2');
      expect(result).toHaveProperty('totalScore');
      expect(typeof result.totalScore).toBe('number');
    } finally {
      cleanup();
    }
  });
});
