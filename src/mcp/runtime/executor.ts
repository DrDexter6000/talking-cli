import type { McpToolDefinition } from '../types.js';
import type { McpTransport, ScenarioResult, TestScenario } from './types.js';

export async function executeScenarios(
  transport: McpTransport,
  tools: McpToolDefinition[],
): Promise<ScenarioResult[]> {
  const { generateScenarios } = await import('./scenario-generator.js');

  const allScenarios: TestScenario[] = [];
  for (const tool of tools) {
    const scenarios = generateScenarios(tool);
    allScenarios.push(...scenarios);
  }

  const results: ScenarioResult[] = [];

  for (const scenario of allScenarios) {
    try {
      const result = await transport.callTool(scenario.toolName, scenario.args);
      const responseText = extractText(result);
      results.push({ scenario, result, responseText });
    } catch {
      // Timeout or transport error — treat as no response
      results.push({
        scenario,
        result: { content: [], isError: true },
        responseText: '',
      });
    }
  }

  return results;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text ?? '')
    .join('\n');
}
