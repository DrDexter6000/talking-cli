# Benchmark Progress & Findings

> **SSOT (Single Source of Truth)** for all benchmark-related progress, findings, and decisions.
> Last updated: 2026-04-21
> Status: Active development
> Version: Framework v0.6 (package.json 0.1.0)

---

## 1. Current Status

### What We've Built

| Component | Status | Notes |
|-----------|--------|-------|
| Benchmark runner | ✅ v0.6 | Progress reporting, parallel execution, resume capability |
| Stats engine | ✅ Enhanced | Sign test, Wilcoxon, token efficiency, time metrics, recovery tracking |
| Report renderer | ✅ v0.6 | AUDIT-BENCHMARK.md with executive summary |
| CLI interface | ✅ Enhanced | `--parallel`, `--max-concurrency`, `--resume` flags |
| Task set | ✅ 39 tasks | 29 active + 10 recovery tasks |
| Hint coverage | ✅ 10/10 tools | All filesystem tools have hints |

### Benchmark Runner Features (v0.6)

```bash
# Basic run
npm run benchmark -- --provider minimax

# Parallel execution (3 concurrent tasks)
npm run benchmark -- --provider minimax --parallel --max-concurrency 3

# Resume interrupted run
npm run benchmark -- --provider minimax --parallel --resume

# Limit tasks for quick test
npm run benchmark -- --provider minimax --limit 5
```

**New metrics tracked:**
- `walltime`: Actual execution time per task
- `errorRecoveries`: Count of errors successfully recovered from
- `toolCalls`: Total tool invocations
- `timeToFirstTool`: Time until first tool call
- `timeToSuccess`: Time until successful completion

---

## 2. Key Findings

### 2.1 The Critical Bug (Fixed ✅)

**Problem**: Hints were placed in `structuredContent.hints` but executor only read `content[].text`.

**Impact**: v4/v5 benchmarks compared two mute variants — hints never reached the model.

**Fix**: `withHints()` now injects hints into `content[].text` alongside tool results.

### 2.2 API Issues (Fixed ✅)

**Problem**: Wrong base URL (`api.minimaxi.com` vs `api.minimax.io`).

**Discovery**: `sk-cp-...` is Coding Plan key requiring Chinese endpoint `https://api.minimaxi.com/anthropic`.

**Fix**: Base URL validation + correct endpoint for key type.

### 2.3 Model Capability Ceiling

**Observation**: MiniMax M2.7 Highspeed is too weak to show meaningful differences.

**Evidence**:
- v8-full (35 tasks): 23% discordance rate
- v10-curated (29 tasks): 17% discordance rate  
- v11-real-failures (39 tasks): 2.6% discordance rate

**Pattern**:
- Complex tasks: both variants fail → tie
- Simple tasks: both variants succeed → tie
- Only narrow middle band shows differences

**Conclusion**: Model capability is the bottleneck, not the methodology.

### 2.5 Phase 1 Benchmark Results (Honest Finding)

**Date**: 2026-04-20
**Model**: MiniMax-M2.7-highspeed
**Task Set**: 25 filesystem tasks
**Variants**: mute vs talking (with hints)

**Result**: **NEGATIVE (statistically significant)**
- Talking wins: 0
- Mute wins: 6  
- Ties: 19
- Sign test: n=6, p=0.03125 (< 0.05)

**Interpretation**: On MiniMax M2.7, the mute variant (no hints) significantly outperformed the talking variant. This does NOT mean the methodology is invalid — it means this particular model cannot leverage the hints effectively.

**Full details**: See `.internal/TDD-P4-phase-1.md` for complete execution log.

### 2.4 Token Efficiency (Case Study Only)

**OpenClaw gh-issues case study** (static analysis, no model execution):
- Bloated: 887 lines / 4,939 words / 34,850 chars
- Talking: 170 lines / 772 words / 5,479 chars
- **84.3% volume reduction**

⚠️ **Important**: This measures SKILL.md size reduction only. It does NOT prove that the talking variant achieves the same task quality with fewer tokens. The controlled benchmark (Phase 1) produced a NEGATIVE result on MiniMax M2.7 (see §2.5 below).

**This is objective and independent of model capability, but it is not sufficient evidence of the full claim.**

---

## 3. Decisions Made

### 3.1 Testing Strategy

| Decision | Rationale |
|----------|-----------|
| Pause model testing | MiniMax M2.7 produced negative results; stronger models needed for validation |
| Focus on token efficiency | Objective, reproducible, independent of model capability |
| Case study approach | OpenClaw, Anthropic skill-creator, Vercel AGENTS.md |
| Keep functional benchmark | For future stronger models; framework is ready |

### 3.2 Benchmark Design

| Decision | Rationale |
|----------|-----------|
| Parallel execution | Reduce 40min → ~15min runtime |
| Resume capability | Avoid losing progress on interruptions |
| Auto-save every 5 results | Checkpointing for long runs |
| Extended metrics | Time, recovery, tool calls for deeper analysis |

---

## 4. Blockers & Challenges

### Current Blockers

1. **Model capability**: MiniMax M2.7 cannot leverage hints effectively
2. **Cost**: Stronger models (Claude/GPT-4) too expensive for systematic testing
3. **Time**: Even with parallelization, full benchmark takes 15-20 minutes

### Mitigations

1. **Token efficiency benchmark**: Doesn't require model execution
2. **Case studies**: Real-world SKILL.md comparisons
3. **Framework ready**: When stronger models become available/cheaper

---

## 5. Next Steps

### Immediate (This Week)

1. ✅ Benchmark framework v0.6 (progress, parallel, metrics)
2. ⏳ Run token efficiency benchmark on all tasks
3. ⏳ Document case studies (Anthropic skill-creator, Vercel AGENTS.md)

### Short-term (Next 2 Weeks)

1. **Analyze hint quality**: Are hints actionable? Do they lead to recovery?
2. **Optimize task set**: Remove non-discriminative tasks, add more recovery scenarios
3. **Token efficiency report**: Comprehensive analysis of bloated vs talking SKILL.md

### Long-term (Next Month)

1. **Wait for stronger models**: Claude 3.5 Sonnet price drop or GPT-4o mini
2. **MCP spec proposal**: Formal `agent_hints` field proposal
3. **Community validation**: Open benchmark for external reproduction

---

## 6. Success Criteria

### Achieved ✅

1. **Framework robustness**: Progress reporting, parallel execution, resume, extended metrics
2. **Hint coverage**: 10/10 tools have hints
3. **Task diversity**: Recovery tasks, error scenarios, edge cases
4. **Provider flexibility**: Configurable provider system (stub, deepseek, openai, minimax, gemini)

### Pending ⏳

1. **Functional validation on capable models**: Test on Claude 3.5 Sonnet or GPT-4 to verify talking > mute
2. **More case studies**: Anthropic, Vercel, other ecosystems
3. **Statistical significance**: p < 0.05 on functional benchmark with a model that can leverage hints

### Honest Assessment ⚠️

- **Token efficiency claim**: 84.3% SKILL.md reduction proven (static analysis)
- **Task quality claim**: NOT proven on tested models (MiniMax M2.7 showed opposite result)
- **Methodology validity**: Remains theoretically sound; needs validation on stronger models

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Model too weak forever | Low | High | Token efficiency is enough |
| Stronger models too expensive | Medium | High | Wait for price drops |
| Community skepticism | Medium | Medium | Case studies + open framework |
| MCP spec rejected | Low | Medium | Continue as convention |

---

## 8. Resources

### Files
- `benchmark/runner/run-benchmark.ts` — Main runner with parallel support
- `benchmark/runner/stats.ts` — Statistical analysis engine
- `benchmark/runner/renderer.ts` — Report generator
- `benchmark/cli.ts` — CLI interface
- `benchmark/servers/talking/index.ts` — Talking variant with hints
- `benchmark/tasks/` — Task definitions
- `benchmark/CASE-STUDY-gh-issues.md` — OpenClaw analysis

### Commands
```bash
# Run benchmark with progress and parallel execution
npm run benchmark -- --provider deepseek --parallel --max-concurrency 3

# Resume interrupted benchmark
npm run benchmark -- --provider deepseek --parallel --resume

# Quick test with limited tasks
npm run benchmark -- --provider deepseek --limit 5

# List available providers
npm run benchmark -- --list-providers

# Generate provider config template
npm run benchmark -- --init-config

# Smoke test (no API key needed)
npm run benchmark:smoke
```

---

## 9. Contact & Context

**Project**: Talking CLI — **Distributed Prompting** / **Prompt-On-Call** methodology
**Goal**: Prove that moving guidance from SKILL.md into tool responses reduces token consumption and improves task completion
**Current Phase**: Framework complete; awaiting validation on capable models
**Next Phase**: Functional validation on Claude/GPT-4, then MCP spec proposal

**Key Insight**: 
> "The agent receives guidance exactly when it needs it, not buried in a 400-line document."

**Value Proposition**:
- Token efficiency: 84.3% reduction in initial prompt size (proven via static analysis)
- Maintainability: Hints live with tools, not in monolithic SKILL.md
- Composability: Each tool carries its own guidance
- ⚠️ Task quality improvement: NOT yet proven on tested models; needs validation on stronger models
