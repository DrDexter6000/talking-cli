# Talking CLI

> **Make it embarrassing to ship a mute CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)

**Your CLI is mute. That's half your prompt problem.**

Every guide on agent skills tells you to optimize your `SKILL.md` 鈥?the long, one-way monologue you write once and hope the agent remembers. Nobody talks about the other half of your prompt surface: the silent return values of your tools.

When an agent calls your CLI today, the tool runs, returns raw data, and says nothing. No hint about the next step. No signal when results are ambiguous. No cue that "zero hits" means "broaden the query." All of that guidance gets shoved back upstream into `SKILL.md`, which bloats into hundreds of lines of scenario prose no agent can reliably follow.

**Talking CLI** is a design methodology for agent tools that speak back. It treats `SKILL.md` and tool output as **one shared prompt surface with one shared budget**, and gives you concrete rules for deciding what belongs in which channel.

**Prompt-on-call** 鈥?progressive disclosure taken one level deeper. Instead of pre-loading every scenario into SKILL.md, your tool speaks up when called 鈥?triggered by what it actually sees, not by what the designer predicted.

Stop writing everything into `SKILL.md`. Give your CLI a voice.

---

## How it works

### The Prompt Budget Shift

```mermaid
graph LR
    subgraph Before ["鉂?Before: Mute CLI"]
        A1[SKILL.md<br/>400+ lines] --> A2[Agent]
        A3[Tool returns<br/>raw JSON only] --> A2
        A1 -.->|repeated guidance<br/>shoved upstream| A3
    end

    subgraph After ["鉁?After: Talking CLI"]
        B1[SKILL.md<br/>&lt; 150 lines] --> B2[Agent]
        B3[Tool returns<br/>JSON + hints] --> B2
    end

    Before -->|Audit + Optimize| After
```

### Four Heuristics, Full Coverage

```mermaid
graph TD
    H1[H1 路 Document Budget<br/>SKILL.md 鈮?150 lines]
    H2[H2 路 Fixture Coverage<br/>error + empty scenarios]
    H3[H3 路 Structured Hints<br/>hints / suggestions / guidance]
    H4[H4 路 Actionable Guidance<br/>specific, actionable content]

    H1 & H2 & H3 & H4 --> Score[Total Score<br/>0鈥?00]
    Score -->|鈮?80| Pass[鉁?PASS<br/>Ship it]
    Score -->|< 80| Fail[鉂?FAIL<br/>Fix it]
```

---

## Quick Start

```bash
# Audit your skill 鈥?default coach mode (plain language, actionable)
npx talking-cli audit ./my-skill

# CI mode 鈥?machine-readable, exit code driven
npx talking-cli audit ./my-skill --ci

# JSON mode 鈥?structured output for tooling
npx talking-cli audit ./my-skill --json

# Persona mode 鈥?same audit, different voice
npx talking-cli audit ./my-skill --persona nba-coach
npx talking-cli audit ./my-skill --persona british-critic
npx talking-cli audit ./my-skill --persona zen-master
npx talking-cli audit ./my-skill --persona emotional-damage-dad

# Audit an MCP server 鈥?static analysis (fast, safe)
npx talking-cli audit-mcp ./my-mcp-server

# Deep audit 鈥?runtime M3/M4 heuristics (spawns server)
npx talking-cli audit-mcp ./my-mcp-server --deep

# Generate optimization plan (plan-only, never touches source files)
npx talking-cli optimize ./my-skill
# 鈫?writes TALKING-CLI-OPTIMIZATION.md at the skill root
```

---

## What it looks like

Coach mode running against a bloated, mute skill:

```
Score: 0/100
Yikes. Your CLI is so quiet I can hear the tokens screaming in agony.

H1 路 Line Count 路 FAIL
Your SKILL.md is 165 lines. The budget is 150.
鈫?Just 15 lines over. Tighten the prose and migrate post-call guidance to tool hints.

H2 路 Hint Coverage 路 FAIL
1 tool(s) have zero fixtures. They don't speak at all: search
鈫?Add talking-cli-fixtures for [search]. One error scenario, one empty/zero-result scenario.
  Make them return a "hints" field.

H3 路 Structured Hints 路 FAIL
0/0 passed fixtures contain hint fields.
鈫?Make your tools return a "hints" or "suggestions" field alongside raw data.

H4 路 Actionable Guidance 路 FAIL
0/0 hint fields have actionable content.
鈫?Hints should be specific. "Try again" is too short.
  "Try broadening your query with fewer filters" is actionable.

---
Fix the issues above, then run npx talking-cli audit again to see your new score.
```

(The real output is colored. We just can't show chalk in a code block.)

---

## The Methodology

Talking CLI is more than a linter. It's a design philosophy:

- **[PHILOSOPHY.md](PHILOSOPHY.md)** 鈥?the full methodology: four channels, four rules, a budget, and five anti-patterns.
- **[docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md)** 鈥?the formal theoretical anchor (*Tool-Scoped Progressive Disclosure*).

---

## Status

**P3 Phase 4 complete. MCP audit M1鈥揗4 complete.**

- 鉁?H1: `SKILL.md` line-count budget (150 lines)
- 鉁?H2: Fixture-driven hint coverage detection
- 鉁?H3: Structured hint fields (`hints`, `suggestions`, `guidance`, etc.)
- 鉁?H4: Actionable guidance content (length + specificity)
- 鉁?`optimize --apply`: Auto-fix with safety rules (git branch + backup)
- 鉁?5 personas: default 路 NBA coach 路 British critic 路 Zen master 路 emotional-damage-dad
- 鉁?**MCP server audit**: `audit-mcp` with M1鈥揗4 heuristics, `--deep` runtime mode, Python server support
- 鈴?`optimize --workflow`: 9-step complex skill transformation pipeline

The methodology is stable. The CLI surface may still evolve before v1.0.0.

## License

MIT
