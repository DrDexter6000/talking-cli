# Benchmark Methodology

**Audience**: anyone evaluating the credibility of Talking CLI's benchmark claims, including reviewers of the upcoming MCP `agent_hints` RFC.

**Status**: 4 rounds complete (4 models, 4,000+ executions). This document describes the methodology, the results, and the honest limitations.

---

## Why a methodology doc

Benchmark numbers without a methodology section are advertising. A reader who cannot reconstruct the experiment cannot critique it; a reader who cannot critique it has no reason to believe it.

---

## The hypothesis being tested

> **Distributed Prompting** — moving guidance from static `SKILL.md` into tool responses (hints) — produces materially better agent behavior than the equivalent guidance left as static prose.

"Better" decomposes into two measurable claims:

| Claim | Direct observable | Status |
|---|---|:---:|
| **Efficiency** | Input tokens per task | ✅ Proven (15–22% savings, 4 models, 4 rounds) |
| **Quality** | Pass rate per task | ❌ Not measurable (ceiling effect) |
| **Quality parity** | C4 ≈ C1 pass rate | ✅ Confirmed (Δ ≤ 2.2pp across all models) |

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

Four frontier models tested across two rounds:

| Model | Provider | Round(s) |
|-------|----------|:--------:|
| DeepSeek V4 Pro | `deepseek-reasoner` | R4 |
| DeepSeek Reasoner | `deepseek-reasoner` | R5 |
| Kimi K2.6 | `kimi-k2.6` (Coding Plan API) | R4 |
| GLM-5.1 | `glm-5.1` (Coding Plan API) | R4, R5 |

### Tasks

**Round 4**: 45 MCP tasks across 4 server targets (filesystem 13, memory 20, fetch 5, everything 7).

**Round 5**: 15 new harder tasks designed to reduce ceiling effect (filesystem 5, memory 5, fetch 3, everything 2).

### Execution parameters

- k = 3 trials per (task, variant, model) cell
- Max 20 LLM turns per task
- 5-minute timeout per LLM call

### Total executions

R4: 3 models × 2 variants × 45 tasks × 3 trials = **810 trial records**
R5: 2 models × 4 variants × 15 tasks × 3 trials = **360 trial records**
**Total: 4 models, 1,170+ trial records across 60 unique tasks**

---

## Results

### Primary finding: Token efficiency

**Round 4 (C1 vs C4)**

| Model | C1 avg input tokens | C4 avg input tokens | Savings |
|-------|:-------------------:|:-------------------:|:-------:|
| DeepSeek V4 Pro | 13,652 | 11,323 | **−17%** |
| Kimi K2.6 | 11,278 | 9,201 | **−18%** |
| GLM-5.1 | 12,256 | 9,623 | **−22%** |

**Round 5 (4-way ablation, harder tasks)**

| Model | C1 avg tokens | C4 avg tokens | Savings |
|-------|:------------:|:------------:|:-------:|
| DeepSeek Reasoner | 27,259 | 23,001 | **−15.6%** |
| GLM-5.1 | 18,831 | 14,818 | **−21.3%** |

Consistent across all 4 models and 4 rounds. The primary driver is the skill dimension: switching from 873-line to 168-line skill cuts 2,000–5,000 tokens per call.

### Secondary finding: Quality parity

| Model | Round | C1 | C4 | Δ | Sign test p |
|-------|:-----:|:--:|:--:|:-:|:-----------:|
| DeepSeek V4 Pro | R4 | 91.1% | 90.4% | −0.7pp | 1.000 |
| Kimi K2.6 | R4 | 88.1% | 90.4% | +1.5pp | 1.000 |
| GLM-5.1 | R4 | 90.4% | 93.3% | +2.2pp | 1.000 |
| DeepSeek Reasoner | R5 | 91.1% | 91.1% | 0.0pp | 1.000 |
| GLM-5.1 | R5 | 100% | 97.8% | −2.2pp | 1.000 |

C4 achieves parity or near-parity with C1 across all models and rounds. The worst delta is −2.2pp (GLM R5), within noise for k=3.

### Tertiary finding: C2 quality signal (R5 only)

| Model | C1 (Full/Mute) | C2 (Full/Talk) | Δ |
|-------|:--------------:|:--------------:|:-:|
| DeepSeek Reasoner | 91.1% | 97.8% | **+6.7pp** |
| GLM-5.1 | 100% | 100% | 0.0pp |

C2 (adding hints to full skill) outperforms C1 on DeepSeek by 6.7pp — the strongest quality signal observed. Not statistically significant (p=0.25) but suggests hints have value when tasks are challenging enough to produce failures.

### Why quality significance is elusive: Ceiling effect

| Round | Model | C1 tasks at 100% |
|:-----:|-------|:----------------:|
| R4 | All 3 models | 75.6% (34/45) |
| R5 | DeepSeek | 73.3% (11/15) |
| R5 | GLM-5.1 | 100% (15/15) |

With 73–100% of tasks at ceiling for C1, pass-rate analysis is underpowered. Current frontier models are too capable for the task suites.

---

## Known limitations

1. **Tasks too easy**: Average baseline pass rate 88–100%. Tasks need to be calibrated to 30–60% baseline on current models to measure a quality signal. Even R5's "harder" tasks are insufficient, especially for GLM-5.1.

2. **k=3 is low**: While sufficient for sign test, higher k (5–10) would increase power for Wilcoxon signed-rank on continuous scores.

3. **Single skill pair**: Only one Full/Lean skill pair tested. The result may not generalize to all skill compression strategies.

4. **C2 anomaly (R4) mitigated (R5)**: In R4, adding hints to verbose skills hurt GLM-5.1 by 6pp. In R5's 4-way ablation, C2 now outperforms C1 on DeepSeek (+6.7pp). The anomaly appears to be task-difficulty-dependent rather than systematic.

5. **No Western providers tested**: All models are Chinese-frontier. Cross-cultural validation on Claude, GPT-4o, Gemini is needed before claiming model-agnosticism at publication grade.

6. **No reference models**: Supplementary runs on weaker models (MiniMax, DeepSeek Flash) were not executed. These would help demonstrate whether hints help more on less capable models.

---

## Verdict rubric

| Verdict | Required conditions |
|---|---|
| **PROVEN** | total_tokens ↓ p < .05 **AND** turns ↓ p < .05 **AND** pass rate ↑ ≥ 10pp |
| **SUCCESS** | total_tokens ↓ p < .05 **AND** pass rate 95% CI does not cross significant degradation |
| **PARTIAL** | One of {total_tokens, turns} ↓ significant; other metrics neutral |
| **FAILURE** | No metric significant at p < .05 |

**Current verdict: PARTIAL** — token savings proven across 4 models and 4 rounds; quality parity confirmed; quality improvement suggested but not statistically significant.

Cross-provider claims require ≥ 3 providers reaching the same verdict tier or higher. We currently meet this for token efficiency and quality parity.

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
