# Real-World Benchmark

Multi-target benchmark testing real, npm-published MCP servers with 2×2 ablation (Full/Lean Skill × Mute/Hinting Server). This is the primary benchmark for validating Distributed Prompting.

> The synthetic benchmark (`benchmark/tasks-curated-archive/`) has been superseded. See its DEPRECATED.md for context.

## Targets

| Target | Server | Source | Tasks | Runnable | Data Model |
|--------|--------|--------|:-----:|:--------:|------------|
| **memory** | `@modelcontextprotocol/server-memory` | npm (Anthropic official) | 10 | ✅ | Knowledge graph (entities, relations, observations) |
| **everything** | `@modelcontextprotocol/server-everything` | npm (Anthropic official) | 7 | ✅ | Multi-tool demo (echo, calculator, weather, resources) |
| **atlas** | Scale AI MCP-Atlas (adapted) | GitHub (scaleapi/mcp-atlas) | 10 | ⚠️ | External APIs (Wikipedia, OSM, Met Museum, git, SQL) |

### server-memory (10 tasks)

Official Anthropic knowledge graph server (~18K weekly npm downloads). Audited at M3=0 — zero hint guidance across all 9 tool scenarios. Responses are raw JSON like `{"entities":[],"relations":[]}`.

| Task | Difficulty | Hint trigger | What it tests |
|------|-----------|-------------|---------------|
| task-memory-create-and-query | easy | none | Basic create + search |
| task-memory-relations | medium | none | Entity-relation traversal |
| task-memory-empty-search | easy | empty | Search on empty graph |
| task-memory-update-observations | medium | none | Add observations + verify |
| task-memory-complex-query | hard | none | Multi-hop relation traversal |
| task-memory-delete-cleanup | medium | none | Delete + verify remaining |
| task-memory-nonexistent-entity | easy | empty | Error handling for missing entity |
| task-memory-empty-graph-operations | easy | empty | All operations on empty graph |
| task-memory-duplicate-create | easy | none | Duplicate entity handling |
| task-memory-full-crud-cycle | hard | none | Complete CRUD + verification |

**Provenance**: Tasks are original to this project, designed against the server-memory API surface. They exercise all 9 tools across the full CRUD lifecycle. The 3 empty/error-path tasks (`empty-search`, `nonexistent-entity`, `empty-graph-operations`) directly test the scenarios where Distributed Prompting hints matter most.

### server-everything (7 tasks)

Official Anthropic demo/test server. Provides echo, calculator, weather, resource links, structured content, and annotated messages.

| Task | Difficulty | Hint trigger | What it tests |
|------|-----------|-------------|---------------|
| task-everything-echo-basics | easy | none | Basic echo tool usage |
| task-everything-sum-calculator | easy | none | Structured tool calling (get-sum) |
| task-everything-weather-comparison | medium | structured-content | Multi-step comparison with discovery hints |
| task-everything-invalid-resource | easy | error | Error recovery on invalid resource ID |
| task-everything-resource-links | medium | none | Resource link resolution |
| task-everything-annotated-messages | easy | none | Message annotation handling |
| task-everything-multi-tool-workflow | hard | none | Multi-tool orchestration across 5+ tools |

**Provenance**: Tasks are original to this project, designed against the server-everything API. They test MCP protocol features (annotations, resource links, structured content). Note: this is a demo server — it represents protocol correctness testing, not production workload simulation.

### mcp-atlas (10 tasks — external-validity artifacts)

Adapted from [Scale AI MCP-Atlas](https://github.com/scaleapi/mcp-atlas), a public benchmark for evaluating MCP agent capabilities. Each task includes `source.origin`, `source.url`, `source.task_id`, and `source.attribution`.

| Task | Difficulty | What it tests |
|------|-----------|---------------|
| task-atlas-barber-female-stats | easy | Data analysis — filter CSV by gender, compute stats |
| task-atlas-barber-rating-age | medium | Multi-column filtering + correlation |
| task-atlas-beer-wednesday-saturday | easy | Day-of-week filtering from time-series data |
| task-atlas-doordash-fast-food | medium | Cross-source reasoning (DoorDash + category classification) |
| task-atlas-equestrian-statues | hard | Multi-hop Wikipedia search + image verification |
| task-atlas-git-merge-detective | medium | Git history analysis (specific commit hash) |
| task-atlas-guggenheim-architect | hard | Wikipedia entity resolution (Frank Gehry → Guggenheim) |
| task-atlas-met-museum-rooster | easy | Met Museum API query + artist identification |
| task-atlas-movie-genre-ranking | medium | Data analysis with ranking logic |
| task-atlas-tomorrowland-charging | hard | Real-world reasoning (festival logistics) |

**⚠ These tasks require external APIs (Wikipedia, OSM, Met Museum, git, SQL) and are configured against `server-everything` which cannot fulfill them.** They serve as external-validity reference artifacts for future integration with appropriate MCP servers. Do not include in statistical analysis until properly wired.

**Provenance**: Real user prompts from the MCP-Atlas corpus. Natural language, vague, ambiguous — exactly how real users interact with agents. The most ecologically valid task set in the suite, pending server integration.

---

## Representativeness Assessment

### What this suite covers

| Dimension | Coverage | Notes |
|-----------|:--------:|-------|
| Knowledge graph CRUD | ✅ | server-memory: full lifecycle (create, read, update, delete, search) |
| Error/empty scenarios | ⚠️ | 4/17 runnable tasks (24%) trigger error/empty paths |
| Multi-tool orchestration | ✅ | everything + memory both have multi-step tasks |
| Natural language prompts | ✅ | Atlas tasks use real user prompts; memory/everything are structured |
| MCP protocol features | ✅ | Resources, annotations, structured content, tool calling |
| Difficulty spread | ⚠️ | Easy 53% / Medium 29% / Hard 18% — skewed toward easy |

### What this suite does NOT cover

| Gap | Impact | Priority |
|-----|--------|----------|
| File I/O server | The most common MCP pattern is untested | High |
| Auth/permissions server | Authorization failure recovery untested | Medium |
| Streaming server | Progressive data delivery untested | Low |
| Ambiguous user intent (runnable tasks) | All 17 runnable tasks have explicit instructions | Medium |
| Adversarial/noise inputs | No tasks give the agent misleading information | Low |

### Known limitations (honest assessment)

1. **Checkers validate keywords, not behavior.** All checkers use substring matching on the LLM's final text. An LLM that hallucinates plausible text without calling tools could pass. Future improvement: verify tool-call sequences from conversation history.

2. **Talking server variants are reimplementations, not thin wrappers.** The mute variant uses the original npm package; the talking variant reimplements the same logic with hints added. Behavioral differences could theoretically stem from reimplementation, not just hint treatment. Future improvement: wrap the original package's internals with a thin hint-injection layer.

3. **server-everything is a demo server.** It has hardcoded weather data and simplified tool implementations. Its results demonstrate protocol correctness, not production robustness.

4. **Happy-path dominance.** Only 24% of runnable tasks trigger error/empty scenarios where Distributed Prompting provides the strongest benefit. The measurable effect size is diluted by tasks where hints provide marginal value.

5. **Atlas tasks are not yet runnable.** 10 tasks with the best ecological validity are wired to the wrong server and produce no valid results. Including them in any count without qualification would be misleading.

---

## Variants (2×2 ablation)

Each target runs 4 cells in the standard ablation:

| Cell | Skill | Server | Purpose |
|------|-------|--------|---------|
| 1 | full-skill (verbose) | mute (original) | Pure control — no hints from any channel |
| 2 | full-skill | talking (with hints) | Server-only effect |
| 3 | lean-skill (compressed) | mute | Skill-only effect |
| 4 | lean-skill | talking | Full treatment — Distributed Prompting |

Default when `--variants` is omitted: all 4 cells.

---

## How to run

### Prerequisites

1. Build benchmark infrastructure:
   ```bash
   npm run benchmark:build
   ```

2. Install server dependencies (first time only):
   ```bash
   cd benchmark/real-world/servers/server-memory/mute && npm install
   cd ../talking && npm install
   cd ../../../servers/server-everything/mute && npm install
   cd ../talking && npm install
   ```

3. Set API key for your chosen provider:
   ```bash
   $env:ZHIPU_API_KEY = "..."      # glm-5.1
   $env:DEEPSEEK_API_KEY = "..."   # deepseek, deepseek-reasoner
   $env:KIMI_API_KEY = "..."       # kimi-k2.6
   ```

### Quick smoke test

```bash
# No API key needed — stub provider returns fixed responses
node benchmark/real-world/cli.mjs --provider stub --limit 2 --target memory
```

### Full benchmark

```bash
# Sequential (default)
node benchmark/real-world/cli.mjs --provider glm-5.1 --target all

# 2-way parallel
node benchmark/real-world/cli.mjs --provider glm-5.1 --target all --parallel --max-concurrency 2

# With k=3 repeat for statistical validity
node benchmark/real-world/cli.mjs --provider glm-5.1 --target all --parallel --max-concurrency 2 --repeat 3
```

### PowerShell background runner

```powershell
# Fire-and-forget with log + flag file tracking
.\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider glm-5.1

# Check status
.\benchmark\scripts\check-benchmark.ps1 -OutputDir "benchmark/real-world/results/2026-04-30-glm-5.1"
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--provider` | stub | LLM provider (stub, glm-5.1, deepseek, deepseek-reasoner, kimi-k2.6, openai, gemini) |
| `--target` | memory | Target server (memory, everything, atlas, all) |
| `--variants` | all 4 cells | Comma-separated variants (e.g. `full-skill+mute,lean-skill+talking`) |
| `--parallel` | off | Enable parallel execution |
| `--max-concurrency` | 2 | Max concurrent task executions (when parallel) |
| `--repeat` | 1 | Number of trials per (task, variant) for statistical validity (k≥3 recommended) |
| `--limit` | all | Max tasks per target |
| `--max-turns` | 20 | Max LLM turns per task |
| `--verbose` | off | Print per-task token counts and walltime |

### Watchdog

When running, the CLI emits automatic progress reports:
- **Every 5 minutes**: light heartbeat — completion count, pass rate, speed, ETA
- **Every 30 minutes**: deep analysis — per-variant breakdown, control vs treatment delta, token efficiency

No external scripts needed — the watchdog is built into the CLI.

---

## Directory structure

```
benchmark/real-world/
├── cli.mjs                           # Self-contained benchmark executor (ESM)
├── checkers/
│   ├── memory-checkers.cjs           # 10 checkers for server-memory tasks
│   ├── everything-checkers.cjs       # 7 checkers for server-everything tasks
│   └── atlas-checkers.cjs            # 10 checkers for mcp-atlas tasks
├── servers/
│   ├── server-memory/
│   │   ├── mute/                     # npm install of original @modelcontextprotocol/server-memory
│   │   └── talking/                  # Reimplementation with hints (index.mjs + KnowledgeGraphManager)
│   └── server-everything/
│       ├── mute/                     # npm install of original @modelcontextprotocol/server-everything
│       └── talking/                  # Reimplementation with hints (index.mjs)
├── tasks/
│   ├── server-memory/                # 10 task JSON files
│   ├── server-everything/            # 7 task JSON files
│   └── mcp-atlas/                    # 10 task JSON files (external-validity artifacts)
├── skills/
│   ├── memory-full-skill.md          # Full skill (~120 lines)
│   ├── memory-lean-skill.md          # Lean skill (~40 lines)
│   ├── everything-full-skill.md      # Full skill for server-everything
│   └── everything-lean-skill.md      # Lean skill for server-everything
├── scripts/
│   ├── run-memory-benchmark.ps1      # PowerShell runner for server-memory
│   └── run-everything-benchmark.ps1  # PowerShell runner for server-everything
├── results/                          # Dated run output (gitignored)
└── README.md                         # This file
```

## Design decisions

1. **Self-contained executor**: `cli.mjs` includes its own MCP subprocess handler (`McpSubprocess`) and imports LLM providers from the compiled `benchmark/dist/`. This makes the real-world benchmark independently runnable without depending on the synthetic benchmark's `StandaloneExecutor`.

2. **Fresh state per task**: Each task run spawns a new MCP server subprocess with clean state. Memory targets get a fresh `MEMORY_FILE_PATH` temp file; everything targets start with default state.

3. **Text-based checkers**: Since tasks don't produce filesystem artifacts, checkers analyze the LLM's final text response for expected patterns. This is the weakest validation approach — see Known Limitations above.

4. **Providers from shared infrastructure**: LLM providers (API clients, configuration, streaming) are imported from `benchmark/dist/runner/providers.js`, which is compiled from `benchmark/runner/providers.ts`. Adding a new provider to `provider-config.ts` automatically makes it available to the real-world benchmark.
