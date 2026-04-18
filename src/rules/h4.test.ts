import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiscoveryResult, Fixture } from '../types.js';
import { evaluateH4 } from './h4.js';

function createDiscovery(
  fixtures: Array<{
    tool: string;
    scenario: string;
    json: unknown;
    assertField: string;
  }>,
): { discovery: DiscoveryResult; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h4-'));
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

describe('evaluateH4', () => {
  it('PASS when all hint contents are actionable', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Try broadening your query.' },
        assertField: 'hints',
      },
      {
        tool: 'search',
        scenario: 'empty',
        json: { suggestions: ['Step one', 'Step two'] },
        assertField: 'suggestions',
      },
    ]);
    try {
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('PASS');
      expect(result.score).toBe(100);
    } finally {
      cleanup();
    }
  });

  it('FAIL when hint string is empty', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: '' },
        assertField: 'hints',
      },
    ]);
    try {
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('FAIL when hint string is too short', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'ok' },
        assertField: 'hints',
      },
    ]);
    try {
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('PASS when hint is a non-empty array', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { guidance: ['Retry with filters', 'Check spelling'] },
        assertField: 'guidance',
      },
    ]);
    try {
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('PASS');
      expect(result.score).toBe(100);
    } finally {
      cleanup();
    }
  });

  it('FAIL when hint array is empty', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: [] },
        assertField: 'hints',
      },
    ]);
    try {
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('FAIL when zero fixtures', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-h4-'));
    writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
    try {
      const discovery: DiscoveryResult = {
        skillMdPath: join(dir, 'SKILL.md'),
        tools: [{ name: 'search', ext: '.js', path: join(dir, 'tools', 'search.js') }],
        fixtures: [],
      };
      const result = await evaluateH4(discovery);
      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
