import { readFileSync } from 'node:fs';
import { evaluateH1 } from './rules/h1.js';
import { evaluateH2 } from './rules/h2.js';
import type { DiscoveryResult, EngineOutput } from './types.js';

export async function runEngine(discovery: DiscoveryResult): Promise<EngineOutput> {
  const content = readFileSync(discovery.skillMdPath, 'utf-8');
  const h1 = evaluateH1(content);
  const h2 = await evaluateH2(discovery);

  return {
    skillDir: discovery.skillMdPath.replace(/SKILL\.md$/, ''),
    skillLineCount: h1.raw.lineCount,
    h1,
    h2,
    totalScore: Math.round((h1.score + h2.score) / 2),
  };
}
