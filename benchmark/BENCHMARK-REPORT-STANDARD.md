# Benchmark Report Standard

> **SSOT (Single Source of Truth)** for benchmark report format.
> Version: 1.0
> Last updated: 2026-04-22

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

### 4. Success Criteria Evaluation (成功评判标准)

```
Success Evaluation
==================
✅ Token Reduction: {YES/NO} ({N}% reduction)
✅ Quality Maintained: {YES/NO} (pass rate delta: {±N}pp)
✅ Quality Improved: {YES/NO} (Talking wins: {N})

Verdict: {SUCCESS / GREAT_SUCCESS / PARTIAL / FAILURE}
```

**Verdict rules**:
- **SUCCESS** (成功): Token消耗减少，执行质量保持不变 (pass rate delta within ±5pp)
- **GREAT_SUCCESS** (大成功): Token消耗减少，执行质量还获得提高 (Talking wins > Mute wins)
- **PARTIAL** (部分成功): Token消耗减少，但质量下降明显
- **FAILURE** (失败): Token消耗未减少，或质量严重下降

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

## Enforcement

This format is **mandatory** for all future benchmark runs. The benchmark runner should generate reports following this standard automatically.

---

## Changelog

- **2026-04-22**: v1.0 — Initial standard based on user requirements
