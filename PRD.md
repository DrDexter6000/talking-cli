# Talking CLI — Product Requirements Document

**Version**: 0.1 (draft)
**Status**: Pre-MVP, roadmap locked
**Last updated**: 2026-04-18
**Owner**: Project founder
**Source of truth**: This document supersedes [HANDOFF.md](HANDOFF.md). Phase-level TDD plans MUST reference this PRD by section.

---

## 0 · Context & Lineage

Talking CLI emerged from the Round 10 final review of a personal project called `life-index` (journal search + write CLI). That review concluded:

> "Search quality is no longer only a retrieval-tuning problem — it requires a new agent/tool collaboration boundary."

That boundary — between what `SKILL.md` should carry and what tool output should carry — had no name, no rules, and no budget in the public literature. CN-001 formalized the concept. This project packages it for distribution.

**Lineage chain**:
```
life-index Round 10 (practical pain)
    ↓ conceptualized as
CN-001 Tool-Scoped Progressive Disclosure (academic anchor)
    ↓ popularized as
Talking CLI (methodology / public narrative)
    ↓ operationalized as
talking-cli (linter / CLI tool)
```

---

## 1 · Problem Statement

Every guide on agent skills tells developers to optimize `SKILL.md`. **Nobody talks about the silent return values of their tools.** The result:

1. `SKILL.md` grows to hundreds of lines trying to anticipate every scenario.
2. Tools return raw data with no structured guidance.
3. Agents waste tokens re-reading rules on every call that could have been said once, at the moment they mattered, inside the tool response.

**Concrete evidence** (from [life-index audit, 2026-04-18](#appendix-a-life-index-audit)):
- SKILL.md was **457 lines — 3.0× over the 150-line budget**.
- Only 1 of 6 tools had a hint system; the other 5 were "mute".
- "Must check `needs_confirmation`" was repeated **4 times** in SKILL.md while also being surfaced at runtime — pure budget waste.

This is not an edge case. This is the default shape of agent skills today.

---

## 2 · Vision & Non-Goals

### Vision

**Make it embarrassing to ship a mute CLI.**

Ship a methodology + a linter + a vocabulary that turns "tool returns raw data and says nothing" from "normal" into "obviously undercooked." Within 12 months, a skill author should feel the same social pressure about tool silence that they feel today about un-typed Python.

### Goals (in scope)

- **G1**: A stable, teachable methodology (PHILOSOPHY.md + CN-001). Already drafted.
- **G2**: A linter (`talking-cli`) that audits SKILL + tool combos against the four heuristics.
- **G3**: A **plain-language "coach mode"** that translates technical audit findings into actionable guidance a non-specialist can follow — diagnose the problem, explain the fix, skip the jargon.
- **G4**: A strict `--ci` mode for teams integrating it into pipelines.
- **G5**: One killer demo: a real SKILL.md audited and visibly improved.
- **G6**: An **`optimize` command** that proposes concrete fixes. Default: writes a review-able plan document, never modifies source files. Opt-in `--apply`: creates a `talking-cli/optimize-*` branch with committed changes so the user can diff / revert. The user's skill is never silently rewritten.

### Non-Goals (explicitly out of scope)

- **NG1**: Generic code linting. We lint the **skill/tool contract**, not Python/JS quality.
- **NG2**: IDE plugin (VSCode / Cursor) in v1. CLI first.
- **NG3**: Runtime enforcement (blocking tool calls). We audit, we don't gate execution.
- **NG4**: Supporting non-agent CLIs. This is for tools meant to be called by LLM agents.
- **NG5**: A web dashboard. If it's not a 5-minute `npx` experience, we've failed.

---

## 3 · Users & Personas

### P1 · "The Skill Author" — PRIMARY

Builds agent skills (Anthropic Skills, MCP servers, custom CLIs for Claude Code / Cursor / Aider). Has felt the SKILL.md bloat pain but lacks vocabulary for it. **Success signal**: they run `npx talking-cli` and say "ouch, fair".

### P2 · "The CI Integrator"

Works at a company shipping agent tooling. Wants a pass/fail gate in PR review. **Success signal**: they add `talking-cli --ci` to their pre-commit or GitHub Actions.

### P3 · "The Social Amplifier"

Reads Twitter / HN / Anthropic Discord. Doesn't build skills themselves but shares content about them. **Success signal**: they screenshot the coach-mode output and post it.

> Persona priority: **P1 ≫ P3 > P2**. P3 drives adoption of P1 via memetic spread. P2 is a nice-to-have that legitimizes the project but doesn't drive growth.

---

## 4 · Prompt Surface Thesis (Theoretical Anchor)

Formal statement in [docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md). One-line summary:

> **Prompt Surface = SKILL.md ∪ {tool_result.hints}** — two halves, one budget. Misplacing guidance in the wrong half is the most common failure mode in agent skill design.

Four channels (C1–C4 in CN-001 terminology):
- **C1 Contract** — what `SKILL.md` declares statically
- **C2 Handshake** — schema-level tool I/O
- **C3 Voice** — runtime hints / ambiguity signals in tool output ← **most underdeveloped**
- **C4 Judgment** — agent's chain-of-thought reasoning

Talking CLI is primarily about **C3**.

---

## 5 · Product Surface

### 5.1 CLI form

```bash
# === Audit: diagnose the problem ===

# Default: coach mode — plain language, non-specialist friendly
npx talking-cli audit <skill-dir>

# CI mode — machine-readable, no voice
npx talking-cli audit <skill-dir> --ci

# JSON mode — IDE / tooling integration
npx talking-cli audit <skill-dir> --json

# Persona switching (future)
npx talking-cli audit <skill-dir> --persona nba-coach
npx talking-cli audit <skill-dir> --persona british-critic
npx talking-cli audit <skill-dir> --persona zen-master

# === Optimize: propose the fix ===

# Default: plan-only. Writes TALKING-CLI-OPTIMIZATION.md at the skill root.
# Does NOT touch any source file. User reads, decides, applies manually.
npx talking-cli optimize <skill-dir>

# Opt-in: apply on a new git branch. Requires clean working tree.
# Refuses to run outside a git repo.
npx talking-cli optimize <skill-dir> --apply
#   → creates branch  talking-cli/optimize-YYYYMMDD
#   → commits each fix as a separate commit (traceable to one heuristic)
#   → leaves the user to review / merge / discard
```

**`optimize` safety contract (non-negotiable)**:
1. Default behavior **never modifies source files** — only writes the plan doc.
2. `--apply` refuses to run if: (a) not in a git repo, or (b) working tree is dirty.
3. Each applied change is a separate commit with message `[H#] <what> → <why>`, so a user can cherry-pick or revert individual fixes.
4. Every proposed change traces back to a specific heuristic violation from the audit. No "while we're here" drive-by edits.

### 5.2 Output architecture

```
┌──────────────────────────────────────────────────┐
│  Scoring Engine (single source of truth)         │
│  H1 line-count · H2 hint-coverage ·              │
│  H3 hint-budget · H4 duplication                 │
└────────────┬─────────────────────┬───────────────┘
             ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ Coach Renderer  │   │  CI / JSON       │
    │  (default)      │   │  Renderer        │
    └─────────────────┘   └─────────────────┘
```

**Non-negotiable**: scoring logic is never duplicated across renderers. Tone is a renderer concern; verdicts are an engine concern.

### 5.3 Coach mode design constraints

- **Plain language first** — a non-specialist should be able to read the output and know exactly what's wrong and what to do next, with no jargon lookups
- **Critique the artifact, never the author** — the SKILL.md is the subject, not the person who wrote it
- **Every finding pairs with an actionable fix** — no complaint is shipped without a concrete next step
- **Honest about heuristic limits** — when a rule uses a noisy method (e.g. H4 cos-sim on mixed CN/EN text), the output says so, not pretends to be oracle-grade
- **Readable out of context** — each finding should make sense without needing to read the whole report
- **Personality is welcome** — tone, warmth, and humor are allowed and often improve comprehension; they are means to clarity, not ends in themselves

---

## 6 · Heuristics → Lint Rules

| # | Heuristic | What it checks | Detection mode |
|---|-----------|----------------|----------------|
| **H1** | `SKILL.md` ≤ 150 lines (excluding frontmatter) | Static line count | Static only |
| **H2** | Every tool's error + zero-result paths emit a hint | Fixture-driven probe of tool responses | Static (schema) + Dynamic (fixture runner) |
| **H3** | Single response emits ≤ 3 hints | Schema inspection + runtime sampling | Static + Dynamic |
| **H4** | No advice appears in both `SKILL.md` and hints | Semantic similarity (cos-sim > 0.75) | Static (embedding) |

**Open detection questions** (move to §9 if unresolved by phase planning):
- H1: include/exclude code blocks in line count?
- H2: how to require users to provide fixtures without friction?
- H3: is static `MAX_HINTS` constant enough, or must we actually run the tool?
- H4: cos-sim threshold for mixed CN/EN text — needs empirical tuning

---

## 7 · Roadmap

### P0 · Validation — "prove it's worth doing" (1–2 weeks)

| # | Action | Exit criterion |
|---|--------|----------------|
| 0.1 | Tagline A/B test (2–3 skill authors) | Winning version locked for README |
| 0.2 | ✅ **DONE** — human-executed audit of `life-index` against H1–H4 | Produced 38/100 report with specific fix list |
| 0.3 | Draft 3 coach personas (NBA coach · British critic · Zen master) | Pick default by reaction from 2 non-AI-circle friends |

**Gate to P1**: If 0.3 produces a persona that makes readers want to screenshot → proceed. If not → stop, rework narrative.

### P1 · MVP — `talking-cli` minimally running (2–4 weeks)

Dependency graph:
```
1.1 Node stack selection
       ↓
1.2 Scoring Engine · H1 rule (line count)
       ↓
1.3 Scoring Engine · H2 rule (fixture-driven hint detection)
       ↓
   ┌───┴────────────────────┐
1.4 Coach Renderer    1.5 CI / JSON Renderer
       └───────────┬─────────┘
                   ↓
1.6 `optimize` command · plan-only mode (writes TALKING-CLI-OPTIMIZATION.md)
                   ↓
1.7 Demo: `talking-cli audit` + `optimize` on life-index, round-trip improvement
```

**Deferred to P3**: H3 / H4 rules (need real-world calibration); `optimize --apply` (needs user trust before we touch their files).

**Deliverable**: `npx talking-cli audit <dir>` produces a plain-language report a non-specialist can understand; `npx talking-cli optimize <dir>` produces a concrete fix plan that, when manually applied, measurably improves the re-audit score.

### P2 · Launch — one day, multi-platform (1–2 weeks)

| # | Action | Channel |
|---|--------|---------|
| 2.1 | License (MIT) + README Hero (from 0.1 winner) | Repo |
| 2.2 | Screenshot of coach mode as README section 2 | Repo |
| 2.3 | PHILOSOPHY §6 anti-patterns: sharpen tone · §7 add URLs | Repo |
| 2.4 | Blog post: "I asked a linter to review my own AI skill. It called me fat." | Personal blog |
| 2.5 | Simultaneous launch: GitHub + HN + Twitter + Anthropic community | All |

### P3 · Expansion — post-launch, feedback-driven (ongoing)

| # | Action | Why later |
|---|--------|-----------|
| 3.1 | H3 + H4 rules hardened | Need real SKILL.md corpus for tuning |
| 3.2 | `optimize --apply` mode (branch creation + commit per fix) | Needs audit trust + telemetry before we auto-touch user code |
| 3.3 | Quantitative benchmark: SKILL-heavy vs hints-heavy, task success rate | Paper-level artifact, not launch-critical |
| 3.4 | Cross-framework validation (Cursor / Aider / OpenHands) | Defuses "only works on Claude" objection |
| 3.5 | RFC to MCP community | Only valuable after demo exists |
| 3.6 | Community-contributed `--persona` packs | Low-cost engagement hook |

---

## 8 · Success Metrics

Success is measured by **whether `talking-cli` actually helps its users improve their skills** — not by how visible the project gets. All metrics below are observable from one's own usage data + a handful of pilot users; none require public-facing numbers.

### Dimension 1 · Diagnosis clarity

Can the audit output be understood and acted on by someone who is not a prompt-engineering specialist?

- **M1 · Comprehension**: Show coach-mode output to 3 pilot users (target: vibe coders / skill authors new to the methodology). Without additional explanation, each user can restate, in their own words, what problems their skill has and which one to fix first. *Falsifies*: coach mode is too jargon-heavy.
- **M2 · Actionability**: ≥ 80% of audit findings map to a single, concrete change the user can execute without asking for clarification. Measured by reviewing every finding in pilot runs. *Falsifies*: the tool reports problems but doesn't help solve them.

### Dimension 2 · Repair efficacy

When a user applies the tool's suggestions, does the skill actually get better?

- **M3 · Round-trip improvement**: On `life-index` (first test subject) and at least 2 other volunteer skills, re-audit score after applying the `optimize` plan improves by ≥ 15 points (out of 100). *Falsifies*: the fixes don't fix.
- **M4 · No regression**: Applying the plan does not break the skill's existing behavior. Measured by running the skill's own test suite (if any) before/after, plus a smoke test by the original author. *Falsifies*: `optimize` generates brittle or incorrect changes.

### Dimension 3 · Real-world pickup (low-ceremony)

- **M5 · Third-party run**: At least one person outside the author's immediate circle runs `talking-cli audit` on a skill they didn't write. *Falsifies*: tool is only usable by its creator.
- **M6 · Concrete merged fix**: At least one skill (anyone's, including life-index) has a change merged to its main branch that was originated by a `talking-cli` suggestion. *Falsifies*: audit findings don't survive review.

### Anti-metrics (things we explicitly do NOT chase)

- GitHub star counts within N days of launch
- Twitter / HN impressions
- "Virality" targets of any kind
- External citation counts of "Prompt Surface" terminology

These are outcomes that may or may not happen. Treating them as goals corrupts the product into a marketing vehicle and pulls design decisions toward spectacle over usefulness.

### Internal review rhythm

Re-evaluate M1–M6 at: MVP completion, launch + 30 days, launch + 90 days. If the tool is failing on Dimensions 1–2 but "succeeding" on attention, treat that as a **failure** — we shipped a meme, not a tool.

---

## 9 · Open Questions (active)

Pulled from [HANDOFF.md §未决问题](HANDOFF.md) — only the ones still undecided.

### Narrative
- **Q1**: Hero paragraph tightening — 1 more pass before launch?
- **Q2**: PHILOSOPHY §7 Related Work — specific URLs for each reference
- **Q3**: Add 1–2 non-journal examples to avoid "one person's private itch" framing

### Tooling
- **Q4**: Line-count rule — include/exclude code fences, frontmatter? (see §6)
- **Q5**: H2 fixture mechanism — convention over config, or explicit `tests/fixtures/`?
- **Q6**: H4 similarity threshold for CN/EN mixed text — needs empirical corpus

### Strategic
- **Q7**: Pre-launch RFC to Anthropic / MCP community — yes / no / when
- **Q8**: Author identity on launch — real name vs handle

### Theoretical
- **Q9**: Quantitative benchmark (P3.2) — pursue seriously or stay anecdotal?

---

## 10 · Decision Log

Chronological. New entries append to bottom. Entries are never deleted — superseded decisions are marked as such.

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-04-18 | Project name: "Talking CLI" (display) | "Mute → talking" carries the core anti-thesis; tested against "prompt loop", won | Active |
| 2026-04-18 | Hero tagline: "Your CLI is mute. That's half your prompt problem." | Names the asymmetry in 1 sentence | Active (pending 0.1 A/B) |
| 2026-04-18 | Funnel: README → PHILOSOPHY → CN-001 | Three reader types, three depths | Active |
| 2026-04-18 | Drop "agent-native vs agent-first" from main narrative | Dichotomy not sharp enough; scaffolding only | Active |
| 2026-04-18 | ~~Dual-brand: "Talking CLI" methodology + `talkback` linter~~ | Original rationale: philosophy independent from tool failure | **SUPERSEDED same day** |
| 2026-04-18 | Unify brand to `talking-cli` (methodology + CLI share one name) | Matches ESLint / Prettier precedent. Dual-brand was over-engineering: it cost reader cognition up-front to hedge a risk (tool failure) that is rename-able if it happens | Active |
| 2026-04-18 | Coach mode is MVP feature, not P2 polish | Plain-language audit output is the primary way non-specialist authors will actually act on findings. Without it, `talking-cli` is just another linter with output they can't read | Active |
| 2026-04-18 | Default = coach mode; `--ci` / `--json` are opt-in | Default output determines memetic velocity; CI teams are secondary persona | Active |
| 2026-04-18 | Coach mode reframed from "roast optimized for sharing" to "plain-language explanation for non-specialists" | Stating "social sharing" as a goal made it a marketing vehicle; the honest user value is readability for vibe coders. Spread is a byproduct, not a KPI | Active |
| 2026-04-18 | Added G6: `optimize` command with plan-only default, opt-in `--apply` | Audit alone is diagnosis without treatment. Plan-only default keeps safety; `--apply` defers to P3 until user trust is established | Active |
| 2026-04-18 | Success metrics rewritten around tool efficacy (diagnosis clarity, repair efficacy, pickup), not star/view counts | Publishing vanity targets creates bad incentives and reads as thirsty. Anti-metrics explicitly exclude stars / impressions / citations | Active |

---

## Appendix A · life-index audit (2026-04-18)

Human-executed run of H1–H4 against `D:\Loster AI\Projects\life-index`. Raw data anchor for §1 problem statement evidence.

| Heuristic | Measurement | Verdict |
|-----------|-------------|---------|
| H1 line budget | SKILL.md = 457 lines (3.0× over) | ❌ FAIL |
| H2 hint coverage | 1 / 6 tools with hint infrastructure | ⚠️ PARTIAL |
| H3 hint budget | `_MAX_HINTS = 5` (static), peak 4 observed | ⚠️ SOFT FAIL |
| H4 duplication | 3 concrete duplicated statements found | ⚠️ PARTIAL |

**Total**: 38 / 100. Full findings in conversation transcript 2026-04-18.

**Value to project**: this audit surfaced 4 concrete tooling insights that reshape MVP scope (see §6 "Open detection questions"). It is the primary evidence that the methodology generates actionable signal, not vibes.

---

## Appendix B · References

- [README.md](README.md) — 30-second pitch
- [PHILOSOPHY.md](PHILOSOPHY.md) — full methodology
- [docs/CN-001](docs/CN-001-tool-scoped-progressive-disclosure.md) — theoretical anchor
- [HANDOFF.md](HANDOFF.md) — historical snapshot (superseded by this PRD)
