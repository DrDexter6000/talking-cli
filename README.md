# Talking CLI

> **Make it embarrassing to ship a mute CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)

Every guide on agent skills tells you to optimize your `SKILL.md`. **Nobody talks about the silent return values of your tools.**

When an agent calls your CLI, it runs, returns raw data, and says nothing. No hint. No cue. No guidance. All of that gets shoved back into `SKILL.md`, which bloats into hundreds of lines of scenario prose no agent can follow.

**Talking CLI** audits your skill + tool combo and tells you exactly where the prompt budget is leaking. With a coach who roasts your code because they care.

---

## Quick Start

```bash
# Audit your skill — default coach mode (plain language, roast included)
npx talking-cli audit ./my-skill

# CI mode — machine-readable, exit code driven
npx talking-cli audit ./my-skill --ci

# JSON mode — structured output for tooling
npx talking-cli audit ./my-skill --json

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

---
Fix the issues above, then run npx talking-cli audit again to see your new score.
```

(The real output is colored. We just can't show chalk in a code block.)

---

## The Methodology

Talking CLI is more than a linter. It's a design philosophy:

- **[PHILOSOPHY.md](PHILOSOPHY.md)** — the full methodology: four channels, four rules, a budget, and five anti-patterns.
- **[docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md)** — the formal theoretical anchor (*Tool-Scoped Progressive Disclosure*).

---

## Status

**P1 MVP complete.** `audit` (H1 + H2) and `optimize` (plan-only) are working.

- ✅ H1: `SKILL.md` line-count budget (150 lines)
- ✅ H2: Fixture-driven hint coverage detection
- ✅ Coach / CI / JSON renderers
- ⏳ H3 + H4: Deferred to P3 (needs real-world corpus calibration)
- ⏳ `optimize --workflow`: Complex skill transformation pipeline

The methodology is stable. The CLI surface may still evolve before v1.0.0.

## License

MIT
