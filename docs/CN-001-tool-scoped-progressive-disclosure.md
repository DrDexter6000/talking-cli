# CN-001: Tool-Scoped Progressive Disclosure

**Status**: Draft
**Date**: 2026-04-18
**Scope**: Cross-cutting agent/tool interaction model
**Relation to Talking CLI**: This is the formal theoretical anchor. `PHILOSOPHY.md` is its public-facing synthesis.

---

## Context

Agent-native systems often accumulate too much guidance in one place. In practice, this shows up as:

1. **Global document bloat.** A single file — `SKILL.md`, `CLAUDE.md`, `AGENTS.md`, or equivalent — is made to carry tool discovery, responsibility boundaries, scenario routing, and fine-grained usage guidance all at once. The global prompt grows, and the agent's attention dilutes.

2. **Local knowledge cannot be disclosed on demand.** The details a specific tool actually needs are only relevant at the moment that tool is invoked. Pre-loading them into the global document pays a token and attention cost on every turn, whether or not those details are needed.

3. **Soft rules are hard to test.** When "how to call this tool and what to do in each situation" is written only in prose, behavior depends on model memory and interpretation. These rules are unverifiable, not stably regressible, and hard to reuse across agents.

A structure is needed that separates:

- Global rules
- Tool contracts
- Runtime local hints
- Agent judgment

---

## Decision

Adopt **Tool-Scoped Progressive Disclosure** as the recommended conceptual model for agent/tool interaction.

Its core claim:

> **Let the global document retreat to "thin router + invariants." Let each specific tool disclose its own local context at the moment it is called.**

This is not about pushing more prompt content at the agent. It is about layering context:

- What should be static lives in schema / contracts.
- What should be deterministically executed lives in CLI preprocessing.
- What is only relevant at invocation time lives in invocation-time hints.
- What requires model judgment is left to agent reasoning.

---

## The Four-Layer Model

| Layer | Name | What Lives Here | Boundary Rule |
|:---:|---|---|---|
| **L1** | **Schema Contract** | Parameter types, frontmatter schema, enums, field constraints, response shape | Static, machine-readable; carries no prose guidance |
| **L2** | **Deterministic Preprocessing** | Normalization, default filling, date parsing, structured plan generation, hard validation | Purely deterministic; does not handle ambiguity |
| **L3** | **Invocation-Time Hints** | Short, per-call hints, ambiguity signals, edge-case notes | Short, ephemeral, single-tool scope; never preloaded into the global prompt |
| **L4** | **Agent Reasoning** | Ambiguity handling, user follow-up, aggregation judgment, explanation, cross-tool orchestration | Consumes L1–L3; owns all non-deterministic judgment |

In the public-facing `PHILOSOPHY.md`, these are restated as C1 (Contract) / C2 (Handshake) / C3 (Voice) / C4 (Judgment). The layer numbers are preserved here for citation stability.

---

## Boundary Rules

### Rule 1 — L1 does not explain, only constrains

The Schema Contract exists to express:

- Which fields exist
- What their types are
- Which values are legal
- What the response shape looks like

It does not carry:

- Usage strategy
- Scenario notes
- "The best way to call this"

For example:

- `mood: list[str]` belongs in L1.
- "Mood should prioritize emotion words, not activities" does not belong in L1 — it belongs in L3 or in external documentation.

### Rule 2 — L2 performs only deterministic transformation

Deterministic Preprocessing may handle:

- Date normalization
- Query normalization
- Structured plan generation
- Default parameter filling
- Required-field validation

It must not handle:

- Open-ended judgments like "what did the user probably mean?"
- Fuzzy semantic inference
- Strategic choices such as "should we ask a follow-up or just answer?"

### Rule 3 — L3 is tool-scoped, not an extension of the global prompt

Invocation-Time Hints are not a way to smuggle `SKILL.md` content into tool output. They provide local context for the current tool, at the moment of the current call.

They should be:

- **Only valid for the current call**
- **Bound to a single tool or command**
- **Short, descriptive, non-directive**

For example:

- `0 results found; consider broadening the date range`
- `aggregation requires agent judgment; search returns an evidence set, not a final answer`

They should not read like:

- "You must now call search three times"
- "Follow these 12 steps of reasoning"

That is how hints collapse back into a long system prompt.

### Rule 4 — L4 owns ambiguity judgment

Only Agent Reasoning handles:

- Ambiguity interpretation
- Intent understanding
- Selection among multiple candidates
- Aggregation of conclusions and expression of uncertainty

The CLI must not take on this kind of open-ended responsibility.

---

## Relation to Existing Terms

Tool-Scoped Progressive Disclosure is not a newly invented universe. It is a cleanly named sub-pattern of existing ideas.

### Closest adjacent terms

| Term | Why it is close | Why it is not sufficient |
|---|---|---|
| **Context Engineering** | The parent discipline — "the right context at the right time." Named and popularized by [Tobi Lütke](https://x.com/tobi) and [Andrej Karpathy](https://x.com/karpathy) in mid-2025; [formalized by Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (Sept 2025). | Too broad; does not specify this architecture |
| **Progressive Disclosure** | Accurately describes the "on-demand" principle. [Formalized for skill-loading by Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) (Barry Zhang, Keith Lazuka, Mahesh Murag, Oct 2025) as a three-level architecture (metadata → instructions → resources). | Covers the `SKILL.md` half of the prompt surface; does not describe the tool-output half or the agent/tool layering |
| **Tool Response Guidance** | [Anthropic advocates](https://www.anthropic.com/engineering/writing-tools-for-agents) "steering agents with helpful instructions" in tool responses (Jan 2026). | Paragraph-level best practice — no named concept, no budget, no audit, no protocol proposal |
| **Dynamic / Event-Driven Context Injection** | Very close to the runtime injection mechanism | Does not fully capture "tool-scoped + thin global router" |
| **Tiered Skill Architecture** | Close to the "router + body" structure | Usually applied to skill loading; does not always cover CLI runtime hints |
| **Just-In-Time Tooling / JIT Context** | Emphasizes on-demand loading | Leans toward tool discovery; does not focus on hint injection |

So this concept is best understood as:

> **A nameable, reusable sub-pattern inside Context Engineering.**

---

## Canonical Example — `search_journals`

The reference example for CN-001 is a journal-search tool. The mapping below shows how each layer maps to a real implementation, without coupling the concept to any specific project.

### L1 — Schema Contract

- JSON schema for parameters and return shape
- Documented types, enums, and required fields
- Response envelope including `results`, `hints`, `ambiguity`

### L2 — Deterministic Preprocessing

- Query normalization
- Date expressions parsed into structured time windows
- Topic / entity hint extraction
- Structured `search_plan` output

### L3 — Invocation-Time Hints

Fields in the response:

- `hints`
- `ambiguity`
- (Optionally) `search_plan`

These are only relevant to the current call. They must not be pre-loaded into the global skill document.

### L4 — Agent Reasoning

The agent decides:

- Whether the current ambiguity warrants asking the user
- Whether this is an aggregation query
- Whether retrieved evidence answers the question directly or only supports an answer

---

## Consequences

### Positive

1. **Shorter global prompts.** `SKILL.md` can contract significantly.
2. **More focused attention.** Agents read local hints only when the relevant tool is invoked.
3. **More testable behavior.** L2 and L3 can enter formal contracts and regression tests.
4. **Clearer responsibility boundaries.** CLI no longer carries open-ended judgment; agents are not forced to memorize every scenario in prose.
5. **Gradual evolution.** The pattern can be introduced incrementally — one tool at a time.

### Tradeoffs

1. **A new layer must be designed.** `hints`, `ambiguity`, and (optionally) `search_plan` need formal definitions.
2. **Hint growth must be restrained.** If every tool emits many hints, the pattern reverts to a prompt flood.
3. **The schema/hint boundary must be explicit.** Otherwise field semantics get duplicated across both surfaces.

---

## Anti-Patterns

The following all violate CN-001:

1. Writing every scenario into `SKILL.md`.
2. Letting the CLI emit large prescriptive prompts.
3. Letting the deterministic layer handle fuzzy semantic judgment.
4. Designing invocation-time hints as a second system prompt.
5. Collapsing schema, hint, and reasoning into a single prose blob.

---

## Adoption Guidance

If a specific implementation decision is made in the future, it should be captured in an ADR that cites this concept document, rather than modifying CN-001 itself.

For example:

- `ADR-012`: introduces `hints` field in Layer 3 for a specific tool
- `ADR-013`: introduces structured `search_plan` in Layer 2 for a specific tool

In short:

> **CN-001 defines the language and the boundaries. ADRs record specific implementation decisions.**

---

## Related

- `PHILOSOPHY.md` — the public-facing Talking CLI synthesis of this concept.
- Future ADRs that cite CN-001 as their theoretical basis.
