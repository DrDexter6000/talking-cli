# Talking CLI

*A design methodology for agent tools that speak back.*

---

> **Your CLI is mute. That's half your prompt problem.**

Every guide on agent skills tells you to optimize your `SKILL.md` — the long, one-way monologue you write once and hope the agent remembers. Nobody talks about the other half of your prompt surface: the silent return values of your tools.

When an agent calls your CLI today, the tool runs, returns raw data, and says nothing. No hint about the next step. No signal when results are ambiguous. No cue that "zero hits" means "broaden the query." All of that guidance gets shoved back upstream into `SKILL.md`, which bloats into hundreds of lines of scenario prose no agent can reliably follow.

**Talking CLI** is a design methodology for agent tools that speak back. It treats `SKILL.md` and tool output as **one shared prompt surface with one shared budget**, and gives you concrete rules for deciding what belongs in which channel.

Stop writing everything into `SKILL.md`. Give your CLI a voice.

---

## Read next

- **[PHILOSOPHY.md](PHILOSOPHY.md)** — the full methodology: four channels, four rules, a budget, and five anti-patterns.
- **[docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md)** — the formal theoretical anchor (*Tool-Scoped Progressive Disclosure*). Talking CLI is its public-facing synthesis.

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

## Status

**P1 MVP complete.** The `talking-cli` linter is runnable: `audit` (H1 + H2 heuristics) and `optimize` (plan-only) are working.

- ✅ H1: `SKILL.md` line-count budget (150 lines)
- ✅ H2: Fixture-driven hint coverage detection
- ✅ Coach / CI / JSON renderers
- ⏳ H3 + H4: Deferred to P3 (needs real-world corpus calibration)
- ⏳ `optimize --workflow`: Complex skill transformation pipeline — see PRD §11

The methodology (`PHILOSOPHY.md` + `CN-001`) is stable. The CLI surface may still evolve before v1.0.0.

## Contributing

Issues and discussion are welcome. PRs accepted for bug fixes and P3 roadmap items. See `.internal/PRD.md` for the full product spec (internal).

## License

MIT
