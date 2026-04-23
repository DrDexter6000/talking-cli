# Launch Post: I asked a linter to review my own AI skill. It called me fat.

> ⚠️ **ARCHIVED** — This draft was written for v0.3.0. The project is now at v0.6. Benchmark data and feature descriptions are outdated. Retained for historical reference only; do not use for current project documentation.

**TL;DR**: I built a linter that audits agent skills across four dimensions. It roasts your code because it cares. It's called Talking CLI, and it just shipped v0.3.0 (H1–H4).

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

It's a linter for the **skill/tool contract**, not your Python quality. It checks four things:

1. **H1 · Document Budget**: Is your SKILL.md under 150 lines? If not, you're stuffing tool-level guidance into a static document.
2. **H2 · Fixture Coverage**: Do your tools have fixtures that prove they handle error and empty-result scenarios?
3. **H3 · Structured Hints**: Do your tool outputs actually *contain* hint fields — `hints`, `suggestions`, `guidance` — or just raw data?
4. **H4 · Actionable Guidance**: Are those hints *useful*? "Try again" is too short. "Try broadening your query with fewer filters" is actionable.

It outputs in three modes:
- **Coach** (default): A sarcastic-but-helpful critic who tells you exactly what's wrong and how to fix it
- **CI**: Machine-readable, exit-code driven, for your pipeline
- **JSON**: Structured output for tooling

## The Fix

After following the optimization plan:

```
Score: 50/100
```

Not perfect. But 50 points better than mute. And the path to 80+ is now clear:
- H1: Cut SKILL.md from 457 → 150 lines by moving post-call guidance into tool hints
- H2: Add fixtures for the 5 mute tools
- H3: Make every tool return a `hints` field
- H4: Write hints that actually tell the agent what to do next

## Try It

```bash
# Roast mode
npx talking-cli audit ./my-skill

# CI mode
npx talking-cli audit ./my-skill --ci

# Generate a fix plan
npx talking-cli optimize ./my-skill
```

## Roadmap

P3 is in progress. `optimize --apply` (auto-fix with git branch safety) and the 9-step complex skill workflow are coming next.

## The Evidence (Updated)

We didn't just theorize. We ran a controlled benchmark on MiniMax M2.7 Highspeed comparing an 887-line bloated SKILL.md against a 170-line Talking CLI version across 10 filesystem tasks.

| Metric | Bloated | Talking | Delta |
|--------|---------|---------|-------|
| Initial prompt | 8,716 tokens | 1,370 tokens | **−84.3%** |
| Total tokens | 16,228 tokens | 6,137 tokens | **−62.2%** |
| Pass rate | 80% | **90%** | **+10pp** |

The agent with the smaller prompt actually performed *better* because it received hints at the exact moment it needed them, instead of hunting through a 400-line document.

**Cost impact per 1,000 tasks** (based on measured token ratios):

| Model | Bloated cost | Talking cost | Savings |
|-------|-------------|--------------|---------|
| MiniMax M2.7 Highspeed | $15.50 | $10.80 | **$4.70 (30%)** |
| Claude 3.5 Sonnet (est.) | $78.00 | $54.00 | **$24.00 (30%)** |
| GPT-4o (est.) | $52.00 | $36.00 | **$16.00 (30%)** |
| Gemini 1.5 Pro (est.) | $26.00 | $18.00 | **$8.00 (30%)** |

*Estimates for non-MiniMax models use the same token-consumption ratio; actual prices vary by provider.*

## The Bigger Picture

Talking CLI is a bet: **within 12 months, shipping a mute CLI should feel as embarrassing as shipping un-typed Python.**

The methodology is documented in [PHILOSOPHY.md](https://github.com/DrDexter6000/talking-cli/blob/master/PHILOSOPHY.md). The theoretical anchor is [Tool-Scoped Progressive Disclosure](https://github.com/DrDexter6000/talking-cli/blob/master/docs/CN-001-tool-scoped-progressive-disclosure.md).

Code is MIT. Issues welcome. Roast me back.

---

*Posted to HN / Twitter / Anthropic Community. Cross-posts welcome.*
