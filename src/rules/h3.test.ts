import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiscoveryResult, Fixture } from '../types.js';
import { evaluateH3 } from './h3.js';

function createDiscovery(
  fixtures: Array<{
    tool: string;
    scenario: string;
    json: unknown;
    assertField: string;
  }>,
): { discovery: DiscoveryResult; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h3-'));
  writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
  mkdirSync(join(dir, 'tools'));
  mkdirSync(join(dir, 'talking-cli-fixtures'));

  const toolNames = [...new Set(fixtures.map((f) => f.tool))];
  for (const name of toolNames) {
    writeFileSync(join(dir, 'tools', `${name}.js`), '');
  }

  const fullFixtures = fixtures.map((f) => {
    const name = `${f.tool}.${f.scenario}.fixture.json`;
    const fixture: Fixture = {
      tool: f.tool,
      scenario: f.scenario,
      command: ['node', '-e', `console.log(JSON.stringify(${JSON.stringify(f.json)}))`],
      assert: { output_has_field: f.assertField },
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
    tools: toolNames.map((name) => ({
      name,
      ext: '.js',
      path: join(dir, 'tools', `${name}.js`),
    })),
    fixtures: fullFixtures,
  };

  return {
    discovery,
    cleanup: () => rmSync(dir, { recursive: true }),
  };
}

describe('evaluateH3', () => {
  it('PASS when all fixtures have hint fields', async () => {
    const { discovery, cleanup } = createDiscovery([
      { tool: 'search', scenario: 'error', json: { hints: 'try again' }, assertField: 'hints' },
      {
        tool: 'search',
        scenario: 'empty',
        json: { suggestions: ['broaden'] },
        assertField: 'suggestions',
      },
    ]);
    try {
      const result = await evaluateH3(discovery);
      expect(result.verdict).toBe('PASS');
      expect(result.score).toBe(100);
    } finally {
      cleanup();
    }
  });

  it('PARTIAL when some fixtures have hint fields', async () => {
    const { discovery, cleanup } = createDiscovery([
      { tool: 'search', scenario: 'error', json: { hints: 'try again' }, assertField: 'hints' },
      { tool: 'search', scenario: 'empty', json: { data: 123 }, assertField: 'data' },
    ]);
    try {
      const result = await evaluateH3(discovery);
      expect(result.verdict).toBe('PARTIAL');
      expect(result.score).toBe(50);
    } finally {
      cleanup();
    }
  });

  it('FAIL when no fixtures have hint fields', async () => {
    const { discovery, cleanup } = createDiscovery([
      { tool: 'search', scenario: 'error', json: { data: 123 }, assertField: 'data' },
      { tool: 'search', scenario: 'empty', json: { results: [] }, assertField: 'results' },
    ]);
    try {
      const result = await evaluateH3(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('FAIL when zero fixtures', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h3-'));
    writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
    try {
      const discovery: DiscoveryResult = {
        skillMdPath: join(dir, 'SKILL.md'),
        tools: [{ name: 'search', ext: '.js', path: join(dir, 'tools', 'search.js') }],
        fixtures: [],
      };
      const result = await evaluateH3(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('FAIL when all fixtures are broken', async () => {
    const { discovery, cleanup } = createDiscovery([
      { tool: 'search', scenario: 'error', json: { hints: 'x' }, assertField: 'hints' },
    ]);
    // Override command to produce invalid JSON
    discovery.fixtures[0].fixture.command = ['node', '-e', 'console.log("not json")'];
    try {
      const result = await evaluateH3(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });
});
