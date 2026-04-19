# Talking CLI

> **Make it embarrassing to ship a mute CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)

**Your CLI is mute. That's half your prompt problem.**

Every guide on agent skills tells you to optimize your `SKILL.md` — the long, one-way monologue you write once and hope the agent remembers. Nobody talks about the other half of your prompt surface: the silent return values of your tools.

When an agent calls your CLI today, the tool runs, returns raw data, and says nothing. No hint about the next step. No signal when results are ambiguous. No cue that "zero hits" means "broaden the query." All of that guidance gets shoved back upstream into `SKILL.md`, which bloats into hundreds of lines of scenario prose no agent can reliably follow.

**Talking CLI** is a design methodology for agent tools that speak back. It treats `SKILL.md` and tool output as **one shared prompt surface with one shared budget**, and gives you concrete rules for deciding what belongs in which channel.

**Prompt-on-call** — progressive disclosure taken one level deeper. Instead of pre-loading every scenario into SKILL.md, your tool speaks up when called — triggered by what it actually sees, not by what the designer predicted.

Stop writing everything into `SKILL.md`. Give your CLI a voice.

---

## How it works

### The Prompt Budget Shift

```mermaid
graph LR
    subgraph Before ["❌ Before: Mute CLI"]
        A1[SKILL.md<br/>400+ lines] --> A2[Agent]
        A3[Tool returns<br/>raw JSON only] --> A2
        A1 -.->|repeated guidance<br/>shoved upstream| A3
    end

    subgraph After ["✅ After: Talking CLI"]
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

## MCP Ecosystem Audit: What We Found

We ran `talking-cli audit-mcp --deep` against 4 official Anthropic MCP servers:

| Server | Tools | Scenarios | M3 · Guidance | M4 · Errors |
|--------|-------|-----------|---------------|-------------|
| `server-filesystem` | 11 | 21 | **0/100** | 74/100 |
| `server-everything` | 13 | 13 | **0/100** | 83/100 |
| `server-memory` | 9 | 9 | **0/100** | 100/100* |
| `server-github` | 25 | 25 | **0/100** | 100/100* |
| **Total** | **58** | **68** | **0/68** | — |

\* M4=100 because Zod validation errors are technically informative. These are SDK-generated messages, not tool-authored recovery guidance.

**The finding**: Out of 68 tested error/empty-result scenarios across 4 official servers, **zero** returned actionable guidance. The entire MCP ecosystem treats tool output as data pipes, not dialogue participants.

We also analyzed 823 Composio GitHub tools via static JSON schema inspection. Same result: zero hint infrastructure.

---

## The Methodology

Talking CLI is more than a linter. It's a design philosophy:

- **[PHILOSOPHY.md](PHILOSOPHY.md)** — the full methodology: four channels, four rules, a budget, and five anti-patterns.
- **[docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md)** — the formal theoretical anchor (*Tool-Scoped Progressive Disclosure*).

---

## Status

**v0.2.0 — Methodology stable. CLI surface may evolve before v1.0.0.**

- ✅ H1–H4 skill audit (`audit` command)
- ✅ M1–M4 MCP server audit (`audit-mcp --deep`)
- ✅ 5 personas: default · NBA coach · British critic · Zen master · emotional-damage-dad
- ✅ `optimize --apply` with git branch safety
- ⏳ `optimize --workflow`: 9-step complex skill transformation pipeline
- ⏳ H3 hint budget ≤ 3 (embedding-based)
- ⏳ H4 semantic duplication detection

## License

MIT
