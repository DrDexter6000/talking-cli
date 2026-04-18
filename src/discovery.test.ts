import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryError, discoverFixtures, discoverSkillMd, discoverTools } from './discovery.js';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'talking-cli-test-'));
}

describe('discoverSkillMd', () => {
  it('returns absolute path when SKILL.md exists', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'SKILL.md'), '# Test\n');
      const result = discoverSkillMd(dir);
      expect(result).toBe(join(dir, 'SKILL.md'));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws DiscoveryError when SKILL.md is missing', () => {
    const dir = createTempDir();
    try {
      expect(() => discoverSkillMd(dir)).toThrow(DiscoveryError);
      expect(() => discoverSkillMd(dir)).toThrow('No SKILL.md found');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws DiscoveryError when SKILL.md is a directory', () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'SKILL.md'));
      expect(() => discoverSkillMd(dir)).toThrow(DiscoveryError);
      expect(() => discoverSkillMd(dir)).toThrow('Expected');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('is case-sensitive (skill.md != SKILL.md)', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'skill.md'), '# lowercase\n');
      expect(() => discoverSkillMd(dir)).toThrow(DiscoveryError);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('discoverTools', () => {
  it('returns tools with correct names and extensions', () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'tools'));
      writeFileSync(join(dir, 'tools', 'search.js'), '');
      writeFileSync(join(dir, 'tools', 'write.ts'), '');

      const tools = discoverTools(dir);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain('search');
      expect(tools.map((t) => t.name)).toContain('write');
      expect(tools.find((t) => t.name === 'search')?.ext).toBe('.js');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('ignores nested directories (non-recursive)', () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'tools'));
      mkdirSync(join(dir, 'tools', 'deep'));
      writeFileSync(join(dir, 'tools', 'deep', 'nested.js'), '');
      writeFileSync(join(dir, 'tools', 'top.js'), '');

      const tools = discoverTools(dir);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('top');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('returns empty array when tools/ is missing', () => {
    const dir = createTempDir();
    try {
      expect(discoverTools(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('discoverFixtures', () => {
  it('parses valid fixtures', () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'talking-cli-fixtures'));
      writeFileSync(
        join(dir, 'talking-cli-fixtures', 'search.error.fixture.json'),
        JSON.stringify({
          tool: 'search',
          scenario: 'error',
          command: ['node', 'tools/search.js'],
          assert: { output_has_field: 'hints' },
        }),
      );

      const fixtures = discoverFixtures(dir);
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].tool).toBe('search');
      expect(fixtures[0].scenario).toBe('error');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('skips malformed JSON with diagnostic', () => {
    const dir = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mkdirSync(join(dir, 'talking-cli-fixtures'));
      writeFileSync(join(dir, 'talking-cli-fixtures', 'bad.error.fixture.json'), 'not json');
      writeFileSync(
        join(dir, 'talking-cli-fixtures', 'good.error.fixture.json'),
        JSON.stringify({
          tool: 'good',
          scenario: 'error',
          command: ['a'],
          assert: { output_has_field: 'hints' },
        }),
      );

      const fixtures = discoverFixtures(dir);
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].tool).toBe('good');
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('skips invalid fixture schema with diagnostic', () => {
    const dir = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mkdirSync(join(dir, 'talking-cli-fixtures'));
      writeFileSync(
        join(dir, 'talking-cli-fixtures', 'bad.error.fixture.json'),
        JSON.stringify({ tool: 'bad', scenario: 'error' }), // missing command & assert
      );

      const fixtures = discoverFixtures(dir);
      expect(fixtures).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      rmSync(dir, { recursive: true });
    }
  });

  it('returns empty array when fixtures/ is missing', () => {
    const dir = createTempDir();
    try {
      expect(discoverFixtures(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
