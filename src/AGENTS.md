# src/ — Core CLI

**Parent**: [../AGENTS.md](../AGENTS.md)

## OVERVIEW

Audit engine (H1-H4) for skill directories, personas, renderers, optimizer, fixture runner.

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add audit heuristic | `rules/h*.ts` | Return `HeuristicResult` — follow existing pattern |
| Change CLI command | `cli.ts` | Commander registration at bottom |
| Add output format | `renderers/*.ts` | Must mirror coach/ci/json triple |
| Add persona | `personas/*.ts` | Implement `PersonaRenderer`, register in `personas/index.ts` + `PERSONA_KEYS` |
| Modify fixture execution | `runner/fixture-runner.ts` | Spawns subprocess, parses JSON, asserts field existence |
| Change optimization plan | `optimize/plan-generator.ts` | Generates TALKING-CLI-OPTIMIZATION.md markdown |
| Change optimization apply | `optimize/applier.ts` | Git branch safety: creates `talking-cli/optimize-YYYYMMDD`, commits per-fix |
| Discovery logic | `discovery.ts` | `discoverSkillMd()` → SKILL.md, `discoverTools()` → tools/, `discoverFixtures()` → talking-cli-fixtures/ |
| Shared types | `types.ts` | `HeuristicResult`, `EngineOutput`, `Fixture`, `DiscoveryResult`, `isValidFixture()`, `assertFixture()` |

## H1-H4 THRESHOLDS

| Rule | Evaluates | Threshold | Score |
|------|-----------|-----------|-------|
| H1 | SKILL.md line count | ≤150 lines | PASS=100, FAIL=0 |
| H2 | Per-tool fixture coverage | error + empty scenarios required | PASS=100, PARTIAL=50, FAIL=0 per tool |
| H3 | Hint fields in fixture output | `hints`/`suggestions`/`guidance`/`next_steps`/`recommendations` | ≥80 PASS, ≥50 PARTIAL, <50 FAIL |
| H4 | Actionable content in hints | String ≥10 chars or non-empty array | ≥80 PASS, ≥50 PARTIAL, <50 FAIL |

**Total**: `Math.round((h1+h2+h3+h4)/4)`

## PERSONA INTERFACE

```typescript
interface PersonaRenderer {
  readonly key: PersonaKey;
  renderHeader(totalScore, hasCustomTools): string;
  renderH1(h1): string;  // + renderH2, renderH3, renderH4
  renderM1(m1): string;  // + renderM2, renderM3, renderM4
  renderFooter(totalScore): string;
}
```

2 implementations: `default`, `emotional-damage-dad`. (Archived: `nba-coach`, `british-critic`, `zen-master` in `personas/archive/`.)

## CONVENTIONS

- `engine.ts` runs H1-H4 sequentially, averages scores
- `fixture-runner.ts` default timeout 5000ms, checks `output_has_field` exists and non-null
- `applier.ts` git safety: clean tree check → feature branch → per-fix commits → restore original branch
- Discovery throws `DiscoveryError` (not plain Error) if SKILL.md missing
