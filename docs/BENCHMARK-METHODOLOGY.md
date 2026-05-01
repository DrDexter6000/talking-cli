# Benchmark Methodology

**Audience**: anyone evaluating the credibility of Talking CLI's benchmark claims, including reviewers of the upcoming MCP `agent_hints` RFC.

**Status**: 3-model cross-validation complete (1,620 executions). This document describes the methodology, the results, and the honest limitations.

---

## Why a methodology doc

Benchmark numbers without a methodology section are advertising. A reader who cannot reconstruct the experiment cannot critique it; a reader who cannot critique it has no reason to believe it.

---

## The hypothesis being tested

> **Distributed Prompting** — moving guidance from static `SKILL.md` into tool responses (hints) — produces materially better agent behavior than the equivalent guidance left as static prose.

"Better" decomposes into two measurable claims:

| Claim | Direct observable | Status |
|---|---|:---:|
| **Efficiency** | Input tokens per task | ✅ Proven (17–22% savings, 3 models) |
| **Quality** | Pass rate per task | ❌ Not measurable (ceiling effect) |

---

## Experimental design

### 2×2 Factorial Ablation

| Factor | Levels |
|--------|--------|
| Skill document | Full Skill (873 lines) vs Lean Skill (168 lines) |
| Server behavior | Mute Tools (raw JSON) vs Hinting Tools (JSON + contextual hints) |

This produces 4 cells:

| Cell | Skill | Server | Label |
|:----:|-------|--------|-------|
| C1 | Full Skill | Mute | Control |
| C2 | Full Skill | Hinting | Hints only |
| C3 | Lean Skill | Mute | Skill compression only |
| C4 | Lean Skill | Hinting | Combined treatment |

### Models

Three frontier models tested independently:

| Model | Provider | Context Window |
|-------|----------|:--------------:|
| DeepSeek V4 Pro | `deepseek-reasoner` | 1M tokens |
| Kimi K2.6 | `kimi-k2.6` (Coding Plan API) | 128K tokens |
| GLM-5.1 | `glm-5.1` (Coding Plan API) | 200K tokens |

### Tasks

45 MCP tasks across 4 server targets:

| Target | Tasks | Description |
|--------|:-----:|-------------|
| server-everything | 7 | Multi-tool workflows, resource handling |
| server-fetch | 5 | HTTP fetching, 404 handling, truncation |
| server-filesystem | 13 | File CRUD, search, batch reads, path traversal |
| server-memory | 20 | Knowledge graph CRUD, relations, dedup, edge cases |

### Execution parameters

- k = 3 trials per (task, variant, model) cell
- Max 20 LLM turns per task
- 5-minute timeout per LLM call
- Concurrency: 2 (DeepSeek, GLM-5.1) / 3 (Kimi)

### Total executions

3 models × 4 variants × 45 tasks × 3 trials = **1,620 trial records**

---

## Results

### Primary finding: Token efficiency

| Model | C1 avg input tokens | C4 avg input tokens | Savings |
|-------|:-------------------:|:-------------------:|:-------:|
| DeepSeek V4 Pro | 13,652 | 11,323 | **−17%** |
| Kimi K2.6 | 11,278 | 9,201 | **−18%** |
| GLM-5.1 | 12,256 | 9,623 | **−22%** |

Consistent across all models. The primary driver is the skill dimension: switching from 873-line to 168-line skill cuts ~2,000–3,200 tokens per call.

### Secondary finding: Pass rate

| Model | C4 − C1 Δ | Sign test p |
|-------|:---------:|:-----------:|
| DeepSeek V4 Pro | −0.7 pp | 1.000 |
| Kimi K2.6 | +1.5 pp | 1.000 |
| GLM-5.1 | +2.2 pp | 1.000 |

Not statistically significant for any model.

### Why: Ceiling effect

| Category | Count | Share |
|----------|:-----:|:-----:|
| Ceiling (100% in all 12 cells) | 34 | 75.6% |
| Floor (0% in all 12 cells) | 3 | 6.7% |
| Discriminating | 8 | 17.8% |

With 82% of tasks unable to differentiate between control and treatment, pass-rate analysis is underpowered. Current frontier models are too capable for this task suite.

---

## Known limitations

1. **Tasks too easy**: Average baseline pass rate 88–91%. Tasks need to be calibrated to 40–60% baseline on current models to measure a quality signal.

2. **k=3 is low**: While sufficient for sign test, higher k (5–10) would increase power for Wilcoxon signed-rank on continuous scores.

3. **Single skill pair**: Only one Full/Lean skill pair tested. The result may not generalize to all skill compression strategies.

4. **C2 anomaly unexplained**: Adding hints to verbose skills hurts GLM-5.1 by 6pp. Root cause (information overload? attention dilution?) not yet investigated.

5. **No Western providers tested**: All three models are Chinese-frontier. Cross-cultural validation on Claude, GPT-4o, Gemini is needed before claiming model-agnosticism at publication grade.

6. **No reference models**: Supplementary runs on weaker models (MiniMax, DeepSeek Flash) were not executed. These would help demonstrate whether hints help more on less capable models.

---

## Verdict rubric

| Verdict | Required conditions |
|---|---|
| **PROVEN** | total_tokens ↓ p < .05 **AND** turns ↓ p < .05 **AND** pass rate ↑ ≥ 10pp |
| **SUCCESS** | total_tokens ↓ p < .05 **AND** pass rate 95% CI does not cross significant degradation |
| **PARTIAL** | One of {total_tokens, turns} ↓ significant; other metrics neutral |
| **FAILURE** | No metric significant at p < .05 |

**Current verdict: PARTIAL** — token savings proven across 3 models; quality signal not measurable due to ceiling effect.

Cross-provider claims require ≥ 3 providers reaching the same verdict tier or higher. We currently meet this for token efficiency only.

---

## Honesty contract

Talking CLI's case is that *every prompt surface should declare its boundaries*. This document tries to honor that for the benchmark itself:

- We report what the data says, not what we hoped it would say.
- The ceiling effect and null pass-rate findings are presented with equal prominence as the token savings.
- The C2 anomaly (hints hurting with verbose skills) is documented, not hidden.
- We explicitly note what the data does NOT support.

---

## See also

- [`../PHILOSOPHY.md`](../PHILOSOPHY.md) — Distributed Prompting methodology
- [`../README.md`](../README.md) — project overview and benchmark results
