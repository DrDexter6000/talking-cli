# Checker Quality Audit: Cohen's κ Between Automated Checkers and Blind 2nd-Model Scoring

**Date**: 2026-04-27
**Scoring model**: GLM-5.1 (blind, temperature 0.1)
**Source data**: 68 benchmark runs from `real-world/results/2026-04-27-glm-5.1/`

## Result

| Metric | Value |
|--------|-------|
| Sampled runs | 20 (incl. all 5 failures + 1 partial score) |
| Valid scores | 15 (5 model responses unparseable) |
| **Cohen's κ** | **0.186** (slight agreement) |
| Observed agreement (Po) | 0.533 |
| Expected agreement (Pe) | 0.427 |
| Checker pass rate | 60% (9/15) |
| Model pass rate | 13% (2/15) |

**Verdict**: Low agreement. The 2nd model applies substantially stricter criteria than the automated checkers. All disagreements go one direction: checker PASS + model FAIL (7 cases). Zero cases of checker FAIL + model PASS.

## Methodology

1. **Sampling**: Deterministic sample of 20 runs (seed=42) from 68 total. All 5 failures force-included to ensure failure representation.
2. **Blind scoring prompt**: Each run presented to GLM-5.1 as:
   - Task description (full `prompt` field from task JSON)
   - Agent's observed outcome (`checkerReason` — the automated checker's summary of what the agent did)
   - Question: "Does this outcome indicate the agent successfully completed the task?"
3. **Constraint**: The model saw the checkerReason but not the checker's pass/fail verdict.
4. **Parsing**: Response parsed for leading PASS/FAIL keyword. Responses without clear verdict excluded (5/20).
5. **Cohen's κ**: Standard formula κ = (Po − Pe) / (1 − Pe).

## Confusion Matrix

|  | Model PASS | Model FAIL |
|--|-----------|------------|
| **Checker PASS** | 2 (a) | 7 (b) |
| **Checker FAIL** | 0 (c) | 6 (d) |

All 6 checker-FAIL cases are correctly identified by the model (4 timeouts, 1 legitimate failure, 1 partial 0.25 score).
All 7 disagreements are checker-PASS that the model rejected.

## Scored Runs

| # | Task | Variant | Checker | Model | Notes |
|---|------|---------|---------|-------|-------|
| 1 | resource-links | full+mute | FAIL | FAIL | Timeout — both agree |
| 2 | resource-links | full+talking | FAIL | FAIL | Timeout — both agree |
| 3 | resource-links | lean+talking | FAIL | FAIL | Timeout — both agree |
| 4 | sum-calculator | full+mute | FAIL | FAIL | Timeout — both agree |
| 5 | delete-cleanup | lean+talking | FAIL | FAIL | Checker: "does not confirm PermanentUser remains" |
| 6 | full-crud-cycle | talking | FAIL | FAIL | Checker: score 0.25 (only relation_deleted passed) |
| 7 | relations | full+mute | **PASS** | **FAIL** | Model disagrees — brief reason only |
| 8 | echo-basics | full+mute | PASS | PASS | Both agree |
| 9 | sum-calculator | lean+mute | PASS | ??? | Model response empty |
| 10 | weather-comparison | full+mute | PASS | ??? | Model response empty |
| 11 | complex-query | full+mute | PASS | PASS | Both agree |
| 12 | multi-tool-workflow | full+mute | PASS | ??? | Model response empty |
| 13 | resource-links | lean+mute | **PASS** | **FAIL** | Model: "too vague" |
| 14 | create-and-query | full+talking | **PASS** | **FAIL** | Model: "too vague" |
| 15 | weather-comparison | lean+talking | **PASS** | **FAIL** | Model: "too vague" |
| 16 | full-crud-cycle | lean+mute | **PASS** | **FAIL** | Checker: score 0.75, model rejects |
| 17 | create-and-query | lean+mute | **PASS** | **FAIL** | Model: "too vague" |
| 18 | update-observations | lean+mute | **PASS** | **FAIL** | Model response truncated |
| 19 | empty-graph-ops | lean+mute | PASS | ??? | Model response empty |
| 20 | empty-graph-ops | talking | PASS | ??? | Model response empty |

## Analysis

### Why κ is low

The primary driver is a **systematic strictness bias** in the 2nd model. The model requires detailed evidence of task completion, but the input it receives (`checkerReason`) is a brief summary, not the full agent transcript. Examples:

- **create-and-query**: Checker says "agent created entities and reported search results." The model considers this too vague — it wants evidence that specific entities (Google, Apple, Microsoft) were created with correct observations.
- **full-crud-cycle (0.75)**: Checker marks partial (3/4 steps). The model treats any missed step as FAIL.
- **resource-links (lean+mute)**: Checker says "described 5 links with both text and blob types." Model says "too vague."

This is a **methodology artifact**, not necessarily a checker defect. The checkers evaluate the full agent transcript; the 2nd model evaluates a one-line summary.

### What the agreement tells us

- **Failure detection is reliable**: 6/6 failures agreed. The checkers correctly flag timeouts, incomplete tasks, and missed steps.
- **Pass criteria may be lenient**: The 7 disagreements suggest the checkers accept brief confirmations where a stricter evaluator would want more detail. This is a calibration choice, not a bug.
- **Partial scoring is interesting**: Run #16 passed the checker at 0.75 (3/4 steps) but was rejected by the model. The checker's binary pass threshold may need review for multi-step tasks.

### Limitations

1. **Information asymmetry**: The 2nd model sees `checkerReason` (a 10-20 word summary), not the full agent transcript. This inherently disadvantages the model — it cannot verify details the checker saw.
2. **Same model scoring itself**: GLM-5.1 generated the original responses and also scores them. Using a different model (Claude, GPT-4o) would be more independent.
3. **5 unparseable responses**: 25% of model outputs were empty or didn't contain PASS/FAIL, reducing effective sample to 15.
4. **Single trial**: No repeated measures — κ could vary with different samples.

### Recommendations

1. **For future audits**: Use a different (stronger) model for blind scoring, and provide the full agent transcript instead of the checkerReason summary.
2. **For checker calibration**: The 7 disagreed PASS cases deserve manual review. If the agents did produce adequate detail, the checker is correctly lenient. If not, the model's stricter standard may be appropriate.
3. **For partial scores**: Consider reporting a score threshold (e.g., ≥0.75 = PASS) explicitly in checkerReason to aid interpretation.
4. **For reproducibility**: The audit script (`checker-audit.mjs`) and raw results (`checker-audit-results.json`) are available for re-running with different models or sample sizes.

## Files

- `benchmark/real-world/checker-audit.mjs` — Audit script (deterministic, reproducible)
- `benchmark/real-world/results/checker-audit-results.json` — Raw results with model responses
