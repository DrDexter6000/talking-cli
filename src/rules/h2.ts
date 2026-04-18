import type { HeuristicResult, DiscoveryResult } from '../types.js';
import { runFixture } from '../runner/fixture-runner.js';

export async function evaluateH2(discovery: DiscoveryResult): Promise<HeuristicResult> {
  const { tools, fixtures, skillMdPath } = discovery;

  if (tools.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      score: 100,
      raw: { reason: 'No tools/ directory found' },
    };
  }

  const toolResults = await Promise.all(
    tools.map(async (tool) => {
      const toolFixtures = fixtures.filter((f) => f.tool === tool.name);
      const toolDir = skillMdPath.replace(/SKILL\.md$/, '');

      if (toolFixtures.length === 0) {
        return { name: tool.name, verdict: 'FAIL' as const, score: 0 };
      }

      const runResults = await Promise.all(
        toolFixtures.map((f) => runFixture(f.fixture, toolDir))
      );

      const hasErrorScenario = toolFixtures.some((f) =>
        /error/i.test(f.scenario)
      );
      const hasEmptyScenario = toolFixtures.some((f) =>
        /empty|zero|no-result/i.test(f.scenario)
      );

      const allPassed = runResults.every((r) => r.status === 'passed');
      const hasRequiredScenarios = hasErrorScenario && hasEmptyScenario;

      if (allPassed && hasRequiredScenarios) {
        return { name: tool.name, verdict: 'PASS' as const, score: 100 };
      }

      if (toolFixtures.length > 0 && (!allPassed || !hasRequiredScenarios)) {
        return { name: tool.name, verdict: 'PARTIAL' as const, score: 50 };
      }

      return { name: tool.name, verdict: 'FAIL' as const, score: 0 };
    })
  );

  const totalScore =
    toolResults.reduce((sum, t) => sum + t.score, 0) / toolResults.length;

  const hasFailures = toolResults.some((t) => t.verdict === 'FAIL');
  const hasPartials = toolResults.some((t) => t.verdict === 'PARTIAL');

  let verdict: HeuristicResult['verdict'];
  if (hasFailures) {
    verdict = 'FAIL';
  } else if (hasPartials) {
    verdict = 'PARTIAL';
  } else {
    verdict = 'PASS';
  }

  return {
    verdict,
    score: Math.round(totalScore),
    raw: { tools: toolResults },
  };
}
