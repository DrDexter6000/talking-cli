# Benchmark Run Log

> SSOT registry of all benchmark runs. Each entry links to full results.
> Last updated: 2026-04-25

---

## Run Index

| # | Date | Provider | Tasks | Variants | Trials | Design | Verdict | Directory |
|---|------|----------|-------|----------|--------|--------|---------|-----------|
| R1 | 2026-04-22 | deepseek-chat | 25 | 2 (mute/talking) | 1 | v1 legacy | SUCCESS | `results/full-run-2026-04-22-0813/` |
| R2 | 2026-04-22 | minimax-m2.7 | 25 | 2 (mute/talking) | 1 | v1 legacy | PARTIAL | `results/full-run-minimax-2026-04-22/` |
| R3 | 2026-04-22 | deepseek-reasoner | 25 | 2 | ~0.6 | v1 legacy | ABANDONED | — |
| R4 | 2026-04-25 | deepseek-v4-flash | 3 | 4 (2×2 ablation) | 1 | v2 ablation | SUCCESS | `results/test-fix-2026-04-25/` |

---

## R1 — DeepSeek Chat (v1, 2-cell)

- **Provider**: DeepSeek Chat (v1 model)
- **Design**: Legacy 2-cell (mute vs talking), 25 tasks, single trial
- **Key metrics**: Pass rate 40%→28% (−12pp), Tokens −69%
- **Verdict**: SUCCESS — token savings robust, quality within noise
- **Full report**: `results/full-run-2026-04-22-0813/AUDIT-BENCHMARK.md`

## R2 — MiniMax M2.7 HS (v1, 2-cell)

- **Provider**: MiniMax M2.7 HighSpeed
- **Design**: Legacy 2-cell, 25 tasks, single trial, 37 min
- **Key metrics**: Pass rate 52%→44% (−8pp), Tokens −8%
- **Verdict**: PARTIAL — token savings confirmed but smaller
- **Full report**: `results/full-run-minimax-2026-04-22/AUDIT-BENCHMARK.md`

## R3 — DeepSeek Reasoner (v1, abandoned)

- **Provider**: DeepSeek Reasoner (v1)
- **Status**: Abandoned after 30/50 runs
- **Reason**: Avg walltime ~200s/task, 27% timeout rate
- **Action**: Skipped per user decision

## R4 — DeepSeek V4 Flash (v2, 2×2 ablation, infrastructure validation)

- **Provider**: DeepSeek V4 Flash
- **Design**: 2×2 ablation (bloated/talking × mute/talking), 3 tasks, single trial
- **Purpose**: Validate MCP init timeout fix + 2×2 ablation infrastructure
- **Key metrics**:

| Cell | Avg Tokens | Avg Turns | Avg Walltime | Pass Rate |
|------|-----------|-----------|-------------|-----------|
| bloated+mute (control) | 470,755 | 13.0 | 170s | 0/3 |
| bloated+talking (server effect) | 391,497 | 12.7 | 193s | 1/3 |
| talking+mute (skill effect) | 469,343 | 14.7 | 147s | 1/3 |
| talking+talking (full treatment) | 415,523 | 11.7 | 97s | 0/3 |

**Named contrasts**:
- Server effect: −79K tokens (−16.8%), +1 win — **only significant dimension**
- Skill effect: −1.4K tokens (−0.3%), +1 win — negligible
- Full vs control: −55K tokens (−11.7%), 0 wins — interaction effect
- Interaction: talking+talking underperforms talking+mute — **investigate**

**Key findings**:
1. Token savings come almost entirely from talking **server** (−17%), not talking skill (−0.3%)
2. talking+talking is NOT the best cell — interaction effect needs investigation
3. n=3 with single trial — all statistics insignificant (p=1.0)
4. Per-task variance up to 4× — confirms need for `--repeat ≥3`
5. MCP init timeout fix validated — all 12 cells completed successfully

- **Verdict**: SUCCESS (infrastructure validation)
- **Full report**: `results/test-fix-2026-04-25/AUDIT-BENCHMARK.md`

---

## Naming Convention

Run directories follow: `{type}-{provider}-{date}` or `{date}` for legacy runs.

- `full-run-*`: Complete 25/30-task run with a single provider
- `test-fix-*`: Infrastructure validation run (few tasks)
- `smoke`: Stub provider validation
- `minimax-*`: MiniMax-specific debugging runs
- `{date}`: Legacy format (early runs)

---

*This document is the single source of truth for benchmark run history. Individual run details are in their respective `AUDIT-BENCHMARK.md` files within the result directories.*
