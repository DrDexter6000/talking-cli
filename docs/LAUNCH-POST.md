# Launch Post: I asked a linter to review my own AI skill. It called me fat.

**TL;DR**: I built a linter that audits agent skills. It roasts your code because it cares. It's called Talking CLI, and it just shipped v0.1.0.

```bash
npx talking-cli audit ./my-skill
```

---

## The Problem Nobody Talks About

Every guide on agent skills tells you to optimize your `SKILL.md`. Nobody talks about the **silent return values of your tools**.

When an agent calls your CLI, the tool runs, returns raw data, and says nothing. No hint about the next step. No signal when results are ambiguous. No cue that "zero hits" means "broaden the query." All of that guidance gets shoved back upstream into `SKILL.md`, which bloats into hundreds of lines of scenario prose no agent can reliably follow.

This is not an edge case. This is the default shape of agent skills today.

## The Evidence

I audited my own project, `life-index` (a journal search + write CLI). Here's what I found:

- **SKILL.md: 457 lines** — 3× over a sane budget
- **5 of 6 tools** were completely mute — raw JSON, zero guidance
- **"Check needs_confirmation"** was repeated 4 times in SKILL.md while also being surfaced at runtime — pure budget waste

Running it through Talking CLI:

```
Score: 0/100
Yikes. Your CLI is so quiet I can hear the tokens screaming in agony.
```

Ouch. Fair.

## What Talking CLI Does

It's a linter for the **skill/tool contract**, not your Python quality. It checks two things today (more coming):

1. **H1 · Line Count**: Is your SKILL.md under 150 lines? If not, you're probably stuffing tool-level guidance into a static document.
2. **H2 · Hint Coverage**: Do your tools have fixtures that prove they "speak back" — returning structured hints, not just raw data?

It outputs in three modes:
- **Coach** (default): A sarcastic-but-helpful critic who tells you exactly what's wrong and how to fix it
- **CI**: Machine-readable, exit-code driven, for your pipeline
- **JSON**: Structured output for tooling

## The Fix

After following the optimization plan (adding hints to tool output, moving post-call guidance out of SKILL.md):

```
Score: 50/100
```

Not perfect. But 50 points better than mute. And the path to 80+ is now clear.

## Try It

```bash
# Roast mode
npx talking-cli audit ./my-skill

# CI mode
npx talking-cli audit ./my-skill --ci

# Generate a fix plan
npx talking-cli optimize ./my-skill
```

## The Bigger Picture

Talking CLI is a bet: **within 12 months, shipping a mute CLI should feel as embarrassing as shipping un-typed Python.**

The methodology is documented in [PHILOSOPHY.md](https://github.com/DrDexter6000/talking-cli/blob/master/PHILOSOPHY.md). The theoretical anchor is [Tool-Scoped Progressive Disclosure](https://github.com/DrDexter6000/talking-cli/blob/master/docs/CN-001-tool-scoped-progressive-disclosure.md).

Code is MIT. Issues welcome. Roast me back.

---

*Posted to HN / Twitter / Anthropic Community. Cross-posts welcome.*
