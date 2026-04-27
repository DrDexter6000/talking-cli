import { discoverMcpTools, McpDiscoveryError } from './discovery.js';
import { evaluateM1 } from './rules/m1.js';
import { evaluateM2 } from './rules/m2.js';
import { evaluateM3 } from './rules/m3.js';
import { evaluateM4 } from './rules/m4.js';
import { detectServerCommand } from './runtime/detect-server-command.js';
import { executeScenarios } from './runtime/executor.js';
import { StdioMcpTransport } from './runtime/stdio-transport.js';
import { HEURISTIC_VERSION } from '../rules/VERSION.js';
import type { McpEngineOutput } from './types.js';

export async function runMcpEngine(
  serverDir: string,
  options?: { deep?: boolean; command?: string[]; staticDir?: string },
): Promise<McpEngineOutput> {
  let staticTools: ReturnType<typeof discoverMcpTools> = [];
  let m1: ReturnType<typeof evaluateM1>;
  let m2: ReturnType<typeof evaluateM2>;

  const staticAnalysisDir = options?.staticDir ?? serverDir;

  try {
    staticTools = discoverMcpTools(staticAnalysisDir);
    m1 = evaluateM1(staticTools);
    m2 = evaluateM2(staticTools);
  } catch (err) {
    if (err instanceof McpDiscoveryError && options?.deep) {
      // Python servers may not have package.json — allow deep mode to continue
      m1 = { verdict: 'NOT_APPLICABLE', score: 100, raw: { reason: err.message } };
      m2 = { verdict: 'NOT_APPLICABLE', score: 100, raw: { reason: err.message } };
    } else {
      throw err;
    }
  }

  if (!options?.deep) {
    return {
      serverDir,
      m1,
      m2,
      totalScore: Math.round((m1.score + m2.score) / 2),
      rulesetVersion: HEURISTIC_VERSION,
    };
  }

  // Deep mode: spawn the server and run runtime heuristics
  let cmd: { command: string; args: string[] };
  if (options?.command && options.command.length > 0) {
    cmd = { command: options.command[0], args: options.command.slice(1) };
  } else {
    cmd = detectServerCommand(serverDir);
  }
  const transport = new StdioMcpTransport({
    command: cmd.command,
    args: cmd.args,
    cwd: serverDir,
  });

  let m3: typeof m1 | undefined;
  let m4: typeof m1 | undefined;

  try {
    await transport.initialize();
    const runtimeTools = await transport.listTools();

    // R1: If static discovery failed, use runtime tools for M1/M2
    if (m1.verdict === 'NOT_APPLICABLE' && runtimeTools.length > 0) {
      m1 = evaluateM1(runtimeTools);
      m2 = evaluateM2(runtimeTools);
    }

    const scenarioResults = await executeScenarios(transport, runtimeTools);
    m3 = evaluateM3(scenarioResults);
    m4 = evaluateM4(scenarioResults);
  } finally {
    await transport.close();
  }

  const scores = [m1.score, m2.score];
  if (m3 && m3.verdict !== 'NOT_APPLICABLE') scores.push(m3.score);
  if (m4 && m4.verdict !== 'NOT_APPLICABLE') scores.push(m4.score);

  const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    serverDir,
    m1,
    m2,
    m3,
    m4,
    totalScore,
    rulesetVersion: HEURISTIC_VERSION,
  };
}
