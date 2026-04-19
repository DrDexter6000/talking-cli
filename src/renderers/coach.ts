import type { PersonaRenderer } from '../personas/types.js';
import type { EngineOutput } from '../types.js';

export function renderCoach(output: EngineOutput, persona: PersonaRenderer): string {
  const sections: string[] = [persona.renderHeader(output.totalScore, output.hasCustomTools)];

  if (output.h1.verdict !== 'PASS') {
    sections.push(persona.renderH1(output.h1));
  }

  if (output.h2.verdict !== 'PASS' && output.h2.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderH2(output.h2));
  }

  if (output.h3.verdict !== 'PASS' && output.h3.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderH3(output.h3));
  }

  if (output.h4.verdict !== 'PASS' && output.h4.verdict !== 'NOT_APPLICABLE') {
    sections.push(persona.renderH4(output.h4));
  }

  sections.push(persona.renderFooter(output.totalScore));

  return sections.join('\n\n');
}
