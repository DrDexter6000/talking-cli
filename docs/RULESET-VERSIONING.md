# Ruleset Versioning

This document describes the versioning policy for the heuristic ruleset (H1–H4 and M1–M4).

## What is Versioned

The **heuristic ruleset** is versioned as a single unit, tracking all 8 rules:

| Rule | Description |
|------|-------------|
| H1 | Document Budget — SKILL.md ≤ 150 lines |
| H2 | Fixture Coverage — error + empty scenarios per tool |
| H3 | Structured Hints — hint fields in fixture output |
| H4 | Actionable Guidance — specific, actionable hint content |
| M1 | MCP Discovery — server introspection and tool enumeration |
| M2 | MCP Scenario Generation — error/empty test scenarios |
| M3 | MCP Structured Guidance — hints in tool responses |
| M4 | MCP Error Recovery — actionable error messages |

## Version Format

Versions follow [Semantic Versioning (semver)](https://semver.org/):

- **Major** (X.0.0): Breaking changes to rule logic or thresholds
- **Minor** (0.X.0): New rules added, or existing rules enhanced without breaking changes
- **Patch** (0.0.X): Bug fixes, documentation updates, or non-behavioral changes

## When to Bump

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| Rule logic/threshold change | Major | H3 threshold 50→80, H1 limit 150→100 |
| New rule added | Minor | Adding H5 for hint budget |
| Rule enhancement (preserves existing behavior) | Minor | New regex patterns for M1 |
| Bug fix in existing rule | Patch | Fix regex false positive |
| Documentation or metadata only | None | Updating this doc |

## Reading the Version

### CLI --version

```bash
$ npx talking-cli --version
0.1.0 (ruleset 1.0.0)
```

### JSON Output

The `rulesetVersion` field is included in all audit report outputs:

```json
{
  "skillDir": "./my-skill/",
  "skillLineCount": 42,
  "h1": { "verdict": "PASS", "score": 100, "raw": {} },
  "h2": { "verdict": "PASS", "score": 100, "raw": {} },
  "h3": { "verdict": "PASS", "score": 100, "raw": {} },
  "h4": { "verdict": "PASS", "score": 100, "raw": {} },
  "totalScore": 100,
  "hasCustomTools": true,
  "rulesetVersion": "1.0.0"
}
```

### Programmatic Access

```typescript
import { HEURISTIC_VERSION, HEURISTICS } from './rules/VERSION.js';

console.log(HEURISTIC_VERSION); // "1.0.0"
console.log(HEURISTICS.H1.description); // "Document Budget — SKILL.md ≤ 150 lines"
```

## Current Version

**1.0.0** — Initial stable release of the heuristic ruleset.