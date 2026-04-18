import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiscoveryResult, Fixture } from '../types.js';
import { evaluateH2 } from './h2.js';

function createMockDiscovery(
  tools: { name: string }[],
  fixtures: Array<{ tool: string; scenario: string; command?: string[] }>,
): { discovery: DiscoveryResult; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h2-'));

  writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
  mkdirSync(join(dir, 'tools'));
  mkdirSync(join(dir, 'talking-cli-fixtures'));

  for (const tool of tools) {
    writeFileSync(
      join(dir, 'tools', `${tool.name}.js`),
      `console.log(JSON.stringify({ hints: ['hint1'] }));`,
    );
  }

  const fullFixtures = fixtures.map((f) => {
    const name = `${f.tool}.${f.scenario}.fixture.json`;
    const fixture: Fixture = {
      tool: f.tool,
      scenario: f.scenario,
      command: f.command ?? ['node', join(dir, 'tools', `${f.tool}.js`)],
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
    tools: tools.map((t) => ({
      name: t.name,
      ext: '.js',
      path: join(dir, 'tools', `${t.name}.js`),
    })),
    fixtures: fullFixtures,
  };

  return {
    discovery,
    cleanup: () => rmSync(dir, { recursive: true }),
  };
}

describe('evaluateH2', () => {
  it('PASS when all required scenarios pass', async () => {
    const { discovery, cleanup } = createMockDiscovery(
      [{ name: 'search' }],
      [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty-result' },
      ],
    );
    try {
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('PASS');
      expect(result.score).toBe(100);
    } finally {
      cleanup();
    }
  });

  it('PARTIAL when only error fixture exists', async () => {
    const { discovery, cleanup } = createMockDiscovery(
      [{ name: 'search' }],
      [{ tool: 'search', scenario: 'error' }],
    );
    try {
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('PARTIAL');
      expect(result.score).toBe(50);
    } finally {
      cleanup();
    }
  });

  it('FAIL when no fixtures for a tool', async () => {
    const { discovery, cleanup } = createMockDiscovery([{ name: 'search' }], []);
    try {
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('averages scores across multiple tools', async () => {
    const { discovery, cleanup } = createMockDiscovery(
      [{ name: 'search' }, { name: 'write' }],
      [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'empty' },
        // write has no fixtures → FAIL
      ],
    );
    try {
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(50); // (100 + 0) / 2
    } finally {
      cleanup();
    }
  });

  it('NOT_APPLICABLE when no tools exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h2-'));
    writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
    try {
      const discovery: DiscoveryResult = {
        skillMdPath: join(dir, 'SKILL.md'),
        tools: [],
        fixtures: [],
      };
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('NOT_APPLICABLE');
      expect(result.score).toBe(100);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('recognizes zero-result scenario variants', async () => {
    const { discovery, cleanup } = createMockDiscovery(
      [{ name: 'search' }],
      [
        { tool: 'search', scenario: 'error' },
        { tool: 'search', scenario: 'zero-hits' },
      ],
    );
    try {
      const result = await evaluateH2(discovery);
      expect(result.verdict).toBe('PASS');
    } finally {
      cleanup();
    }
  });
});
