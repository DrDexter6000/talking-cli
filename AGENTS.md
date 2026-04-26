# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-26
**Commit:** 5ba968e
**Branch:** master

## OVERVIEW

Talking CLI — a linter/auditor that checks if agent skills and MCP servers return actionable hints (Distributed Prompting). TypeScript, ESM-first, built with Commander + tsup, tested with Vitest.

## STRUCTURE

```
.
├── src/            # Core CLI: audit engine (H1-H4), MCP audit (M1-M4), personas, renderers, optimize
│   ├── mcp/        # Parallel subsystem: MCP server audit engine, rules, runtime
│   ├── personas/   # 5 voice implementations (default, nba-coach, british-critic, zen-master, emotional-damage-dad)
│   ├── rules/      # H1-H4 heuristic evaluators
│   ├── renderers/  # Coach (human), CI, JSON output
│   ├── optimize/   # Plan generator + applier (writes TALKING-CLI-OPTIMIZATION.md)
│   └── runner/     # Fixture runner for test fixtures
├── benchmark/      # Standalone benchmark harness (own tsconfig, own dist/, own providers)
│   ├── runner/     # Provider config, stats, checker, standalone executor
│   ├── servers/    # Vendored MCP server variants (mute/ talking/) — NOT renamed; npm install + build required
│   ├── tasks/      # 25 benchmark task JSONs + archived/
│   ├── tasks-curated/  # 15 curated tasks (5 easy + 7 medium + 3 hard) for ablation studies
│   ├── skills/     # Reference skill files: full-skill.md, lean-skill.md (renamed from bloated/talking)
│   ├── docs/       # BENCHMARK-GUIDE (SSOT), REPORT-STANDARD, PROVIDER-CONFIG
│   └── scripts/    # run-benchmark-bg.ps1, check-benchmark.ps1
├── docs/           # Public docs (CN-001 redirect, LAUNCH-POST archived)
├── .internal/      # Private: PRD.md, TDD-P4.md, phased plans, HANDOFF.md
└── dist/           # Build output (tsup: ESM + CJS)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new audit heuristic | `src/rules/` (H1-H4) or `src/mcp/rules/` (M1-M4) | Follow existing pattern: evaluate function returning `HeuristicResult` |
| Change output format | `src/renderers/` (skill) or `src/mcp/renderers/` (MCP) | Coach/CI/JSON triple |
| Add a persona | `src/personas/` | Register in `src/personas/index.ts` + `PERSONA_KEYS` |
| Modify benchmark tasks | `benchmark/tasks/*.json` | Schema: `{id, tool, scenario, command, assert}` |
| Change benchmark providers | `benchmark/runner/provider-config.ts` | Authoritative source for model params; glm-5.1 added |
| Run ablation benchmark | `benchmark/cli.ts` | `--task-dir benchmark/tasks-curated` for 15-task curated set |
| Benchmark execution flow | `benchmark/runner/run-benchmark.ts` → `standalone-executor.ts` | `checker.ts` validates results (915 lines, largest file) |
| Discovery logic | `src/discovery.ts` (skills) or `src/mcp/discovery.ts` (MCP) | File-walking, fixture parsing |
| Types | `src/types.ts` | Domain types: `HeuristicResult`, `EngineOutput`, `Fixture`, `DiscoveryResult` |

## CONVENTIONS

- **ESM-only** (`"type": "module"`, `NodeNext` module resolution). Imports must use `.js` extensions in TS source.
- **Biome** for linting/formatting (NOT ESLint/Prettier). Only lints `src/` — benchmark is excluded.
- **Test co-location**: `*.test.ts` files sit next to source. Vitest runs both `src/` and `benchmark/` tests.
- **Strict TS**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` — all enabled.
- **No `as any` / `@ts-ignore`** — type suppression is forbidden.
- **Line width**: 100 chars (Biome config, not the standard 80).
- **Temp dirs in tests**: `mkdtempSync(join(tmpdir(), 'talking-cli-*'))` + try/finally `rmSync` cleanup.

## ANTI-PATTERNS (THIS PROJECT)

- **Never delete failing tests** to make suites pass
- **Never commit** without explicit user request
- **WSL paths** (`/mnt/...`) must be preserved as-is in benchmark server code — never convert
- **5 methodology anti-patterns** defined in PHILOSOPHY.md: Stoic Tool, Oracle SKILL.md, Preacher CLI, Hallucinating Handshake, Ghost Ambiguity

## UNIQUE STYLES

- **Fixture assertion pattern**: `talking-cli-fixtures/*.fixture.json` files with `{tool, scenario, command, assert: {output_has_field}}` schema
- **Runtime type guards**: `isValidFixture()` / `assertFixture()` in `src/types.ts` — no Zod/ schema library
- **Process.exit spy**: `vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)` in tests
- **Sentence-case test names**: `"outputs coach report by default"`, not `testOutputsCoachReport`
- **Benchmark providers**: Separate provider system (stub, deepseek, glm-5.1, minimax) with env-var API keys
- **`src/index.ts` is empty placeholder** — package is CLI-only, not importable as library

## COMMANDS

```bash
# Build
npm run build                  # tsup → dist/

# Test
npm test                       # vitest run (src/ + benchmark/)
npm run test:watch             # vitest --watch

# Lint/Format
npm run lint                   # biome check src/
npm run lint:fix               # biome check --write src/
npm run format                 # biome format --write src/

# Type check
npm run typecheck              # tsc --noEmit

# Benchmark
npm run benchmark:smoke        # stub provider, 3 tasks, local-only
npm run benchmark:build        # tsc -p benchmark/tsconfig.json
npm run benchmark -- --provider glm-5.1 --task-dir benchmark/tasks-curated --variants full-skill+lean-skill+mute+hinting
```

## DOCUMENTATION GUIDE

This project maintains a strict documentation hierarchy. Each document has a defined authority level:

| Document | Authority | Purpose |
|----------|-----------|---------|
| **README.md** | Public · Primary | Project overview, usage, evidence, roadmap |
| **PHILOSOPHY.md** | Public · Methodology | Distributed Prompting methodology: Four Channels, Four Rules, Budget, Anti-Patterns. Absorbs the former CN-001 theoretical anchor |
| **docs/CN-001** | Public · Redirect | Redirects to PHILOSOPHY.md. Preserves L1–L4 → C1–C4 citation mapping |
| **docs/LAUNCH-POST.md** | Public · Archived | Launch draft for v0.3.0 (outdated, retained for reference) |
| **benchmark/docs/BENCHMARK-GUIDE.md** | Internal · SSOT | Benchmark task design, execution guide, and all findings |
| **benchmark/docs/BENCHMARK-REPORT-STANDARD.md** | Internal · Standard | Mandatory report format for all benchmark runs |
| **benchmark/docs/PROVIDER-CONFIG.md** | Internal · Reference | Provider configuration and API key setup |
| **.internal/PRD.md** | Private · Product | Product requirements (not in repo) |
| **.internal/TDD-P4.md** | Private · Execution | Phase 4 execution plan (not in repo) |
| **.internal/HANDOFF.md** | Private · Operational | Session handoff state (not in repo) |

**Hierarchy rules**:
- Public documents (README, PHILOSOPHY) take precedence over internal docs in case of conflict
- `benchmark/docs/BENCHMARK-GUIDE.md` is the single source of truth for benchmark findings
- `benchmark/runner/provider-config.ts` is the authoritative source for provider parameters (docs sync from it)
- `.internal/` files are operational, not archival — HANDOFF.md expires between sessions

## NOTES

- `src/index.ts` is an empty stub — the public API is CLI-only via `src/cli.ts`
- `benchmark/` has its own `tsconfig.json` and compiles to `benchmark/dist/` — separate build pipeline
- `benchmark/servers/variants/` requires `cd benchmark/servers && npm install && pwsh scripts/build.ps1` before use
- Benchmark results in `benchmark/results/` are gitignored
- `.internal/` contains PRD, phased TDD plans, and session handoff — operational, not archival
- `checker.ts` (915 lines) is the largest file — benchmark result validation logic
- `src/mcp/` is a parallel audit subsystem with its own engine, rules (M1-M4), renderers, and runtime — mirrors `src/` structure for MCP server audits
- `benchmark/tasks-curated/` is the curated 15-task set for ablation studies (targets 40–70% baseline pass rate)
- Variant naming: SkillVariant = "full-skill" | "lean-skill"; ServerVariant = "mute" | "hinting"
- GLM-5.1 uses coding plan endpoint `api/coding/paas/v4` (not standard `api/paas/v4`)
- Benchmark uses 2-cell parallel execution (not 4-cell — GLM-5.1 can't handle >2 concurrent)
- API keys (DEEPSEEK_API_KEY, ZHIPU_API_KEY, MINIMAX_API_KEY) are env-var only, never hardcoded
- Build uses tsup (not tsc) for main package; tsc for benchmark
