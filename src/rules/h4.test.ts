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
        json: { suggestions: ['Check available filters', 'Review your input'] },
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

  // --- Phase 1: generic phrases that must be REJECTED ---

  it('FAIL on generic "Try again later"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Try again later' },
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

  it('FAIL on generic "Something went wrong"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Something went wrong' },
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

  it('FAIL on generic "An error has occurred"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'An error has occurred' },
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

  it('FAIL on "Access denied" with no fix suggestion', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Access denied - path outside allowed directories' },
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

  it('FAIL on SDK boilerplate "Input validation error: required property"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: "Input validation error: 'repo_path' is a required property" },
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

  it('FAIL on generic "Error occurred while processing"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Error occurred while processing' },
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

  // --- Phase 1: specific guidance that must be ACCEPTED ---

  it('PASS on "Try broadening your query with fewer filters"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'empty',
        json: { hints: 'Try broadening your query with fewer filters' },
        assertField: 'hints',
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

  it('PASS on "Check the X field for valid values"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Check the X field for valid values' },
        assertField: 'hints',
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

  it('PASS on "Narrow the date range to include more results"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'empty',
        json: { hints: 'Narrow the date range to include more results' },
        assertField: 'hints',
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

  it('PASS on "Use list_allowed_directories to see valid paths"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Use list_allowed_directories to see valid paths' },
        assertField: 'hints',
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

  // --- Phase 1: edge cases ---

  it('PASS on hint with action verb prefix "Hint: check your input"', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { hints: 'Hint: check your input' },
        assertField: 'hints',
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

  it('PASS when array has mixed items with at least one actionable', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { suggestions: ['Something went wrong', 'Try using fewer filters'] },
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

  it('FAIL when array contains only generic non-actionable items', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'error',
        json: { suggestions: ['Something went wrong', 'Please try again'] },
        assertField: 'suggestions',
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

  it('PASS on "Broaden date range" (action verb + ≥10 chars)', async () => {
    const { discovery, cleanup } = createDiscovery([
      {
        tool: 'search',
        scenario: 'empty',
        json: { hints: 'Broaden date range' },
        assertField: 'hints',
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
});
