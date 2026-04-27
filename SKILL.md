# Talking CLI — Agent Skill Definition

## What This Tool Does

Talking CLI audits agent skills and MCP servers for **Distributed Prompting** compliance.
It checks whether your tools return actionable hints alongside raw data — the
**Prompt-On-Call** pattern that reduces prompt waste and improves agent behavior.

## Commands

### `audit <dir>`
Audits a skill directory against four heuristics (H1–H4):

- **H1 · Document Budget**: SKILL.md must be ≤150 lines
- **H2 · Fixture Coverage**: Each tool needs error + empty-result fixture scenarios
- **H3 · Structured Hints**: Passed fixtures must contain hint fields
- **H4 · Actionable Guidance**: Hint values must be specific (≥10 chars or non-empty arrays)

Output modes: `--ci` (machine-readable), `--json` (structured), `--persona <name>` (styled).

### `audit-mcp <dir>`
Same audit for MCP servers using M1–M4 heuristics. Add `--deep` for runtime testing.

### `optimize <dir>`
Generates `TALKING-CLI-OPTIMIZATION.md` with fix suggestions. Use `--apply` to auto-fix.

## Key Concepts

**Prompt Surface** = SKILL.md ∪ tool hints. One budget, two writable surfaces.

**Distributed Prompting** moves scenario-specific guidance from the static SKILL.md
into the tool's response — surfaced only when that tool is called, relevant only
to what just happened.

**Four channels**: C1 (SKILL.md prose), C2 (tool schema), C3 (tool response hints),
C4 (error recovery guidance).

**Five anti-patterns**: Stoic Tool, Oracle SKILL.md, Preacher CLI,
Hallucinating Handshake, Ghost Ambiguity. See PHILOSOPHY.md for full definitions.

## Error Handling

When `audit` encounters issues, check the tool response `hints` array for
specific recovery steps. Common patterns:

- Missing SKILL.md → discovery fails with actionable guidance
- Bloated SKILL.md → H1 fails, optimize suggests line cuts
- Missing fixtures → H2 fails per tool, lists uncovered tools
- No hints in output → H3 fails, suggests hint field names
- Vague hints → H4 fails, suggests minimum actionable length

## Integration

```bash
# CI pipeline
npx talking-cli audit ./my-skill --ci
# Exit code 0 = score ≥80, exit code 1 = below threshold

# Programmatic
npx talking-cli audit ./my-skill --json | jq '.totalScore'
```

## Scoring Thresholds

| Score | Verdict |
|-------|---------|
| ≥80   | PASS — ship it |
| 50–79 | PARTIAL — fix before release |
| <50   | FAIL — needs significant work |
