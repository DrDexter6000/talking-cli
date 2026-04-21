# Talking CLI

> **Tool silence is a design defect. Distributed Prompting is the fix.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)

**Sound familiar?**

Your `SKILL.md` is 400 lines. Half of it describes what the agent should do *after* a specific tool returns —     
> "if zero results, broaden the query,"     
> "if ambiguous, ask the user,"     
> "this field means X, not Y."     
    
The agent loads all 400 lines every single turn, but most of that guidance only matters 10% of the time. The other 90%, it's paying attention rent on scenarios that didn't happen.

Meanwhile, your tools return raw JSON and say nothing. No hint about what just happened. No signal that results were sparse or the query was ambiguous. No cue for the next step. The tools are mute, so all the guidance gets shoved upstream into `SKILL.md`, which slowly bloats into a monologue describing every possible outcome of every possible call — most of which the agent promptly forgets or ignores.

That's not a skill problem. That's a **prompt surface** problem. You only know one writable surface, so everything goes there.

**Talking CLI gives your tools a voice.** When the agent calls, the tool talks back — not with a wall of prose, but with the right hint, at the right moment, inside the response.     

> That's **Distributed Prompting**: progressive disclosure, with **Prompt-On-Call** as its implementation pattern.

---

**Standing on shoulders.** The ideas here did not spring from vacuum.

CLI is the native interface for AI agents — [John Carmack](https://x.com/ID_AA_Carmack/status/1874124927130886501) observed this in late 2024, the [CodeAct](https://arxiv.org/abs/2402.01030) paper (Wang et al., ICML 2024) proved it, and [Andrej Karpathy](https://x.com/karpathy/status/2026360908398862478) crystallized it: *"Build. For. Agents."*

[Progressive disclosure](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) as a skill-loading architecture was formalized by Anthropic (Barry Zhang, Keith Lazuka, Mahesh Murag, Oct 2025) and is now an [open standard](https://agentskills.io) adopted across Claude Code, Codex CLI, and Gemini CLI. [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) as a named discipline was popularized by [Tobi Lütke](https://x.com/tobi) and [Andrej Karpathy](https://x.com/karpathy) in mid-2025.

Anthropic also advocates ["steering agents with helpful instructions in tool responses"](https://www.anthropic.com/engineering/writing-tools-for-agents) — but only as a paragraph-level best practice. Nobody has named it, budgeted it, audited it, or proposed it as a protocol-level primitive. **That gap is what Talking CLI fills.**

---

## What this project is

Talking CLI is a **three-leg stool** built around one idea: **Distributed Prompting** — moving guidance from static SKILL.md into the moment of invocation.

You can also think of this as **Prompt-On-Call**: instead of one monolithic document trying to anticipate every scenario, each tool carries its own guidance — surfaced only when that tool is called, relevant only to what just happened.

1. **Methodology** — [PHILOSOPHY.md](PHILOSOPHY.md) + [CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md). Names the Voice channel (C3), budgets the prompt surface, enumerates anti-patterns. The formal name for Distributed Prompting's theoretical anchor is *Tool-Scoped Progressive Disclosure*.
2. **Evidence** — the ecosystem audit above, and a reproducible benchmark (in progress, see [Roadmap](#roadmap)).
3. **Standard** — a proposed `agent_hints` convention we are taking to the MCP spec, backed by the data.

The linter (`talking-cli audit` / `audit-mcp`) is the **probe**, not the hero. It's how you reproduce the audit numbers on your own server.

### Core claim

> **Prompt Surface = `SKILL.md` ∪ `{tool_result.hints}` — two halves, one budget.**

Or, in distributed-systems language:

> **Centralized guidance (SKILL.md) + Distributed guidance (tool hints) = One prompt budget.**

Anything you write into `SKILL.md` that only applies *after a specific tool call* is mispriced: it costs every turn and earns only on a small fraction of turns. Moving that guidance into the tool's response (**Distributed Prompting** via **Prompt-On-Call**) is the single biggest lever most skill authors haven't pulled.

---

## How it works

### The Prompt Budget Shift (visual)

```mermaid
graph LR
    subgraph Before ["❌ Before: Mute CLI"]
        A1[SKILL.md<br/>400+ lines] --> A2[Agent]
        A3[Tool returns<br/>raw JSON only] --> A2
        A1 -.->|repeated guidance<br/>shoved upstream| A3
    end

    subgraph After ["✅ After: Distributed Prompting"]
        B1[SKILL.md<br/>&lt; 150 lines] --> B2[Agent]
        B3[Tool returns<br/>JSON + hints] --> B2
    end

    Before -->|Audit + Optimize| After
```

### Four Heuristics, Full Coverage

```mermaid
graph TD
    H1[H1 · Document Budget<br/>SKILL.md ≤ 150 lines]
    H2[H2 · Fixture Coverage<br/>error + empty scenarios]
    H3[H3 · Structured Hints<br/>hints / suggestions / guidance]
    H4[H4 · Actionable Guidance<br/>specific, actionable content]

    H1 & H2 & H3 & H4 --> Score[Total Score<br/>0–100]
    Score -->|≥ 80| Pass[✅ PASS<br/>Ship it]
    Score -->|< 80| Fail[❌ FAIL<br/>Fix it]
```

---

## Quick Start

```bash
# Audit your skill — default coach mode (plain language, actionable)
npx talking-cli audit ./my-skill

# CI mode — machine-readable, exit code driven
npx talking-cli audit ./my-skill --ci

# JSON mode — structured output for tooling
npx talking-cli audit ./my-skill --json

# Persona mode — same audit, different voice
npx talking-cli audit ./my-skill --persona nba-coach
npx talking-cli audit ./my-skill --persona british-critic
npx talking-cli audit ./my-skill --persona zen-master
npx talking-cli audit ./my-skill --persona emotional-damage-dad

# Audit an MCP server — static analysis (fast, safe)
npx talking-cli audit-mcp ./my-mcp-server

# Deep audit — runtime M3/M4 heuristics (spawns server)
npx talking-cli audit-mcp ./my-mcp-server --deep

# Generate optimization plan (plan-only, never touches source files)
npx talking-cli optimize ./my-skill
# → writes TALKING-CLI-OPTIMIZATION.md at the skill root
```

## API key requirements

Normal `talking-cli` usage does **not** require any model API key.

The following commands are fully local-first:

- `talking-cli audit`
- `talking-cli audit-mcp`
- `talking-cli optimize`

Any model-backed execution belongs only to the internal benchmark harness under `benchmark/`, not to the user-facing CLI contract.

For internal benchmark development today:

- `npm run benchmark:smoke` is wired and local-only using the stub benchmark provider.
- `npm run benchmark` is reserved for the future model-backed standalone executor path and is not Phase 1-complete yet.

---

## What it looks like

Coach mode running against a bloated, mute skill:

```
Score: 0/100
Yikes. Your CLI is so quiet I can hear the tokens screaming in agony.

H1 · Line Count · FAIL
Your SKILL.md is 165 lines. The budget is 150.
→ Just 15 lines over. Tighten the prose and migrate post-call guidance to tool hints.

H2 · Hint Coverage · FAIL
1 tool(s) have zero fixtures. They don't speak at all: search
→ Add talking-cli-fixtures for [search]. One error scenario, one empty/zero-result scenario.
  Make them return a "hints" field.

H3 · Structured Hints · FAIL
0/0 passed fixtures contain hint fields.
→ Make your tools return a "hints" or "suggestions" field alongside raw data.

H4 · Actionable Guidance · FAIL
0/0 hint fields have actionable content.
→ Hints should be specific. "Try again" is too short.
  "Try broadening your query with fewer filters" is actionable.

---
Fix the issues above, then run npx talking-cli audit again to see your new score.
```

(The real output is colored. We just can't show chalk in a code block.)

---

## The finding: MCP Ecosystem Audit

We ran `talking-cli audit-mcp --deep` against **4 official Anthropic MCP servers** across **68 error / empty-result scenarios**. Number of scenarios that returned actionable guidance:

> **0 / 68.**

Static analysis of 823 Composio GitHub tools: same result. Zero hint infrastructure. The MCP ecosystem today treats tool output as a data pipe, not a dialogue participant.

| Server | Tools | Scenarios | M3 · Guidance | M4 · Errors |
|--------|-------|-----------|---------------|-------------|
| `server-filesystem` | 11 | 21 | **0/100** | 74/100 |
| `server-everything` | 13 | 13 | **0/100** | 83/100 |
| `server-memory` | 9 | 9 | **0/100** | 100/100* |
| `server-github` | 25 | 25 | **0/100** | 100/100* |
| **Total** | **58** | **68** | **0/68** | — |

\* M4=100 because Zod validation errors are technically informative. These are SDK-generated messages, not tool-authored recovery guidance.

### Token Efficiency Analysis

**Static analysis** (OpenClaw gh-issues skill):

| Metric | Bloated | Talking | Delta |
|--------|---------|---------|-------|
| Lines of code | 887 | 170 | **−80.8%** |
| Words | 4,939 | 772 | **−84.4%** |
| Characters | 34,850 | 5,479 | **−84.3%** |

**Controlled benchmark** (DeepSeek-V3.2, 25 tasks):

| Metric | Mute | Talking | Delta |
|--------|------|---------|-------|
| Mean input tokens | 37,461 | 14,386 | **−62%** |
| Mean walltime | — | — | **−36s** |
| Pass rate | 32% | 28% | −4% (not significant) |

**Key finding**: **Distributed Prompting** consistently reduces token consumption by 60–84% across all measurement methods. The task quality claim (talking > mute) remains unproven on tested models — model capability is the current bottleneck, not the methodology.

### Controlled Benchmark Results (DeepSeek-V3.2)

We ran the full benchmark harness (25 tasks, mute vs talking) against **DeepSeek-V3.2**:

| Metric | Mute | Talking | Delta |
|--------|------|---------|-------|
| **Tasks won** | 6 | 4 | — |
| **Ties** | 15 | 15 | — |
| **Pass rate** | 32% (8/25) | 28% (7/25) | −4% |
| **Mean input tokens** | 37,461 | 14,386 | **−62%** |
| **Mean output tokens** | — | — | −1,196 |
| **Mean walltime** | — | — | **−36s** |
| **Error recoveries** | 9 | 11 | +2 |

**Statistical significance**: Wilcoxon p = 0.015 (< 0.05) for token efficiency; Sign test p = 0.754 (not significant) for task wins.

**Interpretation**: On DeepSeek-V3.2, **Distributed Prompting** delivers significant token and time savings, but the model is not yet capable enough to consistently leverage hints for higher task success rates. The 15 ties (60%) indicate that for most tasks, both variants either succeed or fail together — the model's capability ceiling is the bottleneck, not the methodology.

**Estimated cost savings per 1,000 tasks** (based on measured token ratios, assuming equivalent task quality):

| Model | Bloated cost | Talking cost | Savings |
|-------|-------------|--------------|---------|
| DeepSeek-V3.2 | $52.00 | $20.00 | **$32.00 (62%)** |
| Claude 3.5 Sonnet (est.) | $78.00 | $30.00 | **$48.00 (62%)** |
| GPT-4o (est.) | $52.00 | $20.00 | **$32.00 (62%)** |
| Gemini 1.5 Pro (est.) | $26.00 | $10.00 | **$16.00 (62%)** |

*Estimates assume equivalent task quality; actual validation on stronger models pending.*

---

## The Methodology

Talking CLI is more than a linter. It's the implementation of **Distributed Prompting**: every tool response is a designed prompt surface, not a data dump. **Prompt-On-Call** is the concrete pattern for achieving this.

- **[PHILOSOPHY.md](PHILOSOPHY.md)** — the full methodology: four channels, four rules, a budget, and five anti-patterns.
- **[docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md)** — the formal theoretical anchor (*Tool-Scoped Progressive Disclosure*).

---

## Roadmap

**Current focus**: Framework complete (v0.6); awaiting functional validation on capable models.

| Track | Goal | Status |
|---|---|---|
| **Methodology** (shipped) | PHILOSOPHY + CN-001 + H1–H4 / M1–M4 heuristics | ✅ |
| **Evidence harness** (G7 / P4.1) | Internal benchmark harness comparing mute vs. talking variants under controlled execution | ✅ Complete (v0.6 with parallel execution, resume, extended metrics) |
| **Functional validation** | Validate talking > mute on Claude/GPT-4-class models | ⏳ Pending (DeepSeek-V3.2: token savings proven, task quality not significant) |
| **Ecosystem audit publication** (G8 / P4.2) | `AUDIT-BENCHMARK.md` as re-runnable artifact, public post | 🔄 Ready for re-run with stronger models |
| **H4 semantic upgrade** (G9 / P4.3) | Haiku-class classifier replaces the `≥ 10 chars` stub; graceful fallback without API key | ⏳ |
| **H3 hint-budget ≤ 3** (G9 / P4.4) | Semantic dedup of hints, not field-count | ⏳ |
| **Persona cut** (D1 / P4.5) | 5 hand-coded personas → 1 default + 1 experimental | ⏳ |
| **Self-dogfood** (G11 / P4.6) | `talking-cli audit .` ≥ 90/100, CI-enforced, README badge | ⏳ |
| **MCP spec proposal** (G10 / P4.7) | RFC / discussion on `modelcontextprotocol/*` for a first-class `agent_hints` field | ⏳ Blocked on functional validation |

### Status of surfaces available today

- ✅ H1–H4 skill audit (`audit`) — v1 heuristics; H3/H4 will harden in P4.3–4.4
- ✅ M1–M4 MCP server audit (`audit-mcp --deep`)
- ✅ `optimize` plan + `--apply` with git branch safety
- 🧪 Multiple personas (`--persona`) — **experimental**, surface will shrink in P4.5
- ⛔ `optimize --workflow` (9-step pipeline) — specified in PRD §11, deferred past P4

## License

MIT
