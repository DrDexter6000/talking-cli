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

## Status

**Draft.** The methodology is being formalized. A companion linter — the `talking-cli` CLI — is planned but not yet built.

The shape of the ideas is stable enough to share and argue about. The wording is not.

## Contributing

Not accepting PRs yet — the surface is still being set. Issues and discussion are welcome.

## License

TBD.
