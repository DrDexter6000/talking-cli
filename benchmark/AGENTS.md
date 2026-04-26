# benchmark/ — Standalone Benchmark Harness

**Parent**: [../AGENTS.md](../AGENTS.md)

## OVERVIEW

Separate compilation unit (own `tsconfig.json`, own `dist/`) for running mute vs talking benchmarks across LLM providers. **Not a test suite** — it's a second CLI application.

## STRUCTURE

```
benchmark/
├── cli.ts                  # CLI entry: --provider, --parallel, --resume, --limit
├── tsconfig.json           # rootDir: ".", outDir: "./dist", excludes test/fixtures/servers
├── runner/
│   ├── provider-config.ts  # ProviderConfig definitions (SSOT for model params)
│   ├── providers.ts        # OpenAI/Anthropic/Gemini/Stub HTTP clients
│   ├── run-benchmark.ts    # Orchestrator: sequential or parallel execution
│   ├── standalone-executor.ts # Task execution: LLM + MCP subprocess + turn loop
│   ├── checker.ts          # 85 checker functions (915 lines) — validates task results
│   ├── stats.ts            # Wilcoxon signed-rank + sign test + aggregates
│   ├── renderer.ts         # Renders AUDIT-BENCHMARK.md report
│   └── types.ts            # BenchmarkTask, BenchmarkRunResult interfaces
├── servers/
│   ├── mute/               # Vendored @modelcontextprotocol/server-filesystem — NO hints
│   └── talking/            # Same server — WITH hints via withHints() helper
├── tasks/                  # 25 benchmark task JSONs + archived/
├── skills/
│   ├── bloated-skill.md    # Control variant: full skill, no tool hints
│   ├── talking-skill.md    # Treatment variant: references tool hints
│   └── reference-server-filesystem.md  # Server documentation
├── docs/
│   ├── BENCHMARK-GUIDE.md  # SSOT: task design, execution guide, findings
│   ├── BENCHMARK-REPORT-STANDARD.md  # Report format standard
│   └── PROVIDER-CONFIG.md  # Provider config reference
├── scripts/
│   ├── run-benchmark-bg.ps1  # Background execution wrapper
│   └── check-benchmark.ps1   # Status checker
├── fixtures/               # Stats test fixtures (raw.jsonl for pass/fail/win scenarios)
└── results/                # Dated run output (gitignored)
```

## PROVIDERS

| Provider | model | format | contextWindow | API key env |
|----------|-------|--------|---------------|-------------|
| stub | stub | openai | 0 | none |
| deepseek | deepseek-v4-flash | openai | 1M | `DEEPSEEK_API_KEY` |
| deepseek-reasoner | deepseek-v4-pro | openai | 1M | `DEEPSEEK_API_KEY` |
| **glm-5.1** | **glm-5.1** | **openai** | **200K** | **`ZHIPU_API_KEY`** |
| minimax | MiniMax-M2.7-highspeed | anthropic | 196K | `MINIMAX_API_KEY` |
| openai | gpt-4o | openai | 128K | `OPENAI_API_KEY` |
| gemini | gemini-1.5-pro | gemini | 1M | `GEMINI_API_KEY` |

Config priority: explicit → `~/.talking-cli/providers.json` → `.talking-cli-providers.json` → defaults.

## EXECUTION FLOW

1. `cli.ts` parses args → creates `StandaloneExecutor` with provider
2. `run-benchmark.ts` loads tasks, loops tasks × variants (mute/talking)
3. `standalone-executor.ts`: loads skill (bloated/talking), spawns MCP server subprocess, runs LLM turn loop (max 20 turns, 5min per call)
4. Each LLM call includes system prompt + conversation + MCP tool definitions
5. `checker.ts` validates final result against 85 registered checker functions
6. `stats.ts` computes Wilcoxon + sign test on per-task deltas
7. `renderer.ts` generates AUDIT-BENCHMARK.md with verdict (GREAT_SUCCESS/SUCCESS/PARTIAL/FAILURE)

## SERVERS: mute vs talking

Both are vendored copies of `@modelcontextprotocol/server-filesystem` at pinned commit. Only difference: `talking/index.ts` wraps tool responses with `withHints(text, hints)` that adds actionable guidance on error/empty results. **Must `npm install && npm run build` before use.**

## TASK SCHEMA

```typescript
interface BenchmarkTask {
  id: string;          // "task-batch-json-transform"
  prompt: string;      // Full task description
  checker: string;     // Checker function name
  difficulty: string;  // "hard" | "medium"
  category?: string;
}
```

## ANTI-PATTERNS

- **Never run `npm run benchmark` directly in bash tool** — it's long-running. Use `scripts/run-benchmark-bg.ps1`
- **Servers need build** — `benchmark/servers/*/dist/` doesn't exist in repo; must build first
- **Results gitignored** — `benchmark/results/` is in `.gitignore`
- **WSL paths** — servers contain `path-utils.ts` with NEVER-convert rules for `/mnt/` paths
- **API keys via env-var only** — never hardcoded; `provider-config.ts` supports `${ENV_VAR}` syntax
- **checker.ts is 915 lines** — largest file, 85 registered checkers by name
