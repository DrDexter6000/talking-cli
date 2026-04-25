# CORPUS-MATRIX.md — 30-Task Benchmark Corpus (3×3 Matrix)

**Generated:** 2026-04-23
**Total tasks:** 30
**Source:** 25 existing + 5 new

## Matrix Overview

The 3×3 matrix cross-classifies tasks by **hint trigger** (row) and **tier** (column).
Hint triggers represent the dominant tool-state the agent will encounter:

- **empty** — zero-result / sparse-result scenarios
- **permission** — path / access / permission issues
- **schema** — ambiguous or evolving data formats

Tiers represent agent execution complexity:

- **easy** — 1–2 tool calls, straightforward operation
- **medium** — 2–5 tool calls, some reasoning needed
- **hard** — 5+ tool calls, error handling, ambiguity, many files

## Cell Occupancy

```
                 easy    medium    hard    Total
               ┌───────┬─────────┬───────┬───────┐
  empty        │   3   │    5    │   2   │  10   │
               ├───────┼─────────┼───────┼───────┤
  permission   │   3   │    5    │   2   │  10   │
               ├───────┼─────────┼───────┼───────┤
  schema       │   3   │    5    │   2   │  10   │
               ├───────┼─────────┼───────┼───────┤
  Total        │   9   │   15    │   6   │  30   │
               └───────┴─────────┴───────┴───────┘
```

## Task Assignments

### empty / easy (3)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-dependency-update` | existing | Check packages for vulnerabilities — often returns none |
| `task-api-integration-test` | existing | Test API endpoints — many return empty responses |
| `task-search-empty-dir` | **new** | Search TODO/FIXME in a clean codebase — returns empty |

### empty / medium (5)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-doc-generation-api` | existing | Extract JSDoc from source — sparse comments expected |
| `task-i18n-extraction-gen` | existing | Extract i18n strings — some files have none |
| `task-log-analysis-nginx` | existing | Parse access log for security patterns — sparse hits |
| `task-test-coverage-analysis` | existing | Find uncovered code paths — many gaps |
| `task-multi-config-resolve` | **new** | Search config across 8 services — some have no files |

### empty / hard (2)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-codebase-dead-code` | existing | Find unused exports — many searches return empty |
| `task-error-recovery-batch` | existing | Process corrupted/empty CSV files — mixed empty results |

### permission / easy (3)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-documentation-website` | existing | Create doc directory tree — path creation issues |
| `task-code-review-automation` | existing | Set up git hooks and CI — config path issues |
| `task-config-migration` | existing | Migrate config across environments — path resolution |

### permission / medium (5)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-config-drift-audit` | existing | Read 56 config files across 8 environments |
| `task-env-config-hydration` | existing | Access 15 microservice directories for env vars |
| `task-security-scan-codebase` | existing | Scan sensitive paths and credential locations |
| `task-service-path-resolution` | **new** | Validate paths across 6 environment directories |
| `task-stale-path-cleanup` | **new** | Migrate stale path references across config/doc files |

### permission / hard (2)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-log-correlation-incident` | existing | Read logs across 6 services — cross-service access |
| `task-multi-service-debug` | existing | Debug 8 microservices — multi-directory access |

### schema / easy (3)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-performance-profile-parse` | existing | Parse V8 profile JSON formats |
| `task-data-pipeline-build` | existing | Transform between JSON/CSV/XML/text formats |
| `task-config-schema-compare` | **new** | Compare two config schema versions for drift |

### schema / medium (5)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-large-yaml-pipeline` | existing | Refactor complex YAML CI/CD pipeline |
| `task-monorepo-dependency-graph` | existing | Parse package.json across 12 packages |
| `task-multifile-refactor-esm` | existing | Convert CJS → ESM import syntax |
| `task-large-scale-refactor` | existing | Transform code formats across 200+ files |
| `task-database-migration-gen` | existing | Generate SQL migration from schema diff |

### schema / hard (2)

| Task ID | Origin | Rationale |
|---------|--------|-----------|
| `task-batch-json-transform` | existing | Complex JSON schema migration with field restructuring |
| `task-batch-markdown-transform` | existing | Normalize inconsistent markdown across 15 files |

## Classification Rationale

### Tier (execution complexity)

- **easy**: Despite verbose prompts, these tasks require only 1–2 tool-call patterns
  (search + report, read + compare, list + write). The agent's core loop is simple.
- **medium**: 2–5 distinct tool-call patterns with some reasoning (cross-referencing
  files, comparing values, generating structured output from analysis).
- **hard**: 5+ tool-call patterns with error handling, multi-service coordination,
  or complex transformation logic. Agent must maintain state across many operations.

### Hint trigger (dominant tool-state)

- **empty**: Task naturally produces zero-result or sparse-result tool responses.
  The agent must handle "nothing found" scenarios and still produce useful output.
- **permission**: Task requires accessing files across directories/environments that
  may not exist, have wrong permissions, or have path mismatches.
- **schema**: Task involves transforming, comparing, or reconciling data in different
  formats where field names, types, or structures may be ambiguous or inconsistent.

## Gap Analysis (Pre-Fill)

Before adding 5 new tasks, the 25-task distribution was:

```
                 easy    medium    hard
               ┌───────┬─────────┬───────┐
  empty        │   2   │    4    │   2   │
               ├───────┼─────────┼───────┤
  permission   │   3   │    3    │   2   │
               ├───────┼─────────┼───────┤
  schema       │   2   │    5    │   2   │
               └───────┴─────────┴───────┘
```

Gaps filled by 5 new tasks:
1. `task-search-empty-dir` → empty/easy (+1)
2. `task-multi-config-resolve` → empty/medium (+1)
3. `task-service-path-resolution` → permission/medium (+1)
4. `task-stale-path-cleanup` → permission/medium (+1)
5. `task-config-schema-compare` → schema/easy (+1)
