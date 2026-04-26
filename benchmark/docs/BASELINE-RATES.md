# Baseline Pass Rates — DeepSeek-V4-Flash (full-skill+mute)

> **Date**: 2026-04-25
> **Provider**: deepseek (deepseek-v4-flash)
> **Variant**: full-skill+mute (control cell)
> **Tasks**: 30 (9 easy, 15 medium, 6 hard)
> **Turn limit**: 20 per task
> **Run ID**: R5 (results/2026-04-25)

## 1. Overall Results

| Metric | Value |
|--------|-------|
| **Total pass** | 5/30 (17%) |
| **Mean tokens** | 198K per task |
| **Timeout** | 14/30 (47%) |
| **End-turn fail** | 15/30 (50%) |
| **Error** | 1/30 (3%) |

## 2. Tier Distribution

| Tier | Target | Actual | Delta |
|------|--------|--------|-------|
| **Easy** | ≥85% | 22% (2/9) | **−63pp** |
| **Medium** | 60-75% | 20% (3/15) | **−40~55pp** |
| **Hard** | 20-40% | 0% (0/6) | **−20~40pp** |

**Verdict: ALL TIERS SIGNIFICANTLY BELOW TARGET.**

## 3. Tier × Hint-Trigger Matrix

| Tier | empty | permission | schema |
|------|-------|-----------|--------|
| **Easy** | 0/3 (0%) | 1/3 (33%) | 1/3 (33%) |
| **Medium** | 1/5 (20%) | 0/5 (0%) | 2/5 (40%) |
| **Hard** | 0/2 (0%) | 0/2 (0%) | 0/2 (0%) |

Schema-trigger tasks have the highest pass rate (30% overall), suggesting the model handles structured-data tasks better than file-exploration (empty) or access-control (permission) tasks.

## 4. Bug Fix Impact

A sandbox path injection bug was discovered and fixed between runs:

| Metric | R4 (buggy) | R5 (fixed) |
|--------|-----------|-----------|
| Access denied on first call | 30/30 | 0/30 |
| Total pass rate | 30% (9/30) | 17% (5/30) |
| Easy pass rate | 56% (5/9) | 22% (2/9) |
| Medium pass rate | 27% (4/15) | 20% (3/15) |
| Hard pass rate | 0% (0/6) | 0% (0/6) |

R4's higher pass rate was **artificially inflated** — the model accidentally recovered from path errors by exploring and finding partial data. R5 reflects true model capability.

## 5. Root Cause Analysis

The low pass rates are NOT caused by:

- **Sandbox bug**: Fixed. Access denied events are now rare secondary exploration (21 across 17 tasks, not first-call blockers).
- **Turn limit exhaustion**: 14/25 failures are timeout (hit 20 turns), but the model is actively working — it's just not completing the task correctly within the budget.
- **Checker strictness**: Checkers validate concrete artifacts (file existence, content patterns). The model simply isn't producing the right outputs.

The low pass rates ARE caused by:

1. **Model capability ceiling**: DeepSeek-V4-Flash is a budget-tier model. Many tasks require multi-step reasoning across 5+ files that exceeds its reliable planning depth.
2. **Task scope**: Many tasks require creating 3-5 files with specific content, which demands sustained coherent output over many turns.
3. **No hint assistance**: This is the control (bloated+mute) cell. The model gets no actionable guidance from tools.

## 6. Implications for Benchmark Design

### Option A: Adjust Tier Targets (Accept Model Ceiling)

| Tier | Current Target | Proposed Target |
|------|---------------|----------------|
| Easy | ≥85% | ≥40% |
| Medium | 60-75% | 20-40% |
| Hard | 20-40% | 0-15% |

Rationale: If the benchmark's purpose is to measure *relative* improvement (talking vs mute), absolute baseline doesn't matter as long as there's room for improvement. 17% baseline leaves 83pp headroom.

**Risk**: If the model never passes, you can't measure improvement. You need at least some tasks to pass in the control arm to detect a delta.

### Option B: Adjust Task Difficulty (Reduce Scope)

Simplify tasks to achieve target baselines:
- Reduce file count per task (5 files → 2-3)
- Shorten expected output (detailed report → key findings)
- Provide more structure in prompts (step-by-step hints in prompt)

**Risk**: Over-simplification reduces ecological validity.

### Option C: Use Stronger Model for Baseline Calibration

Run baseline on Claude/GPT-4-class model, then validate on budget models.

**Risk**: Requires additional API key and cost.

### Recommendation

**Option A with a floor constraint**: Accept lower targets but require at least 3 tasks per tier to pass in baseline. If easy tier can't reach 30%, simplify 2-3 easy tasks until it does. The current easy tier (22%) is close to this floor.

## 7. Passing Tasks (Reference)

These 5 tasks passed — they represent the model's achievable scope:

| Task | Tier | Trigger | Turns | Tokens |
|------|------|---------|-------|--------|
| task-database-migration-gen | medium | schema | 20 | 242K |
| task-doc-generation-api | medium | empty | 19 | 233K |
| task-documentation-website | easy | permission | 18 | 228K |
| task-large-yaml-pipeline | medium | schema | 20 | 258K |
| task-performance-profile-parse | easy | schema | 6 | 214K |

Observations:
- 3/5 passing tasks use schema trigger (structured data tasks)
- 4/5 use 18-20 turns (near the limit)
- The 1 task that passed quickly (6 turns) is performance-profile-parse (schema trigger, easy tier)
