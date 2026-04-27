export const HEURISTIC_VERSION = '1.0.0';

export const HEURISTICS = {
  H1: { version: '1.0.0', description: 'Document Budget — SKILL.md ≤ 150 lines' },
  H2: { version: '1.0.0', description: 'Fixture Coverage — error + empty scenarios per tool' },
  H3: { version: '1.0.0', description: 'Structured Hints — hint fields in fixture output' },
  H4: { version: '1.0.0', description: 'Actionable Guidance — specific, actionable hint content' },
  M1: {
    version: '1.0.0',
    description: 'MCP Discovery — server introspection and tool enumeration',
  },
  M2: { version: '1.0.0', description: 'MCP Scenario Generation — error/empty test scenarios' },
  M3: { version: '1.0.0', description: 'MCP Structured Guidance — hints in tool responses' },
  M4: { version: '1.0.0', description: 'MCP Error Recovery — actionable error messages' },
} as const;
