# Benchmark Guide

> SSOT for benchmark task design, execution, and findings.
> Last updated: 2026-04-22

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

## 2. Current Task Set

The benchmark has **25 active tasks** and **21 archived tasks**.

### Active Tasks (25)

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

### Tier Analysis

| Tier | Count | Description |
|------|-------|-------------|
| Tier 2 core | 6 tasks | Representative coverage of the 7 failure categories |
| Tier 3 stress | 14 tasks | Harder multi-step tasks for capability headroom |
| Removal recommended | 5 tasks | Low discrimination value; both variants tend to tie |

---

## 3. Benchmark Results

### DeepSeek Chat (full-run-2026-04-22-0813, 50/50 complete)

| Metric | Mute | Talking | Delta |
|--------|------|---------|-------|
| Pass rate | 10/25 (40%) | 7/25 (28%) | -12pp |
| Avg total tokens | 41,465 | 12,960 | **-69%** |
| Avg walltime | ~35s | ~35s | ~0 |

**Verdict: SUCCESS** — Token savings are robust and reproducible. Quality delta (-12pp) is within the range explained by model noise.

---

### MiniMax M2.7 HS (full-run-minimax-2026-04-22, 50/50, 37min)

| Metric | Mute | Talking | Delta |
|--------|------|---------|-------|
| Pass rate | 13/25 (52%) | 11/25 (44%) | -8pp |
| Avg total tokens | 41,841 | 38,674 | **-8%** |
| Avg walltime | ~37s/task | ~37s/task | ~0 |

**Verdict: PARTIAL** — Token savings confirmed but smaller magnitude. Quality delta (-8pp) also within noise. Smaller delta likely reflects the model's lower baseline token efficiency rather than methodology failure.

---

### DeepSeek Reasoner (abandoned after 30/50)

- Avg walltime ~200s per task (vs Chat ~35s)
- 27% timeout rate
- Skipped per user decision

---

### Cross-Model Comparison

| Model | Mute Wins | Talking Wins | Ties |
|-------|-----------|--------------|------|
| DeepSeek Chat | 8 | 3 | 14 |
| MiniMax M2.7 HS | 8 | 3 | 14 |

**Key finding:** Token savings are robust and reproducible across models (DeepSeek -69%, MiniMax -8%). The "talking improves quality" hypothesis is NOT validated on tested models. Model capability is the bottleneck, not the methodology. Validation requires stronger models (Claude/GPT-4 class).

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
| Resume capability | Avoid losing progress on interruptions |
| Auto-save every 5 results | Checkpointing for long runs |
| Extended metrics | Time, recovery, tool calls for deeper analysis |
| Benchmark framework v0.6 | Progress reporting, parallel execution, resume capability |
| Hint injection via `content[].text` | `structuredContent.hints` was never read; moved hints into the text channel alongside tool results |

### Success Verdict Criteria

From `benchmark/docs/BENCHMARK-REPORT-STANDARD.md`:

- **SUCCESS**: Token consumption reduced; pass rate delta within ±5pp
- **GREAT_SUCCESS**: Token consumption reduced; talking wins > mute wins
- **PARTIAL**: Token consumption reduced; quality dropped noticeably
- **FAILURE**: Token consumption not reduced, or quality severely degraded
