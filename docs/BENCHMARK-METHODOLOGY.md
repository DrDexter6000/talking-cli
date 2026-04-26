# Benchmark Methodology

**Audience**: anyone evaluating the credibility of Talking CLI's benchmark claims, including reviewers of the upcoming MCP `agent_hints` RFC.

**Status**: v1 results published; v2 design (this document) being implemented. Open about the gap between the two — the v1 numbers are real but bounded; v2 is what they grow into.

---

## Why a methodology doc

Benchmark numbers without a methodology section are advertising. A reader who cannot reconstruct the experiment cannot critique it; a reader who cannot critique it has no reason to believe it.

This document explains:

1. What hypothesis the benchmark is actually testing.
2. The design principles that govern how we build the corpus, run the trials, and report results.
3. The known limitations of the v1 benchmark — explicitly, before a reviewer has to find them.
4. The v2 design that addresses those limitations and the verdict rubric that v2 results will be reported under.

---

## The hypothesis being tested

> **Distributed Prompting** — moving guidance from static `SKILL.md` into tool responses (hints) — produces materially better agent behavior than the equivalent guidance left as static prose.

"Better" decomposes into three measurable claims:

| Claim | Direct observable | Why it matters |
|---|---|---|
| **Efficiency** | Total end-to-end tokens (input + output, cache-aware) per task | Cost; this is what adopters write checks for |
| **Behavior** | Turns to first successful tool call; error → recovery distance | Direct evidence the agent stops wandering |
| **Quality** | Pass rate per difficulty tier | The agent finishes more tasks, especially medium-difficulty ones |

A benchmark that only measures the first claim (efficiency) leaves the methodology open to the rebuttal *"you've just shown shorter prompts win, which everyone already knew."* All three observables are needed to defend the thesis.

---

## Design principles

These principles govern all benchmark generations. Where v1 violates them, v2 fixes the violation.

### 1. Measure what the thesis actually claims

The thesis is about *agent behavior*. Aggregate token count is downstream — informative but not diagnostic. Direct observables of behavior are turns and error-recovery distance. Both must headline alongside tokens.

### 2. Calibrate difficulty for signal, not for impressiveness

A benchmark composed entirely of hard tasks (~30% baseline pass rate) is the worst operating point for detecting hint-driven lift: most tasks fail in both arms, hiding any difference. The sweet spot is **medium tasks with mute baseline 60–75%**, where hints can credibly push borderline failures into successes.

A balanced corpus needs all three tiers, but the *signal* lives in the medium tier.

### 3. Categorize by hint-trigger scenario

Hints help in three structurally distinct situations:

- **Empty-result trigger** — search returned no rows; hint suggests broadening the query.
- **Permission/path trigger** — file inaccessible or wrong path; hint suggests the correct location.
- **Schema-ambiguity trigger** — argument format wrong; hint provides a worked example.

A benchmark that does not decompose by trigger type cannot tell whether the methodology works *where it claims to*. Aggregate-only reporting hides which trigger types are doing the work.

### 4. Variance is a feature

If hints reduce agent decision entropy, the talking variant should be **more consistent** across repeated runs, not just better on average. Within-task variance — measured with k ≥ 3 trials per cell — is a first-class metric. Lower variance is a structural signature that mean differences cannot fake.

### 5. Reproducibility over headline

A single-shot benchmark is a blog post. Evidence requires:

- k ≥ 3 trials per (task, variant) cell; k = 5 for headline runs.
- Schema-versioned result rows.
- SHA-256 hashes of task definitions stored alongside results, refusing to combine runs with mismatched hashes.
- Captured server stderr for forensic trail.
- Mechanical `diff` between mute and talking server forks committed as an artifact.

---

## Two-criterion success framing

The current author-stated success model is:

> ① E2E token ↓ + completion rate unchanged = SUCCESS
> ② E2E token ↓ + completion rate ↑ = GREAT_SUCCESS

This is directionally right but has two structural gaps that the v2 verdict rubric (below) corrects:

| Gap | v2 fix |
|---|---|
| "Unchanged" is statistically unmeasurable on small n | Replace with: pass-rate 95% CI does not exclude 0 (i.e., no *significant* degradation) |
| "Token" is ambiguous — input, output, or cache-adjusted? | Replace with: total tokens (input + output, cache-aware) |
| Turns are missing entirely from the framing | Add as a co-equal headline metric |

---

## v1 (current) — what it shows and what it does not

### What v1 measured

- 25 hand-curated tasks, primarily hard difficulty.
- Two arms: `mute` (server returns raw JSON) vs `talking` (server returns JSON + hints).
- Single trial per (task, arm). No within-cell variance estimate.
- Headline statistical test: Wilcoxon signed-rank on per-task input-token deltas.
- Sole model with full results: DeepSeek-V3.2 (and partial MiniMax).

### What v1 proves

- **Token efficiency on DeepSeek-V3.2**: talking variant uses substantively fewer tokens at p < .05.

### What v1 does NOT prove

- **Quality lift**: pass-rate delta of +4pp (36% → 40%) is within statistical noise on n = 25; sign test p = 1.0.
- **Cross-model generalization**: cost extrapolations to Claude / GPT-4o / Gemini in the README use ratio math, not actual runs.
- **Decomposition of savings**: how much of the −76% is initial-prompt shrink vs. fewer agent turns? v1 does not separate.
- **Trigger-type effectiveness**: v1 corpus is not categorized by hint-trigger scenario, so per-category effect sizes cannot be computed.
- **Variant integrity**: under default settings, v1's `mute` arm uses a hardcoded ~50-word fallback prompt rather than `full-skill.md` (873 lines). The README narrative compares static documents; the runtime experiment compares something else. v2's first phase fixes this.

The integrity of acknowledging this last point is the basis for asking readers to take v2 seriously.

---

## v2 design

### Phase A — experimental design correction (gate)

- Variant ↔ skill loader mismatch fixed (default variants match the README narrative).
- Wilcoxon refactored to test total_tokens, turns, tool_errors, and recovery_distance independently.
- `cost_per_success` (total tokens across all runs / successful runs) replaces success-only token average as headline cost metric.
- Result rows carry `schemaVersion` and `taskHash`.
- Each task gains `tier` and `hint_trigger` metadata.

### Phase B — task corpus redesign

30-task structured corpus, **3 trigger × 3 tier**:

| | Tier-easy (mute baseline ≥ 85%) | Tier-medium (60–75%) | Tier-hard (20–40%) |
|---|---|---|---|
| Empty-result trigger | 3 | 5 | 2 |
| Permission/path trigger | 3 | 5 | 2 |
| Schema-ambiguity trigger | 3 | 5 | 2 |

Reporting per cell, not just aggregate.

### Phase C — usability and trace

- `--repeat N` flag, default 3 in published runs.
- Per-failure trace dumps under `results/<run>/traces/`.
- Per-task sandbox isolation; server stderr captured.
- Mechanical `benchmark/servers/DIFF.md` regenerated in CI.

### Phase D — publication standard

| Verdict | Required conditions |
|---|---|
| **PROVEN** | total_tokens ↓ p < .05 **AND** turns ↓ p < .05 **AND** medium-tier pass rate ↑ ≥ 10pp |
| **SUCCESS** | total_tokens ↓ p < .05 **AND** pass rate 95% CI ⊃ 0 (no significant degradation) |
| **PARTIAL** | One of {total_tokens, turns} ↓ p < .05; other metrics neutral |
| **FAILURE** | No metric significant at p < .05 |

Cross-provider claims require ≥ 3 providers reaching the same verdict tier or higher.

### Phase E — credibility hardening (for MCP RFC submission)

- Checker quality audit: blind rescore of 20 sampled task runs by human or second model; report Cohen's κ.
- Public-corpus robustness subset: ≥ 10 tasks drawn from SWE-bench Verified or equivalent, run alongside the structured 30-task corpus, to disarm the selection-bias critique.

### Optional — the variance test

For each task, run k = 5 trials per arm and compare **outcome variance** (turn-count standard deviation), not just mean.

If hints reduce agent decision entropy, talking variance should be lower than mute variance. This is the test most likely to survive adversarial review: variance reductions are structural signatures, much harder to explain as cherry-picking.

---

## Honesty contract

This methodology is published *before* v2 results, deliberately. The intent is:

1. The design is critiqueable on its own merits, not defended after-the-fact to fit a result.
2. If v2 produces FAILURE, that result is fully informative — the framework that called for it is the same one that publishes it.
3. v1 limitations are stated in the same document as the v2 design, not in a footnote behind it.

Talking CLI's case is that *every prompt surface should declare its boundaries*. This document tries to honor that for the benchmark itself.

---

## See also

- [`../PHILOSOPHY.md`](../PHILOSOPHY.md) — Distributed Prompting methodology.
- [`../README.md`](../README.md) — project overview and v1 benchmark results.

Internal-only benchmark docs (not public; `benchmark/` is currently gitignored): `benchmark/docs/BENCHMARK-GUIDE.md` (findings SSOT), `benchmark/docs/BENCHMARK-REPORT-STANDARD.md`, `benchmark/docs/PROVIDER-CONFIG.md`. These will be made public once the benchmark harness exits its current gitignore period.
