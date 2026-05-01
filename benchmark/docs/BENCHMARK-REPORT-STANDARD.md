# Benchmark Report Standard

> **SSOT (Single Source of Truth)** for benchmark report format.
> Version: 2.0
> Last updated: 2026-04-27

---

## Mandatory Report Format

Every full benchmark run **MUST** output the following sections in this exact order:

---

### 1. Benchmark Overview (benchmark简介)

```
Benchmark Overview
==================
Date: YYYY-MM-DD HH:MM
Provider: {provider-name}
Model: {model-name}
Tasks: {N} tasks
Variants: {variant-names}
Total Runs: {N}
Concurrency: {N} parallel
Total Duration: {MM}m {SS}s
```

**Required fields**:
- Date (测试日期)
- Provider (提供商)
- Model (模型名称)
- Tasks (任务数量)
- Variants (测试变体)
- Total Runs (总运行次数)
- Concurrency (并发数)
- Total Duration (总耗时)

---

### 1.1 Model Configuration (模型配置)

```
Model Configuration
===================
Model ID: {model-id}
Base URL: {base-url}
Context Window: {N} tokens
Max Output Tokens: {N}
Temperature: {N}
Timeout: {N}s
API Format: {openai|anthropic|gemini}
```

**Required fields**:
- Model ID (官方模型标识符)
- Base URL (API端点)
- Context Window (上下文窗口大小)
- Max Output Tokens (最大输出token数)
- Temperature (温度参数)
- Timeout (超时时间)
- API Format (API格式)

**Purpose**: 明确记录测试使用的模型版本和配置参数，确保结果可复现，并支持横向比较不同模型的表现。

---

### 2. Token Consumption Comparison (Token消耗对比)

#### 2.1 Initial Prompt Tokens (起始Token消耗)

```
Initial Prompt Tokens
=====================
Bloated/Mute: {N} tokens
Talking:      {N} tokens
Delta:        {N} tokens ({±N}%)
```

#### 2.2 Input Tokens (输入Token对比)

```
Input Tokens
============
Bloated/Mute: {N} tokens/task (avg)
Talking:      {N} tokens/task (avg)
Delta:        {N} tokens ({±N}%)
```

#### 2.3 Output Tokens (输出Token对比)

```
Output Tokens
=============
Bloated/Mute: {N} tokens/task (avg)
Talking:      {N} tokens/task (avg)
Delta:        {N} tokens ({±N}%)
```

#### 2.4 Total Tokens (总Token消耗对比)

```
Total Tokens
============
Bloated/Mute: {N} tokens/task (avg)
Talking:      {N} tokens/task (avg)
Delta:        {N} tokens ({±N}%)
```

**Calculation rules**:
- All percentages: `(Talking - Mute) / Mute × 100%`
- Negative = Talking saves tokens
- Positive = Talking uses more tokens

---

### 3. Task Quality Comparison (任务完成质量对比)

```
Task Quality
============
Bloated/Mute Wins: {N} tasks
Talking Wins:      {N} tasks
Ties:              {N} tasks

Pass Rate
=========
Bloated/Mute: {N}% ({passed}/{total})
Talking:      {N}% ({passed}/{total})
Delta:        {±N}pp (percentage points)

Statistical Significance
========================
Sign Test:     n={N}, p={N.NNNN}
Wilcoxon Test: W={N}, p={N.NNNN}
```

**Required fields**:
- Bloated/Mute Wins (BLOATED胜出次数)
- Talking Wins (TALKING胜出次数)
- Ties (平局次数)
- Pass Rate (通过率)
- Delta in pp (percentage points, 百分点)
- Statistical tests (统计检验)

---

### 4. Verdict (判定)

```
Verdict Evaluation
==================
✅ Token Reduction: {YES/NO} ({N}% reduction, Wilcoxon p={N})
✅ Turn Reduction: {YES/NO} ({N}% reduction, Wilcoxon p={N})
✅ Quality Maintained: {YES/NO} (pass rate delta: {±N}pp, 95% CI: [{N}, {N}])

Verdict: {PROVEN / SUCCESS / PARTIAL / FAILURE}
```

**Verdict rules** (statistically rigorous, English-only):

| Verdict | Required conditions |
|---|---|
| **PROVEN** | total_tokens ↓ p < .05 **AND** turns ↓ p < .05 **AND** medium-tier pass rate ↑ ≥ 10pp |
| **SUCCESS** | total_tokens ↓ p < .05 **AND** pass rate 95% CI does not cross significant degradation |
| **PARTIAL** | One of {total_tokens, turns} ↓ p < .05; other metrics neutral |
| **FAILURE** | No metric significant at p < .05 |

**95% CI for pass rate delta**: Normal approximation `sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2)`.

---

### 5. Detailed Conclusion (详细总结结论)

```
Detailed Conclusion
===================
1. Key Findings:
   - {finding 1}
   - {finding 2}
   - {finding 3}

2. Statistical Interpretation:
   - {interpretation}

3. Model Capability Assessment:
   - {assessment}

4. Recommendations:
   - {recommendation 1}
   - {recommendation 2}
```

**Required elements**:
- Key Findings (关键发现)
- Statistical Interpretation (统计解读)
- Model Capability Assessment (模型能力评估)
- Recommendations (建议)

---

## Example Report

See the latest benchmark report for reference:
- `benchmark/results/full-run-YYYY-MM-DD/` directory
- `AUDIT-BENCHMARK.md` file

---

## Variant Naming Convention (变体命名规范)

All reports MUST use the following display names for the 2×2 ablation cells:

| Internal ID | Display Name | Meaning |
|-------------|-------------|---------|
| `full-skill+mute` | **Full Skill / Mute Tools** | 完整 SKILL.md (887行) + 工具返回原始数据，不含 hint |
| `full-skill+hinting` | **Full Skill / Hints in Tools** | 完整 SKILL.md + 工具在错误/空结果时返回 actionable hint |
| `lean-skill+mute` | **Lean Skill / Mute Tools** | 精简 SKILL.md (170行) + 工具返回原始数据，不含 hint |
| `lean-skill+hinting` | **Lean Skill / Hints in Tools** | 精简 SKILL.md + 工具在错误/空结果时返回 actionable hint |

**Why these names**: The two dimensions are (1) how much guidance is in the SKILL.md file, and (2) whether the tool responses contain contextual hints. "Full Skill / Lean Skill" describes the skill file; "Mute Tools / Hints in Tools" describes the tool behavior. Together they are immediately understandable without internal jargon.

**Scope of applicability**: This benchmark validates the Distributed Prompting methodology using an MCP server as the experimental carrier. The methodology itself applies to **any** SKILL.md + tool combination — not limited to MCP servers.

---

## Enforcement

This format is **mandatory** for all future benchmark runs. The benchmark runner should generate reports following this standard automatically.

---

## Changelog

- **2026-04-26**: v1.1 — Added variant naming convention (Full Skill / Lean Skill × Mute Tools / Hints in Tools)
- **2026-04-22**: v1.0 — Initial standard based on user requirements
