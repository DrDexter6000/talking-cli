# Benchmark Guide

> SSOT for benchmark task design, execution, and findings.
> Last updated: 2026-04-25

---

## 1. Task Design Philosophy

Task design is grounded in real agent failure modes, drawn from 290+ failure reports, 50+ GitHub issues, and academic literature.

### The Seven Categories of Real Agent Failure

| Category | Failure Mode | Example |
|----------|-------------|---------|
| **Path Resolution** | Relative paths resolved against wrong CWD | MCP server resolves `./config.json` against `/tmp` instead of sandbox root |
| **Permission & Security** | Symlink bypasses path containment | Agent reads `/etc/passwd` via symlink inside allowed directory |
| **Encoding** | Non-UTF-8 content corrupted | Windows CP437 corrupts `Bäckerstraße` into `B?ckerstra?e` |
| **File Persistence** | Tool reports success but file was never written | Sandbox isolate prevents actual write; agent proceeds on false assumption |
| **Batch Scope Creep** | Agent modifies 47 files when asked to fix one | Tool returns success without scope signal |
| **Search Efficiency** | Agent checks 22x more files than necessary | No hint that results are sparse; keeps expanding search |
| **Premature Termination** | Agent declares success before verifying | Returns `{"status": "success"}` without running tests |

### Mute vs. Talking: How Hints Change Behavior

The benchmark tests two variants of the same tool:

**Mute** — tool returns raw data or error, no hint field.

**Talking** — tool returns data plus a `hints` field with actionable guidance at the moment of failure.

#### Example: EISDIR (treating a directory as a file)

**Mute:**
```json
{"error": "EISDIR: illegal operation on a directory, read"}
```

**Talking:**
```json
{
  "type": "directory",
  "hint": "This is a directory, not a file. Use list_directory to see its contents.",
  "entries": ["app.log", "error.log"]
}
```

#### Example: Symlink escape attempt

**Mute:**
```json
{"content": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon..."}
```

**Talking:**
```json
{
  "error": "Access denied",
  "hint": "Symlink target /etc/passwd is outside allowed directories. Always resolve symlinks before checking path containment."
}
```

#### Example: UTF-8 encoding corruption

**Mute:**
```json
{"content": "B?ckerstra?e ??? ???"}  // Mojibake
```

**Talking:**
```json
{
  "content": "Bäckerstraße 日本語 🎉",
  "hint": "File is UTF-8 but system default is CP437. Set process.stdout.setEncoding('utf8') to decode correctly."
}
```

#### Example: False success without verification

**Mute:**
```json
{"status": "success", "message": "Fixed the bug"}
```

**Talking:**
```json
{
  "status": "success",
  "hint": "Edit completed. Remember to run tests to verify the fix. Use 'npm test' or equivalent."
}
```

---

## 2. Server Architecture

### Structure (v2 — shared core + variants)

```
servers/
├── core/              # Shared logic (DRY)
│   ├── lib.ts         # File operations (read, write, edit, search, tail, head)
│   ├── path-utils.ts  # Path normalization (WSL-safe, cross-platform)
│   ├── path-validation.ts  # Security: path-within-allowed-dirs check
│   └── roots-utils.ts # MCP roots protocol handling
├── variants/
│   ├── mute/          # Control: upstream behavior, no hints
│   │   ├── index.ts
│   │   └── tsconfig.json
│   └── talking/       # Treatment: tool responses include actionable hints
│       ├── index.ts
│       ├── hints.ts   # Centralized hint definitions
│       └── tsconfig.json
├── tsconfig.base.json # Shared compiler options
├── package.json       # Shared dependencies (@modelcontextprotocol/sdk)
└── scripts/
    └── build.ps1      # Build both variants
```

Both variants import shared code from `../../core/*.js` (ESM paths). The only behavioral difference is that the `talking` variant wraps tool responses with `withHints()` from `hints.ts`.

**Build**: `cd benchmark/servers && npm install && pwsh scripts/build.ps1`

**Run**: `node benchmark/servers/variants/{mute,talking}/dist/variants/{mute,talking}/index.js /path/to/sandbox`

### Hint Triggers (talking variant)

Hints fire on these tool states:

| State | Example Hint |
|-------|-------------|
| Empty result | "No files matched. Try broadening the pattern with `*` wildcards." |
| Permission denied | "Access denied: path is outside allowed directories. Check the path." |
| Schema ambiguity | "This is a directory, not a file. Use list_directory to see contents." |
| Not found | "File not found. Use search_files to locate it." |

---

## 3. Current Task Set

The benchmark has **30 active tasks** (structured as 3×3 matrix: 3 difficulty tiers × 3 hint-trigger types + none) and **21 archived tasks**.

### Active Tasks (30)

| File | Description | Difficulty |
|------|-------------|-----------|
| `task-api-integration-test.json` | Create integration tests for a REST API | medium |
| `task-batch-json-transform.json` | Batch transform JSON data across multiple files | medium |
| `task-batch-markdown-transform.json` | Batch transform markdown files | medium |
| `task-code-review-automation.json` | Automated code review across a codebase | medium |
| `task-codebase-dead-code.json` | Find and report dead code in a codebase | hard |
| `task-config-drift-audit.json` | Audit configuration drift between environments | medium |
| `task-config-migration.json` | Migrate configuration from one format to another | medium |
| `task-data-pipeline-build.json` | Build a data pipeline from scratch | hard |
| `task-database-migration-gen.json` | Generate database migration scripts | medium |
| `task-dependency-update.json` | Update project dependencies safely | medium |
| `task-doc-generation-api.json` | Generate API documentation from source | medium |
| `task-documentation-website.json` | Build a documentation website | hard |
| `task-env-config-hydration.json` | Hydrate environment config across services | medium |
| `task-error-recovery-batch.json` | Handle and recover from batch operation errors | hard |
| `task-i18n-extraction-gen.json` | Extract and generate i18n translation files | medium |
| `task-large-scale-refactor.json` | Large-scale code refactoring across modules | hard |
| `task-large-yaml-pipeline.json` | Build and debug a large YAML pipeline | hard |
| `task-log-analysis-nginx.json` | Analyze nginx access logs for insights | medium |
| `task-log-correlation-incident.json` | Correlate logs across services for incident analysis | hard |
| `task-monorepo-dependency-graph.json` | Map dependency graph in a monorepo | hard |
| `task-multi-service-debug.json` | Debug issues across multiple microservices | hard |
| `task-multifile-refactor-esm.json` | Refactor multiple files to ESM | medium |
| `task-performance-profile-parse.json` | Parse and analyze performance profiles | medium |
| `task-security-scan-codebase.json` | Run security scan across codebase | hard |
| `task-test-coverage-analysis.json` | Analyze and report test coverage | medium |

### Archived Tasks (21)

21 older tasks are preserved in `benchmark/tasks/archived/` for reference but are not run:

`task-edit-dry-run.json`, `task-edit-recovery-dry-run.json`, `task-get-file-info.json`, `task-info-recovery-not-found.json`, `task-list-directory-sorted.json`, `task-list-directory-with-unicode.json`, `task-list-directory.json`, `task-list-recovery-empty-dir.json`, `task-move-file-cross-directory.json`, `task-move-rename-same-dir.json`, `task-read-access-denied.json`, `task-read-binary-file.json`, `task-read-empty-file.json`, `task-read-recovery-multiple-fail.json`, `task-read-recovery-wrong-path.json`, `task-search-empty-root.json`, `task-search-not-found.json`, `task-search-recovery-nested.json`, `task-tail-file.json`, `task-write-new-file.json`, `task-write-overwrite-existing.json`

### Tier Analysis (3×3 Matrix)

| | Tier-easy (≥85% baseline) | Tier-medium (60–75% baseline) | Tier-hard (20–40% baseline) |
|---|---|---|---|
| **Empty-result trigger** | 3 | 5 | 2 |
| **Permission/path trigger** | 3 | 5 | 2 |
| **Schema-ambiguity trigger** | 3 | 5 | 2 |
| **Total** | **9** | **15** | **6** |

See [`CORPUS-MATRIX.md`](./CORPUS-MATRIX.md) for full matrix with task assignments. Tier baselines are design targets — **not yet empirically verified** (see Research Note RN-004 in `.internal/archive/real-world-validation/RESEARCH-NOTES.md`).

---

## 3. Benchmark Results

> **Full run history**: See [`RUN-LOG.md`](./RUN-LOG.md) for indexed registry of all runs with pointers to detailed reports.

### Summary of Key Findings (across all runs)

| Finding | Evidence | Run |
|---------|----------|-----|
| Token savings reproducible | −69% (DeepSeek), −8% (MiniMax) | R1, R2 |
| Quality hypothesis NOT validated | Pass rate delta within noise on tested models | R1, R2 |
| Server effect dominates skill effect | −17% tokens from talking server vs −0.3% from talking skill | R4 |
| Interaction effect observed | talking+talking underperforms talking+mute | R4 |
| Per-task variance up to 4× | Single trial insufficient, need k≥3 | R4 |
| MCP infrastructure validated | All 12 cells completed with init fix | R4 |

### Cross-Model Comparison (v1 runs)

| Model | Mute Wins | Talking Wins | Ties | Token Delta |
|-------|-----------|--------------|------|-------------|
| DeepSeek Chat | 8 | 3 | 14 | −69% |
| MiniMax M2.7 HS | 8 | 3 | 14 | −8% |

**Key finding**: Token savings are robust and reproducible. The "talking improves quality" hypothesis is NOT validated on tested models. Model capability is the current bottleneck, not the methodology. Validation requires stronger models (Claude/GPT-4 class) and k≥3 trials.

---

## 4. Execution Guide

### Prerequisites

Provider configuration is managed separately. See `benchmark/docs/PROVIDER-CONFIG.md` for setup instructions.

### Run Commands

```bash
# Basic run
npm run benchmark -- --provider minimax

# Parallel execution (3 concurrent tasks)
npm run benchmark -- --provider minimax --parallel --max-concurrency 3

# Resume interrupted run
npm run benchmark -- --provider minimax --parallel --resume

# Limit tasks for quick test
npm run benchmark -- --provider minimax --limit 5

# List available providers
npm run benchmark -- --list-providers

# Smoke test (no API key needed)
npm run benchmark:smoke
```

### Scripts

- `benchmark/scripts/run-benchmark-bg.ps1` — Background benchmark runner
- `benchmark/scripts/check-benchmark.ps1` — Check benchmark status

### Monitoring Protocol (MANDATORY)

When orchestrating a long-running benchmark (≥10 tasks) from an agent session, the following monitoring protocol is **mandatory**:

1. **Poll interval**: Every 5 minutes while the run is in progress.
2. **Output format**: Each poll MUST output structured progress visible to the user:

```
[Cell: {cell-name}] Progress: {done}/{total} tasks
  ✅ Passed: {n} | ❌ Failed: {n} | ⏳ Running: {task-id}
  Last completed: {task-id} ({pass|fail}, {turns}t, {tokens}tok, {walltime}s)
  Elapsed: {mm}m | Est. remaining: ~{mm}m
```

3. **Completion signal**: Final poll must clearly state "DONE" with summary stats.
4. **Parallel cell execution**: When running multiple cells (e.g., 2×2 ablation), cells CAN be run in parallel using separate `--output-dir` flags. Each cell must have its own output directory. Example: launch Cell 1 with `--output-dir results/cell1` and Cell 2 with `--output-dir results/cell2` simultaneously via separate `Start-Process` invocations. Within a single cell, tasks are already parallelized by the `--parallel` flag. This reduces 4-cell ablation from ~3h sequential to ~1h parallel.
5. **No silent waits**: Never use `Start-Sleep` without an accompanying progress check. Every 5-minute block must produce visible output.

### New Metrics Tracked

- `walltime`: Actual execution time per task
- `errorRecoveries`: Count of errors successfully recovered from
- `toolCalls`: Total tool invocations
- `timeToFirstTool`: Time until first tool call
- `timeToSuccess`: Time until successful completion

---

## 5. Historical Decisions

| Decision | Rationale |
|----------|-----------|
| Parallel execution | Reduce 40min to ~15min runtime |
| Parallel cell execution (R6+) | Multiple cells can run in parallel via `--output-dir`; verified in R6 with cells 3+4 running concurrently |
| Resume capability | Avoid losing progress on interruptions |
| Auto-save every 5 results | Checkpointing for long runs |
| Extended metrics | Time, recovery, tool calls for deeper analysis |
| Benchmark framework v0.6 | Progress reporting, parallel execution, resume capability |
| Hint injection via `content[].text` | `structuredContent.hints` was never read; moved hints into the text channel alongside tool results |

### Success Verdict Criteria

From [`BENCHMARK-REPORT-STANDARD.md`](./BENCHMARK-REPORT-STANDARD.md):

**Current (v1)**:
- **SUCCESS**: Token consumption reduced; pass rate delta within ±5pp
- **GREAT_SUCCESS**: Token consumption reduced; talking wins > mute wins
- **PARTIAL**: Token consumption reduced; quality dropped noticeably
- **FAILURE**: Token consumption not reduced, or quality severely degraded

**Upcoming (v2, Phase D)**:
- **PROVEN**: total_tokens ↓ p < .05 AND turns ↓ p < .05 AND medium-tier pass rate ↑ ≥ 10pp
- **SUCCESS**: total_tokens ↓ p < .05 AND pass rate 95% CI ⊃ 0
- **PARTIAL**: One of {total_tokens, turns} ↓ p < .05
- **FAILURE**: No metric significant at p < .05

---

## R7 Lessons Learned: Task Curation & Execution

> Last updated: 2026-04-26

### 1. Floor Effect Diagnosis and Fix

| Run | Tasks | Hard % | Baseline Pass | Effective n |
|-----|-------|--------|--------------|------------|
| R6 | 30 | 67% | 83% floor | n=5 |
| R7 | 15 | 20% | balanced | n=10–12 |

R6's hard-skewed corpus (67% hard tasks) produced a floor effect: 83% of tasks failed in both arms, leaving only 5 tasks with discriminative signal. R7 curates to 15 tasks with mixed difficulty (33% easy, 47% medium, 20% hard), restoring balance and improving effective sample size.

Academic backing: tinyBenchmarks (ICML 2024, Polo et al.) proves curated subsets outperform uncurated full sets. MCP-Bench (NeurIPS 2025) uses 104 tasks as domain standard.

### 2. Task Curation Methodology (SWE-bench Lite Pattern)

1. Classify all tasks by R6 outcome: floor / mid / ceiling
2. Keep mid-range tasks (some pass, some fail = discriminating)
3. Restore easy and medium tasks from `archived/` for balance
4. Target 40–70% baseline pass rate for each task

Result: 5 easy + 7 medium + 3 hard = 15 curated tasks.

### 3. Execution Strategy: 2-Cell Parallel

| Configuration | Result |
|---------------|--------|
| 4 cells parallel | 100% failure rate |
| 2 cells parallel, serial within cell | Stable |
| Serial per cell | 0% failure rate |

GLM-5.1 coding plan endpoint cannot handle 4+ concurrent API requests (all timeout). Recommended: always start with 1-cell pilot, then scale to 2-cell parallel.

### 4. Mandatory 5-Minute Polling

All benchmark runs MUST have 5-minute polling enabled. Without polling, a stuck or failed run wastes hours of API budget.

Standard poll format:

```
[Cell: {cell-name}] Progress: {done}/{total} tasks
  Passed: {n} | Failed: {n} | Running: {task-id}
  Last completed: {task-id} ({pass|fail}, {turns}t, {tokens}tok, {walltime}s)
  Elapsed: {mm}m | Est. remaining: ~{mm}m
```

### 5. CLI Enhancement: --task-dir Flag

Added `--task-dir` flag to benchmark CLI for specifying custom task directories.

```bash
node benchmark/dist/cli.js --provider glm-5.1 --task-dir benchmark/tasks-curated --variants full-skill+mute
```

This enables curated task sets without modifying the default `tasks/` directory.

### 6. Curated Task Set Directory

Created `benchmark/tasks-curated/` with 15 hand-selected tasks sourced from both `tasks/` (active) and `tasks/archived/`. Must be maintained alongside the full 30-task set.

### 7. Provider-Specific Behavior: GLM-5.1

| Behavior | Detail |
|----------|--------|
| Reasoning tokens | Count toward `max_tokens` but not `output_tokens` |
| LLM call latency | 5–10s for simple tasks, 30–60s for complex multi-turn |
| Context pressure | Full skill (887 lines) causes fast context growth, earlier timeouts |
| Coding plan endpoint | `https://open.bigmodel.cn/api/coding/paas/v4` — separate from standard API |

### 8. The 2x2 Signal

R7 successfully demonstrated the 2x2 ablation design produces clear signal.

| Effect | Delta |
|--------|-------|
| Skill compression | −61 to −64% input tokens |
| Server hints | +6 to +20pp pass rate improvement |
| Combined (synergistic) | +26pp > sum of individual effects |

### 9. Skill File Size Calibration (SkillsBench Cross-Validation)

R7's full-skill at 873 lines is at **P99.5 of real-world skill sizes**. This was validated against two independent data sources:

**Source 1 — SkillsBench (arXiv 2602.12670, Feb 2026)**
- Dataset: 36,338 SKILL.md files across the Claude Code ecosystem
- Median: ~120 lines | P90: ~300 | P95: ~400 | >500 lines: 0.7%
- Finding 6: "Comprehensive" skills hurt performance (−2.9pp) vs "moderate detailed" (+18.8pp)

**Source 2 — GitHub 6-repository survey (841 files)**
- Repositories: trailofbits/skills, alirezarezvani/claude-skills, daymade/claude-code-skills, samber/cc-skills-golang, LjyYano/skill-pack, jshsakura/awesome-opencode-skills
- Median: ~100-130 lines | P90: ~300 | Max: 892 | >500 lines: 0.7%

**Source 3 — Local OpenCode skills (30 files)**
- Median: 110 lines | P90: 240 | Max: 314 (wsl-browser)

**Official specification limits**: agentskills.io, Anthropic SKILL-AUTHORING, and skillcheck all cap at **500 lines**.

**Implication**: R7's full-skill is a deliberately extreme control. The effect direction (less skill = better performance) is independently confirmed by SkillsBench at ecosystem scale. For future benchmarks, consider calibrating the "full" control to ~400-500 lines (P95, at spec limit) for more conservative but more defensible results.

### 10. Context Budget is Performance Budget (Core Insight from Cell 3 vs Cell 1)

The surprise finding: **Lean Skill + Mute Tools (Cell 3) OUTPERFORMS Full Skill + Mute Tools (Cell 1)** — both fewer tokens AND higher pass rate.

This is not because the full skill contains bad advice. The mechanism is **context window pressure**:

| Task | Cell 1 context usage | Cell 3 context usage | Cell 1 result | Cell 3 result |
|------|---------------------|---------------------|---------------|---------------|
| task-dependency-update | **144%** (overran) | 47% | FAIL | FAIL |
| task-documentation-website | **132%** | 52% | FAIL | FAIL |
| task-service-path-resolution | **120%** | 35% | FAIL | FAIL |
| task-stale-path-cleanup | **119%** | 64% | FAIL | FAIL |
| task-database-migration-gen | 71% | 47% | FAIL | **PASS** |
| task-performance-profile-parse | 49% | 22% | FAIL | **PASS** |

Cell 1 had 4 tasks exceed 100% of GLM-5.1's 200K context window. Cell 3 had zero. The 873-line skill (~8,700 tokens) accumulates across conversation turns, consuming context budget that could otherwise be spent on task-relevant data.

The counter-example exists: `task-search-empty-dir` went PASS→FAIL in Cell 3, confirming the effect is not universally monotonic — some tasks genuinely benefit from the richer guidance.

**This insight is now cited in PHILOSOPHY.md as supporting evidence for the Distributed Prompting thesis.**

### 11. Next Steps: Real-World Validation

R7 establishes **directional findings** under controlled conditions. External validity requires testing against real-world skill distributions.

#### 11a. Real-Case Audit (Qualitative)

Select 5-10 well-known MCP servers or agent skills and run `talking-cli audit-mcp` / `talking-cli audit`:

**Selection criteria**:
- Known / high-visibility (≥100 GitHub stars or enterprise use)
- Dense tool usage (≥10 distinct tools) — maximizes hint surface area
- Skill file >100 lines — provides compression space
- Non-trivial error paths — exercises Talking CLI's core audit scenarios
- Publicly accessible on GitHub — reproducible

**Candidate sources**:
- `modelcontextprotocol/servers` official repository (20+ servers)
- `anthropic/mcp-samples`
- High-traffic third-party MCP servers
- OpenCode skill registry community skills
- `cursor-directory` community .cursorrules collection

**Output**: AUDIT-REPORT.md per skill/server with H1-H4 or M1-M4 scores.

#### 11b. Before/After Benchmark (Quantitative)

For 3-5 audited skills with optimization potential:
1. Run benchmark tasks against original (unoptimized) skill
2. Apply Talking CLI optimization (add hints, compress skill)
3. Run same benchmark tasks against optimized skill
4. Compare: token usage + task success rate

**Output**: REAL-WORLD-VALIDATION.md with per-skill before/after metrics.

#### 11c. R8 Run Design

- **Provider**: GLM-5.1 (proven stable with 2-cell parallel)
- **Skill**: Calibrated "large" skill at ~400-500 lines (P95, at spec limit)
- **Task set**: `tasks-curated/` (15 tasks, 5e+7m+3h)
- **Design**: Full 2×2 ablation with ≥2 trials per cell for within-cell variance
- **Estimated time**: ~4h (2 phases × 2 cells × ~60min each)

#### 11d. Cross-Provider Validation

Run R8-equivalent on ≥1 additional provider (DeepSeek-V4-Flash or OpenAI GPT-4o) to establish cross-model generalization. Requires separate API keys.

**Priority order**: 11a (audit) → 11b (before/after) → 11c (R8 calibrated) → 11d (cross-provider)
