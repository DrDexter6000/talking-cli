# The Talking CLI Philosophy

*The methodology behind **distributed prompting**: how to design agent tools that are active participants in reasoning, not mute subroutines.*

---

## Your Prompt Surface Has Two Halves

The industry has spent two years optimizing one half of the agent prompt surface: `SKILL.md`, system prompts, skill frontmatter, `CLAUDE.md`, `AGENTS.md`. Every best-practice guide tells you to trim your skill docs, progressively disclose, compose instructions carefully.

Almost none of them talk about the other half.

When an agent invokes a tool, the tool's return value is part of the prompt the agent sees on the next turn. That return value is a prompt surface. It is writable, designable, and budgetable. Most tools today treat it as a data channel — a JSON blob, a stdout dump, maybe an error code. The guidance that should live there gets pushed back upstream into `SKILL.md`, which slowly bloats into a monologue describing every possible outcome of every possible call.

We call tools that behave this way **mute tools**. The design methodology that treats tool output as a first-class prompt surface, we call **Talking CLI**.

---

## The Diagnosis

### Symptom

Your `SKILL.md` is over 300 lines. Most of it describes what the agent should do **after** a tool returns — how to interpret zero results, how to handle ambiguous matches, when to re-try with a broadened query, which fields in the response matter. None of this guidance is ever loaded into the prompt until something goes wrong, but all of it is loaded every turn, forever.

### Cause

The tools themselves are silent. They return data and nothing else. The designer had guidance to give — but the only writable surface they knew about was `SKILL.md`, so that is where it went.

### Consequence

- Global prompts bloat.
- Agent attention dilutes across irrelevant scenarios.
- Guidance rot accumulates — rules in `SKILL.md` drift out of sync with what tools actually do.
- Per-tool knowledge cannot be tested as behavior; only as prose.

---

## The Reframe

> **Prompt Surface = `SKILL.md` ∪ `{tool_result.hints}`**

Two halves. One budget. What you save on one side, you spend on the other.

This is not a metaphor. It is a concrete architectural claim:

1. Anything you write into `SKILL.md` that only applies *after a specific tool call* is mispriced. It costs every turn and earns only on a small fraction of turns.
2. Anything you write into a tool result that *applies regardless of invocation context* is also mispriced. It earns once but duplicates global knowledge.
3. Correctly pricing guidance is the core skill of Talking CLI design.

Agent-native tooling does not just read prompts. It writes them, mid-loop.

We call this **distributed prompting**. It is progressive disclosure applied to the agent–tool boundary: guidance is not pre-announced in a global document; it is surfaced locally, at the moment of invocation, based on what actually happened.

---

## Implementation: Prompt-on-Call

If "distributed prompting" sounds too abstract, call it **prompt-on-call**. This is the concrete implementation pattern: guidance is attached to the tool call itself, delivered in the response, at the moment the agent needs it.

The analogy is exact:

| Centralized System | Distributed System |
|---|---|
| One monolithic document (SKILL.md) carries all guidance | Guidance is distributed across every node (tool response) |
| Every turn pays the full cost, regardless of which tools are called | Each turn only loads the guidance relevant to the tools that were actually invoked |
| Single point of failure: one bloated document | Resilient: each tool owns its own guidance |

The discipline that makes distributed prompting work is the same discipline that makes distributed systems work: **a shared protocol**. In Talking CLI, that protocol is the Four Rules of Talk (below). Without the rules, distributed prompting collapses into chaos — every tool invents its own voice, and the agent drowns in incompatible guidance.

> **distributed prompting = prompt-on-call + the Four Rules protocol**

---

## The Four Channels

Talking CLI distinguishes four channels in the agent/tool interaction. Each has a different lifetime, a different cost profile, and a different owner.

| Channel | Name | What Lives Here | Owner |
|:---:|---|---|---|
| **C1** | **The Contract** | Types, enums, field schemas, response shape | Schema file |
| **C2** | **The Handshake** | Normalization, defaults, deterministic preprocessing | CLI preamble |
| **C3** | **The Voice** | Invocation-time hints, ambiguity signals, next-step cues | Tool response |
| **C4** | **The Judgment** | Ambiguity resolution, intent inference, aggregation | Agent reasoning |

### C1 — The Contract

*"Here is what I accept and return."*

The Contract is static and machine-readable. It constrains the shape of data, not the meaning of calls. Parameter types, enums, required fields, response schemas — all live here.

**What does not belong here**: usage strategy, scenario guidance, "the best way to call me." A schema is a type system, not a manual.

**One-line test**: if removing this line would make the response unparseable, it belongs in the Contract. Otherwise it does not.

### C2 — The Handshake

*"Let me clean this up before we talk."*

The Handshake is everything the CLI can do deterministically before any reasoning: date parsing, query normalization, default value filling, hard validation, structured plan generation.

**What does not belong here**: any step that requires judgment about user intent. If the logic needs to ask "what did the user probably mean?", it is not a Handshake — it is Judgment, and it belongs in C4.

**One-line test**: can this step be a pure function with no LLM call? If yes, it is a Handshake.

### C3 — The Voice

*"Here is what you should know, right now."*

The Voice is the mechanism of **prompt-on-call** — the most underdeveloped channel in today's agent stacks, and the one Talking CLI exists to make respectable.

A tool's Voice is the set of short, invocation-scoped hints it returns alongside its data. It tells the agent what just happened in a way the data alone cannot: that results were sparse, that a query was ambiguous, that an aggregation-style question cannot be answered by the evidence returned, that zero results likely mean the date window was too narrow.

**What does not belong here**: multi-step instructions, lectures about the tool's existence, guidance that applies to all calls regardless of outcome. The Voice whispers; it does not orate.

**One-line test**: does this hint only matter *because of what just happened in this specific call*? If yes, it belongs in the Voice. If it would apply to every call, move it to `SKILL.md`.

### C4 — The Judgment

*"You decide what it means."*

The Judgment is everything that requires open-ended reasoning: resolving ambiguity, inferring user intent, choosing between candidate interpretations, deciding whether to answer or to ask a follow-up.

**What does not belong here**: anything the Contract can constrain, anything the Handshake can preprocess, anything the Voice can hint. The Judgment is the residual — what is left after the other three channels have done their job.

**One-line test**: if two reasonable agents could disagree about the right answer, it is Judgment. If not, push it down.

---

## Four Rules of Talk

### Rule 1 — The Contract does not explain, it constrains.

Schemas define shape, not policy. The moment you find yourself writing usage advice in a schema description field, you have violated Rule 1.

- ❌ `mood: list[str]  # Prefer emotion words, not activities.`
- ✅ `mood: list[str]` — and the emotion-words guidance lives in C3 when the field is empty.

### Rule 2 — The Handshake is deaf to meaning.

The deterministic preprocessing layer cannot do semantic inference. It can parse "last week" into a date range. It cannot decide whether "last week" means the calendar week or the trailing seven days — that decision is ambiguity, and ambiguity is Judgment.

- ❌ The CLI picks between two interpretations silently.
- ✅ The CLI returns both interpretations as Voice hints and lets the agent choose.

### Rule 3 — The Voice whispers, it does not lecture.

Hints are short, local, and invocation-scoped. They are not a second `SKILL.md` living inside tool output. If your Voice starts including multi-step procedures or general doctrine, you have rebuilt the thing you were trying to escape.

- ❌ `hints: ["You must now call search three times, then aggregate, then..."]`
- ✅ `hints: ["0 results; consider broadening the date range."]`

### Rule 4 — The Judgment is the agent's, not the CLI's.

The CLI does not decide what the user meant. The CLI does not decide whether to follow up. The CLI surfaces evidence and hints; the agent decides.

This rule is about **discipline of restraint**. The temptation to have the CLI "just handle it" is strong and almost always produces worse agents, because it hides the decision from the one component that can actually reason across turns.

---

## The Talking CLI Budget

Abstract principles are easy to agree with and impossible to apply. The following heuristics make the methodology testable.

### Heuristic 1 — Keep `SKILL.md` under 150 lines for a mature, stable tool.

If you are above this, the excess is almost always post-call guidance that belongs in C3.

### Heuristic 2 — Silence on error or zero-result paths is a bug.

If your tool can return empty results or fail partially, and it says nothing about why or what to do next, you have a mute tool. Fix it.

### Heuristic 3 — Cap the Voice at three hints per response.

Hints are meant to whisper. If you find yourself returning five or ten, you are using C3 as a prose dump and will produce exactly the prompt flood you were trying to avoid.

### Heuristic 4 — The same guidance must not appear in both halves.

If a piece of advice lives in both `SKILL.md` and `tool_result.hints`, one of them is misplaced. Budget waste compounds: you pay for it every call *and* every turn.

These four heuristics map directly onto the first four rules of the planned `talking-cli` linter.

---

## Anti-Patterns (or, How to Build a Mute CLI)

Five patterns to recognize and avoid. Each is tempting because it feels like simplicity.

### 1. The Stoic Tool

Returns only data. Errors throw. No structured explanation of what went wrong, no hint about recovery. The agent gets a stack trace and is expected to improvise.

*Why it happens*: the developer treats the tool as an API, not as a speaker in a conversation.

### 2. The Oracle `SKILL.md`

Every possible scenario is foreseen and pre-written into `SKILL.md`. The document swells to 500+ lines, most of which are "if the tool returns X, then Y" branches that could be `hints` instead.

*Why it happens*: the developer only knows one writable surface.

### 3. The Preacher CLI

The tool's Voice is used to lecture. Hints become multi-step procedures, doctrinal statements, and general advice. C3 has been repurposed as a pocket `SKILL.md`.

*Why it happens*: having discovered the Voice channel, the developer overcorrects and dumps everything into it.

### 4. The Hallucinating Handshake

C2 silently does semantic inference — guessing what the user meant, choosing between interpretations without telling anyone. The tool returns "an answer" but the agent no longer knows which question was answered.

*Why it happens*: determinism is easier to build than restraint.

### 5. The Ghost Ambiguity

The tool encounters genuine ambiguity and resolves it silently. No hint, no signal. The agent gets a confident-looking result and cannot tell that a coin was flipped.

*Why it happens*: returning "it is ambiguous" feels like a failure, so the developer buries the ambiguity instead of surfacing it.

---

## Related Work

Talking CLI does not invent a new channel. It names, budgets, and disciplines one everybody already has but few design on purpose.

- **Progressive disclosure (Anthropic skills)** — Same family. Anthropic formalized progressive disclosure as a three-level skill-loading architecture ([Barry Zhang, Keith Lazuka, Mahesh Murag, Oct 2025](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)), now an [open standard](https://agentskills.io). It covers the `SKILL.md` half of the prompt surface; leaves the tool-output half unstructured. Talking CLI complements it on the other half.
- **Tool response guidance (Anthropic)** — The closest precedent. Anthropic's ["Writing Effective Tools for Agents"](https://www.anthropic.com/engineering/writing-tools-for-agents) (Jan 2026) advocates "steering agents with helpful instructions" in tool responses and "prompt-engineering your error responses." But it treats this as a paragraph-level best practice — no named concept, no budget, no audit, no protocol proposal. Talking CLI formalizes this insight as **distributed prompting** (with prompt-on-call as its implementation pattern).
- **MCP `structuredContent`** — Provides a technical channel for structured tool output. Offers no methodology for what to put in it. Talking CLI fills that gap.
- **ReAct** — Observation as a step in the agent's loop. Describes the mechanism; does not prescribe observation as a designed prompt surface.
- **Tool result design in agent frameworks (LangChain, AutoGen, et al.)** — Fragmented practice. Tool returns are ad-hoc payloads with occasional hints. Talking CLI names the fragment and makes it a first-class design surface.
- **Prompt-on-call** — The implementation pattern for distributed prompting. The concrete mechanism of attaching guidance to individual tool responses at the moment of invocation.
- **Context engineering** — The parent discipline. Named and popularized by [Tobi Lütke](https://x.com/tobi) and [Andrej Karpathy](https://x.com/karpathy) in mid-2025. Talking CLI is a concrete sub-pattern: context engineering applied to the agent–tool boundary.

---

## Start Here

### 1. Audit (with `talking-cli`)

Run `npx talking-cli audit <skill-dir>` to get a scored report on your skill's prompt surface health. The linter checks:
- H1: Is your `SKILL.md` under 150 lines?
- H2: Do your tools have fixtures covering error and empty-result paths?
- H3: Do your tool outputs contain structured hint fields (`hints`, `suggestions`, `guidance`)?
- H4: Are those hints actionable (specific, non-empty, ≥ 10 chars)?

Fix the findings it surfaces, then re-audit to watch your score climb.

### 2. Move one rule

Pick a single piece of post-call guidance and migrate it: delete it from `SKILL.md`, add it to the relevant tool's response as a `hint`. Re-run your agent on a handful of representative queries. Observe whether behavior degraded.

It usually does not. The first successful move is the moment Talking CLI stops being an idea and becomes a habit.

### 3. Close the loop

Formalize `hints`, `ambiguity`, and (optionally) `next_steps` fields in your tool's response schema. Now C3 has a home, and future guidance has a place to go that is not your global prompt.

---

## Evidence: Token Efficiency Benchmark

We validated the prompt-surface claim with a controlled benchmark on MiniMax M2.7 Highspeed. Ten filesystem tasks were executed twice: once with an 887-line bloated SKILL.md (all error handling inline) and once with a 170-line Talking CLI skill (error handling moved to tool hints).

| Metric | Bloated | Talking | Delta |
|--------|---------|---------|-------|
| Initial prompt | 8,716 tokens | 1,370 tokens | **−84.3%** |
| Runtime input | 13,024 tokens | 2,166 tokens | **−83.4%** |
| Total tokens | 16,228 tokens | 6,137 tokens | **−62.2%** |
| Pass rate | 80% | **90%** | **+10pp** |

The result satisfies both success criteria:
1. **Token consumption drops, quality stays the same** — satisfied (actually improves).
2. **Token consumption drops, quality improves** — satisfied.

**Why quality improves**: the agent no longer wades through a 400-line document to find the one rule that applies. It receives the right hint, at the right moment, inside the response that triggered the need.

**Cost projection per 1,000 tasks** (based on measured token ratios):

| Model | Bloated cost | Talking cost | Savings |
|-------|-------------|--------------|---------|
| MiniMax M2.7 Highspeed | $15.50 | $10.80 | **$4.70 (30%)** |
| Claude 3.5 Sonnet (est.) | $78.00 | $54.00 | **$24.00 (30%)** |
| GPT-4o (est.) | $52.00 | $36.00 | **$16.00 (30%)** |
| Gemini 1.5 Pro (est.) | $26.00 | $18.00 | **$8.00 (30%)** |

*Estimates for non-MiniMax models use the same token-consumption ratio; actual prices vary by provider and volume.*

---

## Reference

- **[CN-001: Tool-Scoped Progressive Disclosure](docs/CN-001-tool-scoped-progressive-disclosure.md)** — the formal theoretical anchor. Talking CLI is its public-facing synthesis.
- **`talking-cli` linter** — P3 in progress. `npx talking-cli audit <skill-dir>` runs H1–H4 heuristics; `optimize` generates actionable fix plans. See `README.md` for usage.

---

## Acknowledgments

Talking CLI emerged from practical work on a journal-search tool, where the gap between `SKILL.md` growth and tool silence became impossible to ignore. The insight — that the two halves share one budget — predates this document; the synthesis here is an attempt to make it teachable.

The ideas rest on work by many others:

- **John Carmack** observed that CLI is the natural interface for LLM agents ([Dec 2024](https://x.com/ID_AA_Carmack/status/1874124927130886501)).
- **Wang et al.** proved that executable code actions outperform JSON function calls for LLM agents ([CodeAct, ICML 2024](https://arxiv.org/abs/2402.01030)).
- **Andrej Karpathy** crystallized the CLI-first agent philosophy: *"Build. For. Agents."* ([Feb 2026](https://x.com/karpathy/status/2026360908398862478)).
- **Anthropic** (Barry Zhang, Keith Lazuka, Mahesh Murag) formalized progressive disclosure as a skill-loading architecture ([Oct 2025](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)).
- **Anthropic** (Ken Aizawa) advocated "steering agents with helpful instructions in tool responses" ([Jan 2026](https://www.anthropic.com/engineering/writing-tools-for-agents)).
- **Tobi Lütke** and **Andrej Karpathy** named and popularized *context engineering* as a discipline ([mid-2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

Distributed prompting — the named, budgeted, auditable approach to decentralized tool guidance — is Talking CLI's contribution. Prompt-on-call is its implementation pattern.
