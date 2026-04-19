import type { PersonaRenderer } from '../../personas/types.js';
import type { McpEngineOutput } from '../types.js';

export function renderMcpCoach(output: McpEngineOutput, persona: PersonaRenderer): string {
  const sections: string[] = [persona.renderHeader(output.totalScore, true)];

  if (output.m1.verdict !== 'PASS') {
    sections.push(persona.renderM1(output.m1));
  }

  if (output.m2.verdict !== 'PASS' && output.m2.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderM2(output.m2));
  }

  if (output.m3 && output.m3.verdict !== 'PASS' && output.m3.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderM3(output.m3));
  }

  if (output.m4 && output.m4.verdict !== 'PASS' && output.m4.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderM4(output.m4));
  }

  sections.push(persona.renderFooter(output.totalScore));

  return sections.join('\n\n');
}
