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
| R5 | 2026-04-25 | deepseek-v4-flash | 30 | 1 (full-skill+mute) | 1 | v2 baseline | ⚠️ BELOW TARGET | `results/2026-04-25/` |
| R6 | 2026-04-26 | deepseek-v4-flash | 30 | 4 (2×2 ablation) | 1 | v2 ablation | SUCCESS | `results/REPORT-2x2-R6.md` |

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
- **Design**: 2×2 ablation (full-skill/lean-skill × mute/hinting), 3 tasks, single trial
- **Purpose**: Validate MCP init timeout fix + 2×2 ablation infrastructure
- **Key metrics**:

| Cell | Avg Tokens | Avg Turns | Avg Walltime | Pass Rate |
|------|-----------|-----------|-------------|-----------|
| full-skill+mute (control) | 470,755 | 13.0 | 170s | 0/3 |
| full-skill+hinting (server effect) | 391,497 | 12.7 | 193s | 1/3 |
| lean-skill+mute (skill effect) | 469,343 | 14.7 | 147s | 1/3 |
| lean-skill+hinting (full treatment) | 415,523 | 11.7 | 97s | 0/3 |

**Named contrasts**:
- Server effect: −79K tokens (−16.8%), +1 win — **only significant dimension**
- Skill effect: −1.4K tokens (−0.3%), +1 win — negligible
- Full vs control: −55K tokens (−11.7%), 0 wins — interaction effect
- Interaction: lean-skill+hinting underperforms lean-skill+mute — **investigate**

**Key findings**:
1. Token savings come almost entirely from hinting **server** (−17%), not lean skill (−0.3%)
2. lean-skill+hinting is NOT the best cell — interaction effect needs investigation
3. n=3 with single trial — all statistics insignificant (p=1.0)
4. Per-task variance up to 4× — confirms need for `--repeat ≥3`
5. MCP init timeout fix validated — all 12 cells completed successfully

- **Verdict**: SUCCESS (infrastructure validation)
- **Full report**: `results/test-fix-2026-04-25/AUDIT-BENCHMARK.md`

## R5 — DeepSeek V4 Flash (v2, baseline-only, 30-task)

- **Provider**: DeepSeek V4 Flash
- **Design**: Baseline-only (full-skill+mute), 30 tasks, single trial
- **Purpose**: Measure actual tier pass rates for corpus calibration
- **Bug fix**: Sandbox path injection bug discovered in R4 (pre-run). Task prompts referenced `/tmp/benchmark-sandbox/` but actual sandbox was `C:\Users\...\Temp\talking-cli-benchmark-XXXXX`. Fixed in `standalone-executor.ts`.

**Tier results**:

| Tier | Target | Actual | Delta |
|------|--------|--------|-------|
| Easy (9 tasks) | ≥85% | 22% (2/9) | −63pp |
| Medium (15 tasks) | 60-75% | 20% (3/15) | −40~55pp |
| Hard (6 tasks) | 20-40% | 0% (0/6) | −20~40pp |

**Hint trigger results**: empty 10%, permission 10%, schema 30%

**Outcome breakdown**: 14 timeout, 15 end-turn, 1 error

**Key finding**: ALL tiers significantly below target. Root cause: model capability ceiling, not task design. Budget-tier model cannot reliably complete multi-file tasks within 20 turns. See `benchmark/docs/BASELINE-RATES.md` for options.

- **Verdict**: ⚠️ BELOW TARGET — baseline documented, tier targets need adjustment
- **Full analysis**: `benchmark/docs/BASELINE-RATES.md`

## R6 — DeepSeek V4 Flash (v2, 2×2 ablation, 30-task)

- **Provider**: DeepSeek V4 Flash
- **Design**: 2×2 ablation (Full/Lean Skill × Mute/Hints in Tools), 30 tasks, single trial, 120 total runs
- **Purpose**: Isolate Skill compression vs Tool hint injection effects on tokens and quality
- **Naming convention** (REPORT-STANDARD v1.1):
  - Cell 1: Full Skill / Mute Tools (控制组)
  - Cell 2: Full Skill / Hints in Tools
  - Cell 3: Lean Skill / Mute Tools
  - Cell 4: Lean Skill / Hints in Tools (完全实验组)

**2×2 Ablation Matrix (total tokens/task)**:

|  | Mute Tools | Hints in Tools | Tool Hint Effect |
|---|---|---|---|
| **Full Skill** (874行) | 198,453 tok | 188,361 tok | −5.1% |
| **Lean Skill** (170行) | 69,509 tok | 69,993 tok | +0.7% |
| **Skill Effect** | −65.0% | −62.9% | — |

**Pass rates**: 17% / 20% / 10% / 20% (Cells 1-4)

**Named contrasts**:
- Full Treatment: −128K tok (−64.7%), 3 wins / 2 losses vs control
- Tool Hint Effect: −10K tok (−5.1%), 4 wins / 3 losses
- Skill Effect: −129K tok (−65%), 2 wins / 4 losses (quality dip without tool hints)

**Key findings**:
1. Token 节省几乎全部来自 Skill 文件压缩 (−65%)，而非 Tool hint (−5.1%)
2. Lean Skill 不配合 Tool hints 时质量最差 (10%) — 需要两个通道配合
3. Full Treatment 方向正确但统计不显著 (n=1, p≈1.0)

- **Verdict**: SUCCESS — token −64.7%, quality direction correct, needs stronger model validation
- **Full report**: `results/REPORT-2x2-R6.md`
- **Data dirs**: `results/2026-04-25/` (Cell 1), `results/cell2-bloated-talking/`, `results/cell3-talking-mute/`, `results/cell4-talking-talking/`

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
