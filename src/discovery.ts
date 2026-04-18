import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { type DiscoveredTool, type DiscoveredFixture, type Fixture, assertFixture } from './types.js';

const SKILL_MD = 'SKILL.md';
const TOOLS_DIR = 'tools';
const FIXTURES_DIR = 'talking-cli-fixtures';
const FIXTURE_SUFFIX = '.fixture.json';

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

export function discoverSkillMd(skillDir: string): string {
  const absoluteDir = resolve(skillDir);

  let entries: string[];
  try {
    entries = readdirSync(absoluteDir);
  } catch {
    throw new DiscoveryError(
      `Cannot read directory ${absoluteDir}`
    );
  }

  if (!entries.includes(SKILL_MD)) {
    throw new DiscoveryError(
      `No SKILL.md found in ${absoluteDir} (looked for ${SKILL_MD})`
    );
  }

  const skillMdPath = resolve(absoluteDir, SKILL_MD);
  const stat = statSync(skillMdPath);
  if (!stat.isFile()) {
    throw new DiscoveryError(
      `Expected ${skillMdPath} to be a file, but it is a directory`
    );
  }

  return skillMdPath;
}

export function discoverTools(skillDir: string): DiscoveredTool[] {
  const toolsDir = resolve(skillDir, TOOLS_DIR);

  let entries: string[];
  try {
    entries = readdirSync(toolsDir);
  } catch {
    // tools/ is optional
    return [];
  }

  return entries
    .map((name) => {
      const path = resolve(toolsDir, name);
      const stat = statSync(path);
      if (!stat.isFile()) return null;
      return {
        name: basename(name, extname(name)),
        ext: extname(name),
        path,
      };
    })
    .filter((t): t is DiscoveredTool => t !== null);
}

export function discoverFixtures(skillDir: string): DiscoveredFixture[] {
  const fixturesDir = resolve(skillDir, FIXTURES_DIR);

  let entries: string[];
  try {
    entries = readdirSync(fixturesDir);
  } catch {
    // fixtures/ is optional
    return [];
  }

  const fixtures: DiscoveredFixture[] = [];

  for (const name of entries) {
    if (!name.endsWith(FIXTURE_SUFFIX)) continue;

    const path = resolve(fixturesDir, name);
    const stat = statSync(path);
    if (!stat.isFile()) continue;

    // Parse <tool>.<scenario>.fixture.json
    const withoutSuffix = name.slice(0, -FIXTURE_SUFFIX.length);
    const firstDot = withoutSuffix.indexOf('.');
    if (firstDot === -1) {
      console.warn(`[talking-cli] Skipping malformed fixture filename: ${name} (expected <tool>.<scenario>.fixture.json)`);
      continue;
    }

    const tool = withoutSuffix.slice(0, firstDot);
    const scenario = withoutSuffix.slice(firstDot + 1);

    // Validate JSON content
    let content: string;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      console.warn(`[talking-cli] Cannot read fixture: ${name}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn(`[talking-cli] Skipping invalid JSON fixture: ${name}`);
      continue;
    }

    try {
      assertFixture(parsed);
    } catch (err) {
      console.warn(`[talking-cli] Skipping invalid fixture schema: ${name} — ${(err as Error).message}`);
      continue;
    }

    fixtures.push({ name, tool, scenario, path, fixture: parsed as Fixture });
  }

  return fixtures;
}
