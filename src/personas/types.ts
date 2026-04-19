import type { HeuristicResult } from '../types.js';

export type PersonaKey =
  | 'default'
  | 'nba-coach'
  | 'british-critic'
  | 'zen-master'
  | 'emotional-damage-dad';

export interface PersonaRenderer {
  readonly key: PersonaKey;
  readonly name: string;
  readonly description: string;
  renderHeader(totalScore: number, hasCustomTools: boolean): string;
  renderH1(h1: HeuristicResult): string;
  renderH2(h2: HeuristicResult): string;
  renderH3(h3: HeuristicResult): string;
  renderH4(h4: HeuristicResult): string;
  renderM1(m1: HeuristicResult): string;
  renderM2(m2: HeuristicResult): string;
  renderM3(m3: HeuristicResult): string;
  renderM4(m4: HeuristicResult): string;
  renderFooter(totalScore: number): string;
}
